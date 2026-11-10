"use client";

import { db } from "./db";

const cache = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

/** Object URL for a locally stored artwork blob, cached for the session. */
export function getArtworkUrl(id: string): Promise<string | null> {
  const hit = cache.get(id);
  if (hit) return Promise.resolve(hit);
  let p = pending.get(id);
  if (!p) {
    p = db.artworks.get(id).then((a) => {
      pending.delete(id);
      if (!a) return null;
      const url = URL.createObjectURL(a.blob);
      cache.set(id, url);
      return url;
    });
    pending.set(id, p);
  }
  return p;
}

export function peekArtworkUrl(id?: string): string | null {
  return id ? cache.get(id) ?? null : null;
}
