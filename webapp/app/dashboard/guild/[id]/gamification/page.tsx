"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  Sparkles,
  Trophy,
  Target,
  TrendingUp,
  Users,
  Star,
  Settings,
  Plus,
  Zap,
  Award,
  BarChart3,
  Gift
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { XPSystemDesigner } from "@/components/gamification/XPSystemDesigner"
import { AchievementCreator } from "@/components/gamification/AchievementCreator"
import { QuestBuilder } from "@/components/gamification/QuestBuilder"
import { LevelRewardsManager } from "@/components/gamification/LevelRewardsManager"

type GamificationConfig = {
  message_xp: number
  message_cooldown_seconds: number
  daily_claim_base_xp: number
  level_curve_type: string
  achievements_enabled: boolean
  quests_enabled: boolean
}

type Stats = {
  total_users: number
  avg_level: number
  total_xp_earned: number
  achievements_earned: number
  quests_completed: number
  active_users_7d: number
}

export default function GamificationPage() {
  const params = useParams()
  const router = useRouter()
  const guildId = params.id as string

  const [config, setConfig] = useState<GamificationConfig | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("overview")

  useEffect(() => {
    fetchData()
  }, [guildId])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch config and stats in parallel
      const [configRes, statsRes] = await Promise.all([
        fetch(`/api/guilds/${guildId}/gamification/config`),
        fetch(`/api/guilds/${guildId}/gamification/stats`)
      ])

      if (!configRes.ok) {
        if (configRes.status === 403) {
          setError("You don't have permission to access this guild's gamification settings")
        } else if (configRes.status === 404) {
          setError("Guild not found")
        } else {
          setError("Failed to load gamification config")
        }
        return
      }

      const configData = await configRes.json()
      setConfig(configData.config)

      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData.stats)
      }
    } catch (error) {
      console.error("Error fetching gamification data:", error)
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/10 to-gray-900 p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header Skeleton */}
          <div className="space-y-3">
            <div className="h-10 w-96 bg-gray-800/50 rounded-lg animate-pulse" />
            <div className="h-5 w-64 bg-gray-800/50 rounded animate-pulse" />
          </div>

          {/* Stats Grid Skeleton */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="bg-gray-800/50 border-gray-700">
                <CardContent className="p-6">
                  <div className="space-y-3">
                    <div className="h-4 w-24 bg-gray-700/50 rounded animate-pulse" />
                    <div className="h-8 w-16 bg-gray-700/50 rounded animate-pulse" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tabs Skeleton */}
          <div className="h-96 bg-gray-800/50 border border-gray-700 rounded-lg animate-pulse" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/10 to-gray-900 p-6 flex items-center justify-center">
        <Card className="bg-gray-800/50 border-red-500/50 max-w-md">
          <CardContent className="p-8 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
              <svg
                className="h-8 w-8 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Unable to Load Gamification</h3>
            <p className="text-gray-400 mb-6">{error}</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={fetchData} variant="outline">
                Try Again
              </Button>
              <Button onClick={() => router.push(`/dashboard/guild/${guildId}`)}>
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/10 to-gray-900 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white">Gamification Designer</h1>
            </div>
            <p className="text-gray-400">
              Design XP systems, achievements, and quests to engage your community
            </p>
          </div>

          <Button
            onClick={() => router.push(`/dashboard/guild/${guildId}/gamification/settings`)}
            variant="outline"
            className="gap-2"
          >
            <Settings className="h-4 w-4" />
            Configure XP System
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Total Users */}
          <Card className="bg-gray-800/50 border-gray-700 hover:border-purple-500/50 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Users className="h-5 w-5 text-purple-400" />
                <Badge variant="outline" className="text-xs">Total</Badge>
              </div>
              <div className="text-2xl font-bold text-white mb-1">
                {stats?.total_users.toLocaleString() || 0}
              </div>
              <div className="text-xs text-gray-400">Users</div>
            </CardContent>
          </Card>

          {/* Average Level */}
          <Card className="bg-gray-800/50 border-gray-700 hover:border-blue-500/50 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="h-5 w-5 text-blue-400" />
                <Badge variant="outline" className="text-xs">Avg</Badge>
              </div>
              <div className="text-2xl font-bold text-white mb-1">
                {stats?.avg_level.toFixed(1) || 0}
              </div>
              <div className="text-xs text-gray-400">Avg Level</div>
            </CardContent>
          </Card>

          {/* Total XP */}
          <Card className="bg-gray-800/50 border-gray-700 hover:border-green-500/50 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Zap className="h-5 w-5 text-green-400" />
                <Badge variant="outline" className="text-xs">XP</Badge>
              </div>
              <div className="text-2xl font-bold text-white mb-1">
                {((stats?.total_xp_earned || 0) / 1000).toFixed(1)}K
              </div>
              <div className="text-xs text-gray-400">Total XP</div>
            </CardContent>
          </Card>

          {/* Achievements */}
          <Card className="bg-gray-800/50 border-gray-700 hover:border-yellow-500/50 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Trophy className="h-5 w-5 text-yellow-400" />
                <Badge variant="outline" className="text-xs">Earned</Badge>
              </div>
              <div className="text-2xl font-bold text-white mb-1">
                {stats?.achievements_earned || 0}
              </div>
              <div className="text-xs text-gray-400">Achievements</div>
            </CardContent>
          </Card>

          {/* Quests */}
          <Card className="bg-gray-800/50 border-gray-700 hover:border-pink-500/50 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Target className="h-5 w-5 text-pink-400" />
                <Badge variant="outline" className="text-xs">Done</Badge>
              </div>
              <div className="text-2xl font-bold text-white mb-1">
                {stats?.quests_completed || 0}
              </div>
              <div className="text-xs text-gray-400">Quests</div>
            </CardContent>
          </Card>

          {/* Active Users */}
          <Card className="bg-gray-800/50 border-gray-700 hover:border-cyan-500/50 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <BarChart3 className="h-5 w-5 text-cyan-400" />
                <Badge variant="outline" className="text-xs">7D</Badge>
              </div>
              <div className="text-2xl font-bold text-white mb-1">
                {stats?.active_users_7d || 0}
              </div>
              <div className="text-xs text-gray-400">Active</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-gray-800 border border-gray-700">
            <TabsTrigger value="overview" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="xp" className="gap-2">
              <Zap className="h-4 w-4" />
              XP System
            </TabsTrigger>
            <TabsTrigger value="achievements" className="gap-2">
              <Trophy className="h-4 w-4" />
              Achievements
            </TabsTrigger>
            <TabsTrigger value="quests" className="gap-2">
              <Target className="h-4 w-4" />
              Quests
            </TabsTrigger>
            <TabsTrigger value="rewards" className="gap-2">
              <Gift className="h-4 w-4" />
              Level Rewards
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* XP System Card */}
              <Card className="bg-gray-800/50 border-gray-700 hover:shadow-lg hover:shadow-purple-500/20 transition-all">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg">
                        <Zap className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-white">XP System</CardTitle>
                        <CardDescription>Configure experience points</CardDescription>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => setActiveTab("xp")}>
                      Configure
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                    <span className="text-sm text-gray-400">Message XP</span>
                    <Badge variant="outline">{config?.message_xp || 5} XP</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                    <span className="text-sm text-gray-400">Daily Claim</span>
                    <Badge variant="outline">{config?.daily_claim_base_xp || 50} XP</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                    <span className="text-sm text-gray-400">Level Curve</span>
                    <Badge variant="outline" className="capitalize">
                      {config?.level_curve_type || 'square_root'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Achievements Card */}
              <Card className="bg-gray-800/50 border-gray-700 hover:shadow-lg hover:shadow-yellow-500/20 transition-all">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg">
                        <Trophy className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-white">Achievements</CardTitle>
                        <CardDescription>Create badges and milestones</CardDescription>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setActiveTab("achievements")}
                      disabled={!config?.achievements_enabled}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Create
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                    <span className="text-sm text-gray-400">Status</span>
                    <Badge variant={config?.achievements_enabled ? "default" : "secondary"}>
                      {config?.achievements_enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                    <span className="text-sm text-gray-400">Total Earned</span>
                    <Badge variant="outline">{stats?.achievements_earned || 0}</Badge>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => setActiveTab("achievements")}
                  >
                    <Star className="h-4 w-4" />
                    Manage Achievements
                  </Button>
                </CardContent>
              </Card>

              {/* Quests Card */}
              <Card className="bg-gray-800/50 border-gray-700 hover:shadow-lg hover:shadow-pink-500/20 transition-all">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-pink-500 to-purple-500 rounded-lg">
                        <Target className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-white">Quests</CardTitle>
                        <CardDescription>Design daily & weekly challenges</CardDescription>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setActiveTab("quests")}
                      disabled={!config?.quests_enabled}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Create
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                    <span className="text-sm text-gray-400">Status</span>
                    <Badge variant={config?.quests_enabled ? "default" : "secondary"}>
                      {config?.quests_enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                    <span className="text-sm text-gray-400">Completed</span>
                    <Badge variant="outline">{stats?.quests_completed || 0}</Badge>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => setActiveTab("quests")}
                  >
                    <Target className="h-4 w-4" />
                    Manage Quests
                  </Button>
                </CardContent>
              </Card>

              {/* Level Rewards Card */}
              <Card className="bg-gray-800/50 border-gray-700 hover:shadow-lg hover:shadow-green-500/20 transition-all">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-green-500 to-cyan-500 rounded-lg">
                        <Gift className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-white">Level Rewards</CardTitle>
                        <CardDescription>Rewards for leveling up</CardDescription>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setActiveTab("rewards")}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-4 bg-gradient-to-r from-gray-700/50 to-gray-700/30 rounded-lg">
                    <div className="text-sm text-gray-400 mb-2">Configure rewards at:</div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">Level 5</Badge>
                      <Badge variant="outline">Level 10</Badge>
                      <Badge variant="outline">Level 25</Badge>
                      <Badge variant="outline">Level 50</Badge>
                      <Badge variant="outline">+ Custom</Badge>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => setActiveTab("rewards")}
                  >
                    <Award className="h-4 w-4" />
                    Configure Level Rewards
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Quick Start Guide */}
            <Card className="bg-gradient-to-br from-gray-800/50 to-purple-900/20 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-400" />
                  Quick Start Guide
                </CardTitle>
                <CardDescription>
                  Get your gamification system up and running in minutes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-gray-700/30 rounded-lg">
                    <div className="text-xl font-bold text-white mb-2">1️⃣</div>
                    <div className="text-sm font-medium text-white mb-1">Configure XP</div>
                    <div className="text-xs text-gray-400">
                      Set XP rates for messages, daily claims, and level curve
                    </div>
                  </div>
                  <div className="p-4 bg-gray-700/30 rounded-lg">
                    <div className="text-xl font-bold text-white mb-2">2️⃣</div>
                    <div className="text-sm font-medium text-white mb-1">Create Achievements</div>
                    <div className="text-xs text-gray-400">
                      Design badges for milestones like "Level 10" or "100 Messages"
                    </div>
                  </div>
                  <div className="p-4 bg-gray-700/30 rounded-lg">
                    <div className="text-xl font-bold text-white mb-2">3️⃣</div>
                    <div className="text-sm font-medium text-white mb-1">Build Quests</div>
                    <div className="text-xs text-gray-400">
                      Create daily/weekly challenges to keep users engaged
                    </div>
                  </div>
                  <div className="p-4 bg-gray-700/30 rounded-lg">
                    <div className="text-xl font-bold text-white mb-2">4️⃣</div>
                    <div className="text-sm font-medium text-white mb-1">Set Level Rewards</div>
                    <div className="text-xs text-gray-400">
                      Grant roles, NFTs, or bonuses when users level up
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* XP System Tab */}
          <TabsContent value="xp">
            <XPSystemDesigner guildId={guildId} onSave={fetchData} />
          </TabsContent>

          {/* Achievements Tab */}
          <TabsContent value="achievements">
            <AchievementCreator guildId={guildId} />
          </TabsContent>

          {/* Quests Tab */}
          <TabsContent value="quests">
            <QuestBuilder guildId={guildId} />
          </TabsContent>

          {/* Level Rewards Tab */}
          <TabsContent value="rewards">
            <LevelRewardsManager guildId={guildId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
