import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SproutAvatar from "../components/SproutAvatar";
import { getProfile, getSnapshot } from "../api";
import {
  formatJournalDate,
  profileToJournal,
  setActiveJournalId,
  type Journal,
} from "../journals";

export default function JournalSelect() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [journals, setJournals] = useState<Journal[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    Promise.all([getProfile(), getSnapshot().catch(() => null)])
      .then(([profile, snap]) => {
        setName(profile.display_name);
        let last: string | null = profile.created_at;
        if (snap?.categories?.length) {
          const dates = snap.categories
            .map((c) => c.latest_at)
            .filter(Boolean) as string[];
          if (dates.length) last = dates.sort().reverse()[0];
        }
        const primary = profileToJournal(profile, last);
        setJournals([
          primary,
          {
            id: "demo-2",
            displayName: "Add another parent",
            lastUpdated: null,
            profileId: profile.id,
          },
        ]);
      })
      .catch(() => {
        setJournals([
          {
            id: "1",
            displayName: "Mom/Dad",
            lastUpdated: null,
            profileId: 1,
          },
        ]);
      });
  }, []);

  const pick = (j: Journal) => {
    if (j.id === "demo-2") {
      navigate("/profile");
      return;
    }
    setActiveJournalId(j.id);
    navigate("/parent");
  };

  return (
    <div className="screen screen-journals">
      <button type="button" className="icon-btn journal-menu" aria-label="Menu">
        <span className="icon-circle" />
      </button>

      <header className="journal-header journal-fade-in">
        <p className="welcome-greeting">Welcome Back!</p>
        <h1 className="welcome-name">{name || "Friend"}</h1>
        <p className="journal-prompt">Please select a Longevity Journal to continue</p>
      </header>

      <div className="journal-carousel-wrap">
        <div
          className="journal-carousel"
          onScroll={(e) => {
            const el = e.currentTarget;
            const w = el.offsetWidth;
            const idx = Math.round(el.scrollLeft / w);
            setActiveIdx(Math.min(idx, journals.length - 1));
          }}
        >
          {journals.map((item) => (
            <button
              key={item.id}
              type="button"
              className="journal-card"
              onClick={() => pick(item)}
            >
              <SproutAvatar size={72} />
              <strong>{item.displayName}</strong>
              <em>Last updated: {formatJournalDate(item.lastUpdated)}</em>
              {item.id !== "demo-2" && (
                <span className="journal-card-cta">Open longevity dashboard →</span>
              )}
            </button>
          ))}
        </div>
        <div className="journal-dots">
          {journals.map((_, i) => (
            <span key={i} className={i === activeIdx ? "active" : ""} />
          ))}
        </div>
      </div>
    </div>
  );
}
