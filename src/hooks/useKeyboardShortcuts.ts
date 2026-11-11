"use client";

import { useEffect } from "react";
import { likeSong } from "@/lib/actions";
import { db } from "@/lib/db";
import { usePlayer } from "@/store/player";

export const SHORTCUTS: [string, string][] = [
  ["Space", "Play / pause"],
  ["Shift + →  /  Shift + ←", "Next / previous track"],
  ["→  /  ←", "Seek forward / back 5 s"],
  ["↑  /  ↓", "Volume up / down"],
  ["M", "Mute"],
  ["S", "Shuffle"],
  ["R", "Cycle repeat (off / all / one)"],
  ["L", "Like current song"],
  ["Q", "Toggle queue"],
  ["/", "Search"],
];

export function useKeyboardShortcuts(onSearch: () => void) {
  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) {
        // Range inputs keep arrow keys, but Space should still toggle playback.
        if (!(t instanceof HTMLInputElement && t.type === "range" && e.code === "Space")) return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[role="dialog"]')) return;
      const p = usePlayer.getState();
      switch (e.code) {
        case "Space":
          if (t.tagName === "BUTTON" || t.getAttribute("role") === "row") return; // let buttons activate
          e.preventDefault();
          p.togglePlay();
          break;
        case "ArrowRight":
          e.preventDefault();
          if (e.shiftKey) p.next();
          else p.seek(Math.min(p.duration || Infinity, p.position + 5));
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (e.shiftKey) p.previous();
          else p.seek(Math.max(0, p.position - 5));
          break;
        case "ArrowUp":
          e.preventDefault();
          p.setVolume(p.volume + 0.05);
          break;
        case "ArrowDown":
          e.preventDefault();
          p.setVolume(p.volume - 0.05);
          break;
        case "KeyM":
          p.toggleMute();
          break;
        case "KeyS":
          p.toggleShuffle();
          break;
        case "KeyR":
          p.cycleRepeat();
          break;
        case "KeyQ":
          p.setQueueOpen(!p.queueOpen);
          break;
        case "KeyL": {
          const id = p.queue[p.index];
          const song = id ? await db.songs.get(id) : undefined;
          if (song) await likeSong(song);
          break;
        }
        case "Slash":
          e.preventDefault();
          onSearch();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSearch]);
}
