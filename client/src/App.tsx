import { NavLink, Route, Routes } from "react-router-dom";
import Assess from "./pages/Assess";
import ChairStandTest from "./pages/ChairStandTest";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import ReactionTest from "./pages/ReactionTest";
import WalkTest from "./pages/WalkTest";

function Disclaimer() {
  return (
    <div className="disclaimer" role="note">
      <strong>KinSpan</strong> shares wellness trends and functional aging insights — not
      diagnoses. Patterns sometimes reflect stamina or mobility changes; talk with a clinician
      when worried.
    </div>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>KinSpan</h1>
        <p className="tagline">Longevity translator for families</p>
      </header>
      <Disclaimer />
      <nav className="tabs">
        <NavLink to="/" end>
          Home
        </NavLink>
        <NavLink to="/profile">Profile</NavLink>
        <NavLink to="/assess">Check-ins</NavLink>
        <NavLink to="/dashboard">Trajectory</NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/assess" element={<Assess />} />
        <Route path="/assess/reaction" element={<ReactionTest />} />
        <Route path="/assess/walk" element={<WalkTest />} />
        <Route path="/assess/chair" element={<ChairStandTest />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </div>
  );
}
