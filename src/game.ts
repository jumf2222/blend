// Game state: the current puzzle, the player's marks, history, timer and stats.

import { createContext, createEffect, createMemo, createSignal, createStore, onSettled } from "solid-js";
import { findConflicts, findHint, findMistakes, isSolved, type Hint } from "./engine/analyze";
import type { Difficulty, Mark, Puzzle } from "./engine/core";
import { dailySpec, generate, parsePuzzleId, randomSeed } from "./engine/generate";
import { dailyStreak, loadGames, loadLastId, loadStats, saveGame, saveStats, type Stats } from "./storage";

export type Tool = "cycle" | "R" | "Y" | "B" | "x";
export type Mode = "daily" | "free";

interface Change {
  cell: number;
  from: Mark;
  to: Mark;
}

interface GameState {
  mode: Mode;
  daily: string | null;
  board: Mark[];
  past: Change[][];
  future: Change[][];
  elapsed: number;
  hints: number;
  checks: number;
  won: boolean;
  /** Cells flagged wrong by "Check"; cleared when the cell changes. */
  flagged: number[];
  message: string | null;
  showWin: boolean;
}

const CYCLE: Mark[] = ["", "R", "Y", "B", "x"];

interface Start {
  puzzle: Puzzle;
  mode: Mode;
  daily: string | null;
}

function todaysDaily(): Start {
  const spec = dailySpec(new Date());
  return { puzzle: generate(spec.size, spec.difficulty, spec.seed), mode: "daily", daily: spec.date };
}

/** Resolve a puzzle id (from the URL or storage) into a puzzle; daily if it matches today's. */
function fromId(id: string | null | undefined): Start | null {
  const parsed = id ? parsePuzzleId(id) : null;
  if (!parsed) return null;
  const today = todaysDaily();
  if (today.puzzle.id === id) return today;
  return { puzzle: generate(parsed.size, parsed.difficulty, parsed.seed), mode: "free", daily: null };
}

function freshState(start: Start): GameState {
  const saved = loadGames()[start.puzzle.id];
  const n = start.puzzle.size;
  const board = saved?.board?.length === n * n ? saved.board : Array<Mark>(n * n).fill("");
  return {
    mode: start.mode,
    daily: start.daily,
    board,
    past: [],
    future: [],
    elapsed: saved?.elapsed ?? 0,
    hints: saved?.hints ?? 0,
    checks: saved?.checks ?? 0,
    won: saved?.won ?? false,
    flagged: [],
    message: null,
    showWin: false,
  };
}

function initialStart(): Start {
  const hash = typeof location !== "undefined" ? location.hash.slice(1) : "";
  if (hash === "daily") return todaysDaily();
  return fromId(hash) ?? fromId(loadLastId()) ?? todaysDaily();
}

export function createGame() {
  const start = initialStart();
  const [puzzle, setPuzzle] = createSignal<Puzzle>(start.puzzle);
  const [state, setState] = createStore<GameState>(freshState(start));
  const [tool, setTool] = createSignal<Tool>("cycle");
  const [stats, setStats] = createSignal<Stats>(loadStats());
  // Hints are replaced wholesale, so they live in a signal rather than the store.
  const [hint, setHint] = createSignal<Hint | null>(null);

  const conflicts = createMemo(() => findConflicts(puzzle(), state.board));
  const streak = createMemo(() => dailyStreak(stats(), new Date()));
  const hintCells = createMemo(() => {
    const h = hint();
    const cells = new Set<number>();
    if (h?.kind === "deduction") for (const r of h.reasons) for (const c of r.cells) cells.add(c);
    return cells;
  });

  function load(next: Start) {
    setPuzzle(next.puzzle);
    setHint(null);
    setState(() => freshState(next));
  }

  function recordWin() {
    const s = loadStats();
    s.solved++;
    if (state.mode === "daily" && state.daily && !s.daily[state.daily])
      s.daily[state.daily] = { time: state.elapsed, hints: state.hints };
    saveStats(s);
    setStats(s);
  }

  /** Apply one undoable action (a list of cell changes). */
  function apply(changes: { cell: number; to: Mark }[]) {
    if (state.won) return;
    const p = puzzle();
    const real: Change[] = changes
      .filter((c) => p.clues[c.cell] === null && state.board[c.cell] !== c.to)
      .map((c) => ({ cell: c.cell, from: state.board[c.cell], to: c.to }));
    if (!real.length) return;
    commit(real, "do");
  }

  function commit(changes: Change[], kind: "do" | "undo" | "redo") {
    const nextBoard = state.board.slice();
    for (const c of changes) nextBoard[c.cell] = kind === "undo" ? c.from : c.to;
    const won = isSolved(puzzle(), nextBoard);
    const touched = new Set(changes.map((c) => c.cell));
    setState((s) => {
      for (const c of changes) s.board[c.cell] = kind === "undo" ? c.from : c.to;
      if (kind === "do") {
        s.past.push(changes);
        s.future = [];
      } else if (kind === "undo") {
        s.past.pop();
        s.future.push(changes);
      } else {
        s.future.pop();
        s.past.push(changes);
      }
      s.flagged = s.flagged.filter((i) => !touched.has(i));
      s.message = null;
      if (won) {
        s.won = true;
        s.showWin = true;
      }
    });
    setHint(null);
    if (won) recordWin();
  }

  const actions = {
    activate(i: number) {
      const t = tool();
      const cur = state.board[i];
      if (t === "cycle") apply([{ cell: i, to: CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length] }]);
      else apply([{ cell: i, to: cur === t ? "" : t }]);
    },
    toggleEmpty(i: number) {
      apply([{ cell: i, to: state.board[i] === "x" ? "" : "x" }]);
    },
    set(i: number, m: Mark) {
      apply([{ cell: i, to: m }]);
    },
    undo() {
      if (state.won) return;
      const last = state.past[state.past.length - 1];
      if (!last) return;
      commit(last.map((c) => ({ ...c })), "undo");
    },
    redo() {
      if (state.won) return;
      const next = state.future[state.future.length - 1];
      if (!next) return;
      commit(next.map((c) => ({ ...c })), "redo");
    },
    restart() {
      if (state.won) return;
      apply(state.board.map((_, cell) => ({ cell, to: "" as Mark })));
    },
    check() {
      if (state.won) return;
      const wrong = findMistakes(puzzle(), state.board);
      const filled = state.board.filter((m) => m).length;
      setHint(null);
      setState((s) => {
        s.checks++;
        s.flagged = wrong;
        s.message = wrong.length
          ? `${wrong.length} ${wrong.length === 1 ? "entry is" : "entries are"} wrong (marked).`
          : filled
            ? "Everything so far is correct."
            : "Nothing to check yet.";
      });
    },
    hint() {
      if (state.won) return;
      const h = findHint(puzzle(), state.board);
      setHint(h);
      setState((s) => {
        s.message = null;
        if (h.kind !== "none") s.hints++;
      });
    },
    applyHint() {
      const h = hint();
      if (h?.kind === "deduction") apply([{ cell: h.cell, to: h.mark }]);
      else if (h?.kind === "mistake") apply([{ cell: h.cell, to: "" }]);
    },
    dismiss() {
      setHint(null);
      setState((s) => {
        s.message = null;
      });
    },
    closeWin() {
      setState((s) => {
        s.showWin = false;
      });
    },
    openWin() {
      setState((s) => {
        s.showWin = true;
      });
    },
    newPuzzle(size: number, difficulty: Difficulty) {
      load({ puzzle: generate(size, difficulty, randomSeed()), mode: "free", daily: null });
    },
    daily() {
      load(todaysDaily());
    },
    loadId(id: string) {
      const next = fromId(id);
      if (next && next.puzzle.id !== puzzle().id) load(next);
    },
  };

  // Persist progress for this puzzle.
  createEffect(
    () => ({
      id: puzzle().id,
      mode: state.mode,
      daily: state.daily ?? undefined,
      board: [...state.board] as Mark[],
      elapsed: state.elapsed,
      hints: state.hints,
      checks: state.checks,
      won: state.won,
    }),
    (game) => saveGame({ ...game, savedAt: Date.now() }),
  );

  // Keep the URL shareable: #<puzzle id>.
  createEffect(
    () => puzzle().id,
    (id) => {
      if (location.hash.slice(1) !== id) history.replaceState(null, "", `#${id}`);
    },
  );

  onSettled(() => {
    const timer = setInterval(() => {
      if (!state.won && document.visibilityState === "visible")
        setState((s) => {
          s.elapsed++;
        });
    }, 1000);
    const onHash = () => actions.loadId(location.hash.slice(1));
    window.addEventListener("hashchange", onHash);
    return () => {
      clearInterval(timer);
      window.removeEventListener("hashchange", onHash);
    };
  });

  return { puzzle, state, hint, tool, setTool, conflicts, hintCells, stats, streak, actions };
}

export type Game = ReturnType<typeof createGame>;
export const GameContext = createContext<Game>();

export const formatTime = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};
