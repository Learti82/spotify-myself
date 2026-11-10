"use client";

import { Cloud, CloudDownload, CloudUpload, HardDrive, Keyboard, Loader2, LogOut, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/Modal";
import { PageContainer, Section } from "@/components/ui";
import { backupSongToCloud } from "@/lib/actions";
import { backupMetadata, cloudEnabled, restoreMetadata } from "@/lib/cloud-client";
import { formatBytes, pluralize } from "@/lib/format";
import { requestPersistentStorage } from "@/lib/library";
import { useOnline, useSongs, useStorageEstimate } from "@/hooks/library";
import { SHORTCUTS } from "@/hooks/useKeyboardShortcuts";
import { toast } from "@/store/ui";

export default function SettingsPage() {
  const songs = useSongs();
  const online = useOnline();
  const [cloud, setCloud] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [persistTick, setPersistTick] = useState(0);
  const storage = useStorageEstimate([songs?.length, persistTick]);

  useEffect(() => {
    if (online) cloudEnabled().then(setCloud);
  }, [online]);

  const notUploaded = (songs ?? []).filter((s) => s.offline && !s.cloudPath && s.source !== "youtube");
  const offlineBytes = (songs ?? []).filter((s) => s.offline).reduce((t, s) => t + (s.size ?? 0), 0);

  const task = (name: string, fn: () => Promise<void>) => async () => {
    setBusy(name);
    try {
      await fn();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <PageContainer className="max-w-3xl">
      <h1 className="mb-6 text-3xl font-bold">Settings</h1>

      <Section title="This device">
        <div className="space-y-3 rounded-lg bg-surface p-5 text-sm">
          <div className="flex items-start gap-3">
            <HardDrive size={18} className="mt-0.5 shrink-0 text-muted" />
            <div className="flex-1">
              <p>{pluralize(songs?.filter((s) => s.offline).length ?? 0, "song")} stored offline ({formatBytes(offlineBytes)}).</p>
              {storage && (
                <p className="mt-1 text-muted">
                  Browser storage: {formatBytes(storage.usage)} used of ~{formatBytes(storage.quota)}.{" "}
                  {storage.persisted ? "Persistent storage is on." : "Persistent storage is off — the browser may evict data when space is low."}
                </p>
              )}
            </div>
          </div>
          {storage && !storage.persisted && (
            <Button
              variant="secondary"
              onClick={async () => {
                const ok = await requestPersistentStorage();
                setPersistTick((t) => t + 1);
                toast(ok ? "Persistent storage enabled" : "The browser declined. Installing the app usually allows it.", ok ? "success" : "default");
              }}
            >
              <ShieldCheck size={16} /> Keep my offline music safe
            </Button>
          )}
          <p className="text-muted">Tip: install Cadence from your browser&apos;s menu (“Install app” / “Add to Home Screen”) for a full-screen, offline-ready app.</p>
        </div>
      </Section>

      <Section title="Private cloud backup (optional)">
        <div className="space-y-4 rounded-lg bg-surface p-5 text-sm">
          {cloud === null && <p className="text-muted">{online ? "Checking…" : "Connect to the internet to use cloud backup."}</p>}
          {cloud === false && (
            <p className="text-muted">
              Not configured. Set <code className="text-white">SUPABASE_URL</code> and <code className="text-white">SUPABASE_SERVICE_ROLE_KEY</code> on the server
              and run the SQL in <code className="text-white">supabase/migrations</code> to back up your library privately and restore it on other devices.
              The app works fully without it.
            </p>
          )}
          {cloud && (
            <>
              <p className="flex items-center gap-2 text-accent"><Cloud size={16} /> Connected to your private Supabase project.</p>
              <p className="text-muted">
                Audio files go to a private bucket and are only ever served through short-lived signed links. Once a file is backed up, you can
                remove its offline copy and download it again later.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={!!busy || notUploaded.length === 0}
                  onClick={task("files", async () => {
                    for (const s of notUploaded) await backupSongToCloud(s);
                  })}
                >
                  {busy === "files" ? <Loader2 size={16} className="animate-spin" /> : <CloudUpload size={16} />}
                  Upload {pluralize(notUploaded.length, "file")}
                </Button>
                <Button
                  variant="secondary"
                  disabled={!!busy}
                  onClick={task("backup", async () => {
                    const r = await backupMetadata();
                    toast(`Backed up ${pluralize(r.songs, "song")} and ${pluralize(r.playlists, "playlist")}`, "success");
                  })}
                >
                  {busy === "backup" ? <Loader2 size={16} className="animate-spin" /> : <CloudUpload size={16} />} Back up library
                </Button>
                <Button
                  variant="secondary"
                  disabled={!!busy}
                  onClick={task("restore", async () => {
                    const r = await restoreMetadata();
                    toast(`Restored ${pluralize(r.songs, "song")} and ${pluralize(r.playlists, "playlist")}`, "success");
                  })}
                >
                  {busy === "restore" ? <Loader2 size={16} className="animate-spin" /> : <CloudDownload size={16} />} Restore from cloud
                </Button>
              </div>
            </>
          )}
        </div>
      </Section>

      <Section title="Keyboard shortcuts">
        <ul className="divide-y divide-white/5 rounded-lg bg-surface px-5 text-sm">
          {SHORTCUTS.map(([keys, action]) => (
            <li key={keys} className="flex items-center justify-between py-2.5">
              <span className="text-muted">{action}</span>
              <kbd className="flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 font-mono text-xs"><Keyboard size={12} /> {keys}</kbd>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Account">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface p-5 text-sm">
          <p className="text-muted">This app is private: there is no sign-up, no public profiles and no sharing.</p>
          <form action="/api/auth/logout" method="post">
            <Button variant="secondary" type="submit"><LogOut size={16} /> Lock app</Button>
          </form>
        </div>
      </Section>
    </PageContainer>
  );
}
