// Per-browser persistence. Every access is guarded: storage can be missing
// or throw (private mode, blocked site data), and the game must still work.

import type { Mark } from "./engine/core";

const GAMES_KEY = "blend:v1:games";
const LAST_KEY = "blend:v1:last";
const STATS_KEY = "blend:v1:stats";
const MAX_SAVED = 20;

export interface SavedGame {
  id: string;
  mode: "daily" | "free";
  daily?: string;
  board: Mark[];
  elapsed: number;
  hints: number;
  checks: number;
  won: boolean;
  savedAt: number;
}

export interface DailyResult {
  time: number;
  hints: number;
}
export interface Stats {
  solved: number;
  daily: Record<string, DailyResult>;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: progress just isn't kept */
  }
}

export const loadGames = () => read<Record<string, SavedGame>>(GAMES_KEY, {});
export const loadLastId = () => read<string | null>(LAST_KEY, null);

export function saveGame(game: SavedGame) {
  const games = loadGames();
  games[game.id] = game;
  const ids = Object.keys(games).sort((a, b) => games[b].savedAt - games[a].savedAt);
  for (const id of ids.slice(MAX_SAVED)) delete games[id];
  write(GAMES_KEY, games);
  write(LAST_KEY, game.id);
}

export const loadStats = () => read<Stats>(STATS_KEY, { solved: 0, daily: {} });
export const saveStats = (stats: Stats) => write(STATS_KEY, stats);

/** Consecutive daily wins ending today (or yesterday, if today isn't done yet). */
export function dailyStreak(stats: Stats, today: Date): number {
  const key = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const d = new Date(today);
  if (!stats.daily[key(d)]) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (stats.daily[key(d)]) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
