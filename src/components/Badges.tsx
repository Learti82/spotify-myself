"use client";

import { CircleArrowDown, MonitorPlay } from "lucide-react";
import type { Song } from "@/lib/types";
import { useDownloads } from "@/store/downloads";

export function YouTubeBadge() {
  return (
    <span
      title="Streams from YouTube via the official player. Not available offline."
      className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-red-600/90 px-1 py-px text-[10px] font-bold uppercase leading-tight text-white"
    >
      <MonitorPlay size={10} strokeWidth={2.5} /> YouTube
    </span>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 6;
  const c = 2 * Math.PI * r;
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className="-rotate-90 shrink-0" aria-label={`Downloading ${Math.round(pct)}%`}>
      <circle cx="8" cy="8" r={r} fill="none" stroke="#4d4d4d" strokeWidth="2" />
      <circle cx="8" cy="8" r={r} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
    </svg>
  );
}

/** Green arrow for offline-ready files; a progress ring while downloading. */
export function OfflineIndicator({ song }: { song: Song }) {
  const progress = useDownloads((s) => s.active[song.id]);
  if (progress) {
    const pct = progress.total ? (progress.loaded / progress.total) * 100 : 10;
    return <ProgressRing pct={pct} />;
  }
  if (song.source === "youtube") return <YouTubeBadge />;
  if (song.offline) {
    return (
      <span title="Downloaded — plays offline" className="shrink-0 text-accent" data-testid="offline-icon">
        <CircleArrowDown size={14} strokeWidth={2.5} aria-label="Available offline" />
      </span>
    );
  }
  return null;
}

export function SourceLabel({ song }: { song: Song }) {
  const label = song.source === "youtube" ? "YouTube stream" : song.source === "url" ? "Authorized download" : "Your file";
  return <span className="text-xs text-subtle">{label}</span>;
}
