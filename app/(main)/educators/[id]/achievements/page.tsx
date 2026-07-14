"use client";

import { use } from "react";
import EducatorAchievementsPage from "@/components/educators/EducatorAchievementsPage";

export default function EducatorAchievementsRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <EducatorAchievementsPage userId={id} />;
}
