"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// UX guard only — the real boundary is RLS (scores_insert_judge and
// scores_privileged_all). Bounces anyone who's neither a judge, a
// head_judge, nor an organizer away from judge pages.
export default function JudgeRouteGuard({ role }: { role: string }) {
  const router = useRouter();

  useEffect(() => {
    if (role !== "judge" && role !== "head_judge" && role !== "organizer") {
      router.replace("/judge-login");
    }
  }, [role, router]);

  return null;
}
