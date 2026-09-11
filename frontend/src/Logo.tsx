export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#141414" />
      <g transform="translate(4,4)" fill="none" stroke="#ffffff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
        <line x1="22" y1="2" x2="11" y2="13" />
      </g>
    </svg>
  );
}
