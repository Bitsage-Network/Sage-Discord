import {
  LayoutDashboard,
  Shield,
  Puzzle,
  Gift,
  Gamepad2,
  Users,
  BarChart3,
  Settings2,
  Sliders,
  type LucideIcon,
} from "lucide-react"

export interface GuildNavItem {
  name: string
  href: string
  icon: LucideIcon
  description?: string
}

export const guildNavigation: GuildNavItem[] = [
  {
    name: "Overview",
    href: "",
    icon: LayoutDashboard,
    description: "Guild dashboard and statistics",
  },
  {
    name: "Token-Gating",
    href: "/token-gating",
    icon: Shield,
    description: "Configure wallet-based role requirements",
  },
  {
    name: "Requirement Builder",
    href: "/requirement-builder",
    icon: Puzzle,
    description: "Build complex access requirements with logic gates",
  },
  {
    name: "Reward Campaigns",
    href: "/rewards",
    icon: Gift,
    description: "Create and manage reward campaigns",
  },
  {
    name: "Gamification",
    href: "/gamification",
    icon: Gamepad2,
    description: "Configure XP, achievements, and quests",
  },
  {
    name: "Members",
    href: "/members",
    icon: Users,
    description: "View and manage guild members",
  },
  {
    name: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    description: "Member growth and engagement statistics",
  },
  {
    name: "Bot Configuration",
    href: "/bot-config",
    icon: Settings2,
    description: "Configure Discord bot behavior",
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Sliders,
    description: "Guild settings and preferences",
  },
]

/**
 * Builds the full path for a guild feature
 */
export function buildGuildPath(guildId: string, feature: string = ""): string {
  const base = `/dashboard/guild/${guildId}`
  return feature ? `${base}${feature}` : base
}

/**
 * Gets the active navigation item based on the current pathname
 */
export function getActiveNavItem(pathname: string): GuildNavItem | null {
  // Extract the feature path from the full pathname
  // e.g., "/dashboard/guild/123/token-gating" -> "/token-gating"
  const match = pathname.match(/\/dashboard\/guild\/[^/]+(.*)/)
  const featurePath = match ? match[1] : ""

  // Find matching nav item
  const navItem = guildNavigation.find((item) => {
    if (item.href === "" && featurePath === "") {
      return true // Overview page
    }
    return featurePath.startsWith(item.href) && item.href !== ""
  })

  return navItem || null
}

/**
 * Gets the display name for the current feature based on pathname
 */
export function getFeatureDisplayName(pathname: string): string {
  const activeItem = getActiveNavItem(pathname)
  return activeItem?.name || "Overview"
}

/**
 * Checks if a navigation item is active based on the current pathname
 */
export function isNavItemActive(
  pathname: string,
  navItemHref: string
): boolean {
  // Extract the feature path from the full pathname
  const match = pathname.match(/\/dashboard\/guild\/[^/]+(.*)/)
  const featurePath = match ? match[1] : ""

  // Special case for overview (empty href)
  if (navItemHref === "") {
    return featurePath === ""
  }

  // Check if pathname starts with the nav item's href
  return featurePath.startsWith(navItemHref)
}
