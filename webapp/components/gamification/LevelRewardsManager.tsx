"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Gift, Plus, Edit, Trash2, TrendingUp, Award, Crown, Zap } from "lucide-react"

interface LevelRewardsManagerProps {
  guildId: string
}

type LevelReward = {
  id: number
  level: number
  role_id: string | null
  xp_bonus: number
  achievement_id: number | null
  nft_reward_campaign_id: string | null
  custom_message: string | null
  active: boolean
}

export function LevelRewardsManager({ guildId }: LevelRewardsManagerProps) {
  const [rewards, setRewards] = useState<LevelReward[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<LevelReward | null>(null)

  // Form state
  const [level, setLevel] = useState(5)
  const [roleId, setRoleId] = useState("")
  const [xpBonus, setXpBonus] = useState(0)
  const [customMessage, setCustomMessage] = useState("")
  const [active, setActive] = useState(true)

  // Available roles (mock - fetch from API in production)
  const [availableRoles, setAvailableRoles] = useState<any[]>([])

  useEffect(() => {
    fetchRewards()
    fetchRoles()
  }, [guildId])

  const fetchRewards = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/guilds/${guildId}/gamification/level-rewards`)
      const data = await res.json()
      if (data.success) {
        setRewards(data.rewards || [])
      }
    } catch (error) {
      console.error("Error fetching level rewards:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchRoles = async () => {
    try {
      const res = await fetch(`/api/guilds/${guildId}/roles`)
      const data = await res.json()
      if (data.success) {
        setAvailableRoles(data.roles || [])
      }
    } catch (error) {
      console.error("Error fetching roles:", error)
    }
  }

  const handleCreate = () => {
    setEditing(null)
    resetForm()
    setDialogOpen(true)
  }

  const handleEdit = (reward: LevelReward) => {
    setEditing(reward)
    setLevel(reward.level)
    setRoleId(reward.role_id || "")
    setXpBonus(reward.xp_bonus || 0)
    setCustomMessage(reward.custom_message || "")
    setActive(reward.active)
    setDialogOpen(true)
  }

  const resetForm = () => {
    setLevel(5)
    setRoleId("")
    setXpBonus(0)
    setCustomMessage("")
    setActive(true)
  }

  const handleSave = async () => {
    try {
      const body = {
        level,
        role_id: roleId || null,
        xp_bonus: xpBonus,
        custom_message: customMessage || null,
        active
      }

      const url = editing
        ? `/api/guilds/${guildId}/gamification/level-rewards/${editing.id}`
        : `/api/guilds/${guildId}/gamification/level-rewards`

      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })

      const data = await res.json()

      if (data.success) {
        await fetchRewards()
        setDialogOpen(false)
        resetForm()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const handleDelete = async (id: number, level: number) => {
    if (!confirm(`Delete reward for level ${level}?`)) return

    try {
      const res = await fetch(`/api/guilds/${guildId}/gamification/level-rewards/${id}`, {
        method: "DELETE"
      })

      const data = await res.json()

      if (data.success) {
        await fetchRewards()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const handleToggleActive = async (reward: LevelReward) => {
    try {
      const res = await fetch(`/api/guilds/${guildId}/gamification/level-rewards/${reward.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !reward.active })
      })

      const data = await res.json()

      if (data.success) {
        await fetchRewards()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const getRoleDisplay = (roleId: string | null) => {
    if (!roleId) return null
    const role = availableRoles.find(r => r.id === roleId)
    return role ? role.name : roleId
  }

  const sortedRewards = [...rewards].sort((a, b) => a.level - b.level)

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-green-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Level Rewards</h2>
          <p className="text-sm text-gray-400 mt-1">
            Configure rewards granted automatically when users level up
          </p>
        </div>
        <Button
          onClick={handleCreate}
          className="gap-2 bg-gradient-to-r from-green-500 to-cyan-500 hover:from-green-600 hover:to-cyan-600"
        >
          <Plus className="h-4 w-4" />
          Add Level Reward
        </Button>
      </div>

      {/* Quick Add Buttons */}
      <div className="flex flex-wrap gap-2">
        <span className="text-sm text-gray-400 mr-2">Quick add:</span>
        {[5, 10, 15, 20, 25, 50, 75, 100].map((lvl) => {
          const exists = rewards.some(r => r.level === lvl)
          return (
            <Button
              key={lvl}
              size="sm"
              variant={exists ? "outline" : "secondary"}
              disabled={exists}
              onClick={() => {
                setLevel(lvl)
                setDialogOpen(true)
              }}
              className="gap-1"
            >
              <TrendingUp className="h-3 w-3" />
              Level {lvl}
            </Button>
          )
        })}
      </div>

      {/* Rewards Timeline */}
      {sortedRewards.length === 0 ? (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Gift className="h-16 w-16 text-gray-600 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Level Rewards Yet</h3>
            <p className="text-gray-400 mb-6 text-center max-w-md">
              Configure rewards to automatically grant roles, bonuses, or achievements when users level up
            </p>
            <Button onClick={handleCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Add First Reward
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Visual Timeline */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Award className="h-5 w-5 text-green-500" />
                Level Progression
              </CardTitle>
              <CardDescription>
                Rewards at each level milestone
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {/* Timeline Line */}
                <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-green-500 via-cyan-500 to-purple-500" />

                {/* Timeline Items */}
                <div className="space-y-6">
                  {sortedRewards.map((reward, index) => (
                    <div key={reward.id} className="relative flex items-start gap-4 group">
                      {/* Level Badge */}
                      <div className={`relative z-10 flex items-center justify-center w-16 h-16 rounded-full font-bold text-white shadow-lg ${
                        reward.active
                          ? 'bg-gradient-to-br from-green-500 to-cyan-500'
                          : 'bg-gray-600'
                      }`}>
                        <div className="text-center">
                          <div className="text-xs opacity-75">Lvl</div>
                          <div className="text-lg">{reward.level}</div>
                        </div>
                      </div>

                      {/* Reward Card */}
                      <Card className={`flex-1 bg-gray-700/50 border-gray-600 transition-all ${
                        !reward.active ? 'opacity-60' : 'hover:border-green-500/50'
                      }`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold text-white">Level {reward.level} Reward</h4>
                                <Switch
                                  checked={reward.active}
                                  onCheckedChange={() => handleToggleActive(reward)}
                                  className="scale-75"
                                />
                              </div>

                              {/* Rewards List */}
                              <div className="space-y-2">
                                {reward.role_id && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Crown className="h-4 w-4 text-yellow-500" />
                                    <span className="text-gray-300">Role:</span>
                                    <Badge variant="outline" className="text-yellow-400">
                                      {getRoleDisplay(reward.role_id)}
                                    </Badge>
                                  </div>
                                )}
                                {reward.xp_bonus > 0 && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Zap className="h-4 w-4 text-green-500" />
                                    <span className="text-gray-300">Bonus XP:</span>
                                    <Badge variant="outline" className="text-green-400">
                                      +{reward.xp_bonus} XP
                                    </Badge>
                                  </div>
                                )}
                                {reward.custom_message && (
                                  <div className="flex items-start gap-2 text-sm mt-2">
                                    <span className="text-gray-400 italic">"{reward.custom_message}"</span>
                                  </div>
                                )}
                                {!reward.role_id && !reward.xp_bonus && !reward.custom_message && (
                                  <div className="text-sm text-gray-500 italic">No rewards configured</div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(reward)}
                              className="gap-2"
                            >
                              <Edit className="h-3 w-3" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(reward.id, reward.level)}
                              className="gap-2 text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-gray-800 border-gray-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Gift className="h-5 w-5 text-green-500" />
              {editing ? "Edit Level Reward" : "Add Level Reward"}
            </DialogTitle>
            <DialogDescription>
              Configure rewards granted when a user reaches this level
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Level */}
            <div className="space-y-2">
              <Label htmlFor="level" className="text-gray-300">Level *</Label>
              <Input
                id="level"
                type="number"
                value={level}
                onChange={(e) => setLevel(parseInt(e.target.value) || 1)}
                className="bg-gray-700 border-gray-600 text-white"
                min={1}
                max={100}
                disabled={!!editing}
              />
              <p className="text-xs text-gray-400">
                Which level triggers this reward
              </p>
            </div>

            {/* Role Reward */}
            <div className="space-y-2">
              <Label htmlFor="roleId" className="flex items-center gap-2 text-gray-300">
                <Crown className="h-4 w-4 text-yellow-500" />
                Grant Discord Role
              </Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="No role (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No role</SelectItem>
                  {availableRoles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400">
                Automatically assign a Discord role on level-up
              </p>
            </div>

            {/* XP Bonus */}
            <div className="space-y-2">
              <Label htmlFor="xpBonus" className="flex items-center gap-2 text-gray-300">
                <Zap className="h-4 w-4 text-green-500" />
                Bonus XP
              </Label>
              <Input
                id="xpBonus"
                type="number"
                value={xpBonus}
                onChange={(e) => setXpBonus(parseInt(e.target.value) || 0)}
                className="bg-gray-700 border-gray-600 text-white"
                min={0}
              />
              <p className="text-xs text-gray-400">
                Extra XP awarded as a one-time bonus
              </p>
            </div>

            {/* Custom Message */}
            <div className="space-y-2">
              <Label htmlFor="customMessage" className="text-gray-300">Custom Congratulations Message</Label>
              <Textarea
                id="customMessage"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="e.g., Congratulations on reaching level {level}! 🎉"
                className="bg-gray-700 border-gray-600 text-white min-h-[80px]"
              />
              <p className="text-xs text-gray-400">
                Custom message shown when user levels up (optional)
              </p>
            </div>

            {/* Active */}
            <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
              <div>
                <div className="text-sm font-medium text-white">Active</div>
                <div className="text-xs text-gray-400">Enable this level reward</div>
              </div>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>

            {/* Preview */}
            <div className="p-4 bg-gradient-to-br from-green-900/30 to-cyan-900/30 rounded-lg border border-green-700/50">
              <div className="text-sm font-medium text-white mb-3">👁️ Preview:</div>
              <div className="space-y-2">
                <div className="text-lg font-bold text-white">Level {level} Reached! 🎉</div>
                {roleId && (
                  <div className="flex items-center gap-2 text-sm">
                    <Crown className="h-4 w-4 text-yellow-500" />
                    <span className="text-gray-300">You earned the role:</span>
                    <Badge variant="outline" className="text-yellow-400">
                      {getRoleDisplay(roleId) || "Selected Role"}
                    </Badge>
                  </div>
                )}
                {xpBonus > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Zap className="h-4 w-4 text-green-500" />
                    <span className="text-gray-300">Bonus reward:</span>
                    <Badge variant="outline" className="text-green-400">+{xpBonus} XP</Badge>
                  </div>
                )}
                {customMessage && (
                  <div className="text-sm text-gray-400 italic mt-2">
                    {customMessage.replace('{level}', level.toString())}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="gap-2 bg-gradient-to-r from-green-500 to-cyan-500"
            >
              <Gift className="h-4 w-4" />
              {editing ? "Update" : "Add"} Reward
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
