"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Small anchored menu rendered in a portal so it is never clipped by scroll containers. */
export function Popover({
  anchor,
  open,
  onClose,
  children,
  align = "end",
}: {
  anchor: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  align?: "start" | "end";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchor || !ref.current) return;
    const a = anchor.getBoundingClientRect();
    const m = ref.current.getBoundingClientRect();
    let top = a.bottom + 6;
    if (top + m.height > window.innerHeight - 8) top = Math.max(8, a.top - m.height - 6);
    let left = align === "end" ? a.right - m.width : a.left;
    left = Math.min(Math.max(8, left), window.innerWidth - m.width - 8);
    setPos({ top, left });
  }, [open, anchor, align]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node) && !anchor?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onScroll = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onClose);
    };
  }, [open, anchor, onClose]);

  if (!open) return null;
  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
      className="fixed z-[70] min-w-56 max-w-[calc(100vw-16px)] rounded-md bg-[#282828] p-1 text-sm shadow-2xl shadow-black/60 animate-fade-in"
    >
      {children}
    </div>,
    document.body,
  );
}

export function MenuItem({
  icon: Icon,
  children,
  onClick,
  danger,
}: {
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-left hover:bg-white/10 ${danger ? "text-red-400" : "text-neutral-100"}`}
    >
      {Icon && <Icon size={16} className="shrink-0 opacity-80" />}
      <span className="truncate">{children}</span>
    </button>
  );
}

export function MenuDivider() {
  return <div className="my-1 h-px bg-white/10" />;
}
