import type { ReactNode } from "react";

export type IconName =
  | "logo"
  | "file"
  | "yaml"
  | "css"
  | "js"
  | "folder"
  | "save"
  | "check"
  | "history"
  | "refresh"
  | "folderOpen"
  | "settings"
  | "x"
  | "link"
  | "globe"
  | "spark"
  | "pulse"
  | "document"
  | "warning"
  | "chevron"
  | "plus";

const paths: Record<IconName, ReactNode> = {
  logo: (
    <>
      <rect width="32" height="32" rx="8" fill="url(#glogo)" />
      <path d="M9 11l7 10 7-10h-4l-3 4.5L13 11z" fill="#fff" />
      <defs>
        <linearGradient id="glogo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b7bff" />
          <stop offset="1" stopColor="#5ad0ff" />
        </linearGradient>
      </defs>
    </>
  ),
  file: <path d="M14 3v4a2 2 0 002 2h4M6 3h8l6 6v12a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z" />,
  yaml: (
    <>
      <path d="M14 3v4a2 2 0 002 2h4M6 3h8l6 6v12a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z" />
      <path d="M9.5 16l2 3 2-3M10 16h3M16 13h.01M16 21h.01" />
    </>
  ),
  css: (
    <>
      <path d="M14 3v4a2 2 0 002 2h4M6 3h8l6 6v12a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z" />
      <path d="M10 15h4l-3.5 4.5H14M17 14.5h.01" />
    </>
  ),
  js: (
    <>
      <path d="M14 3v4a2 2 0 002 2h4M6 3h8l6 6v12a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z" />
      <path d="M9.5 16v5M9.5 16a2.6 2.6 0 013-2.6c1.3 0 2 .8 2 1.6-.6 1.4-5 1-5 3 0 1.6 1.2 2.5 2.8 2a2.6 2.6 0 001.7-2M17 21v-3" />
    </>
  ),
  folder: (
    <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
  ),
  folderOpen: (
    <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v2H6a2 2 0 00-2 2l-1 6V7zM3 16l1.2-4A2 2 0 016.1 11H21l-2.5 8H5a2 2 0 01-2-3z" />
  ),
  save: (
    <>
      <path d="M5 3h11l3 3v15H5z" />
      <path d="M8 3v5h7V3M8 21v-6h8v6" />
    </>
  ),
  check: <path d="M20 6L9 17l-5-5" />,
  history: (
    <>
      <path d="M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 3" />
    </>
  ),
  refresh: (
    <>
      <path d="M21 12a9 9 0 11-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.6-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3h.1a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9v.1a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
    </>
  ),
  x: <path d="M18 6L6 18M6 6l12 12" />,
  link: (
    <>
      <path d="M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.7 1.7" />
      <path d="M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.7-1.7" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 010 18M12 3a15 15 0 000 18" />
    </>
  ),
  spark: (
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" />
  ),
  pulse: <path d="M3 12h4l2.5-6 4 12L16 12h5" />,
  document: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </>
  ),
  warning: (
    <>
      <path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  chevron: <path d="M6 9l6 6 6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
};

export function Icon({
  name,
  size = 18,
  className,
  strokeWidth = 1.6,
}: {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const stroke = name === "logo" ? "none" : "currentColor";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
