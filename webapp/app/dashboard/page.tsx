"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Guild {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo_url: string | null;
  member_count: number;
  role_count: number;
  is_admin: boolean;
  created_at: string;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (session) {
      fetchGuilds();
    }
  }, [session]);

  const fetchGuilds = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/guilds");

      if (!response.ok) {
        throw new Error("Failed to fetch guilds");
      }

      const data = await response.json();
      setGuilds(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const totalMembers = guilds.reduce(
    (sum, guild) => sum + (Number(guild.member_count) || 0),
    0
  );
  const totalRoles = guilds.reduce(
    (sum, guild) => sum + (Number(guild.role_count) || 0),
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          Welcome back, {session?.user?.name?.split("#")[0] || "User"}!
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage your guilds and configure token-gating rules
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Total Guilds
              </p>
              <p className="text-2xl font-bold mt-2">
                {isLoading ? "..." : guilds.length}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <svg
                className="h-6 w-6 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Total Members
              </p>
              <p className="text-2xl font-bold mt-2">
                {isLoading ? "..." : totalMembers.toLocaleString()}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <svg
                className="h-6 w-6 text-emerald-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Active Roles
              </p>
              <p className="text-2xl font-bold mt-2">
                {isLoading ? "..." : totalRoles}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-cyan-500/10 flex items-center justify-center">
              <svg
                className="h-6 w-6 text-cyan-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/50 p-4">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      {/* Guild List or Empty State */}
      {!isLoading && guilds.length === 0 ? (
        <>
          {/* Empty State */}
          <div className="rounded-lg border border-border bg-card p-12 text-center">
            <div className="mx-auto max-w-md">
              <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <svg
                  className="h-8 w-8 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">No guilds yet</h3>
              <p className="text-muted-foreground mb-6">
                Get started by creating your first guild to manage token-gating
                rules and community access.
              </p>
              <Link
                href="/dashboard/create-guild"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Create Your First Guild
              </Link>
            </div>
          </div>

          {/* Quick Links */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="font-semibold mb-2">Getting Started</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">→</span>
                  <span>Create a guild and connect your Discord server</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">→</span>
                  <span>Set up token-gating rules for Starknet tokens</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">→</span>
                  <span>Configure bot protection and verification</span>
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="font-semibold mb-2">Resources</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link
                    href="/docs"
                    className="flex items-start gap-2 hover:text-foreground transition"
                  >
                    <span className="text-primary mt-0.5">📖</span>
                    <span>Read the documentation</span>
                  </Link>
                </li>
                <li>
                  <a
                    href="https://discord.gg/bitsage"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2 hover:text-foreground transition"
                  >
                    <span className="text-primary mt-0.5">💬</span>
                    <span>Join our Discord community</span>
                  </a>
                </li>
                <li>
                  <Link
                    href="/docs/starknet"
                    className="flex items-start gap-2 hover:text-foreground transition"
                  >
                    <span className="text-primary mt-0.5">⚡</span>
                    <span>Learn about Starknet integration</span>
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* My Guilds */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">My Guilds</h2>
              <Link
                href="/dashboard/create-guild"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Create Guild
              </Link>
            </div>

            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border bg-card p-6 animate-pulse"
                  >
                    <div className="h-6 bg-muted rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-muted rounded w-full mb-4"></div>
                    <div className="h-4 bg-muted rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {guilds.map((guild) => (
                  <div
                    key={guild.id}
                    onClick={() => router.push(`/dashboard/guild/${guild.id}`)}
                    className="rounded-lg border border-border bg-card p-6 hover:border-primary/50 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                          {guild.name}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          sagerealms.xyz/guild/{guild.slug}
                        </p>
                      </div>
                      {guild.is_admin && (
                        <span className="px-2 py-1 text-xs bg-primary/20 text-primary rounded">
                          Admin
                        </span>
                      )}
                    </div>

                    {guild.description && (
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                        {guild.description}
                      </p>
                    )}

                    <div className="flex gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Members:</span>{" "}
                        <span className="font-semibold">
                          {guild.member_count || 0}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Roles:</span>{" "}
                        <span className="font-semibold">
                          {guild.role_count || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
