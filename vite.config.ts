import { defineConfig } from "vite";
import solid from "@solidjs/vite-plugin";

export default defineConfig({
  // Relative asset paths, so the build works under any sub-path (e.g. GitHub Pages /blend/).
  base: "./",
  plugins: [solid()],
  test: {
    // UI tests run in jsdom against Solid's browser build.
    environment: "node",
    server: { deps: { inline: [/solid-js/, /@solidjs/] } },
  },
  resolve: process.env.VITEST ? { conditions: ["browser", "development"] } : undefined,
} as any);
