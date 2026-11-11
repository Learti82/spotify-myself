"use client";

import { create } from "zustand";

export interface Toast {
  id: number;
  message: string;
  tone?: "default" | "error" | "success";
}

interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

interface UIState {
  toasts: Toast[];
  editSongId: string | null;
  addToPlaylistSongIds: string[] | null;
  confirm: ConfirmRequest | null;
  sidebarCollapsed: boolean;
  toast: (message: string, tone?: Toast["tone"]) => void;
  dismissToast: (id: number) => void;
  openEditSong: (id: string | null) => void;
  openAddToPlaylist: (ids: string[] | null) => void;
  askConfirm: (req: Omit<ConfirmRequest, "resolve">) => Promise<boolean>;
  closeConfirm: (ok: boolean) => void;
}

let toastId = 0;

export const useUI = create<UIState>((set, get) => ({
  toasts: [],
  editSongId: null,
  addToPlaylistSongIds: null,
  confirm: null,
  sidebarCollapsed: false,
  toast: (message, tone = "default") => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, message, tone }] }));
    setTimeout(() => get().dismissToast(id), tone === "error" ? 6000 : 3500);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  openEditSong: (id) => set({ editSongId: id }),
  openAddToPlaylist: (ids) => set({ addToPlaylistSongIds: ids }),
  askConfirm: (req) => new Promise<boolean>((resolve) => set({ confirm: { ...req, resolve } })),
  closeConfirm: (ok) => {
    get().confirm?.resolve(ok);
    set({ confirm: null });
  },
}));

export const toast = (message: string, tone?: Toast["tone"]) => useUI.getState().toast(message, tone);
