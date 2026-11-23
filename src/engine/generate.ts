// Puzzle generator (port of prototype/gen.py):
// 1. random valid solution, 2. clue on every empty cell,
// 3. greedily remove clues while the logic propagator can still solve it,
// 4. difficulty = how many removed clues get handed back, plus best-of-k for hard.

import { clueAt, type Difficulty, type Puzzle, type SolutionCell } from "./core";
import { propagate } from "./propagate";
import { hashString, mulberry32, shuffle } from "./rng";
import { countSolutions } from "./solver";

export const SIZES = [5, 6, 7] as const;
export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

/** One random valid solution: per color a column permutation, all distinct per row. */
export function randomSolution(n: number, rng: () => number): SolutionCell[] {
  const perm = () => shuffle(Array.from({ length: n }, (_, i) => i), rng);
  for (;;) {
    const red = perm();
    const yellow = perm();
    if (yellow.some((c, r) => c === red[r])) continue;
    const blue = perm();
    if (blue.some((c, r) => c === red[r] || c === yellow[r])) continue;
    const grid: SolutionCell[] = Array(n * n).fill(".");
    for (let r = 0; r < n; r++) {
      grid[r * n + red[r]] = "R";
      grid[r * n + yellow[r]] = "Y";
      grid[r * n + blue[r]] = "B";
    }
    return grid;
  }
}

export function fullClues(solution: SolutionCell[], n: number): (number | null)[] {
  return solution.map((v, i) => (v === "." ? clueAt(solution, n, i) : null));
}

const logicSolves = (n: number, clues: (number | null)[]) =>
  propagate(n, clues).status === "solved";

const clueCount = (clues: (number | null)[]) => clues.filter((c) => c !== null).length;

const settings: Record<Difficulty, { extras: (n: number) => number; attempts: number }> = {
  easy: { extras: (n) => n, attempts: 1 },
  medium: { extras: (n) => Math.floor(n / 3), attempts: 3 },
  hard: { extras: () => 0, attempts: 12 },
};

export function generate(n: number, difficulty: Difficulty, seed: number): Puzzle {
  const rng = mulberry32(seed ^ Math.imul(n, 0x9e3779b1));
  const { extras, attempts } = settings[difficulty];
  let best: { solution: SolutionCell[]; clues: (number | null)[]; removed: number[] } | null = null;

  for (let made = 0, tries = 0; made < attempts && tries < 500; tries++) {
    const solution = randomSolution(n, rng);
    const clues = fullClues(solution, n);
    if (!logicSolves(n, clues)) continue;
    made++;
    const removed: number[] = [];
    for (const k of shuffle(clues.flatMap((c, i) => (c === null ? [] : [i])), rng)) {
      const v = clues[k];
      clues[k] = null;
      if (logicSolves(n, clues)) removed.push(k);
      else clues[k] = v;
    }
    if (!best || clueCount(clues) < clueCount(best.clues)) best = { solution, clues, removed };
  }
  if (!best) throw new Error(`Could not generate a ${n}×${n} puzzle`);

  // Easier tiers get some removed clues back (still logic-solvable: more clues never hurt).
  for (const k of shuffle(best.removed, rng).slice(0, extras(n)))
    best.clues[k] = clueAt(best.solution, n, k);

  if (countSolutions(n, best.clues) !== 1) throw new Error("Generated puzzle is not unique");
  return {
    id: puzzleId(n, difficulty, seed),
    size: n,
    difficulty,
    seed,
    solution: best.solution,
    clues: best.clues,
  };
}

export const puzzleId = (n: number, d: Difficulty, seed: number) => `${n}${d[0]}-${seed}`;

export function parsePuzzleId(id: string): { size: number; difficulty: Difficulty; seed: number } | null {
  const m = /^([567])([emh])-(\d{1,10})$/.exec(id.trim());
  if (!m) return null;
  const difficulty = DIFFICULTIES.find((d) => d[0] === m[2])!;
  const seed = Number(m[3]);
  if (seed > 0xffffffff) return null;
  return { size: Number(m[1]), difficulty, seed };
}

export const randomSeed = () => Math.floor(Math.random() * 1_000_000);

/** Daily puzzle: date-seeded, harder through the week (5×5 Monday → 7×7 Sunday). */
const WEEK: [number, Difficulty][] = [
  [7, "hard"], // Sunday
  [5, "easy"],
  [5, "medium"],
  [5, "hard"],
  [6, "medium"],
  [6, "hard"],
  [7, "medium"],
];

export const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function dailySpec(date: Date) {
  const [size, difficulty] = WEEK[date.getDay()];
  return { size, difficulty, seed: hashString(`blend:${dateKey(date)}`) % 1_000_000_000, date: dateKey(date) };
}
