"use client";

import { Music, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { useArtworkUrl } from "@/hooks/library";

const GRADIENTS = [
  "from-emerald-700 to-teal-900",
  "from-indigo-700 to-purple-900",
  "from-rose-700 to-orange-900",
  "from-sky-700 to-blue-900",
  "from-amber-600 to-red-900",
  "from-fuchsia-700 to-violet-900",
  "from-lime-700 to-emerald-900",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

interface ArtworkProps {
  artworkId?: string;
  artworkUrl?: string;
  seed?: string;
  className?: string;
  icon?: LucideIcon;
  rounded?: string;
  alt?: string;
}

export function Artwork({ artworkId, artworkUrl, seed = "", className = "size-12", icon: Icon = Music, rounded = "rounded", alt = "" }: ArtworkProps) {
  const url = useArtworkUrl(artworkId, artworkUrl);
  const [failed, setFailed] = useState<string | null>(null);
  if (url && failed !== url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={alt}
        className={`${className} ${rounded} shrink-0 object-cover bg-elevated`}
        onError={() => setFailed(url)}
        draggable={false}
        loading="lazy"
      />
    );
  }
  return (
    <div className={`${className} ${rounded} shrink-0 grid place-items-center bg-gradient-to-br ${GRADIENTS[hash(seed) % GRADIENTS.length]}`}>
      <Icon className="w-2/5 h-2/5 text-white/70" strokeWidth={1.5} />
    </div>
  );
}

/** 2x2 mosaic of the first songs' artwork, used for playlists without a custom cover. */
export function Mosaic({
  coverId,
  artworkIds,
  artworkUrls,
  seed,
  className = "size-12",
  rounded = "rounded",
  icon,
}: {
  coverId?: string;
  artworkIds: (string | undefined)[];
  artworkUrls: (string | undefined)[];
  seed: string;
  className?: string;
  rounded?: string;
  icon?: LucideIcon;
}) {
  const withArt = artworkIds.map((id, i) => ({ id, url: artworkUrls[i] })).filter((a) => a.id || a.url);
  if (coverId || withArt.length < 4) {
    const first = withArt[0];
    return (
      <Artwork
        artworkId={coverId ?? first?.id}
        artworkUrl={coverId ? undefined : first?.url}
        seed={seed}
        className={className}
        rounded={rounded}
        icon={icon}
      />
    );
  }
  return (
    <div className={`${className} ${rounded} shrink-0 grid grid-cols-2 grid-rows-2 overflow-hidden`}>
      {withArt.slice(0, 4).map((a, i) => (
        <Artwork key={i} artworkId={a.id} artworkUrl={a.url} seed={seed + i} className="size-full" rounded="" />
      ))}
    </div>
  );
}
