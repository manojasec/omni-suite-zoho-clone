import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { renderSiteMarkdown } from "@/modules/sites/schemas";

export const dynamic = "force-dynamic";

async function loadSiteAndPage(siteSlug: string, pageSlug?: string) {
  const site = await prisma.site.findFirst({
    where: { slug: siteSlug.toLowerCase(), published: true },
    include: {
      pages: {
        where: { status: "PUBLISHED" },
        orderBy: [{ isHome: "desc" }, { position: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!site) return null;
  const page = pageSlug
    ? site.pages.find((p) => p.slug === pageSlug.toLowerCase())
    : site.pages.find((p) => p.isHome) ?? site.pages[0];
  if (!page) return null;
  return { site, page };
}

export async function PublicSiteFrame({
  siteSlug,
  pageSlug,
}: {
  siteSlug: string;
  pageSlug?: string;
}) {
  const data = await loadSiteAndPage(siteSlug, pageSlug);
  if (!data) notFound();
  const { site, page } = data;
  const html = renderSiteMarkdown(page.body);
  const navPages = site.pages;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header
        className="border-b"
        style={{ background: site.themeColor, color: "#ffffff" }}
      >
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link href={`/site/${site.slug}`} className="font-semibold">
            {site.name}
          </Link>
          <nav className="flex flex-wrap gap-3 text-sm">
            {navPages.map((p) => (
              <Link
                key={p.id}
                href={p.isHome ? `/site/${site.slug}` : `/site/${site.slug}/${p.slug}`}
                className={
                  "hover:underline " +
                  (p.id === page.id ? "underline opacity-100" : "opacity-90")
                }
              >
                {p.title}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <article className="mx-auto max-w-4xl px-4 py-10">
        <div
          className="prose prose-sm sm:prose-base max-w-none [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-4 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:my-3 [&_a]:text-primary [&_a]:underline [&_hr]:my-8"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </article>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        {site.description ?? "Powered by OmniSuite Sites"}
      </footer>
    </main>
  );
}
