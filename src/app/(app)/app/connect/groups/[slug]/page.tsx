import { redirect } from "next/navigation";

export default async function GroupSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/app/connect?group=${encodeURIComponent(slug)}`);
}
