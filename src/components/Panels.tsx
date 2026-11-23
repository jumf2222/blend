import { createSignal, For, Show, useContext } from "solid-js";
import { CLUE_NAME, type ClueCode, type Difficulty } from "../engine/core";
import { DIFFICULTIES, SIZES } from "../engine/generate";
import { GameContext, formatTime, type Tool } from "../game";
import { ClueDisc, DropGlyph } from "./Glyphs";

const DIFF_LABEL: Record<Difficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

export function StatusBar() {
  const game = useContext(GameContext);
  const title = () => {
    const p = game.puzzle();
    const size = `${p.size}×${p.size} · ${DIFF_LABEL[p.difficulty]}`;
    return game.state.mode === "daily" ? `Daily ${game.state.daily} · ${size}` : size;
  };
  return (
    <div class="status">
      <div class="status-title">
        <span>{title()}</span>
        <span class="puzzle-id">#{game.puzzle().id}</span>
      </div>
      <div class="status-meta">
        <span class="timer" aria-label="Elapsed time">
          ⏱ {formatTime(game.state.elapsed)}
        </span>
        <Show when={game.state.hints > 0}>
          <span title="Hints used">💡 {game.state.hints}</span>
        </Show>
        <Show when={game.state.won}>
          <button class="link" onClick={() => game.actions.openWin()}>
            Solved ✓
          </button>
        </Show>
      </div>
    </div>
  );
}

const TOOLS: { tool: Tool; label: string }[] = [
  { tool: "cycle", label: "Cycle" },
  { tool: "R", label: "Red" },
  { tool: "Y", label: "Yellow" },
  { tool: "B", label: "Blue" },
  { tool: "x", label: "Empty" },
];

export function Toolbar() {
  const game = useContext(GameContext);
  return (
    <div class="toolbar">
      <div class="tools" role="radiogroup" aria-label="Tap places">
        <For each={TOOLS}>
          {(t) => (
            <button
              type="button"
              role="radio"
              aria-checked={game.tool() === t.tool ? "true" : "false"}
              class={["tool", { active: game.tool() === t.tool }]}
              title={t.tool === "cycle" ? "Tap cycles: blank → Red → Yellow → Blue → × → blank" : `Tap places ${t.label}`}
              onClick={() => game.setTool(t.tool)}
            >
              <span class="tool-icon">
                <Show
                  when={t.tool === "R" || t.tool === "Y" || t.tool === "B"}
                  fallback={<span>{t.tool === "x" ? "×" : "↻"}</span>}
                >
                  <DropGlyph drop={t.tool as "R"} />
                </Show>
              </span>
              <span class="tool-label">{t.label}</span>
            </button>
          )}
        </For>
      </div>
      <div class="actions">
        <button type="button" onClick={() => game.actions.undo()} disabled={!game.state.past.length || game.state.won} title="Undo (Ctrl+Z)">
          ↶ Undo
        </button>
        <button type="button" onClick={() => game.actions.redo()} disabled={!game.state.future.length || game.state.won} title="Redo (Ctrl+Y)">
          ↷ Redo
        </button>
        <button type="button" onClick={() => game.actions.check()} disabled={game.state.won} title="Mark wrong entries">
          ✓ Check
        </button>
        <button type="button" class="primary" onClick={() => game.actions.hint()} disabled={game.state.won} title="Hint (H)">
          💡 Hint
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm("Clear the board? (You can undo this.)")) game.actions.restart();
          }}
          disabled={game.state.won || !game.state.board.some((m) => m)}
        >
          ⟲ Clear
        </button>
      </div>
    </div>
  );
}

export function HintPanel() {
  const game = useContext(GameContext);
  const reasons = () => {
    const h = game.hint();
    return h?.kind === "deduction" ? h.reasons : [];
  };
  return (
    <div class="notice-slot" aria-live="polite">
      <Show when={game.hint()}>
        {(hint) => (
          <div class={["notice", `notice-${hint().kind}`]}>
            <div class="notice-head">
              <strong>{hint().text}</strong>
              <button class="icon" aria-label="Dismiss" onClick={() => game.actions.dismiss()}>
                ✕
              </button>
            </div>
            <Show when={reasons().length > 0}>
              <ul>
                <For each={reasons()}>{(r) => <li>{r.text}</li>}</For>
              </ul>
            </Show>
            <Show when={hint().kind !== "none"}>
              <button class="small" onClick={() => game.actions.applyHint()}>
                {hint().kind === "mistake" ? "Clear that cell" : "Fill it in"}
              </button>
            </Show>
          </div>
        )}
      </Show>
      <Show when={game.state.message}>
        {(msg) => (
          <div class="notice">
            <div class="notice-head">
              <span>{msg()}</span>
              <button class="icon" aria-label="Dismiss" onClick={() => game.actions.dismiss()}>
                ✕
              </button>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}

export function NewPuzzle() {
  const game = useContext(GameContext);
  const [size, setSize] = createSignal(5);
  const [difficulty, setDifficulty] = createSignal<Difficulty>("medium");
  return (
    <section class="card">
      <h2>New puzzle</h2>
      <div class="seg" role="radiogroup" aria-label="Board size">
        <For each={[...SIZES]}>
          {(s) => (
            <button type="button" role="radio" aria-checked={size() === s ? "true" : "false"} class={{ active: size() === s }} onClick={() => setSize(s)}>
              {s}×{s}
            </button>
          )}
        </For>
      </div>
      <div class="seg" role="radiogroup" aria-label="Difficulty">
        <For each={DIFFICULTIES}>
          {(d) => (
            <button
              type="button"
              role="radio"
              aria-checked={difficulty() === d ? "true" : "false"}
              class={{ active: difficulty() === d }}
              onClick={() => setDifficulty(d)}
            >
              {DIFF_LABEL[d]}
            </button>
          )}
        </For>
      </div>
      <div class="row">
        <button type="button" class="primary grow" onClick={() => game.actions.newPuzzle(size(), difficulty())}>
          Generate
        </button>
        <button type="button" class="grow" onClick={() => game.actions.daily()} disabled={game.state.mode === "daily"}>
          Today's daily
        </button>
      </div>
      <p class="muted small-text">
        Daily puzzles get harder through the week: 5×5 on Monday up to 7×7 on Sunday.
        <Show when={game.streak() > 0}> Current streak: 🔥 {game.streak()}.</Show>
      </p>
    </section>
  );
}

const KEY: ClueCode[] = ["R", "Y", "B", "O", "G", "P", "K", "W"];
const KEY_MASK: Record<ClueCode, number> = { W: 0, R: 2, Y: 4, B: 8, O: 6, G: 12, P: 10, K: 14 };
const KEY_TEXT: Record<ClueCode, string> = {
  R: "only Red",
  Y: "only Yellow",
  B: "only Blue",
  O: "Red + Yellow",
  G: "Yellow + Blue",
  P: "Red + Blue",
  K: "all three",
  W: "no drops",
};

export function Rules() {
  return (
    <section class="card rules">
      <details open>
        <summary>
          <h2>How to play</h2>
        </summary>
        <ol>
          <li>
            Every row and column has exactly one <DropGlyph drop="R" class="inline" /> Red, one{" "}
            <DropGlyph drop="Y" class="inline" /> Yellow and one <DropGlyph drop="B" class="inline" /> Blue drop. All other
            cells are empty.
          </li>
          <li>Clue cells are always empty. A clue shows the color you get by mixing the drops directly up, down, left and right of it.</li>
          <li>Clues show which colors are present, not how many: two reds still mix to plain Red.</li>
        </ol>
        <p class="muted small-text">
          Tap a cell to cycle blank → Red → Yellow → Blue → ×. Long-press or right-click marks it empty. Keyboard: arrows to
          move, R/Y/B or 1/2/3 to place, X to mark empty, Backspace to clear, Ctrl+Z / Ctrl+Y, H for a hint.
        </p>
      </details>
      <div class="legend">
        <For each={KEY}>
          {(code) => (
            <div class="legend-item">
              <ClueDisc mask={KEY_MASK[code]} class="small" />
              <span>
                <strong>{CLUE_NAME[code]}</strong> {KEY_TEXT[code]}
              </span>
            </div>
          )}
        </For>
      </div>
    </section>
  );
}
