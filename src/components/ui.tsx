"use client";

import { Pause, Play, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { usePlayer } from "@/store/player";

export function PageContainer({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`px-4 pb-10 pt-4 md:px-6 md:pt-6 animate-fade-in ${className}`}>{children}</div>;
}

/** Sticky page top bar with title that fades in as you scroll. */
export function TopBar({ children }: { children?: ReactNode }) {
  return <div className="sticky top-0 z-20 flex h-16 items-center gap-3 bg-bg/90 px-4 backdrop-blur md:px-6">{children}</div>;
}

export function Section({ title, href, children, action }: { title: string; href?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-end justify-between gap-4">
        <h2 className="text-xl font-bold md:text-2xl">
          {href ? <Link href={href} className="hover:underline">{title}</Link> : title}
        </h2>
        {action ?? (href && <Link href={href} className="text-sm font-semibold text-muted hover:underline">Show all</Link>)}
      </div>
      {children}
    </section>
  );
}

export function CardGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 md:gap-5">{children}</div>;
}

export function CardRow({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:-mx-2 md:px-2 md:gap-4 [&>*]:w-[42vw] [&>*]:max-w-[200px] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-[180px]">
      {children}
    </div>
  );
}

export function PlayFab({ isActive, onClick, size = "md", label = "Play" }: { isActive?: boolean; onClick: () => void; size?: "md" | "lg"; label?: string }) {
  const playing = usePlayer((s) => s.isPlaying);
  const showPause = isActive && playing;
  const dim = size === "lg" ? "size-14" : "size-12";
  return (
    <button
      aria-label={showPause ? "Pause" : label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isActive) usePlayer.getState().togglePlay();
        else onClick();
      }}
      className={`${dim} grid shrink-0 place-items-center rounded-full bg-accent text-black shadow-lg shadow-black/40 transition hover:scale-105 hover:bg-accent-strong`}
    >
      {showPause ? <Pause size={size === "lg" ? 24 : 20} className="fill-black" /> : <Play size={size === "lg" ? 24 : 20} className="ml-0.5 fill-black" />}
    </button>
  );
}

export function MediaCard({
  href,
  title,
  subtitle,
  image,
  onPlay,
  isActive,
  round,
}: {
  href: string;
  title: string;
  subtitle: ReactNode;
  image: ReactNode;
  onPlay?: () => void;
  isActive?: boolean;
  round?: boolean;
}) {
  return (
    <Link href={href} className="group relative block rounded-lg p-2 transition-colors hover:bg-white/[0.07] md:p-3">
      <div className={`relative mb-3 aspect-square overflow-hidden shadow-lg shadow-black/40 ${round ? "rounded-full" : "rounded-md"}`}>
        {image}
        {onPlay && (
          <div className={`absolute bottom-2 right-2 transition-all duration-200 ${isActive ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:opacity-100"}`}>
            <PlayFab onClick={onPlay} isActive={isActive} />
          </div>
        )}
      </div>
      <div className="truncate font-semibold">{title}</div>
      <div className="mt-1 line-clamp-2 text-sm text-muted">{subtitle}</div>
    </Link>
  );
}

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <div className="grid size-16 place-items-center rounded-full bg-elevated">
        <Icon size={28} className="text-muted" />
      </div>
      <h3 className="text-xl font-bold">{title}</h3>
      {children && <div className="max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** Header used by playlist, album, artist and collection pages. */
export function HeroHeader({
  kind,
  title,
  image,
  meta,
  gradient = "from-emerald-800/80",
  children,
}: {
  kind: string;
  title: ReactNode;
  image: ReactNode;
  meta: ReactNode;
  gradient?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`bg-gradient-to-b ${gradient} to-bg px-4 pb-6 pt-6 md:px-6 md:pt-10`}>
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-end">
        <div className="size-44 shrink-0 shadow-2xl shadow-black/50 md:size-56">{image}</div>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div className="text-xs font-semibold uppercase tracking-wider">{kind}</div>
          <h1 className="my-2 break-words text-3xl font-black tracking-tight sm:text-5xl lg:text-6xl">{title}</h1>
          <div className="text-sm text-white/80">{meta}</div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function ActionBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-4 px-4 py-5 md:px-6">{children}</div>;
}

export function IconButton({ label, onClick, children, active, className = "" }: { label: string; onClick: () => void; children: ReactNode; active?: boolean; className?: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`grid size-10 place-items-center rounded-full transition hover:scale-105 ${active ? "text-accent" : "text-muted hover:text-white"} ${className}`}
    >
      {children}
    </button>
  );
}

export function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${active ? "bg-white text-black" : "bg-white/[0.08] text-white hover:bg-white/[0.14]"}`}
    >
      {children}
    </button>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.06] ${className}`} />;
}
