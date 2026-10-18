import type { Colour, Face, Num } from './types.js';

export const COLOURS: Colour[] = ['R', 'Y', 'G', 'B', 'W'];
export const NUMBERS: Num[] = [1, 2, 3, 4, 5];

/** Copies of each number in every colour: three 1s, two each of 2–4, one 5. */
export const COPIES: Record<Num, number> = { 1: 3, 2: 2, 3: 2, 4: 2, 5: 1 };

export const MAX_HINTS = 8;
export const MAX_MISPLAYS = 3;
export const MAX_SCORE = COLOURS.length * NUMBERS.length;

export const isColour = (x: unknown): x is Colour => typeof x === 'string' && (COLOURS as string[]).includes(x);
export const isNum = (x: unknown): x is Num => typeof x === 'number' && (NUMBERS as number[]).includes(x);

/** The 50-card deck, unshuffled. */
export const fullDeck = (): Face[] =>
  COLOURS.flatMap((colour) => NUMBERS.flatMap((number) => Array.from({ length: COPIES[number] }, () => ({ colour, number }))));

/** `R3` → red 3. For tests and fixtures. */
export function parseFace(code: string): Face {
  const colour = code[0];
  const number = Number(code.slice(1));
  if (!isColour(colour) || !isNum(number)) throw new Error(`Not a card: ${code}`);
  return { colour, number };
}

export const faceCode = (f: Face) => `${f.colour}${f.number}`;
