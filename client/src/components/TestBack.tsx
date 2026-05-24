import { Link } from "react-router-dom";

export default function TestBack() {
  return (
    <Link to="/parent" className="test-back">
      ← Back to tests
    </Link>
  );
}
