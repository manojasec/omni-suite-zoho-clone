import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { startVisitorChatAction } from "@/app/(app)/app/chat/actions";

export const dynamic = "force-dynamic";

/**
 * Embed-friendly chat surface. Renders inside an iframe injected by
 * /api/chat/widget.js. Visitors enter their name/email then are redirected
 * (within the iframe) into the existing /chat/[slug]/[publicId] page.
 */
export default async function ChatEmbedPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ws = await prisma.workspace.findUnique({
    where: { slug },
    select: { id: true, name: true, accentColor: true },
  });
  if (!ws) notFound();

  const accent = ws.accentColor ?? "#0F172A";

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <header
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid #e5e7eb",
          background: accent,
          color: "#fff",
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        Chat with {ws.name}
      </header>
      <form
        action={startVisitorChatAction.bind(null, slug)}
        style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}
      >
        <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
          Send us a message and we&apos;ll reply right here.
        </p>
        <label style={{ fontSize: 12, color: "#475569" }} htmlFor="visitorName">
          Name
        </label>
        <input
          id="visitorName"
          name="visitorName"
          required
          maxLength={120}
          style={inputStyle}
        />
        <label style={{ fontSize: 12, color: "#475569" }} htmlFor="visitorEmail">
          Email
        </label>
        <input
          id="visitorEmail"
          name="visitorEmail"
          type="email"
          required
          maxLength={254}
          style={inputStyle}
        />
        <label style={{ fontSize: 12, color: "#475569" }} htmlFor="message">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          required
          maxLength={4000}
          style={{ ...inputStyle, resize: "vertical" }}
        />
        <button
          type="submit"
          style={{
            marginTop: 4,
            background: accent,
            color: "#fff",
            border: 0,
            padding: "10px 14px",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Start chat
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  fontSize: 14,
  fontFamily: "inherit",
};
