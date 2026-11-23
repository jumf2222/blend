// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import { render } from "@solidjs/web";
import { flush } from "solid-js";
import { App } from "./components/App";
import { generate } from "./engine/generate";

const tick = () => new Promise((r) => setTimeout(r, 0));

function mount(hash: string) {
  localStorage.clear();
  history.replaceState(null, "", `#${hash}`);
  document.body.innerHTML = '<div id="root"></div>';
  const dispose = render(() => <App />, document.getElementById("root")!);
  flush();
  return dispose;
}
const cells = () => [...document.querySelectorAll<HTMLButtonElement>(".board .cell")];
const button = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.includes(text))!;

describe("app", () => {
  beforeEach(() => {
    globalThis.confirm = () => true;
  });

  it("renders the puzzle from the URL with its clues", async () => {
    const dispose = mount("5m-123");
    const p = generate(5, "medium", 123);
    expect(cells()).toHaveLength(25);
    const clueCells = cells().filter((c) => c.classList.contains("is-clue"));
    expect(clueCells).toHaveLength(p.clues.filter((c) => c !== null).length);
    expect(document.body.textContent).toContain("#5m-123");
    dispose();
  });

  it("cycles a cell, flags a duplicate, and undoes", async () => {
    const dispose = mount("6e-7");
    const p = generate(6, "easy", 7);
    const free = cells().filter((_, i) => p.clues[i] === null);
    // Find two free cells in the same row.
    const rowOf = (el: HTMLElement) => Math.floor(Number(el.dataset.index) / 6);
    const a = free[0];
    const b = free.find((c) => c !== a && rowOf(c) === rowOf(a))!;
    a.click();
    b.click();
    flush();
    await tick();
    expect(a.getAttribute("aria-label")).toMatch(/Red/);
    expect(a.classList.contains("bad")).toBe(true);
    expect(a.classList.contains("line-bad")).toBe(true);
    button("Undo").click();
    flush();
    expect(b.getAttribute("aria-label")).toMatch(/blank/);
    expect(a.classList.contains("line-bad")).toBe(false);
    button("Redo").click();
    flush();
    expect(b.getAttribute("aria-label")).toMatch(/Red/);
    dispose();
  });

  it("can be solved by following hints to a win", async () => {
    const dispose = mount("7h-99");
    for (let i = 0; i < 200 && !document.querySelector(".dialog"); i++) {
      button("Hint").click();
      flush();
      const fill = button("Fill it in");
      expect(fill).toBeTruthy();
      fill.click();
      flush();
      await tick();
    }
    expect(document.querySelector(".dialog")?.textContent).toContain("Blended!");
    expect(document.querySelector(".share")?.textContent).toContain("Blend #7h-99");
    const saved = JSON.parse(localStorage.getItem("blend:v1:games")!)["7h-99"];
    expect(saved.won).toBe(true);
    dispose();
  });

  it("restores saved progress when reloading the same puzzle", async () => {
    let dispose = mount("5e-5");
    const p = generate(5, "easy", 5);
    const i = p.clues.findIndex((c) => c === null);
    cells()[i].dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    flush();
    await tick();
    expect(cells()[i].getAttribute("aria-label")).toMatch(/marked empty/);
    dispose();
    document.body.innerHTML = '<div id="root"></div>';
    dispose = render(() => <App />, document.getElementById("root")!);
    flush();
    expect(cells()[i].getAttribute("aria-label")).toMatch(/marked empty/);
    dispose();
  });
});
