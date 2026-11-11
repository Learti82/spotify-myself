"use client";

import { CircleArrowDown, HardDrive, Shuffle, WifiOff } from "lucide-react";
import { useMemo } from "react";
import { SongList } from "@/components/SongList";
import { ActionBar, EmptyState, HeroHeader, IconButton, PageContainer, PlayFab, Section } from "@/components/ui";
import { downloadMany } from "@/lib/actions";
import { canDownload } from "@/lib/audio-source";
import { formatBytes, formatTotalDuration, pluralize } from "@/lib/format";
import { useOnline, useSongs, useStorageEstimate } from "@/hooks/library";
import { useDownloads } from "@/store/downloads";
import { usePlayer } from "@/store/player";

export default function OfflinePage() {
  const songs = useSongs();
  const online = useOnline();
  const active = useDownloads((s) => s.active);
  const offline = useMemo(() => (songs ?? []).filter((s) => s.offline).sort((a, b) => b.importedAt - a.importedAt), [songs]);
  const downloadable = useMemo(() => (songs ?? []).filter(canDownload), [songs]);
  const storage = useStorageEstimate([offline.length]);
  const isActive = usePlayer((s) => s.contextHref === "/offline" && s.queue.length > 0);
  const bytes = offline.reduce((t, s) => t + (s.size ?? 0), 0);
  const total = offline.reduce((t, s) => t + (s.duration || 0), 0);
  const play = (shuffle?: boolean) => usePlayer.getState().playSongs(offline.map((s) => s.id), 0, { label: "Offline Music", href: "/offline", shuffle });
  const inProgress = Object.entries(active);

  return (
    <div>
      <HeroHeader
        kind="Collection"
        title="Offline Music"
        gradient="from-teal-800"
        image={<div className="grid size-full place-items-center rounded-md bg-gradient-to-br from-emerald-700 to-teal-400"><CircleArrowDown size={72} /></div>}
        meta={
          <>
            {pluralize(offline.length, "song")} ready without internet
            {total > 0 && <>, {formatTotalDuration(total)}</>} · {formatBytes(bytes)} on this device
          </>
        }
      >
        {!online && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-3 py-1 text-sm text-amber-200">
            <WifiOff size={14} /> You&apos;re offline — these songs still play.
          </div>
        )}
      </HeroHeader>
      {offline.length > 0 && (
        <ActionBar>
          <PlayFab size="lg" isActive={isActive} onClick={() => play()} label="Play offline music" />
          <IconButton label="Shuffle play" onClick={() => play(true)}><Shuffle size={26} /></IconButton>
        </ActionBar>
      )}

      {inProgress.length > 0 && (
        <PageContainer className="!pb-0">
          <Section title="Downloading">
            <ul className="space-y-3" data-testid="download-progress">
              {inProgress.map(([id, p]) => {
                const pct = p.total ? Math.round((p.loaded / p.total) * 100) : 0;
                return (
                  <li key={id} className="rounded-md bg-surface p-3">
                    <div className="mb-2 flex justify-between text-sm">
                      <span className="truncate">{p.label}</span>
                      <span className="tabular-nums text-muted">{p.total ? `${pct}%` : formatBytes(p.loaded)}</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded bg-white/10">
                      <div className="h-full bg-accent transition-[width]" style={{ width: `${p.total ? pct : 30}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Section>
        </PageContainer>
      )}

      <div className="px-2">
        <SongList
          songs={offline}
          context={{ label: "Offline Music", href: "/offline" }}
          empty={
            songs && (
              <EmptyState icon={CircleArrowDown} title="No offline music yet">
                Files you import from your device are stored here automatically. Authorized downloads can be saved with the download button.
              </EmptyState>
            )
          }
        />
      </div>

      <PageContainer>
        {downloadable.length > 0 && (
          <Section
            title="Available to download"
            action={online ? <button className="text-sm font-semibold text-muted hover:text-white" onClick={() => downloadMany(downloadable)}>Download all</button> : undefined}
          >
            <SongList songs={downloadable} context={{ label: "Available to download" }} showDate={false} />
          </Section>
        )}
        <div className="mt-6 flex items-start gap-3 rounded-lg bg-surface p-4 text-sm text-muted">
          <HardDrive size={18} className="mt-0.5 shrink-0" />
          <div>
            {storage ? (
              <>
                Using {formatBytes(storage.usage)} of about {formatBytes(storage.quota)} available to this app.{" "}
                {storage.persisted ? "Storage is persistent — the browser won't clear it automatically." : "Storage isn't marked persistent yet; installing the app helps keep downloads safe."}
              </>
            ) : (
              "Storage information is unavailable in this browser."
            )}
            <p className="mt-2">YouTube items are streaming-only and never appear here.</p>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
