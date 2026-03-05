"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import { GuildSidebar } from "@/components/guild/GuildSidebar"
import { GuildBreadcrumb } from "@/components/guild/GuildBreadcrumb"

interface GuildDetails {
  id: string
  name: string
  slug: string
  description: string | null
  owner_discord_id: string
  discord_guild_id: string | null
  is_public: boolean
  created_at: string
}

interface GuildLayoutProps {
  children: React.ReactNode
  params: {
    id: string
  }
}

export default function GuildLayout({ children, params }: GuildLayoutProps) {
  const { data: session, status } = useSession()
  const [guild, setGuild] = useState<GuildDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Fetch guild data
  useEffect(() => {
    async function fetchGuild() {
      try {
        setLoading(true)
        const res = await fetch(`/api/guilds/${params.id}`)

        if (!res.ok) {
          if (res.status === 401) {
            redirect("/login")
          } else if (res.status === 403) {
            setError("You don't have permission to view this guild")
          } else if (res.status === 404) {
            setError("Guild not found")
          } else {
            setError("Failed to load guild data")
          }
          return
        }

        const data = await res.json()
        // API returns guild object directly (not wrapped in { success, guild })
        setGuild(data)
      } catch (err) {
        console.error("Error fetching guild:", err)
        setError("Failed to load guild data")
      } finally {
        setLoading(false)
      }
    }

    if (status === "authenticated") {
      fetchGuild()
    } else if (status === "unauthenticated") {
      redirect("/login")
    }
  }, [params.id, status])

  // Loading state
  if (status === "loading" || loading) {
    return (
      <div className="flex h-screen">
        {/* Sidebar skeleton */}
        <aside className="hidden lg:block w-72 border-r border-border bg-card">
          <div className="p-6 border-b border-border">
            <div className="h-6 w-32 bg-gray-700 rounded animate-pulse" />
            <div className="h-4 w-24 bg-gray-700 rounded animate-pulse mt-2" />
          </div>
          <div className="p-4 space-y-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-700 rounded animate-pulse" />
            ))}
          </div>
        </aside>

        {/* Main content skeleton */}
        <div className="flex-1 flex flex-col">
          <div className="h-16 border-b border-border bg-background">
            <div className="h-4 w-64 bg-gray-700 rounded animate-pulse m-4" />
          </div>
          <main className="flex-1 p-6">
            <div className="space-y-4">
              <div className="h-8 w-48 bg-gray-700 rounded animate-pulse" />
              <div className="h-32 bg-gray-700 rounded animate-pulse" />
            </div>
          </main>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !guild) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {error || "Failed to load guild"}
          </h1>
          <p className="text-muted-foreground mb-4">
            Please try again or return to your dashboard.
          </p>
          <a
            href="/dashboard"
            className="text-primary hover:underline"
          >
            Return to Dashboard
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <GuildSidebar guild={guild} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Sticky Breadcrumb + Mobile Menu */}
        <div className="sticky top-0 z-10">
          <GuildBreadcrumb
            guildName={guild.name}
            guildId={guild.id}
            onMenuClick={() => setSidebarOpen(true)}
          />
        </div>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      {/* Mobile Sidebar */}
      <GuildSidebar
        guild={guild}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isMobile
      />
    </div>
  )
}
