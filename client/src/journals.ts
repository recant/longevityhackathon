import type { Profile } from "./api";

export type Journal = {
  id: string;
  displayName: string;
  lastUpdated: string | null;
  profileId: number;
};

const KEY = "kinspan_active_journal";

export function profileToJournal(p: Profile, lastUpdated?: string | null): Journal {
  return {
    id: String(p.id),
    displayName: p.display_name,
    lastUpdated: lastUpdated ?? p.created_at ?? null,
    profileId: p.id,
  };
}

export function getActiveJournalId(): string | null {
  return localStorage.getItem(KEY);
}

export function setActiveJournalId(id: string) {
  localStorage.setItem(KEY, id);
}

export function formatJournalDate(iso: string | null): string {
  if (!iso) return "Not yet updated";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
  } catch {
    return "Not yet updated";
  }
}
