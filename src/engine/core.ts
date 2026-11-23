// Core types and helpers shared by the generator, propagator and UI.
//
// Cells are addressed by flat index `i = r * N + c`. Candidates and clue
// colors are bitmasks so the propagator stays fast on 7×7 boards.

export const EMPTY = 1;
export const RED = 2;
export const YELLOW = 4;
export const BLUE = 8;
export const ALL = EMPTY | RED | YELLOW | BLUE;
export const COLORS = [RED, YELLOW, BLUE] as const;
export const COLOR_MASK = RED | YELLOW | BLUE;

export type Drop = "R" | "Y" | "B";
/** Solution cell: a drop or empty. */
export type SolutionCell = Drop | ".";
/** What the player has put in a cell: nothing, a drop, or an "×" (marked empty). */
export type Mark = "" | Drop | "x";

export type ClueCode = "W" | "R" | "Y" | "B" | "O" | "G" | "P" | "K";
export type Difficulty = "easy" | "medium" | "hard";

export interface Puzzle {
  /** Stable id, e.g. "5m-12345". Regenerating from it gives the same puzzle. */
  id: string;
  size: number;
  difficulty: Difficulty;
  seed: number;
  /** Flat N×N solution. */
  solution: SolutionCell[];
  /** Flat N×N clue color masks (RED|YELLOW|BLUE bits); null = not a clue. */
  clues: (number | null)[];
}

export const DROP_BIT: Record<Drop, number> = { R: RED, Y: YELLOW, B: BLUE };
export const BIT_DROP: Record<number, Drop> = { [RED]: "R", [YELLOW]: "Y", [BLUE]: "B" };
export const DROP_NAME: Record<Drop, string> = { R: "Red", Y: "Yellow", B: "Blue" };

const CODE_BY_MASK: Record<number, ClueCode> = {
  0: "W",
  [RED]: "R",
  [YELLOW]: "Y",
  [BLUE]: "B",
  [RED | YELLOW]: "O",
  [YELLOW | BLUE]: "G",
  [RED | BLUE]: "P",
  [RED | YELLOW | BLUE]: "K",
};

export const CLUE_NAME: Record<ClueCode, string> = {
  W: "White",
  R: "Red",
  Y: "Yellow",
  B: "Blue",
  O: "Orange",
  G: "Green",
  P: "Purple",
  K: "Brown",
};

export const clueCode = (mask: number): ClueCode => CODE_BY_MASK[mask & COLOR_MASK];
export const clueName = (mask: number) => CLUE_NAME[clueCode(mask)];

export const popcount = (m: number) => {
  let n = 0;
  for (; m; m &= m - 1) n++;
  return n;
};

/** Human names for the bits in a mask, e.g. "Red or Blue". */
export function bitNames(mask: number, joiner = "or"): string {
  const names: string[] = [];
  if (mask & EMPTY) names.push("empty");
  if (mask & RED) names.push("Red");
  if (mask & YELLOW) names.push("Yellow");
  if (mask & BLUE) names.push("Blue");
  if (names.length <= 1) return names[0] ?? "nothing";
  return names.slice(0, -1).join(", ") + ` ${joiner} ` + names[names.length - 1];
}

export const cellName = (i: number, n: number) => `r${Math.floor(i / n) + 1}c${(i % n) + 1}`;

const neighborCache = new Map<number, number[][]>();
/** Orthogonal neighbors of every cell, cached per board size. */
export function neighbors(n: number): number[][] {
  let cached = neighborCache.get(n);
  if (!cached) {
    cached = [];
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        const list: number[] = [];
        if (r > 0) list.push((r - 1) * n + c);
        if (r < n - 1) list.push((r + 1) * n + c);
        if (c > 0) list.push(r * n + c - 1);
        if (c < n - 1) list.push(r * n + c + 1);
        cached.push(list);
      }
    neighborCache.set(n, cached);
  }
  return cached;
}

export interface Line {
  name: string;
  cells: number[];
}
const lineCache = new Map<number, Line[]>();
/** All rows then all columns. */
export function lines(n: number): Line[] {
  let cached = lineCache.get(n);
  if (!cached) {
    cached = [];
    for (let r = 0; r < n; r++)
      cached.push({ name: `row ${r + 1}`, cells: Array.from({ length: n }, (_, c) => r * n + c) });
    for (let c = 0; c < n; c++)
      cached.push({ name: `column ${c + 1}`, cells: Array.from({ length: n }, (_, r) => r * n + c) });
    lineCache.set(n, cached);
  }
  return cached;
}

/** The clue an empty cell would show: the set of drop colors next to it. */
export function clueAt(solution: SolutionCell[], n: number, i: number): number {
  let mask = 0;
  for (const j of neighbors(n)[i]) {
    const v = solution[j];
    if (v !== ".") mask |= DROP_BIT[v];
  }
  return mask;
}
