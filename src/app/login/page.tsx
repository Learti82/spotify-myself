"use client";

import { Loader2, Lock } from "lucide-react";
import { useState } from "react";
import { LogoMark } from "@/components/Logo";

export default function LoginPage() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <main className="grid min-h-dvh place-items-center bg-gradient-to-b from-[#1f3b2d] to-black px-4">
      <form
        className="w-full max-w-sm rounded-2xl bg-black/60 p-8 shadow-2xl backdrop-blur"
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          setError(null);
          try {
            const res = await fetch("/api/auth/login", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ passcode }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.error ?? "Wrong passcode");
            const next = new URLSearchParams(window.location.search).get("next");
            window.location.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
          } catch (err) {
            setError((err as Error).message);
            setLoading(false);
          }
        }}
      >
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <LogoMark size={56} />
          <h1 className="text-2xl font-bold">Cadence</h1>
          <p className="text-sm text-muted">Private music library</p>
        </div>
        <label className="mb-2 block text-sm font-semibold" htmlFor="passcode">Passcode</label>
        <div className="relative">
          <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            id="passcode"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            className="w-full rounded-md bg-[#2a2a2a] py-3 pl-9 pr-3 outline-none ring-white/60 focus:ring-2"
          />
        </div>
        {error && <p className="mt-3 text-sm text-red-400" role="alert">{error}</p>}
        <button disabled={!passcode || loading} className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3 font-bold text-black transition hover:scale-[1.02] disabled:opacity-50">
          {loading && <Loader2 size={16} className="animate-spin" />} Unlock
        </button>
      </form>
    </main>
  );
}
