"use client";

import { use } from "react";
import EducatorProfile from "@/components/educators/EducatorProfile";

export default function EducatorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <EducatorProfile userId={id} />;
}
