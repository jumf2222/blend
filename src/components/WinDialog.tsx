import { createSignal, Show, useContext } from "solid-js";
import { clueCode, type ClueCode } from "../engine/core";
import { GameContext, formatTime } from "../game";

const EMOJI: Record<ClueCode, string> = { R: "🟥", Y: "🟨", B: "🟦", O: "🟧", G: "🟩", P: "🟪", K: "🟫", W: "⬜" };

export function WinDialog() {
  const game = useContext(GameContext);
  const [copied, setCopied] = createSignal(false);

  const shareText = () => {
    const p = game.puzzle();
    const s = game.state;
    const head = s.mode === "daily" ? `Blend daily ${s.daily}` : `Blend #${p.id}`;
    const rows: string[] = [];
    for (let r = 0; r < p.size; r++) {
      let row = "";
      for (let c = 0; c < p.size; c++) {
        const clue = p.clues[r * p.size + c];
        row += clue === null ? "⬛" : EMOJI[clueCode(clue)];
      }
      rows.push(row);
    }
    const streak = s.mode === "daily" && game.streak() > 1 ? ` · 🔥${game.streak()}` : "";
    return `${head} (${p.size}×${p.size} ${p.difficulty})\n⏱ ${formatTime(s.elapsed)} · 💡${s.hints}${streak}\n${rows.join("\n")}\n${location.origin}${location.pathname}#${p.id}`;
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      prompt("Copy your result:", shareText());
    }
  };

  return (
    <Show when={game.state.showWin}>
      <div class="overlay" onClick={(e) => e.target === e.currentTarget && game.actions.closeWin()}>
        <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="win-title">
          <div class="splash" aria-hidden="true">
            <span class="blob r" />
            <span class="blob y" />
            <span class="blob b" />
          </div>
          <h2 id="win-title">Blended!</h2>
          <p>
            Solved in <strong>{formatTime(game.state.elapsed)}</strong>
            {game.state.hints ? ` with ${game.state.hints} hint${game.state.hints === 1 ? "" : "s"}` : " with no hints"}.
          </p>
          <Show when={game.state.mode === "daily" && game.streak() > 0}>
            <p>Daily streak: 🔥 {game.streak()}</p>
          </Show>
          <pre class="share">{shareText()}</pre>
          <div class="row">
            <button type="button" class="primary grow" onClick={copy}>
              {copied() ? "Copied!" : "Copy result"}
            </button>
            <button
              type="button"
              class="grow"
              onClick={() => game.actions.newPuzzle(game.puzzle().size, game.puzzle().difficulty)}
            >
              Another one
            </button>
          </div>
          <button type="button" class="link" onClick={() => game.actions.closeWin()}>
            Close
          </button>
        </div>
      </div>
    </Show>
  );
}
