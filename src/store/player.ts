"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { RepeatMode } from "@/lib/types";

/** Imperative controls implemented by the AudioEngine (audio element or YouTube player). */
export interface EngineControls {
  seek: (seconds: number) => void;
  getTime: () => number;
}

let engine: EngineControls | null = null;
export function registerEngine(e: EngineControls | null) {
  engine = e;
}

function shuffled<T>(items: T[], first?: T): T[] {
  const rest = items.filter((x) => x !== first);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return first !== undefined ? [first, ...rest] : rest;
}

interface PlayerState {
  queue: string[];
  /** Queue order before shuffle was enabled, to restore it. */
  originalQueue: string[];
  index: number;
  isPlaying: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  volume: number;
  muted: boolean;
  position: number;
  duration: number;
  contextLabel?: string;
  contextHref?: string;
  queueOpen: boolean;
  nowPlayingOpen: boolean;
  /** Bumped to force a reload of the same track (e.g. repeat one). */
  playToken: number;

  currentId: () => string | undefined;
  playSongs: (ids: string[], startIndex?: number, opts?: { shuffle?: boolean; label?: string; href?: string }) => void;
  togglePlay: () => void;
  setPlaying: (v: boolean) => void;
  next: (auto?: boolean) => void;
  previous: () => void;
  seek: (seconds: number) => void;
  setProgress: (position: number, duration?: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  addToQueue: (ids: string[]) => void;
  playNext: (ids: string[]) => void;
  removeFromQueue: (index: number) => void;
  moveInQueue: (from: number, to: number) => void;
  jumpTo: (index: number) => void;
  clearUpcoming: () => void;
  removeSongEverywhere: (id: string) => void;
  setQueueOpen: (v: boolean) => void;
  setNowPlayingOpen: (v: boolean) => void;
}

export const usePlayer = create<PlayerState>()(
  persist(
    (set, get) => ({
      queue: [],
      originalQueue: [],
      index: 0,
      isPlaying: false,
      shuffle: false,
      repeat: "off",
      volume: 0.8,
      muted: false,
      position: 0,
      duration: 0,
      queueOpen: false,
      nowPlayingOpen: false,
      playToken: 0,

      currentId: () => get().queue[get().index],

      playSongs: (ids, startIndex = 0, opts = {}) => {
        if (!ids.length) return;
        const shuffle = opts.shuffle ?? get().shuffle;
        const start = Math.min(Math.max(startIndex, 0), ids.length - 1);
        const first = opts.shuffle && startIndex === 0 ? ids[Math.floor(Math.random() * ids.length)] : ids[start];
        const queue = shuffle ? shuffled(ids, first) : ids;
        set((s) => ({
          originalQueue: ids,
          queue,
          index: shuffle ? 0 : start,
          shuffle,
          isPlaying: true,
          position: 0,
          contextLabel: opts.label,
          contextHref: opts.href,
          playToken: s.playToken + 1,
        }));
      },

      togglePlay: () => {
        if (!get().queue.length) return;
        set((s) => ({ isPlaying: !s.isPlaying }));
      },
      setPlaying: (v) => set({ isPlaying: v }),

      next: (auto = false) => {
        const { queue, index, repeat } = get();
        if (!queue.length) return;
        if (auto && repeat === "one") {
          set((s) => ({ position: 0, playToken: s.playToken + 1, isPlaying: true }));
          return;
        }
        if (index < queue.length - 1) {
          set((s) => ({ index: index + 1, position: 0, isPlaying: true, playToken: s.playToken + 1 }));
        } else if (repeat !== "off" || !auto) {
          // Wrap to the start; when it's the natural end with repeat off, stop.
          set((s) => ({ index: 0, position: 0, isPlaying: repeat !== "off", playToken: s.playToken + 1 }));
        } else {
          set({ isPlaying: false, position: 0 });
          engine?.seek(0);
        }
      },

      previous: () => {
        const { index, queue } = get();
        const t = engine?.getTime() ?? get().position;
        if (t > 3 || !queue.length) {
          engine?.seek(0);
          set({ position: 0 });
          return;
        }
        const nextIndex = index > 0 ? index - 1 : get().repeat === "all" ? queue.length - 1 : 0;
        set((s) => ({ index: nextIndex, position: 0, isPlaying: true, playToken: s.playToken + 1 }));
      },

      seek: (seconds) => {
        engine?.seek(seconds);
        set({ position: seconds });
      },
      setProgress: (position, duration) =>
        set((s) => ({ position, duration: duration ?? s.duration })),
      setVolume: (v) => set({ volume: Math.min(1, Math.max(0, v)), muted: false }),
      toggleMute: () => set((s) => ({ muted: !s.muted })),

      toggleShuffle: () => {
        const { shuffle, queue, index, originalQueue } = get();
        const current = queue[index];
        if (!queue.length) return set({ shuffle: !shuffle });
        if (!shuffle) {
          set({ shuffle: true, originalQueue: queue, queue: shuffled(queue, current), index: 0 });
        } else {
          // Restore the original order, keeping songs added to the queue meanwhile.
          const base = originalQueue.filter((id) => queue.includes(id));
          const extra = queue.filter((id) => !base.includes(id));
          const restored = [...base, ...extra];
          set({ shuffle: false, queue: restored, index: Math.max(0, restored.indexOf(current)) });
        }
      },
      cycleRepeat: () =>
        set((s) => ({ repeat: s.repeat === "off" ? "all" : s.repeat === "all" ? "one" : "off" })),

      addToQueue: (ids) =>
        set((s) => ({ queue: [...s.queue, ...ids], originalQueue: [...s.originalQueue, ...ids] })),
      playNext: (ids) =>
        set((s) => {
          if (!s.queue.length) return { queue: ids, originalQueue: ids, index: 0, playToken: s.playToken + 1 };
          const q = [...s.queue];
          q.splice(s.index + 1, 0, ...ids);
          return { queue: q, originalQueue: [...s.originalQueue, ...ids] };
        }),
      removeFromQueue: (i) =>
        set((s) => {
          if (i === s.index) return {};
          const q = s.queue.filter((_, idx) => idx !== i);
          return { queue: q, index: i < s.index ? s.index - 1 : s.index };
        }),
      moveInQueue: (from, to) =>
        set((s) => {
          const q = [...s.queue];
          const [item] = q.splice(from, 1);
          q.splice(to, 0, item);
          const current = s.queue[s.index];
          return { queue: q, index: q.indexOf(current) };
        }),
      jumpTo: (i) => set((s) => ({ index: i, position: 0, isPlaying: true, playToken: s.playToken + 1 })),
      clearUpcoming: () => set((s) => ({ queue: s.queue.slice(0, s.index + 1) })),
      removeSongEverywhere: (id) =>
        set((s) => {
          const current = s.queue[s.index];
          const q = s.queue.filter((x) => x !== id);
          const removedCurrent = current === id;
          const idx = removedCurrent ? Math.min(s.index, q.length - 1) : q.indexOf(current);
          return {
            queue: q,
            originalQueue: s.originalQueue.filter((x) => x !== id),
            index: Math.max(0, idx),
            isPlaying: removedCurrent ? false : s.isPlaying,
            playToken: removedCurrent ? s.playToken + 1 : s.playToken,
          };
        }),
      setQueueOpen: (v) => set({ queueOpen: v }),
      setNowPlayingOpen: (v) => set({ nowPlayingOpen: v }),
    }),
    {
      name: "player-state",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Remember the queue and the playback position, but never auto-play on load.
      partialize: (s) => ({
        queue: s.queue,
        originalQueue: s.originalQueue,
        index: s.index,
        shuffle: s.shuffle,
        repeat: s.repeat,
        volume: s.volume,
        muted: s.muted,
        position: s.position,
        duration: s.duration,
        contextLabel: s.contextLabel,
        contextHref: s.contextHref,
      }),
    },
  ),
);
