import { createSignal, Repeat, Show, useContext } from "solid-js";
import { DROP_NAME, cellName, clueName, type Mark, type Puzzle } from "../engine/core";
import { GameContext } from "../game";
import { ClueDisc, DropGlyph } from "./Glyphs";

const LONG_PRESS_MS = 420;

const KEY_MARKS: Record<string, Mark> = {
  r: "R",
  "1": "R",
  y: "Y",
  "2": "Y",
  b: "B",
  "3": "B",
  x: "x",
  "0": "x",
  ".": "x",
  Backspace: "",
  Delete: "",
};

export function Board(props: { puzzle: Puzzle }) {
  const game = useContext(GameContext);
  const [cursor, setCursor] = createSignal(0);
  let grid: HTMLDivElement | undefined;

  const focusCell = (i: number) => {
    setCursor(i);
    grid?.querySelector<HTMLElement>(`[data-index="${i}"]`)?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const i = Number((e.target as HTMLElement).dataset.index);
    if (Number.isNaN(i) || e.ctrlKey || e.metaKey || e.altKey) return;
    const n = props.puzzle.size;
    const r = Math.floor(i / n);
    const c = i % n;
    const move: Record<string, number> = {
      ArrowUp: ((r + n - 1) % n) * n + c,
      ArrowDown: ((r + 1) % n) * n + c,
      ArrowLeft: r * n + ((c + n - 1) % n),
      ArrowRight: r * n + ((c + 1) % n),
    };
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key in move) {
      e.preventDefault();
      focusCell(move[key]);
    } else if (key in KEY_MARKS) {
      e.preventDefault();
      game.actions.set(i, KEY_MARKS[key]);
    }
  };

  return (
    <div class="board-wrap" style={{ "--n": String(props.puzzle.size) }}>
      <div class="col-labels" aria-hidden="true">
        <Repeat count={props.puzzle.size}>{(c) => <span>{c + 1}</span>}</Repeat>
      </div>
      <div class="row-labels" aria-hidden="true">
        <Repeat count={props.puzzle.size}>{(r) => <span>{r + 1}</span>}</Repeat>
      </div>
      <div
        class={["board", { won: game.state.won }]}
        role="grid"
        aria-label={`${props.puzzle.size} by ${props.puzzle.size} Blend board`}
        ref={(el) => (grid = el)}
        onKeyDown={onKeyDown}
      >
        <Repeat count={props.puzzle.size * props.puzzle.size}>
          {(i) => <Cell index={i} puzzle={props.puzzle} focused={cursor() === i} onFocus={() => setCursor(i)} />}
        </Repeat>
      </div>
    </div>
  );
}

function Cell(props: { index: number; puzzle: Puzzle; focused: boolean; onFocus: () => void }) {
  const game = useContext(GameContext);
  const clue = () => props.puzzle.clues[props.index] ?? null;
  const mark = () => game.state.board[props.index] ?? "";
  const n = () => props.puzzle.size;
  const hintCell = () => {
    const h = game.hint();
    return h && h.kind !== "none" ? h.cell : -1;
  };
  const lineBad = () => {
    const bad = game.conflicts().lines;
    return bad.has(Math.floor(props.index / n())) || bad.has(n() + (props.index % n()));
  };
  const label = () => {
    const where = cellName(props.index, n());
    const c = clue();
    if (c !== null) return `${where}: ${clueName(c)} clue`;
    const m = mark();
    return `${where}: ${m === "" ? "blank" : m === "x" ? "marked empty" : DROP_NAME[m]}`;
  };

  // Touch: long-press marks empty. Mouse: right-click marks empty.
  let pressTimer: ReturnType<typeof setTimeout> | undefined;
  let suppressClick = false;
  const cancelPress = () => {
    clearTimeout(pressTimer);
    pressTimer = undefined;
  };
  const longPress = () => {
    cancelPress();
    suppressClick = true;
    game.actions.toggleEmpty(props.index);
    navigator.vibrate?.(12);
  };

  return (
    <button
      type="button"
      class={[
        "cell",
        {
          "is-clue": clue() !== null,
          "line-bad": lineBad(),
          bad: clue() !== null ? game.conflicts().clues.has(props.index) : game.conflicts().cells.has(props.index),
          flagged: game.state.flagged.includes(props.index),
          "hint-target": hintCell() === props.index,
          "hint-ref": game.hintCells().has(props.index),
          "is-x": mark() === "x",
        },
      ]}
      data-index={props.index}
      tabindex={props.focused ? 0 : -1}
      role="gridcell"
      aria-label={label()}
      aria-disabled={clue() !== null || game.state.won ? "true" : "false"}
      onFocus={() => props.onFocus()}
      onClick={() => {
        if (suppressClick) {
          suppressClick = false;
          return;
        }
        game.actions.activate(props.index);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        if (pressTimer !== undefined) longPress();
        else if (!suppressClick) game.actions.toggleEmpty(props.index);
      }}
      onPointerDown={(e) => {
        suppressClick = false;
        if (e.pointerType === "mouse") return;
        cancelPress();
        pressTimer = setTimeout(longPress, LONG_PRESS_MS);
      }}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
    >
      <Show
        when={clue() !== null}
        fallback={
          <Show when={mark() !== "" && mark() !== "x"} fallback={<Show when={mark() === "x"}><span class="x-mark">×</span></Show>}>
            <DropGlyph drop={mark() as "R"} />
          </Show>
        }
      >
        <ClueDisc mask={clue()!} />
      </Show>
    </button>
  );
}
