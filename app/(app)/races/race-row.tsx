"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

// Table row that navigates on click. Rows without an href render inert.
export function RaceRow({
  href,
  children,
}: {
  href: string | null;
  children: ReactNode;
}) {
  const router = useRouter();
  if (!href) return <tr>{children}</tr>;
  return (
    <tr
      className="clickable"
      onClick={() => router.push(href)}
      onMouseEnter={() => router.prefetch(href)}
    >
      {children}
    </tr>
  );
}
