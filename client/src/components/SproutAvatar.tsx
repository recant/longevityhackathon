type Props = { size?: number; className?: string };

export default function SproutAvatar({ size = 88, className = "" }: Props) {
  return (
    <div
      className={`sprout-avatar ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 64 64" width={size * 0.5} height={size * 0.5}>
        <path
          d="M32 48 C32 48 20 38 20 28 C20 22 24 18 28 22 C28 14 34 10 32 18 C38 10 44 14 42 22 C46 18 50 22 50 28 C50 38 32 48 32 48 Z"
          fill="#7FA68C"
        />
        <path d="M32 48 L32 56" stroke="#5a8a68" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
}
