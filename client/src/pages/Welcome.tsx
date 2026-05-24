import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TreesBackground from "../components/TreesBackground";
import { getProfile } from "../api";

export default function Welcome() {
  const navigate = useNavigate();
  const [name, setName] = useState("");

  useEffect(() => {
    getProfile()
      .then((p) => setName(p.display_name))
      .catch(() => setName("there"));
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => navigate("/journals"), 3200);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="screen screen-welcome">
      <div className="welcome-panel welcome-slide-up">
        <p className="welcome-greeting welcome-fade">Welcome Back!</p>
        <h1 className="welcome-name welcome-fade">{name || "…"}</h1>
      </div>
      <TreesBackground />
      <button type="button" className="welcome-skip" onClick={() => navigate("/journals")}>
        Continue
      </button>
    </div>
  );
}
