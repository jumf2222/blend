import { onSettled, Show } from "solid-js";
import { createGame, GameContext } from "../game";
import { Board } from "./Board";
import { HintPanel, NewPuzzle, Rules, StatusBar, Toolbar } from "./Panels";
import { WinDialog } from "./WinDialog";

export function App() {
  const game = createGame();

  onSettled(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "z") {
        e.preventDefault();
        if (e.shiftKey) game.actions.redo();
        else game.actions.undo();
      } else if ((e.ctrlKey || e.metaKey) && k === "y") {
        e.preventDefault();
        game.actions.redo();
      } else if (k === "h" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        game.actions.hint();
      } else if (k === "escape") {
        game.actions.closeWin();
        game.actions.dismiss();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <GameContext value={game}>
      <div class="app">
        <header class="masthead">
          <h1>
            <span class="logo" aria-hidden="true">
              <span class="blob r" />
              <span class="blob y" />
              <span class="blob b" />
            </span>
            Blend
          </h1>
          <p class="tagline">A color-mixing logic puzzle</p>
        </header>
        <main class="layout">
          <div class="play">
            <StatusBar />
            <Show when={game.puzzle()} keyed>
              {(p) => <Board puzzle={p} />}
            </Show>
            <Toolbar />
            <HintPanel />
          </div>
          <aside class="side">
            <NewPuzzle />
            <Rules />
          </aside>
        </main>
        <WinDialog />
      </div>
    </GameContext>
  );
}
