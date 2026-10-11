import { ARROW_ROTATION, type Direction, SPOKEN_LABEL } from '../core/directions';
import { svg } from './dom';

/** A heavy, solid arrow pointing up, rotated to the direction. Sized by CSS. */
export function arrow(direction: Direction): SVGElement {
  const shape = svg('path', {
    // Wide head and thick shaft so the shape reads at 4 m.
    d: 'M50 4 L94 50 L68 50 L68 96 L32 96 L32 50 L6 50 Z',
    fill: 'currentColor',
    transform: `rotate(${ARROW_ROTATION[direction]} 50 50)`,
  });
  const el = svg('svg', { viewBox: '0 0 100 100', class: 'arrow', role: 'img', 'aria-label': SPOKEN_LABEL[direction] }, shape);
  return el;
}
