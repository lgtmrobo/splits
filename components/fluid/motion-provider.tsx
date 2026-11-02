"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

// Every Motion animation honours the OS reduced-motion setting: transforms
// and layout travel drop, opacity fades stay.
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
