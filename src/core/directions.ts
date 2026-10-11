export const ALL_DIRECTIONS = [
  'left',
  'right',
  'front',
  'back',
  'front-left',
  'front-right',
  'back-left',
  'back-right',
] as const;

export type Direction = (typeof ALL_DIRECTIONS)[number];

export const DEFAULT_DIRECTIONS: readonly Direction[] = ['left', 'right', 'front'];

/** Word used for the spoken cue. */
export const SPOKEN_LABEL: Record<Direction, string> = {
  left: 'left',
  right: 'right',
  front: 'front',
  back: 'back',
  'front-left': 'front left',
  'front-right': 'front right',
  'back-left': 'back left',
  'back-right': 'back right',
};

/** Arrow rotation in degrees, clockwise from pointing up (= front). */
export const ARROW_ROTATION: Record<Direction, number> = {
  front: 0,
  'front-right': 45,
  right: 90,
  'back-right': 135,
  back: 180,
  'back-left': 225,
  left: 270,
  'front-left': 315,
};

export function isDirection(value: unknown): value is Direction {
  return typeof value === 'string' && (ALL_DIRECTIONS as readonly string[]).includes(value);
}
