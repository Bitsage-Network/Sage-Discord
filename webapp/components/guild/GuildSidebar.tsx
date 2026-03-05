"use client"

import { X } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { guildNavigation, buildGuildPath, isNavItemActive } from "@/lib/guild-navigation"
import { cn } from "@/lib/utils"

interface GuildDetails {
  id: string
  name: string
  owner_discord_id?: string
  discord_guild_id?: string | null
}

interface GuildSidebarProps {
  guild: GuildDetails
  isOpen?: boolean
  onClose?: () => void
  isMobile?: boolean
}

export function GuildSidebar({
  guild,
  isOpen = true,
  onClose,
  isMobile = false,
}: GuildSidebarProps) {
  const pathname = usePathname()

  // Mobile overlay wrapper
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        {isOpen && (
          <div
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
            onClick={onClose}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border shadow-xl transform transition-transform duration-300 ease-in-out lg:hidden",
            isOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <SidebarContent guild={guild} pathname={pathname} onClose={onClose} isMobile />
        </aside>
      </>
    )
  }

  // Desktop sidebar
  return (
    <aside className="w-72 border-r border-border bg-card sticky top-0 h-screen flex-shrink-0">
      <SidebarContent guild={guild} pathname={pathname} />
    </aside>
  )
}

interface SidebarContentProps {
  guild: GuildDetails
  pathname: string
  onClose?: () => void
  isMobile?: boolean
}

function SidebarContent({ guild, pathname, onClose, isMobile }: SidebarContentProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-foreground truncate">
              {guild.name}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {guild.discord_guild_id ? (
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Discord Connected
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-gray-500" />
                  Not Connected
                </span>
              )}
            </p>
          </div>

          {/* Close button (mobile only) */}
          {isMobile && onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="-mt-1 -mr-2"
              aria-label="Close navigation menu"
            >
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto p-4" aria-label="Guild navigation">
        <div className="space-y-1">
          {guildNavigation.map((item) => {
            const href = buildGuildPath(guild.id, item.href)
            const isActive = isNavItemActive(pathname, item.href)
            const Icon = item.icon

            return (
              <Link
                key={item.name}
                href={href}
                onClick={isMobile ? onClose : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  isActive
                    ? "bg-accent text-accent-foreground border-l-4 border-primary"
                    : "text-muted-foreground"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span className="flex-1">{item.name}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <div className="text-xs text-muted-foreground">
          <p>Guild ID: {guild.id.slice(0, 8)}...</p>
        </div>
      </div>
    </div>
  )
}
