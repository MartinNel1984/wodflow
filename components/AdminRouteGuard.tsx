"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

// UX guard only — the real boundary is RLS. Bounces a non-organizer
// away from admin pages client-side; a determined client could still
// only read/write what its RLS policies allow.
export default function AdminRouteGuard({ role }: { role: string }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (role !== "organizer") {
      router.replace("/login");
    }
  }, [role, pathname, router]);

  return null;
}
