"use client"

import { useSession } from "next-auth/react"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"

interface GuildDetails {
  id: string
  name: string
  slug: string
  description: string
  logo_url: string | null
  banner_url: string | null
  twitter_url: string | null
  website_url: string | null
  discord_guild_id: string | null
  is_public: boolean
  owner_discord_id: string
  is_admin: boolean
  member_count: number
  role_count: number
  page_count: number
  created_at: string
}

export default function GuildDetailPage() {
  const { data: session } = useSession()
  const params = useParams()
  const guildId = params.id as string

  const [guild, setGuild] = useState<GuildDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (session && guildId) {
      fetchGuild()
    }
  }, [session, guildId])

  const fetchGuild = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/guilds/${guildId}`)

      if (response.ok) {
        const data = await response.json()
        setGuild(data)
      }
    } catch (err: any) {
      console.error("Error fetching guild:", err)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-2" />
          <div className="h-4 bg-muted rounded w-1/2" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-6">
              <div className="h-6 bg-muted rounded w-1/2 mb-2" />
              <div className="h-8 bg-muted rounded w-1/3" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!guild) {
    return null
  }

  return (
    <div className="p-6 space-y-6">
      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Total Members
              </p>
              <p className="text-2xl font-bold mt-2">{guild.member_count}</p>
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
                Token-Gated Roles
              </p>
              <p className="text-2xl font-bold mt-2">{guild.role_count}</p>
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

        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Custom Pages
              </p>
              <p className="text-2xl font-bold mt-2">{guild.page_count}</p>
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
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link
          href={`/dashboard/guild/${guild.id}/token-gating`}
          className="rounded-lg border border-border bg-card p-6 hover:border-primary/50 transition-colors group"
        >
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
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
            <div className="flex-1">
              <h3 className="font-semibold group-hover:text-primary transition-colors">
                Token-Gating
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Configure role requirements and rules
              </p>
            </div>
          </div>
        </Link>

        <Link
          href={`/dashboard/guild/${guild.id}/requirement-builder`}
          className="rounded-lg border border-border bg-card p-6 hover:border-primary/50 transition-colors group"
        >
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-lg bg-pink-500/10 flex items-center justify-center flex-shrink-0">
              <svg
                className="h-6 w-6 text-pink-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold group-hover:text-primary transition-colors">
                Requirement Builder
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Visual builder for complex token-gating rules
              </p>
            </div>
          </div>
        </Link>

        <Link
          href={`/dashboard/guild/${guild.id}/rewards`}
          className="rounded-lg border border-border bg-card p-6 hover:border-primary/50 transition-colors group"
        >
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
              <svg
                className="h-6 w-6 text-purple-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold group-hover:text-primary transition-colors">
                Reward Campaigns
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Create and manage reward campaigns
              </p>
            </div>
          </div>
        </Link>

        <Link
          href={`/dashboard/guild/${guild.id}/gamification`}
          className="rounded-lg border border-border bg-card p-6 hover:border-primary/50 transition-colors group"
        >
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
              <svg
                className="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold group-hover:text-primary transition-colors">
                Gamification Designer
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Configure XP, achievements, quests, and rewards
              </p>
            </div>
          </div>
        </Link>

        <Link
          href={`/dashboard/guild/${guild.id}/members`}
          className="rounded-lg border border-border bg-card p-6 hover:border-primary/50 transition-colors group"
        >
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
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
            <div className="flex-1">
              <h3 className="font-semibold group-hover:text-primary transition-colors">
                Members
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                View and manage guild members
              </p>
            </div>
          </div>
        </Link>

        <Link
          href={`/dashboard/guild/${guild.id}/analytics`}
          className="rounded-lg border border-border bg-card p-6 hover:border-primary/50 transition-colors group"
        >
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <svg
                className="h-6 w-6 text-blue-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold group-hover:text-primary transition-colors">
                Analytics
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                View member growth and engagement stats
              </p>
            </div>
          </div>
        </Link>

        <Link
          href={`/dashboard/guild/${guild.id}/bot-config`}
          className="rounded-lg border border-border bg-card p-6 hover:border-primary/50 transition-colors group"
        >
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
              <svg
                className="h-6 w-6 text-orange-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold group-hover:text-primary transition-colors">
                Bot Configuration
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Configure Discord bot settings
              </p>
            </div>
          </div>
        </Link>

        <Link
          href={`/dashboard/guild/${guild.id}/settings`}
          className="rounded-lg border border-border bg-card p-6 hover:border-primary/50 transition-colors group"
        >
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-lg bg-slate-500/10 flex items-center justify-center flex-shrink-0">
              <svg
                className="h-6 w-6 text-slate-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold group-hover:text-primary transition-colors">
                Settings
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Manage guild settings and preferences
              </p>
            </div>
          </div>
        </Link>
      </div>

      {/* Discord Connection Status */}
      {!guild.discord_guild_id && (
        <div className="rounded-lg border border-orange-500/50 bg-orange-500/10 p-6">
          <div className="flex items-start gap-4">
            <svg
              className="h-6 w-6 text-orange-500 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div className="flex-1">
              <h3 className="font-semibold text-orange-500">
                Discord Server Not Connected
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Connect your Discord server to enable the bot and token-gating
                features.
              </p>
              <Link
                href={`/dashboard/guild/${guild.id}/settings#discord`}
                className="inline-block mt-3 px-4 py-2 bg-orange-500 text-white rounded-lg font-semibold hover:opacity-90 transition text-sm"
              >
                Connect Discord Server
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Guild Info */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="font-semibold mb-4">Guild Information</h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Public Guild:</span>
            <span className="font-medium">
              {guild.is_public ? "Yes" : "No"}
            </span>
          </div>
          {guild.twitter_url && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Twitter:</span>
              <a
                href={guild.twitter_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                View Profile
              </a>
            </div>
          )}
          {guild.website_url && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Website:</span>
              <a
                href={guild.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Visit Website
              </a>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Created:</span>
            <span className="font-medium">
              {new Date(guild.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
