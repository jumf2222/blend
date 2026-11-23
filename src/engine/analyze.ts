// Player-board analysis: live validation, mistakes, hints and win detection.

import {
  ALL,
  BIT_DROP,
  DROP_BIT,
  DROP_NAME,
  EMPTY,
  cellName,
  lines,
  neighbors,
  type Mark,
  type Puzzle,
} from "./core";
import { propagate, type Reason } from "./propagate";

export interface Conflicts {
  /** Indexes into lines(n): rows first, then columns. */
  lines: Set<number>;
  clues: Set<number>;
  cells: Set<number>;
}

/** Rule violations visible from the board alone (no peeking at the solution). */
export function findConflicts(puzzle: Puzzle, board: readonly Mark[]): Conflicts {
  const n = puzzle.size;
  const out: Conflicts = { lines: new Set(), clues: new Set(), cells: new Set() };

  lines(n).forEach((line, li) => {
    const byColor: Record<string, number[]> = { R: [], Y: [], B: [] };
    let drops = 0;
    let marked = 0;
    for (const i of line.cells) {
      const m = board[i];
      if (m === "x" || puzzle.clues[i] !== null) marked++;
      else if (m) {
        byColor[m].push(i);
        drops++;
      }
    }
    for (const cells of Object.values(byColor))
      if (cells.length > 1) {
        out.lines.add(li);
        cells.forEach((c) => out.cells.add(c));
      }
    if (drops > 3 || marked > n - 3) out.lines.add(li);
  });

  const nb = neighbors(n);
  puzzle.clues.forEach((clue, k) => {
    if (clue === null) return;
    for (const j of nb[k]) {
      const m = board[j];
      if (m === "R" || m === "Y" || m === "B")
        if (!(clue & DROP_BIT[m])) {
          out.clues.add(k);
          out.cells.add(j);
        }
    }
    // Every color the clue needs must still be possible on some neighbor.
    for (const d of ["R", "Y", "B"] as const) {
      if (!(clue & DROP_BIT[d])) continue;
      const stillPossible = nb[k].some((j) => board[j] === d || (board[j] === "" && puzzle.clues[j] === null));
      if (!stillPossible) out.clues.add(k);
    }
  });
  return out;
}

/** Cells whose entry disagrees with the solution. */
export function findMistakes(puzzle: Puzzle, board: readonly Mark[]): number[] {
  const wrong: number[] = [];
  board.forEach((m, i) => {
    if (!m || puzzle.clues[i] !== null) return;
    const s = puzzle.solution[i];
    if ((m === "x" && s !== ".") || (m !== "x" && m !== s)) wrong.push(i);
  });
  return wrong;
}

/** Solved when every drop is in place; empty cells don't need an ×. */
export const isSolved = (puzzle: Puzzle, board: readonly Mark[]) =>
  puzzle.solution.every((s, i) => (s === "." ? board[i] === "" || board[i] === "x" : board[i] === s));

export type Hint =
  | { kind: "mistake"; cell: number; text: string }
  | { kind: "deduction"; cell: number; mark: Mark; text: string; reasons: Reason[] }
  | { kind: "none"; text: string };

export function findHint(puzzle: Puzzle, board: readonly Mark[]): Hint {
  const n = puzzle.size;
  const mistakes = findMistakes(puzzle, board);
  if (mistakes.length)
    return {
      kind: "mistake",
      cell: mistakes[0],
      text: `${cellName(mistakes[0], n)} isn't right. Clear it (or undo back to it) before going further.`,
    };
  if (isSolved(puzzle, board)) return { kind: "none", text: "Already solved!" };

  // Treat the player's (correct) entries as givens and find the next deduction.
  const start = new Uint8Array(n * n);
  board.forEach((m, i) => {
    start[i] = puzzle.clues[i] !== null ? EMPTY : m === "x" ? EMPTY : m ? DROP_BIT[m] : ALL;
  });
  const { steps } = propagate(n, puzzle.clues, start, true);
  // Earliest deduction = the most direct one from what's on the board.
  const step = steps.find((s) => board[s.cell] === "");
  if (step) {
    const mark: Mark = step.value === EMPTY ? "x" : BIT_DROP[step.value];
    const what = mark === "x" ? "must be empty" : `must be ${DROP_NAME[mark as "R"]}`;
    return { kind: "deduction", cell: step.cell, mark, text: `${cellName(step.cell, n)} ${what}.`, reasons: step.reasons };
  }
  // Fallback (shouldn't happen for generated puzzles): reveal one drop.
  const i = puzzle.solution.findIndex((s, i) => s !== "." && board[i] !== s);
  const d = puzzle.solution[i] as "R" | "Y" | "B";
  return { kind: "deduction", cell: i, mark: d, text: `${cellName(i, n)} is ${DROP_NAME[d]}.`, reasons: [] };
}
