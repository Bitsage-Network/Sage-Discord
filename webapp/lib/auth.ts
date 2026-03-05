import { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import pool from "./db";

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "identify email guilds",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account || !profile) return false;

      try {
        const discordProfile = profile as any;

        // Upsert user in database (same table as Discord bot uses)
        await pool.query(
          `INSERT INTO discord_users (user_id, username, discriminator, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())
           ON CONFLICT (user_id) DO UPDATE
           SET username = $2, discriminator = $3, updated_at = NOW()`,
          [
            discordProfile.id,
            discordProfile.username,
            discordProfile.discriminator || "0",
          ]
        );

        return true;
      } catch (error) {
        console.error("Error in signIn callback:", error);
        return false;
      }
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.discordId = token.discordId as string;
      }
      // Include access token in session for Discord API calls
      (session as any).accessToken = token.accessToken;
      return session;
    },

    async jwt({ token, account, profile }) {
      if (account && profile) {
        const discordProfile = profile as any;
        token.discordId = discordProfile.id;
        // Store Discord access token for API calls
        token.accessToken = account.access_token;
      }
      return token;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
};
