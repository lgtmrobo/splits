"use client";

// A vertical list of links with Fluid Functionalism's fluid hover: one
// highlight that springs from row to row under the cursor instead of each
// row blinking its own :hover fill. Rows must touch (no gap) so the
// highlight glides; only rows with an href join, since lighting a row
// promises a click.
//
//   <FluidList>
//     <FluidRow index={0} href="/activities/1">…</FluidRow>
//   </FluidList>

import Link from "next/link";
import { createContext, useContext, useRef, type ReactNode } from "react";
import { FluidHoverHighlight } from "@/components/fluid/fluid-hover-highlight";
import {
  useFluidHover,
  useRegisterFluidHoverItem,
} from "@/lib/fluid/use-fluid-hover";

type Register = (index: number, element: HTMLElement | null) => void;

const RegisterContext = createContext<Register | undefined>(undefined);

export function FluidList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const hover = useFluidHover(ref, { axis: "y" });
  return (
    <div
      ref={ref}
      {...hover.handlers}
      className={["fluid-list", className].filter(Boolean).join(" ")}
    >
      <FluidHoverHighlight hover={hover} className="fluid-list-highlight" />
      <RegisterContext.Provider value={hover.registerItem}>
        {children}
      </RegisterContext.Provider>
    </div>
  );
}

export function FluidRow({
  index,
  href,
  className,
  children,
}: {
  index: number;
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const register = useContext(RegisterContext);
  const ref = useRef<HTMLAnchorElement>(null);
  useRegisterFluidHoverItem(register, index, ref);
  return (
    <Link
      ref={ref}
      href={href}
      className={["fluid-row", className].filter(Boolean).join(" ")}
    >
      {children}
    </Link>
  );
}
