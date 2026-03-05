import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  features: string[];
}

// GET /api/discord/servers - Fetch user's Discord servers
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized - Please login" },
        { status: 401 }
      );
    }

    // Get access token from session
    const accessToken = (session as any).accessToken;

    if (!accessToken) {
      return NextResponse.json(
        {
          error:
            "No Discord access token found. Please re-login with Discord.",
        },
        { status: 401 }
      );
    }

    // Fetch user's guilds from Discord API
    const response = await fetch("https://discord.com/api/v10/users/@me/guilds", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch Discord servers");
    }

    const guilds: DiscordGuild[] = await response.json();

    // Filter to only show servers where user has MANAGE_GUILD permission (0x20)
    const manageableGuilds = guilds.filter((guild) => {
      const permissions = BigInt(guild.permissions);
      const MANAGE_GUILD = BigInt(0x20);
      const ADMINISTRATOR = BigInt(0x8);
      return (
        guild.owner ||
        (permissions & MANAGE_GUILD) === MANAGE_GUILD ||
        (permissions & ADMINISTRATOR) === ADMINISTRATOR
      );
    });

    return NextResponse.json(manageableGuilds, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching Discord servers:", error);
    return NextResponse.json(
      { error: "Failed to fetch Discord servers. Please try again." },
      { status: 500 }
    );
  }
}
