export default function TreesBackground() {
  return (
    <div className="trees-bg" aria-hidden>
      <svg viewBox="0 0 400 120" preserveAspectRatio="xMidYMax meet">
        <path
          className="tree"
          d="M40 120 L40 70 L25 70 L50 35 L75 70 L60 70 L60 120 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          className="tree tree-mid"
          d="M160 120 L160 55 L140 55 L170 15 L200 55 L180 55 L180 120 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          className="tree tree-sm"
          d="M300 120 L300 75 L288 75 L308 48 L328 75 L316 75 L316 120 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}
