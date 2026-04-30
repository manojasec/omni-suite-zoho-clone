import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { userHasActiveTwoFactor, verifyTwoFactorToken } from "@/lib/two-factor-cookie";
export { userHasActiveTwoFactor } from "@/lib/two-factor-cookie";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const TWO_FACTOR_PROVIDER_ID = "two-factor";

const providers: any[] = [
  Credentials({
    name: "Email & password",
    credentials: { email: { label: "Email" }, password: { label: "Password", type: "password" } },
    async authorize(raw) {
      const parsed = credentialsSchema.safeParse(raw);
      if (!parsed.success) return null;
      const { email, password } = parsed.data;
      const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (!user?.hashedPassword) return null;
      const ok = await bcrypt.compare(password, user.hashedPassword);
      if (!ok) return null;
      // If 2FA is fully enrolled, refuse the password-only path. The client
      // flow must call loginAction → verify2faLoginAction → signIn("two-factor").
      if (userHasActiveTwoFactor(user.twoFactorSecret)) return null;
      return { id: user.id, email: user.email, name: user.name ?? undefined, image: user.image ?? undefined };
    },
  }),
  Credentials({
    id: TWO_FACTOR_PROVIDER_ID,
    name: "Two-factor token",
    credentials: { token: { label: "Token" } },
    async authorize(raw) {
      const token = typeof raw?.token === "string" ? raw.token : null;
      if (!token) return null;
      const verified = verifyTwoFactorToken(token);
      if (!verified) return null;
      const user = await prisma.user.findUnique({ where: { id: verified.userId } });
      if (!user) return null;
      return { id: user.id, email: user.email, name: user.name ?? undefined, image: user.image ?? undefined };
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.sub = (user as any).id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) (session.user as any).id = token.sub;
      return session;
    },
  },
});
