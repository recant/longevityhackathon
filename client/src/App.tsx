import type { ReactNode } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Assess from "./pages/Assess";
import ChairStandTest from "./pages/ChairStandTest";
import Dashboard from "./pages/Dashboard";
import GuidedCheckIn from "./pages/GuidedCheckIn";
import JournalSelect from "./pages/JournalSelect";
import LongevityDashboard from "./pages/LongevityDashboard";
import ParentHub from "./pages/ParentHub";
import Profile from "./pages/Profile";
import ReactionTest from "./pages/ReactionTest";
import VideoChair from "./pages/VideoChair";
import VideoWalk from "./pages/VideoWalk";
import WalkTest from "./pages/WalkTest";
import Welcome from "./pages/Welcome";

const LEGACY_PATHS = ["/dashboard/detail", "/profile", "/guided", "/assess"];

function AppChrome({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const legacy = LEGACY_PATHS.some((p) => pathname.startsWith(p));

  if (legacy) {
    return (
      <div className="app-shell">
        <div className="disclaimer" role="note">
          <strong>KinSpan</strong> — wellness trends only, not medical diagnosis.
        </div>
        {children}
      </div>
    );
  }

  return <div className="mobile-app">{children}</div>;
}

export default function App() {
  return (
    <AppChrome>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/journals" element={<JournalSelect />} />
        <Route path="/parent" element={<ParentHub />} />
        <Route path="/dashboard" element={<LongevityDashboard />} />
        <Route path="/dashboard/detail" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/guided" element={<GuidedCheckIn />} />
        <Route path="/assess" element={<Assess />} />
        <Route path="/assess/reaction" element={<ReactionTest />} />
        <Route path="/assess/walk" element={<WalkTest />} />
        <Route path="/assess/chair" element={<ChairStandTest />} />
        <Route path="/assess/video-walk" element={<VideoWalk />} />
        <Route path="/assess/video-chair" element={<VideoChair />} />
      </Routes>
    </AppChrome>
  );
}
