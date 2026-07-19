"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// UX guard only — the real boundary is RLS (scores_insert_judge checks
// my_assigned_heat_ids()). Bounces a non-judge away from judge pages.
export default function JudgeRouteGuard({ role }: { role: string }) {
  const router = useRouter();

  useEffect(() => {
    if (role !== "judge") {
      router.replace("/judge-login");
    }
  }, [role, router]);

  return null;
}
