"use client"

import { ChevronRight, Home, Menu } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { getFeatureDisplayName } from "@/lib/guild-navigation"

interface GuildBreadcrumbProps {
  guildName: string
  guildId: string
  onMenuClick?: () => void
}

export function GuildBreadcrumb({
  guildName,
  guildId,
  onMenuClick,
}: GuildBreadcrumbProps) {
  const pathname = usePathname()
  const featureName = getFeatureDisplayName(pathname)

  return (
    <div className="flex items-center gap-2 px-6 py-4 bg-background border-b border-border">
      {/* Mobile Menu Button */}
      {onMenuClick && (
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden -ml-2"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}

      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
        {/* Home / Dashboard Link */}
        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Home className="h-4 w-4" />
          <span className="hidden md:inline">Dashboard</span>
        </Link>

        <ChevronRight className="h-4 w-4 text-muted-foreground" />

        {/* Guild Name */}
        <Link
          href={`/dashboard/guild/${guildId}`}
          className="text-muted-foreground hover:text-foreground transition-colors max-w-[200px] md:max-w-none truncate"
        >
          {guildName}
        </Link>

        {/* Current Feature (if not on overview page) */}
        {featureName !== "Overview" && (
          <>
            <ChevronRight className="h-4 w-4 text-muted-foreground hidden sm:block" />
            <span className="font-medium text-foreground hidden sm:block">
              {featureName}
            </span>
          </>
        )}
      </nav>

      {/* Mobile: Show only current feature name */}
      {featureName !== "Overview" && (
        <span className="ml-auto font-medium text-foreground sm:hidden text-sm">
          {featureName}
        </span>
      )}
    </div>
  )
}
