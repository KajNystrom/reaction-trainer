import type { SessionState } from '../core/session';
import { arrow } from './arrow';
import { h } from './dom';

export interface SessionViewHandlers {
  onPauseToggle: () => void;
  onStop: () => void;
  onClose: () => void;
}

const PHASE_LABEL: Record<SessionState['phase'], string> = {
  idle: 'Stopped',
  countdown: 'Starting',
  getReady: 'Get ready',
  cue: 'Go',
  rest: 'Rest',
  done: 'Done',
};

/** Full-screen session display. `update()` is cheap and called ~10×/s. */
export function sessionView(handlers: SessionViewHandlers) {
  const label = h('div', { class: 'phase-label' });
  const center = h('div', { class: 'phase-center', 'aria-live': 'assertive' });
  const progress = h('div', { class: 'progress' });
  const notice = h('div', { class: 'notice', role: 'status' });
  const pauseBtn = h('button', { type: 'button', class: 'btn big', onclick: () => handlers.onPauseToggle() }, 'Pause');
  const stopBtn = h('button', { type: 'button', class: 'btn big danger', onclick: () => handlers.onStop() }, 'Stop');
  const closeBtn = h('button', { type: 'button', class: 'btn big primary', onclick: () => handlers.onClose() }, 'Back');
  const controls = h('div', { class: 'controls' }, pauseBtn, stopBtn, closeBtn);
  const root = h('main', { class: 'view session-view' }, label, center, progress, notice, controls);

  let lastKey = '';

  function update(s: SessionState): void {
    const shownPhase = s.paused ? 'paused' : s.phase;
    root.dataset.phase = shownPhase;
    label.textContent = s.paused ? 'Paused' : s.phase === 'rest' && s.restKind === 'set' ? 'Set rest' : PHASE_LABEL[s.phase];

    const secs = Math.ceil(s.remainingMs / 1000);
    // Only rebuild the centre when what it shows changes.
    const key =
      s.phase === 'cue'
        ? `cue:${s.direction}:${s.setIndex}:${s.repIndex}`
        : s.phase === 'countdown' || s.phase === 'rest'
          ? `n:${secs}`
          : s.phase;
    if (key !== lastKey) {
      lastKey = key;
      if (s.phase === 'cue' && s.direction) {
        center.replaceChildren(arrow(s.direction));
      } else if (s.phase === 'countdown' || s.phase === 'rest') {
        center.replaceChildren(h('span', { class: 'big-number' }, formatSeconds(secs)));
      } else if (s.phase === 'getReady') {
        center.replaceChildren(h('span', { class: 'ready-dot', 'aria-label': 'Get ready' }));
      } else if (s.phase === 'done') {
        center.replaceChildren(h('span', { class: 'big-text' }, '✓'));
      } else {
        center.replaceChildren();
      }
    }

    const ended = s.phase === 'done' || s.phase === 'idle';
    const progressText = ended
      ? `${s.totalSets} × ${s.repsPerSet} reps`
      : `Set ${s.setIndex + 1}/${s.totalSets} · Rep ${s.repIndex + 1}/${s.repsPerSet}`;
    const progressKey = `${s.phase === 'rest'}:${progressText}`;
    if (progress.dataset.key !== progressKey) {
      progress.dataset.key = progressKey;
      progress.replaceChildren(
        ...(s.phase === 'rest' ? [h('span', { class: 'progress-next' }, 'Next')] : []),
        progressText,
      );
    }
    pauseBtn.textContent = s.paused ? 'Resume' : 'Pause';
    pauseBtn.hidden = ended;
    stopBtn.hidden = ended;
    closeBtn.hidden = !ended;
  }

  function setNotice(text: string): void {
    notice.textContent = text;
  }

  return { root, update, setNotice };
}

function formatSeconds(total: number): string {
  if (total < 60) return String(total);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
