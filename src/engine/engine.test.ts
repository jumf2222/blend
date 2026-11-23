import { describe, expect, it } from "vitest";
import { clueAt, lines, type Mark, type SolutionCell } from "./core";
import { findConflicts, findHint, findMistakes, isSolved } from "./analyze";
import { DIFFICULTIES, generate, parsePuzzleId, puzzleId, randomSolution } from "./generate";
import { propagate } from "./propagate";
import { mulberry32 } from "./rng";
import { countSolutions } from "./solver";
import { BLUE, EMPTY, RED, YELLOW } from "./core";

// README sample puzzle #1.
const N = 5;
const sampleClues: (number | null)[] = Array(25).fill(null);
sampleClues[4] = RED | YELLOW; // r1c5 O
sampleClues[5] = RED; // r2c1 R
sampleClues[11] = YELLOW | BLUE; // r3c2 G
const sampleSolution = `
R B . Y .
. . Y B R
. . B R Y
B Y R . .
Y R . . B`
  .trim()
  .split(/\s+/) as SolutionCell[];

function isValid(sol: SolutionCell[], n: number) {
  return lines(n).every((l) => {
    const vals = l.cells.map((i) => sol[i]);
    return ["R", "Y", "B"].every((c) => vals.filter((v) => v === c).length === 1);
  });
}

describe("README sample", () => {
  it("is solved by the logic propagator", () => {
    const res = propagate(N, sampleClues);
    expect(res.status).toBe("solved");
    const sol = Array.from(res.cand, (v) => (v === EMPTY ? "." : v === RED ? "R" : v === YELLOW ? "Y" : "B"));
    expect(sol).toEqual(sampleSolution);
  });

  it("has exactly one solution", () => {
    expect(countSolutions(N, sampleClues)).toBe(1);
  });

  it("opening hint matches the README: r2c2 is empty", () => {
    const puzzle = { id: "t", size: N, difficulty: "easy" as const, seed: 0, solution: sampleSolution, clues: sampleClues };
    const hint = findHint(puzzle, Array(25).fill(""));
    expect(hint.kind).toBe("deduction");
    if (hint.kind !== "deduction") return;
    expect(hint.cell).toBe(6);
    expect(hint.mark).toBe("x");
    expect(hint.reasons.map((r) => r.text).join(" ")).toMatch(/Red clue at r2c1.*Green clue at r3c2/);
  });
});

describe("generator", () => {
  it("random solutions are valid", () => {
    const rng = mulberry32(1);
    for (const n of [5, 6, 7]) for (let t = 0; t < 20; t++) expect(isValid(randomSolution(n, rng), n)).toBe(true);
  });

  for (const n of [5, 6, 7])
    for (const d of DIFFICULTIES)
      it(`${n}×${n} ${d}: unique, logic-solvable, clues consistent`, () => {
        for (const seed of [1, 2, 3]) {
          const p = generate(n, d, seed);
          expect(isValid(p.solution, n)).toBe(true);
          expect(countSolutions(n, p.clues)).toBe(1);
          expect(propagate(n, p.clues).status).toBe("solved");
          p.clues.forEach((c, i) => {
            if (c !== null) {
              expect(p.solution[i]).toBe(".");
              expect(c).toBe(clueAt(p.solution, n, i));
            }
          });
        }
      });

  it("is deterministic per id", () => {
    expect(generate(6, "hard", 42)).toEqual(generate(6, "hard", 42));
  });

  it("harder tiers use fewer clues on average", () => {
    const avg = (d: (typeof DIFFICULTIES)[number]) => {
      let total = 0;
      for (let s = 0; s < 10; s++) total += generate(6, d, s).clues.filter((c) => c !== null).length;
      return total / 10;
    };
    expect(avg("easy")).toBeGreaterThan(avg("medium"));
    expect(avg("medium")).toBeGreaterThan(avg("hard"));
  });

  it("round-trips puzzle ids", () => {
    expect(parsePuzzleId(puzzleId(7, "medium", 123))).toEqual({ size: 7, difficulty: "medium", seed: 123 });
    expect(parsePuzzleId("9e-1")).toBeNull();
  });
});

describe("board analysis", () => {
  const puzzle = { id: "t", size: N, difficulty: "easy" as const, seed: 0, solution: sampleSolution, clues: sampleClues };
  const blank = (): Mark[] => Array(25).fill("");

  it("flags duplicate colors in a line", () => {
    const b = blank();
    b[0] = "R";
    b[1] = "R";
    const c = findConflicts(puzzle, b);
    expect(c.lines.has(0)).toBe(true);
    expect(c.cells.has(0) && c.cells.has(1)).toBe(true);
  });

  it("flags a clue contradicted by a neighbor", () => {
    const b = blank();
    b[10] = "R"; // r3c1, next to G clue at r3c2 (no red)
    const c = findConflicts(puzzle, b);
    expect(c.clues.has(11)).toBe(true);
    expect(c.cells.has(10)).toBe(true);
  });

  it("flags a clue that can no longer get its color", () => {
    const b = blank();
    b[0] = "x"; // r1c1
    b[10] = "x"; // r3c1; r2c1's neighbors are r1c1, r3c1, r2c2
    b[6] = "x";
    expect(findConflicts(puzzle, b).clues.has(5)).toBe(true);
  });

  it("detects mistakes and wins", () => {
    const b = sampleSolution.map((s) => (s === "." ? "" : s)) as Mark[];
    expect(isSolved(puzzle, b)).toBe(true);
    expect(findMistakes(puzzle, b)).toEqual([]);
    b[0] = "Y";
    expect(isSolved(puzzle, b)).toBe(false);
    expect(findMistakes(puzzle, b)).toEqual([0]);
    expect(findHint(puzzle, b).kind).toBe("mistake");
  });

  it("hints walk all the way to a solution", () => {
    for (const p of [puzzle, generate(7, "hard", 9)]) {
      const b: Mark[] = Array(p.size * p.size).fill("");
      for (let guard = 0; guard < 200 && !isSolved(p, b); guard++) {
        const h = findHint(p, b);
        expect(h.kind).toBe("deduction");
        if (h.kind === "deduction") b[h.cell] = h.mark;
        expect(findMistakes(p, b)).toEqual([]);
      }
      expect(isSolved(p, b)).toBe(true);
    }
  });
});

