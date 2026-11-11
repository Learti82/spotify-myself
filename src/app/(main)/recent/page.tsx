"use client";

import { History } from "lucide-react";
import { SongList } from "@/components/SongList";
import { EmptyState, PageContainer } from "@/components/ui";
import { useHistory } from "@/hooks/library";

export default function RecentPage() {
  const history = useHistory(200);
  return (
    <PageContainer>
      <h1 className="mb-1 text-3xl font-bold">Recently Played</h1>
      <p className="mb-6 text-sm text-muted">Your listening history on this device.</p>
      <SongList
        songs={(history ?? []).map((h) => h.song)}
        dates={(history ?? []).map((h) => h.entry.playedAt)}
        dateLabel="Played"
        context={{ label: "Recently played", href: "/recent" }}
        empty={history && <EmptyState icon={History} title="Nothing played yet">Songs you listen to will show up here.</EmptyState>}
      />
    </PageContainer>
  );
}
