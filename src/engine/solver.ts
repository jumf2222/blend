// Exhaustive solver: propagate, then branch on the most constrained cell.
// Used to prove uniqueness (the README's "brute-force check").

import { BIT_DROP, COLORS, EMPTY, popcount, type SolutionCell } from "./core";
import { propagate } from "./propagate";

export function solveAll(
  n: number,
  clues: (number | null)[],
  limit = 2,
): SolutionCell[][] {
  const found: SolutionCell[][] = [];

  const search = (start?: Uint8Array) => {
    const { status, cand } = propagate(n, clues, start);
    if (status === "contradiction") return;
    if (status === "solved") {
      found.push(Array.from(cand, (v) => (v === EMPTY ? "." : BIT_DROP[v])));
      return;
    }
    let best = -1;
    for (let i = 0; i < n * n; i++) {
      const p = popcount(cand[i]);
      if (p > 1 && (best < 0 || p < popcount(cand[best]))) best = i;
    }
    for (const bit of [EMPTY, ...COLORS]) {
      if (!(cand[best] & bit)) continue;
      const next = Uint8Array.from(cand);
      next[best] = bit;
      search(next);
      if (found.length >= limit) return;
    }
  };

  search();
  return found;
}

export const countSolutions = (n: number, clues: (number | null)[], limit = 2) =>
  solveAll(n, clues, limit).length;
