import { For, Show } from "solid-js";
import { CLUE_NAME, COLORS, BIT_DROP, clueCode, type Drop } from "../engine/core";

/** Drops differ by shape as well as color: ● Red, ▲ Yellow, ■ Blue. */
export function DropGlyph(props: { drop: Drop; class?: string }) {
  return (
    <svg class={["drop", `drop-${props.drop}`, props.class]} viewBox="0 0 100 100" aria-hidden="true">
      <Show when={props.drop === "R"}>
        <circle cx="50" cy="50" r="38" />
      </Show>
      <Show when={props.drop === "Y"}>
        <path d="M50 10 L91 84 Q93 89 87 89 L13 89 Q7 89 9 84 Z" />
      </Show>
      <Show when={props.drop === "B"}>
        <rect x="14" y="14" width="72" height="72" rx="10" />
      </Show>
    </svg>
  );
}

const SHAPE: Record<Drop, string> = { R: "●", Y: "▲", B: "■" };

/** A clue: disc in the blended color, with its letter and the shapes it contains. */
export function ClueDisc(props: { mask: number; class?: string }) {
  const code = () => clueCode(props.mask);
  const parts = () => COLORS.filter((c) => props.mask & c).map((c) => BIT_DROP[c]);
  return (
    <span
      class={["clue-disc", `clue-${code()}`, props.class]}
      role="img"
      aria-label={`${CLUE_NAME[code()]} clue`}
    >
      <span class="clue-letter">{code()}</span>
      <Show when={parts().length > 0}>
        <span class="clue-pips" aria-hidden="true">
          <For each={parts()}>{(d) => <span>{SHAPE[d]}</span>}</For>
        </span>
      </Show>
    </span>
  );
}
