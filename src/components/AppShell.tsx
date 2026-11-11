"use client";

import { useRouter } from "next/navigation";
import { Suspense, useCallback, type ReactNode } from "react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { GlobalDialogs } from "./Dialogs";
import { PlaybackEngine } from "./PlaybackEngine";
import { NowPlaying, PlayerBar } from "./PlayerBar";
import { QueuePanel } from "./QueuePanel";
import { ServiceWorkerRegistration } from "./ServiceWorker";
import { MobileNav, Sidebar } from "./Sidebar";

/**
 * Persistent layout. It lives in the route-group layout, so it never unmounts
 * while navigating: the audio element and the queue keep playing across pages.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const focusSearch = useCallback(() => {
    router.push("/search");
    // Previously visited pages stay mounted (hidden), so focus the visible input.
    setTimeout(() => {
      const inputs = [...document.querySelectorAll<HTMLInputElement>("#search-input")];
      inputs.find((el) => el.checkVisibility())?.focus();
    }, 80);
  }, [router]);
  useKeyboardShortcuts(focusSearch);

  return (
    <div className="flex h-dvh flex-col bg-black">
      <div className="flex min-h-0 flex-1 gap-2 p-0 pb-[calc(var(--player-h)+var(--mobile-nav-h))] md:p-2 md:pb-[calc(var(--player-h))]">
        <Suspense>
          <Sidebar />
        </Suspense>
        <main id="main" className="relative min-w-0 flex-1 overflow-y-auto bg-bg md:rounded-lg" data-testid="main">
          {children}
        </main>
        <QueuePanel />
      </div>
      <PlayerBar />
      <MobileNav />
      <NowPlaying />
      <PlaybackEngine />
      <GlobalDialogs />
      <ServiceWorkerRegistration />
    </div>
  );
}
