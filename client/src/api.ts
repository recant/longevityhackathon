import { formatApiError } from "./formatApiError";

export type Profile = {
  id: number;
  display_name: string;
  age: number | null;
  sex: string | null;
  lifestyle: string | null;
  medications: string | null;
  smoking: string | null;
  sleep_habits: string | null;
  created_at: string;
};

export type CategoryScore = {
  category: string;
  label: string;
  score: number;
  band: string;
  interpretation: string;
  functional_age: number;
  raw: Record<string, unknown>;
  emoji: string;
  assessment_mode?: string;
  evidence?: string[];
  latest_at?: string;
  trend_detail?: {
    trend: "improving" | "stable" | "watch_closely";
    change_pct: number | null;
    summary: string;
  };
};

export type Snapshot = {
  profile: { id: number; display_name: string; age: number; sex: string | null };
  overall: {
    overall_score: number | null;
    overall_functional_age: number | null;
    chronological_age: number;
    headline: string;
    trend: string;
  };
  categories: CategoryScore[];
  actions: { title: string; detail: string }[];
  tracking_checklist: {
    id: string;
    label: string;
    cadence: string;
    biomarker: boolean;
  }[];
  insights: {
    summary: string;
    conversation_tip: string;
    what_changed?: string;
    mock?: boolean;
  };
  history_counts: { reactions: number; gaits: number; chairs: number };
};

export type ScoredSession = {
  session: Record<string, unknown>;
  scores: CategoryScore;
};

async function json<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(formatApiError(text || res.statusText));
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export async function getProfile(): Promise<Profile> {
  return json(await fetch("/api/profile"));
}

export async function updateProfile(data: Partial<Profile>): Promise<Profile> {
  return json(
    await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
  );
}

export async function saveReaction(trials_ms: number[]) {
  return json<ScoredSession>(
    await fetch("/api/assessments/reaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trials_ms }),
    })
  );
}

export async function saveGait(time_seconds: number) {
  return json<ScoredSession>(
    await fetch("/api/assessments/gait", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ time_seconds }),
    })
  );
}

export async function saveChairStand(riseTimeSeconds: number) {
  return json<ScoredSession>(
    await fetch("/api/assessments/chair-stand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rise_time_seconds: riseTimeSeconds }),
    })
  );
}

export async function getSnapshot(): Promise<Snapshot> {
  return json(await fetch("/api/snapshot"));
}
