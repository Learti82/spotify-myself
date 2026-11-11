"use client";

import {
  CircleArrowDown,
  History,
  Home,
  Library,
  ListMusic,
  Plus,
  Search,
  Settings,
  Upload,
  Heart,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createPlaylist } from "@/lib/library";
import { pluralize } from "@/lib/format";
import { useOnline, usePlaylistsWithStats } from "@/hooks/library";
import { usePlayer } from "@/store/player";
import { Mosaic } from "./Artwork";
import { Logo } from "./Logo";

export const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/library", label: "Your Library", icon: Library },
  { href: "/playlists", label: "Playlists", icon: ListMusic },
  { href: "/liked", label: "Liked Songs", icon: Heart },
  { href: "/recent", label: "Recently Played", icon: History },
  { href: "/offline", label: "Offline Music", icon: CircleArrowDown },
  { href: "/import", label: "Import Music", icon: Upload },
] as const;

function PlaylistLinks() {
  const playlists = usePlaylistsWithStats();
  const params = useSearchParams();
  const pathname = usePathname();
  const playingHref = usePlayer((s) => (s.isPlaying ? s.contextHref : undefined));
  const activeId = pathname === "/playlist" ? params.get("id") : null;
  if (!playlists?.length) {
    return (
      <div className="m-2 rounded-lg bg-elevated p-4">
        <p className="font-semibold">Create your first playlist</p>
        <p className="mt-1 text-sm text-muted">It&apos;s easy, we&apos;ll help you.</p>
      </div>
    );
  }
  return (
    <ul className="space-y-0.5">
      {playlists.map((p) => {
        const href = `/playlist?id=${p.id}`;
        return (
          <li key={p.id}>
            <Link
              href={href}
              className={`flex items-center gap-3 rounded-md p-2 hover:bg-white/[0.07] ${activeId === p.id ? "bg-white/10" : ""}`}
            >
              <Mosaic coverId={p.coverId} artworkIds={p.firstArtworkIds} artworkUrls={p.firstArtworkUrls} seed={p.id} className="size-12" icon={ListMusic} />
              <div className="min-w-0 flex-1">
                <div className={`truncate text-[15px] ${playingHref === href ? "text-accent" : ""}`}>{p.name}</div>
                <div className="truncate text-sm text-muted">Playlist · {pluralize(p.songCount, "song")}</div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const online = useOnline();
  return (
    <aside className="hidden w-[280px] shrink-0 flex-col gap-2 md:flex lg:w-[320px]">
      <nav className="rounded-lg bg-surface px-3 py-4">
        <div className="mb-4 px-3">
          <Logo />
        </div>
        <ul className="space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`flex items-center gap-4 rounded-md px-3 py-2 text-[15px] font-semibold transition-colors ${
                    active ? "text-white" : "text-muted hover:text-white"
                  }`}
                >
                  <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <section className="flex min-h-0 flex-1 flex-col rounded-lg bg-surface">
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <Link href="/playlists" className="font-semibold text-muted hover:text-white">
            Your Playlists
          </Link>
          <button
            aria-label="Create playlist"
            title="Create playlist"
            className="grid size-8 place-items-center rounded-full text-muted hover:bg-white/10 hover:text-white"
            onClick={async () => router.push(`/playlist?id=${await createPlaylist()}`)}
          >
            <Plus size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          <Suspense>
            <PlaylistLinks />
          </Suspense>
        </div>
        <div className="flex items-center justify-between border-t border-white/5 px-5 py-3 text-xs text-muted">
          {online ? (
            <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-accent" /> Online</span>
          ) : (
            <span className="flex items-center gap-2 text-amber-300"><WifiOff size={14} /> Offline — playing local files</span>
          )}
          <Link href="/settings" aria-label="Settings" className="hover:text-white">
            <Settings size={16} />
          </Link>
        </div>
      </section>
    </aside>
  );
}

const MOBILE_NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/library", label: "Library", icon: Library },
  { href: "/offline", label: "Offline", icon: CircleArrowDown },
  { href: "/import", label: "Import", icon: Upload },
] as const;

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 h-[var(--mobile-nav-h)] bg-gradient-to-t from-black via-black/95 to-black/80 md:hidden">
      <ul className="grid h-full grid-cols-5">
        {MOBILE_NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link href={href} className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] ${active ? "text-white" : "text-muted"}`}>
                <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
