"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// UX guard only — the real boundary is RLS (registrations_select /
// registration_athletes_select via my_registration_ids()).
export default function AthleteRouteGuard({ role }: { role: string }) {
  const router = useRouter();

  useEffect(() => {
    if (role !== "athlete") {
      router.replace("/athlete-login");
    }
  }, [role, router]);

  return null;
}
