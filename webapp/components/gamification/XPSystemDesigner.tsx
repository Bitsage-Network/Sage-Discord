"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Loader2, Zap, TrendingUp, Clock, Gift, MessageSquare, Calendar } from "lucide-react"

interface XPSystemDesignerProps {
  guildId: string
  onSave?: () => void
}

type LevelCurveType = "square_root" | "linear" | "exponential" | "custom"

export function XPSystemDesigner({ guildId, onSave }: XPSystemDesignerProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // XP Configuration
  const [messageXP, setMessageXP] = useState(5)
  const [messageCooldown, setMessageCooldown] = useState(60)
  const [dailyClaimXP, setDailyClaimXP] = useState(50)
  const [streakBonus, setStreakBonus] = useState(1.1)
  const [maxStreakMultiplier, setMaxStreakMultiplier] = useState(2.0)

  // Level Curve
  const [levelCurveType, setLevelCurveType] = useState<LevelCurveType>("square_root")
  const [levelCurveBase, setLevelCurveBase] = useState(100)
  const [levelCurveMultiplier, setLevelCurveMultiplier] = useState(1.0)

  // Features
  const [levelUpAnnouncement, setLevelUpAnnouncement] = useState(true)
  const [levelUpDM, setLevelUpDM] = useState(false)
  const [achievementsEnabled, setAchievementsEnabled] = useState(true)
  const [questsEnabled, setQuestsEnabled] = useState(true)
  const [dailyRewardsEnabled, setDailyRewardsEnabled] = useState(true)
  const [leaderboardEnabled, setLeaderboardEnabled] = useState(true)

  useEffect(() => {
    fetchConfig()
  }, [guildId])

  const fetchConfig = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/guilds/${guildId}/gamification/config`)
      const data = await res.json()

      if (data.success && data.config) {
        const config = data.config
        setMessageXP(config.message_xp || 5)
        setMessageCooldown(config.message_cooldown_seconds || 60)
        setDailyClaimXP(config.daily_claim_base_xp || 50)
        setStreakBonus(config.streak_bonus_multiplier || 1.1)
        setMaxStreakMultiplier(config.max_streak_multiplier || 2.0)
        setLevelCurveType(config.level_curve_type || "square_root")
        setLevelCurveBase(config.level_curve_base || 100)
        setLevelCurveMultiplier(config.level_curve_multiplier || 1.0)
        setLevelUpAnnouncement(config.level_up_announcement ?? true)
        setLevelUpDM(config.level_up_dm ?? false)
        setAchievementsEnabled(config.achievements_enabled ?? true)
        setQuestsEnabled(config.quests_enabled ?? true)
        setDailyRewardsEnabled(config.daily_rewards_enabled ?? true)
        setLeaderboardEnabled(config.leaderboard_enabled ?? true)
      }
    } catch (error) {
      console.error("Error fetching config:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)

      const res = await fetch(`/api/guilds/${guildId}/gamification/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message_xp: messageXP,
          message_cooldown_seconds: messageCooldown,
          daily_claim_base_xp: dailyClaimXP,
          streak_bonus_multiplier: streakBonus,
          max_streak_multiplier: maxStreakMultiplier,
          level_curve_type: levelCurveType,
          level_curve_base: levelCurveBase,
          level_curve_multiplier: levelCurveMultiplier,
          level_up_announcement: levelUpAnnouncement,
          level_up_dm: levelUpDM,
          achievements_enabled: achievementsEnabled,
          quests_enabled: questsEnabled,
          daily_rewards_enabled: dailyRewardsEnabled,
          leaderboard_enabled: leaderboardEnabled
        })
      })

      const data = await res.json()

      if (data.success) {
        onSave?.()
        alert("XP system configuration saved!")
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error: any) {
      console.error("Error saving config:", error)
      alert(`Error saving: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  // Calculate example level progression
  const calculateLevel = (xp: number): number => {
    switch (levelCurveType) {
      case "linear":
        return Math.floor(xp / (levelCurveBase * levelCurveMultiplier)) + 1
      case "square_root":
        return Math.floor(Math.sqrt(xp / (levelCurveBase * levelCurveMultiplier))) + 1
      case "exponential":
        return Math.floor(Math.log2(xp / (levelCurveBase * levelCurveMultiplier) + 1)) + 1
      default:
        return Math.floor(Math.sqrt(xp / levelCurveBase)) + 1
    }
  }

  const xpForLevel = (level: number): number => {
    switch (levelCurveType) {
      case "linear":
        return (level - 1) * levelCurveBase * levelCurveMultiplier
      case "square_root":
        return Math.pow(level - 1, 2) * levelCurveBase * levelCurveMultiplier
      case "exponential":
        return (Math.pow(2, level - 1) - 1) * levelCurveBase * levelCurveMultiplier
      default:
        return Math.pow(level - 1, 2) * levelCurveBase
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* XP Rates */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-green-500 to-cyan-500 rounded-lg">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-white">XP Rates</CardTitle>
              <CardDescription>Configure how users earn experience points</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Message XP */}
            <div className="space-y-2">
              <Label htmlFor="messageXP" className="flex items-center gap-2 text-gray-300">
                <MessageSquare className="h-4 w-4 text-blue-400" />
                Message XP
              </Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="messageXP"
                  type="number"
                  value={messageXP}
                  onChange={(e) => setMessageXP(parseInt(e.target.value) || 0)}
                  className="bg-gray-700 border-gray-600 text-white"
                  min={0}
                  max={100}
                />
                <Badge variant="outline">per message</Badge>
              </div>
              <p className="text-xs text-gray-400">
                XP earned for each message sent (with cooldown)
              </p>
            </div>

            {/* Message Cooldown */}
            <div className="space-y-2">
              <Label htmlFor="messageCooldown" className="flex items-center gap-2 text-gray-300">
                <Clock className="h-4 w-4 text-yellow-400" />
                Message Cooldown
              </Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="messageCooldown"
                  type="number"
                  value={messageCooldown}
                  onChange={(e) => setMessageCooldown(parseInt(e.target.value) || 0)}
                  className="bg-gray-700 border-gray-600 text-white"
                  min={0}
                  max={300}
                />
                <Badge variant="outline">seconds</Badge>
              </div>
              <p className="text-xs text-gray-400">
                Cooldown between XP gains from messages (prevents spam)
              </p>
            </div>

            {/* Daily Claim XP */}
            <div className="space-y-2">
              <Label htmlFor="dailyClaimXP" className="flex items-center gap-2 text-gray-300">
                <Gift className="h-4 w-4 text-pink-400" />
                Daily Claim Base XP
              </Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="dailyClaimXP"
                  type="number"
                  value={dailyClaimXP}
                  onChange={(e) => setDailyClaimXP(parseInt(e.target.value) || 0)}
                  className="bg-gray-700 border-gray-600 text-white"
                  min={0}
                  max={500}
                />
                <Badge variant="outline">base XP</Badge>
              </div>
              <p className="text-xs text-gray-400">
                Base XP for daily reward claim (before streak bonus)
              </p>
            </div>

            {/* Streak Bonus */}
            <div className="space-y-2">
              <Label htmlFor="streakBonus" className="flex items-center gap-2 text-gray-300">
                <Calendar className="h-4 w-4 text-purple-400" />
                Streak Bonus Multiplier
              </Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="streakBonus"
                  type="number"
                  step="0.1"
                  value={streakBonus}
                  onChange={(e) => setStreakBonus(parseFloat(e.target.value) || 1.0)}
                  className="bg-gray-700 border-gray-600 text-white"
                  min={1.0}
                  max={2.0}
                />
                <Badge variant="outline">per day</Badge>
              </div>
              <p className="text-xs text-gray-400">
                Bonus multiplier per streak day (1.1 = 10% bonus per day)
              </p>
            </div>

            {/* Max Streak Multiplier */}
            <div className="space-y-2">
              <Label htmlFor="maxStreak" className="flex items-center gap-2 text-gray-300">
                <TrendingUp className="h-4 w-4 text-orange-400" />
                Max Streak Multiplier
              </Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="maxStreak"
                  type="number"
                  step="0.1"
                  value={maxStreakMultiplier}
                  onChange={(e) => setMaxStreakMultiplier(parseFloat(e.target.value) || 1.0)}
                  className="bg-gray-700 border-gray-600 text-white"
                  min={1.0}
                  max={5.0}
                />
                <Badge variant="outline">max</Badge>
              </div>
              <p className="text-xs text-gray-400">
                Maximum streak multiplier cap (2.0 = max 2x bonus)
              </p>
            </div>
          </div>

          {/* Example Calculation */}
          <div className="p-4 bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-lg border border-purple-700/50">
            <div className="text-sm font-medium text-white mb-2">💡 Example Earnings:</div>
            <div className="space-y-1 text-sm text-gray-300">
              <div>• Message: <span className="text-green-400 font-mono">+{messageXP} XP</span> (every {messageCooldown}s)</div>
              <div>• Daily claim (day 1): <span className="text-green-400 font-mono">+{dailyClaimXP} XP</span></div>
              <div>• Daily claim (day 7): <span className="text-green-400 font-mono">+{Math.round(dailyClaimXP * Math.min(Math.pow(streakBonus, 7), maxStreakMultiplier))} XP</span> (with streak bonus)</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Level Curve */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-white">Level Progression Curve</CardTitle>
              <CardDescription>Define how XP translates to levels</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Curve Type */}
            <div className="space-y-2">
              <Label htmlFor="curveType" className="text-gray-300">Curve Type</Label>
              <Select
                value={levelCurveType}
                onValueChange={(value) => setLevelCurveType(value as LevelCurveType)}
              >
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="linear">Linear (Easy)</SelectItem>
                  <SelectItem value="square_root">Square Root (Balanced)</SelectItem>
                  <SelectItem value="exponential">Exponential (Hard)</SelectItem>
                  <SelectItem value="custom">Custom Formula</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400">
                {levelCurveType === "linear" && "Constant XP per level"}
                {levelCurveType === "square_root" && "Gradually increasing XP (recommended)"}
                {levelCurveType === "exponential" && "Rapidly increasing XP"}
                {levelCurveType === "custom" && "Define your own curve"}
              </p>
            </div>

            {/* Base XP */}
            <div className="space-y-2">
              <Label htmlFor="curveBase" className="text-gray-300">Base XP</Label>
              <Input
                id="curveBase"
                type="number"
                value={levelCurveBase}
                onChange={(e) => setLevelCurveBase(parseInt(e.target.value) || 100)}
                className="bg-gray-700 border-gray-600 text-white"
                min={50}
                max={1000}
              />
              <p className="text-xs text-gray-400">
                Base XP used in level calculation
              </p>
            </div>

            {/* Multiplier */}
            <div className="space-y-2">
              <Label htmlFor="curveMultiplier" className="text-gray-300">Multiplier</Label>
              <Input
                id="curveMultiplier"
                type="number"
                step="0.1"
                value={levelCurveMultiplier}
                onChange={(e) => setLevelCurveMultiplier(parseFloat(e.target.value) || 1.0)}
                className="bg-gray-700 border-gray-600 text-white"
                min={0.1}
                max={10}
              />
              <p className="text-xs text-gray-400">
                Adjust progression speed
              </p>
            </div>
          </div>

          {/* Level Preview */}
          <div className="p-4 bg-gray-700/30 rounded-lg">
            <div className="text-sm font-medium text-white mb-3">📊 Level Progression Preview:</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[5, 10, 25, 50].map((level) => (
                <div key={level} className="p-3 bg-gray-800/50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-white mb-1">
                    {level}
                  </div>
                  <div className="text-xs text-gray-400 mb-2">Level</div>
                  <Badge variant="outline" className="text-xs">
                    {xpForLevel(level).toLocaleString()} XP
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Features */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Feature Toggles</CardTitle>
          <CardDescription>Enable or disable gamification features</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Level Up Announcement */}
            <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
              <div>
                <div className="text-sm font-medium text-white">Level-Up Announcements</div>
                <div className="text-xs text-gray-400">Public level-up messages in chat</div>
              </div>
              <Switch
                checked={levelUpAnnouncement}
                onCheckedChange={setLevelUpAnnouncement}
              />
            </div>

            {/* Level Up DM */}
            <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
              <div>
                <div className="text-sm font-medium text-white">Level-Up DMs</div>
                <div className="text-xs text-gray-400">Private messages on level-up</div>
              </div>
              <Switch
                checked={levelUpDM}
                onCheckedChange={setLevelUpDM}
              />
            </div>

            {/* Achievements */}
            <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
              <div>
                <div className="text-sm font-medium text-white">Achievements</div>
                <div className="text-xs text-gray-400">Badge and milestone system</div>
              </div>
              <Switch
                checked={achievementsEnabled}
                onCheckedChange={setAchievementsEnabled}
              />
            </div>

            {/* Quests */}
            <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
              <div>
                <div className="text-sm font-medium text-white">Quests</div>
                <div className="text-xs text-gray-400">Daily and weekly challenges</div>
              </div>
              <Switch
                checked={questsEnabled}
                onCheckedChange={setQuestsEnabled}
              />
            </div>

            {/* Daily Rewards */}
            <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
              <div>
                <div className="text-sm font-medium text-white">Daily Rewards</div>
                <div className="text-xs text-gray-400">Daily claim with streaks</div>
              </div>
              <Switch
                checked={dailyRewardsEnabled}
                onCheckedChange={setDailyRewardsEnabled}
              />
            </div>

            {/* Leaderboard */}
            <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
              <div>
                <div className="text-sm font-medium text-white">Leaderboard</div>
                <div className="text-xs text-gray-400">XP and level rankings</div>
              </div>
              <Switch
                checked={leaderboardEnabled}
                onCheckedChange={setLeaderboardEnabled}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={fetchConfig}
          disabled={saving}
        >
          Reset Changes
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              Save Configuration
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
