import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/session";
import { acceptInvitationAction } from "./actions";
import { Button } from "@/components/ui/button";

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invite = await prisma.invitation.findUnique({
    where: { token },
    include: { workspace: { select: { id: true, name: true } } },
  });

  if (!invite) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold">Invitation not found</h1>
        <p className="mt-2 text-muted-foreground">
          This link is invalid or has already been used.
        </p>
      </Shell>
    );
  }

  if (invite.acceptedAt) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold">Already accepted</h1>
        <p className="mt-2 text-muted-foreground">
          This invitation has already been used. Sign in to access{" "}
          <span className="font-medium">{invite.workspace.name}</span>.
        </p>
        <Link href="/login" className="mt-4 inline-block">
          <Button>Go to sign in</Button>
        </Link>
      </Shell>
    );
  }

  if (invite.expiresAt < new Date()) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold">Invitation expired</h1>
        <p className="mt-2 text-muted-foreground">
          Ask the workspace admin to send a new invitation.
        </p>
      </Shell>
    );
  }

  const session = await auth();

  // Not signed in → bounce them to signup with the invite email pre-filled.
  if (!session?.user?.id) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold">You&apos;re invited</h1>
        <p className="mt-2 text-muted-foreground">
          You&apos;ve been invited to join{" "}
          <span className="font-medium">{invite.workspace.name}</span> as{" "}
          <span className="font-medium">{invite.role.toLowerCase()}</span>.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Sign up or sign in with <span className="font-medium">{invite.email}</span> to
          continue.
        </p>
        <div className="mt-4 flex gap-2">
          <Link href={`/signup?invite=${token}&email=${encodeURIComponent(invite.email)}`}>
            <Button>Create an account</Button>
          </Link>
          <Link href={`/login?callbackUrl=/invitations/${token}`}>
            <Button variant="outline">I already have an account</Button>
          </Link>
        </div>
      </Shell>
    );
  }

  // Signed in: confirm email match and accept.
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold">Wrong account</h1>
        <p className="mt-2 text-muted-foreground">
          This invitation was sent to{" "}
          <span className="font-medium">{invite.email}</span>. Sign out and sign in with
          that email to accept.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-2xl font-semibold">Join {invite.workspace.name}</h1>
      <p className="mt-2 text-muted-foreground">
        You&apos;ll join as <span className="font-medium">{invite.role.toLowerCase()}</span>.
      </p>
      <form
        action={async () => {
          "use server";
          await acceptInvitationAction(token);
          const jar = await cookies();
          jar.set(ACTIVE_WORKSPACE_COOKIE, invite.workspaceId, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 60 * 60 * 24 * 365,
          });
          redirect("/app");
        }}
        className="mt-4"
      >
        <Button type="submit">Accept invitation</Button>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <div className="rounded-lg border bg-card p-6 shadow-sm">{children}</div>
    </div>
  );
}
