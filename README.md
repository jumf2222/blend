# Blend — a color-mixing logic puzzle

*Minesweeper meets Queens, but the clues are paint colors.*

## Rules

The board is an N×N grid (5×5 to start).

1. **Place paint drops.** Every row and every column contains exactly one 🔴 Red, one 🟡 Yellow and one 🔵 Blue drop. All other cells are empty (on 5×5, two empty cells per row/column).
2. **Clue cells are always empty.** Each clue shows the color you get by mixing the drops orthogonally adjacent to it (up/down/left/right).
3. **Clues show which colors are present, not how many.** Two reds next to a clue still mix to plain Red.

### Clue key

| Clue | Code | Neighbors include… |
|---|---|---|
| Red / Yellow / Blue | R / Y / B | only that color |
| Orange | O | Red + Yellow, no Blue |
| Green | G | Yellow + Blue, no Red |
| Purple | P | Red + Blue, no Yellow |
| Brown | K | all three |
| White | W | no drops at all |

Each clue does two jobs: it says which colors must be nearby, and it **rules out** every other color from all of its neighbors.

## Sample puzzle #1 (3 clues, unique, solvable without guessing)

```
     c1 c2 c3 c4 c5
r1    ·  ·  ·  ·  O
r2    R  ·  ·  ·  ·
r3    ·  G  ·  ·  ·
r4    ·  ·  ·  ·  ·
r5    ·  ·  ·  ·  ·
```

Opening move: r2c2 neighbors the R clue (so no Y/B) and the G clue (so no R), so it must be empty.

Solution:

```
R B · Y ·
· · Y B R
· · B R Y
B Y R · ·
Y R · · B
```

## Implementation plan (playable web version)

### Core gameplay
- Tap a cell to cycle: empty → Red → Yellow → Blue → marked-empty (×) → empty. Support right-click / long-press to mark empty directly.
- Clue cells render as a filled circle of the blended color **plus a letter/shape** (colorblind support: ● R, ▲ Y, ■ B).
- Live validation: highlight a row/column with a duplicate color or too many drops; highlight a clue whose neighbors are already in conflict with it.
- Win detection, timer, undo/redo, "check" and "hint" buttons.

### Puzzle generation (see `prototype/blend.py` and `prototype/gen.py` for the Python prototype)
1. Pick a random valid solution: each row is an ordered choice of 3 distinct columns for (R, Y, B), with each column used once per color.
2. Compute the clue for every empty cell.
3. Shuffle the clue cells and remove them one at a time, keeping a removal only if the puzzle is still **solvable by the logic propagator** (that keeps it human-friendly without guessing). Brute-force-check uniqueness at the end.
4. Difficulty: control the number of clues left and which deduction rules the propagator may use.

### Logic propagator (human-style rules)
Each cell has candidates `{empty, R, Y, B}`. Repeat until nothing changes:
- A clue cell is empty, and it removes from all its neighbors every color the clue doesn't contain.
- Row/column: once a color is placed, remove it from the rest of that line. If a color has only one possible cell in a line, place it there.
- Row/column: if N−3 cells are already empty, the rest are drops. If only N−3 cells could be empty, they are empty.
- A clue color with only one neighbor that could hold it is placed there.
- Any cell with no candidates left means a contradiction.

### Stretch goals
- Daily puzzle from a date-based seed, getting harder through the week (5×5 Mon → 7×7 Sun).
- Bigger grids (6×6, 7×7) and difficulty tiers.
- Variants: "bold" clues that also show how many drops touch the cell, or diagonal neighbors counting toward the mix.
- Shareable results grid (emoji) and streak tracking.
- Two-player mode where players take turns revealing clues.

## Files
- `prototype/blend.py`: enumerates every valid 5×5 solution and reduces clues greedily (uniqueness only).
- `prototype/gen.py`: generator that keeps puzzles solvable with the logic propagator. Run `cd prototype && python gen.py <seed>`.
