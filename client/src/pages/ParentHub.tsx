import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SproutAvatar from "../components/SproutAvatar";
import { getProfile, getSnapshot } from "../api";

const TESTS = [
  {
    id: "walk",
    title: "Walking Pace",
    desc: "Test the speed and ease of their walk over a 10 ft distance",
    color: "tile-blue",
    to: "/assess/walk",
  },
  {
    id: "chair",
    title: "Sit & Stand",
    desc: "How many times can they stand up and sit down in 30 seconds?",
    color: "tile-terracotta",
    to: "/assess/chair",
  },
  {
    id: "reaction",
    title: "Reaction Time",
    desc: "Follow the leader and see how quickly they react to instructions",
    color: "tile-sage",
    to: "/assess/reaction",
  },
  {
    id: "manual",
    title: "Manual Entry",
    desc: "Enter your own observational data to add to their Longevity profile",
    color: "tile-dark",
    to: "/guided",
  },
] as const;

export default function ParentHub() {
  const navigate = useNavigate();
  const [name, setName] = useState("NAME");
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    Promise.all([getProfile(), getSnapshot().catch(() => null)])
      .then(([p, snap]) => {
        setName(p.display_name);
        setHasData((snap?.categories?.length ?? 0) > 0);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="screen screen-parent-hub">
      <header className="hub-header">
        <button type="button" className="hub-back" onClick={() => navigate("/journals")}>
          ←
        </button>
        <div className="hub-header-icons">
          <span className="hub-icon" title="Plan" />
          <span className="hub-icon" title="Edit profile" />
          <Link to="/profile" className="hub-icon hub-icon-profile" title="Settings" />
        </div>
        <SproutAvatar size={100} className="hub-avatar" />
      </header>

      <div className="hub-body">
        <h1 className="hub-name">{name}</h1>
        <p className="hub-tagline">
          {hasData
            ? "The next steps of their Longevity Journey"
            : "The first steps of their Longevity Journey"}
        </p>
        {!hasData && <p className="hub-empty-note">Complete a test below to see their summary.</p>}

        <div className="test-tile-grid">
          {TESTS.map((t) => (
            <Link key={t.id} to={t.to} className={`test-tile ${t.color}`}>
              <div className="test-tile-head">{t.title}</div>
              <p>{t.desc}</p>
            </Link>
          ))}
        </div>

        <Link to="/dashboard" className="btn block hub-dashboard-link">
          View longevity dashboard
        </Link>
      </div>
    </div>
  );
}
