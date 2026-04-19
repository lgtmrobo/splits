import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Splits",
  description: "Personal run tracker — built on Strava data with AI coach analysis.",
};

// Sync inline script — runs before first paint to apply the saved accent
// from localStorage. Without this the page renders with the default green
// CSS vars and then flashes to the saved color after hydration.
const ACCENT_BOOT = `
(function(){
  try {
    var swatches = {
      "electric-green": ["#8EF542","#6FC02F","rgba(142, 245, 66, 0.12)","rgba(142, 245, 66, 0.35)"],
      "cyan":           ["#42E8F5","#2FB0C0","rgba(66, 232, 245, 0.12)","rgba(66, 232, 245, 0.35)"],
      "amber":          ["#F5C542","#C09A2F","rgba(245, 197, 66, 0.12)","rgba(245, 197, 66, 0.35)"],
      "magenta":        ["#F542B8","#C02F8E","rgba(245, 66, 184, 0.12)","rgba(245, 66, 184, 0.35)"],
      "violet":         ["#A78BFA","#7C6FCF","rgba(167, 139, 250, 0.12)","rgba(167, 139, 250, 0.35)"]
    };
    var saved = localStorage.getItem("splits.accent");
    if (!saved || !swatches[saved]) return;
    var s = swatches[saved];
    var r = document.documentElement;
    r.style.setProperty("--accent", s[0]);
    r.style.setProperty("--accent-dim", s[1]);
    r.style.setProperty("--accent-soft", s[2]);
    r.style.setProperty("--accent-glow", s[3]);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: ACCENT_BOOT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
