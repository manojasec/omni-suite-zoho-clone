import { PublicSiteFrame } from "../../_render";

export const dynamic = "force-dynamic";

export default async function PublicSitePage({
  params,
}: {
  params: Promise<{ siteSlug: string; pageSlug: string }>;
}) {
  const { siteSlug, pageSlug } = await params;
  return <PublicSiteFrame siteSlug={siteSlug} pageSlug={pageSlug} />;
}
