import { PublicSiteFrame } from "../_render";

export const dynamic = "force-dynamic";

export default async function PublicSiteHome({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  const { siteSlug } = await params;
  return <PublicSiteFrame siteSlug={siteSlug} />;
}
