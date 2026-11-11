"use client";

import { create } from "zustand";

export interface DownloadProgress {
  loaded: number;
  total: number;
  label?: string;
}

interface DownloadState {
  active: Record<string, DownloadProgress>;
  set: (id: string, p: DownloadProgress) => void;
  done: (id: string) => void;
}

export const useDownloads = create<DownloadState>((set) => ({
  active: {},
  set: (id, p) => set((s) => ({ active: { ...s.active, [id]: p } })),
  done: (id) =>
    set((s) => {
      const next = { ...s.active };
      delete next[id];
      return { active: next };
    }),
}));
