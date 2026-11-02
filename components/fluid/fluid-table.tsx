"use client";

// A table whose body rows share one fluid-hover highlight, drawn once
// behind the whole <table> (registry: Table). Body rows opt in with an
// index and an href; the whole row is the click target. Header rows don't
// register.
//
//   <FluidTable>
//     <thead>…</thead>
//     <tbody>
//       <FluidTr index={0} href="/activities/1">…cells…</FluidTr>
//     </tbody>
//   </FluidTable>

import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useRef,
  type MouseEvent,
  type ReactNode,
} from "react";
import { FluidHoverHighlight } from "@/components/fluid/fluid-hover-highlight";
import {
  useFluidHover,
  useRegisterFluidHoverItem,
} from "@/lib/fluid/use-fluid-hover";

type Register = (index: number, element: HTMLElement | null) => void;

const RegisterContext = createContext<Register | undefined>(undefined);

export function FluidTable({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const hover = useFluidHover(ref, { axis: "y" });
  return (
    <div ref={ref} className="fluid-list fluid-table" {...hover.handlers}>
      <FluidHoverHighlight hover={hover} className="fluid-list-highlight" />
      <RegisterContext.Provider value={hover.registerItem}>
        <table className="tbl">{children}</table>
      </RegisterContext.Provider>
    </div>
  );
}

export function FluidTr({
  index,
  href,
  children,
}: {
  index: number;
  href: string;
  children: ReactNode;
}) {
  const register = useContext(RegisterContext);
  const router = useRouter();
  const ref = useRef<HTMLTableRowElement>(null);
  useRegisterFluidHoverItem(register, index, ref);

  function onClick(e: MouseEvent<HTMLTableRowElement>) {
    // A link inside the row handles itself (and keeps cmd-click working).
    if ((e.target as HTMLElement).closest("a")) return;
    router.push(href);
  }

  return (
    <tr ref={ref} className="fluid-tr" onClick={onClick}>
      {children}
    </tr>
  );
}
