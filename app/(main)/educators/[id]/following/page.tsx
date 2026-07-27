import { redirect } from "next/navigation";

export default async function FollowingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/educators/${id}?list=following`);
}
