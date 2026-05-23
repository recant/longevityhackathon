import { useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import Assess from "./pages/Assess";
import ChairStandTest from "./pages/ChairStandTest";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import PathSelect, { useStoredPath } from "./pages/PathSelect";
import Profile from "./pages/Profile";
import ReactionTest from "./pages/ReactionTest";
import VideoChair from "./pages/VideoChair";
import VideoWalk from "./pages/VideoWalk";
import WalkTest from "./pages/WalkTest";
import type { AssessmentPath } from "./path";

function Disclaimer() {
  return (
    <div className="disclaimer" role="note">
      <strong>KinSpan</strong> shares wellness trends and functional aging insights — not
      diagnoses. Patterns sometimes reflect stamina or mobility changes; talk with a clinician
      when worried.
    </div>
  );
}

function AppNav({ path }: { path: AssessmentPath }) {
  return (
    <nav className="tabs">
      <NavLink to="/" end>
        Home
      </NavLink>
      <NavLink to="/profile">Profile</NavLink>
      <NavLink to="/assess">Check-ins</NavLink>
      {path === "manual" ? (
        <>
          <NavLink to="/assess/reaction">Reaction</NavLink>
          <NavLink to="/assess/walk">Walk</NavLink>
          <NavLink to="/assess/chair">Chair</NavLink>
        </>
      ) : (
        <>
          <NavLink to="/assess/video-walk">Video walk</NavLink>
          <NavLink to="/assess/video-chair">Video chair</NavLink>
          <NavLink to="/assess/reaction">Reaction</NavLink>
        </>
      )}
      <NavLink to="/dashboard">Trajectory</NavLink>
    </nav>
  );
}

export default function App() {
  const [path, setPath] = useStoredPath();
  const [, tick] = useState(0);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>KinSpan</h1>
        <p className="tagline">Longevity translator for families</p>
      </header>
      <Disclaimer />
      <PathSelect
        value={path}
        onChange={(p) => {
          setPath(p);
          tick((n) => n + 1);
        }}
      />
      <AppNav path={path} />
      <Routes>
        <Route path="/" element={<Home path={path} />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/assess" element={<Assess />} />
        <Route path="/assess/reaction" element={<ReactionTest />} />
        <Route path="/assess/walk" element={<WalkTest />} />
        <Route path="/assess/chair" element={<ChairStandTest />} />
        <Route path="/assess/video-walk" element={<VideoWalk />} />
        <Route path="/assess/video-chair" element={<VideoChair />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </div>
  );
}
