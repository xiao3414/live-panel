type Props = {
  projectId: string;
  size?: number;
  className?: string;
};

import { useId } from "react";

/** 项目标识图形（可按 projectId 扩展多套） */
export function OemProjectLogo({ projectId, size = 40, className }: Props) {
  const gradId = useId();
  const isOem = projectId === "oemconfig" || projectId.startsWith("oem");
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect width="48" height="48" rx="10" fill={`url(#${gradId})`} />
      {isOem ? (
        <>
          <path
            d="M24 12a8 8 0 0 0-8 8v2h16v-2a8 8 0 0 0-8-8Z"
            fill="rgba(255,255,255,0.92)"
          />
          <path
            d="M14 24v6a10 10 0 0 0 20 0v-6H14Zm4 6a6 6 0 1 1 12 0H18Z"
            fill="rgba(255,255,255,0.85)"
          />
          <circle cx="24" cy="28" r="2.5" fill="#3d8bfd" />
        </>
      ) : (
        <path
          d="M16 16h16v16H16V16Z"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth="2"
        />
      )}
      <defs>
        <linearGradient id={gradId} x1="8" y1="6" x2="40" y2="42">
          <stop stopColor="#2563eb" />
          <stop offset="1" stopColor="#1e3a5f" />
        </linearGradient>
      </defs>
    </svg>
  );
}
