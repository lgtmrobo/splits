import type { SVGProps } from "react";

export type IconName =
  | "dash"
  | "activities"
  | "plan"
  | "shoe"
  | "race"
  | "stats"
  | "activity-detail"
  | "up"
  | "down"
  | "arrow-right"
  | "dot"
  | "search"
  | "filter"
  | "sync"
  | "mountain"
  | "heart"
  | "flag"
  | "zap"
  | "check"
  | "x"
  | "more"
  | "chevron-right"
  | "chevron-down"
  | "calendar"
  | "clock"
  | "settings"
  | "sparkle"
  | "play";

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 16, className = "", ...rest }: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    ...rest,
  };

  switch (name) {
    case "dash":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
      );
    case "activities":
      return (
        <svg {...common}>
          <path d="M3 12h4l2-7 4 14 2-7h6" />
        </svg>
      );
    case "plan":
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path d="M3 9h18M8 2v4M16 2v4" />
        </svg>
      );
    case "shoe":
      return (
        <svg {...common}>
          <path d="M2 16c0-1 1-2 2-2h4l2-3 3 1 2-2h4a3 3 0 0 1 3 3v2c0 1-1 2-2 2H4c-1 0-2-1-2-1z" />
          <path d="M6 14v-2M10 14v-2" />
        </svg>
      );
    case "race":
    case "flag":
      return (
        <svg {...common}>
          <path d="M4 4v17" />
          <path d="M4 4h14l-2 4 2 4H4" />
        </svg>
      );
    case "stats":
      return (
        <svg {...common}>
          <path d="M3 21V3" />
          <path d="M7 17v-6M11 17v-10M15 17v-4M19 17v-9" />
        </svg>
      );
    case "activity-detail":
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" />
        </svg>
      );
    case "up":
      return (
        <svg {...common}>
          <path d="M7 17L17 7" />
          <path d="M10 7h7v7" />
        </svg>
      );
    case "down":
      return (
        <svg {...common}>
          <path d="M7 7l10 10" />
          <path d="M17 10v7h-7" />
        </svg>
      );
    case "arrow-right":
      return (
        <svg {...common}>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      );
    case "dot":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" fill="currentColor" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      );
    case "filter":
      return (
        <svg {...common}>
          <path d="M3 5h18M6 12h12M10 19h4" />
        </svg>
      );
    case "sync":
      return (
        <svg {...common}>
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
          <path d="M21 3v5h-5M3 21v-5h5" />
        </svg>
      );
    case "mountain":
      return (
        <svg {...common}>
          <path d="M3 20l6-10 4 6 3-4 5 8z" />
        </svg>
      );
    case "heart":
      return (
        <svg {...common}>
          <path d="M12 20s-7-4-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 6-7 10-7 10z" />
        </svg>
      );
    case "zap":
      return (
        <svg {...common}>
          <path d="M13 3L4 14h7l-1 7 9-11h-7z" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="M4 12l5 5L20 6" />
        </svg>
      );
    case "x":
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      );
    case "more":
      return (
        <svg {...common}>
          <circle cx="5" cy="12" r="1" fill="currentColor" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
          <circle cx="19" cy="12" r="1" fill="currentColor" />
        </svg>
      );
    case "chevron-right":
      return (
        <svg {...common}>
          <path d="M9 6l6 6-6 6" />
        </svg>
      );
    case "chevron-down":
      return (
        <svg {...common}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      );
    case "sparkle":
      return (
        <svg {...common}>
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
        </svg>
      );
    case "play":
      return (
        <svg {...common}>
          <path d="M6 4l14 8-14 8z" fill="currentColor" />
        </svg>
      );
    default:
      return null;
  }
}
