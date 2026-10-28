"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTapCounter } from "@/lib/taps";

const TAPS_NEEDED = 7;
const MAX_GAP_MS = 1200;

// The FindIt logo. Tapping the "F" seven times in one quick run opens the admin page.
//
// That is only a shortcut. /admin checks who you are on the server and shows a 404 to
// anyone who is not an admin, so knowing the trick gets nobody in. The rest of the logo
// is the normal link home; the "F" is deliberately not part of the link, so tapping it
// can count without navigating away.
export default function Logo({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [counter] = useState(() => createTapCounter({ needed: TAPS_NEEDED, gapMs: MAX_GAP_MS }));

  return (
    <span className={className}>
      <span
        aria-hidden="true"
        onClick={() => {
          if (counter.tap(Date.now())) router.push("/admin");
        }}
        // touch-action stops mobile browsers treating fast taps as a double-tap zoom.
        style={{ touchAction: "manipulation" }}
        className="cursor-default select-none text-[var(--accent)]"
      >
        F
      </span>
      <Link href="/" aria-label="FindIt home">
        <span className="text-[var(--accent)]">ind</span>It
      </Link>
    </span>
  );
}
