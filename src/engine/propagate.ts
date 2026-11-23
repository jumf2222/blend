// Human-style logic propagator (see README "Logic propagator").
//
// Every cell keeps a candidate mask over {empty, R, Y, B}. Rules are applied
// until nothing changes. With `record` on, every deduction keeps a
// human-readable reason so the UI can explain hints.

import {
  ALL,
  COLORS,
  COLOR_MASK,
  EMPTY,
  bitNames,
  cellName,
  clueName,
  lines,
  neighbors,
  popcount,
} from "./core";

export interface Reason {
  text: string;
  /** Cells the explanation refers to (for highlighting). */
  cells: number[];
}

/** A cell that became fully determined, and why. */
export interface Step {
  cell: number;
  value: number;
  reasons: Reason[];
}

export type Status = "solved" | "stuck" | "contradiction";

export interface Propagation {
  status: Status;
  cand: Uint8Array;
  steps: Step[];
}

/** Starting candidates from clues alone: clue cells are empty, the rest unknown. */
export function initialCandidates(n: number, clues: (number | null)[]): Uint8Array {
  const cand = new Uint8Array(n * n);
  for (let i = 0; i < n * n; i++) cand[i] = clues[i] === null ? ALL : EMPTY;
  return cand;
}

export function propagate(
  n: number,
  clues: (number | null)[],
  start?: Uint8Array,
  record = false,
): Propagation {
  const cand = start ? Uint8Array.from(start) : initialCandidates(n, clues);
  const nb = neighbors(n);
  const ls = lines(n);
  const emptiesPerLine = n - 3;
  const removedWhy: { bits: number; reason: Reason }[][] | null = record
    ? Array.from({ length: n * n }, () => [])
    : null;
  const steps: Step[] = [];
  let changed = false;
  let contradiction = false;

  const remove = (i: number, bits: number, why?: (removed: number) => Reason) => {
    const hit = cand[i] & bits;
    if (!hit) return;
    const before = cand[i];
    cand[i] = before & ~bits;
    changed = true;
    if (!cand[i]) {
      contradiction = true;
      return;
    }
    if (removedWhy && why) {
      removedWhy[i].push({ bits: hit, reason: why(hit) });
      if (popcount(before) > 1 && popcount(cand[i]) === 1)
        steps.push({
          cell: i,
          value: cand[i],
          reasons: removedWhy[i].map((r) => ({ ...r.reason, text: cap(r.reason.text) })),
        });
    }
  };

  /** Why each of `cells` can't hold `bit`, grouped by shared reason ("r1c2, r1c3: …"). */
  const whyNot = (cells: number[], bit: number): Reason[] => {
    const groups = new Map<string, { subjects: number[]; cells: number[] }>();
    for (const j of cells) {
      const rec = removedWhy?.[j].find((r) => r.bits & bit)?.reason;
      const reason: Reason = rec
        ? rec
        : clues[j] !== null
          ? { text: "clue cells are always empty.", cells: [] }
          : { text: cand[j] === EMPTY ? "is empty." : `holds ${bitNames(cand[j])}.`, cells: [] };
      const g = groups.get(reason.text) ?? { subjects: [], cells: reason.cells };
      g.subjects.push(j);
      groups.set(reason.text, g);
    }
    return [...groups].map(([text, g]) => ({
      text: `${g.subjects.map((j) => cellName(j, n)).join(", ")}: ${text}`,
      cells: g.cells,
    }));
  };

  const set = (i: number, bit: number, why?: () => Reason, others: number[] = []) => {
    if (cand[i] === bit) return;
    if (!(cand[i] & bit)) {
      contradiction = true;
      return;
    }
    cand[i] = bit;
    changed = true;
    if (removedWhy && why)
      steps.push({ cell: i, value: bit, reasons: [why(), ...whyNot(others.filter((j) => j !== i), bit)] });
  };

  // Clue cells are empty, and rule out every color the clue lacks from all neighbors.
  for (let k = 0; k < n * n; k++) {
    const clue = clues[k];
    if (clue === null) continue;
    if (!(cand[k] & EMPTY)) contradiction = true;
    cand[k] = EMPTY;
    for (const j of nb[k])
      remove(j, COLOR_MASK & ~clue, (hit) => ({
        text: `next to the ${clueName(clue)} clue at ${cellName(k, n)}, which has no ${bitNames(hit)}.`,
        cells: [k],
      }));
  }

  changed = true;
  while (changed && !contradiction) {
    changed = false;

    for (const line of ls) {
      const cells = line.cells;
      for (const x of COLORS) {
        let placed = -1;
        let possible = -1;
        let possibleCount = 0;
        for (const i of cells) {
          if (cand[i] === x) {
            if (placed >= 0) contradiction = true;
            placed = i;
          }
          if (cand[i] & x) {
            possible = i;
            possibleCount++;
          }
        }
        if (contradiction) break;
        if (possibleCount === 0) {
          contradiction = true;
          break;
        }
        if (placed >= 0) {
          for (const i of cells)
            if (i !== placed)
              remove(i, x, () => ({
                text: `${line.name} already has its ${bitNames(x)} at ${cellName(placed, n)}.`,
                cells: [placed],
              }));
        } else if (possibleCount === 1) {
          set(
            possible,
            x,
            () => ({ text: `It's the only cell in ${line.name} that can still hold ${bitNames(x)}:`, cells }),
            cells,
          );
        }
      }
      if (contradiction) break;

      let empties = 0;
      let canBeEmpty = 0;
      for (const i of cells) {
        if (cand[i] === EMPTY) empties++;
        if (cand[i] & EMPTY) canBeEmpty++;
      }
      if (empties > emptiesPerLine || canBeEmpty < emptiesPerLine) {
        contradiction = true;
        break;
      }
      if (empties === emptiesPerLine && canBeEmpty > empties) {
        for (const i of cells)
          if (cand[i] !== EMPTY)
            remove(i, EMPTY, () => ({
              text: `${line.name} already has its ${emptiesPerLine} empty cells.`,
              cells: cells.filter((c) => cand[c] === EMPTY),
            }));
      } else if (canBeEmpty === emptiesPerLine && empties < emptiesPerLine) {
        for (const i of cells)
          if (cand[i] & EMPTY)
            set(
              i,
              EMPTY,
              () => ({
                text: `${cap(line.name)} needs ${emptiesPerLine} empty cells, and its other cells can't be empty:`,
                cells,
              }),
              cells.filter((c) => !(cand[c] & EMPTY)),
            );
      }
    }
    if (contradiction) break;

    // A color in a clue must appear on at least one neighbor.
    for (let k = 0; k < n * n && !contradiction; k++) {
      const clue = clues[k];
      if (clue === null) continue;
      for (const x of COLORS) {
        if (!(clue & x)) continue;
        let possible = -1;
        let count = 0;
        for (const j of nb[k])
          if (cand[j] & x) {
            possible = j;
            count++;
          }
        if (count === 0) {
          contradiction = true;
          break;
        }
        if (count === 1)
          set(
            possible,
            x,
            () => ({
              text: `The ${clueName(clue)} clue at ${cellName(k, n)} needs ${bitNames(x)}, and this is its only neighbor that can still be ${bitNames(x)}:`,
              cells: [k],
            }),
            nb[k],
          );
      }
    }
  }

  let status: Status = "solved";
  if (contradiction) status = "contradiction";
  else
    for (let i = 0; i < n * n; i++)
      if (popcount(cand[i]) !== 1) {
        status = "stuck";
        break;
      }
  return { status, cand, steps };
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
