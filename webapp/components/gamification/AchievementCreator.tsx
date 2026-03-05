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
import { Loader2, Trophy, Plus, Edit, Trash2, Star, Award, Sparkles, Eye, EyeOff } from "lucide-react"

interface AchievementCreatorProps {
  guildId: string
}

type Achievement = {
  id: number
  name: string
  description: string
  emoji: string
  category: string
  rarity: string
  hidden: boolean
  xp_reward: number
  requirement_type: string
  requirement_value: number
  earned_count: number
}

type Rarity = "common" | "rare" | "epic" | "legendary"

const RARITY_COLORS = {
  common: "bg-gray-500 hover:bg-gray-600",
  rare: "bg-blue-500 hover:bg-blue-600",
  epic: "bg-purple-500 hover:bg-purple-600",
  legendary: "bg-yellow-500 hover:bg-yellow-600"
}

const RARITY_EMOJIS = {
  common: "⚪",
  rare: "🔵",
  epic: "🟣",
  legendary: "🟡"
}

const EMOJI_PICKER = [
  "🏆", "⭐", "🎯", "🔥", "💎", "👑", "🎖️", "🥇", "🥈", "🥉",
  "⚡", "💪", "🚀", "🎉", "✨", "💫", "🌟", "⚔️", "🛡️", "🎭",
  "🎪", "🎨", "🎮", "🎲", "🎸", "📚", "🔰", "💰", "🏅", "🎁",
  "🌈", "☀️", "🌙", "⚙️", "🔧", "🔨", "⛏️", "🧪", "🔬", "🎓"
]

export function AchievementCreator({ guildId }: AchievementCreatorProps) {
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Achievement | null>(null)

  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [emoji, setEmoji] = useState("🏆")
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [category, setCategory] = useState("custom")
  const [rarity, setRarity] = useState<Rarity>("common")
  const [hidden, setHidden] = useState(false)
  const [xpReward, setXpReward] = useState(100)
  const [requirementType, setRequirementType] = useState("level")
  const [requirementValue, setRequirementValue] = useState(10)

  useEffect(() => {
    fetchAchievements()
  }, [guildId])

  const fetchAchievements = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/guilds/${guildId}/gamification/achievements`)
      const data = await res.json()
      if (data.success) {
        setAchievements(data.achievements || [])
      }
    } catch (error) {
      console.error("Error fetching achievements:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditing(null)
    resetForm()
    setDialogOpen(true)
  }

  const handleEdit = (achievement: Achievement) => {
    setEditing(achievement)
    setName(achievement.name)
    setDescription(achievement.description || "")
    setEmoji(achievement.emoji || "🏆")
    setCategory(achievement.category)
    setRarity(achievement.rarity as Rarity)
    setHidden(achievement.hidden)
    setXpReward(achievement.xp_reward)
    setRequirementType(achievement.requirement_type)
    setRequirementValue(achievement.requirement_value)
    setDialogOpen(true)
  }

  const resetForm = () => {
    setName("")
    setDescription("")
    setEmoji("🏆")
    setCategory("custom")
    setRarity("common")
    setHidden(false)
    setXpReward(100)
    setRequirementType("level")
    setRequirementValue(10)
  }

  const handleSave = async () => {
    try {
      const body = {
        name,
        description,
        emoji,
        category,
        rarity,
        hidden,
        xp_reward: xpReward,
        requirement_type: requirementType,
        requirement_value: requirementValue
      }

      const url = editing
        ? `/api/guilds/${guildId}/gamification/achievements/${editing.id}`
        : `/api/guilds/${guildId}/gamification/achievements`

      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })

      const data = await res.json()

      if (data.success) {
        await fetchAchievements()
        setDialogOpen(false)
        resetForm()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete achievement "${name}"?`)) return

    try {
      const res = await fetch(`/api/guilds/${guildId}/gamification/achievements/${id}`, {
        method: "DELETE"
      })

      const data = await res.json()

      if (data.success) {
        await fetchAchievements()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Achievement Designer</h2>
          <p className="text-sm text-gray-400 mt-1">
            Create custom badges and milestones for your community
          </p>
        </div>
        <Button
          onClick={handleCreate}
          className="gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
        >
          <Plus className="h-4 w-4" />
          Create Achievement
        </Button>
      </div>

      {/* Achievement List */}
      {achievements.length === 0 ? (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Trophy className="h-16 w-16 text-gray-600 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Achievements Yet</h3>
            <p className="text-gray-400 mb-6 text-center max-w-md">
              Create your first achievement to reward users for milestones and accomplishments
            </p>
            <Button onClick={handleCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Create First Achievement
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {achievements.map((achievement) => (
            <Card
              key={achievement.id}
              className="bg-gray-800/50 border-gray-700 hover:border-yellow-500/50 transition-all group"
            >
              <CardContent className="p-6">
                {/* Achievement Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="text-4xl">{achievement.emoji}</div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white">{achievement.name}</h3>
                        {achievement.hidden && (
                          <EyeOff className="h-3 w-3 text-gray-500" title="Hidden until earned" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            achievement.rarity === "common" ? "border-gray-500 text-gray-400" :
                            achievement.rarity === "rare" ? "border-blue-500 text-blue-400" :
                            achievement.rarity === "epic" ? "border-purple-500 text-purple-400" :
                            "border-yellow-500 text-yellow-400"
                          }`}
                        >
                          {RARITY_EMOJIS[achievement.rarity as Rarity]} {achievement.rarity}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {achievement.category}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                  {achievement.description || "No description"}
                </p>

                {/* Requirements */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Requirement:</span>
                    <span className="text-white capitalize">
                      {achievement.requirement_type.replace("_", " ")} {achievement.requirement_value}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">XP Reward:</span>
                    <Badge variant="outline" className="text-green-400">
                      +{achievement.xp_reward} XP
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Earned:</span>
                    <Badge variant="outline">{achievement.earned_count} times</Badge>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(achievement)}
                    className="flex-1 gap-2"
                  >
                    <Edit className="h-3 w-3" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(achievement.id, achievement.name)}
                    className="gap-2 text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-gray-800 border-gray-700 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              {editing ? "Edit Achievement" : "Create Achievement"}
            </DialogTitle>
            <DialogDescription>
              Design a custom achievement badge for your community
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                {/* Icon */}
                <div className="space-y-2">
                  <Label className="text-gray-300">Icon</Label>
                  <div className="relative">
                    <button
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="w-full h-20 bg-gray-700 border border-gray-600 rounded-lg flex items-center justify-center text-4xl hover:bg-gray-600 transition-colors"
                    >
                      {emoji}
                    </button>
                    {showEmojiPicker && (
                      <div className="absolute top-full mt-2 left-0 z-50 bg-gray-700 border border-gray-600 rounded-lg p-3 grid grid-cols-5 gap-2 max-h-48 overflow-y-auto">
                        {EMOJI_PICKER.map((e) => (
                          <button
                            key={e}
                            onClick={() => {
                              setEmoji(e)
                              setShowEmojiPicker(false)
                            }}
                            className="text-2xl hover:bg-gray-600 rounded p-1"
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Name */}
                <div className="col-span-3 space-y-2">
                  <Label htmlFor="name" className="text-gray-300">Achievement Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Chatmaster"
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-gray-300">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe how to earn this achievement..."
                  className="bg-gray-700 border-gray-600 text-white min-h-[80px]"
                />
              </div>
            </div>

            {/* Classification */}
            <div className="grid grid-cols-2 gap-4">
              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category" className="text-gray-300">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first_steps">First Steps</SelectItem>
                    <SelectItem value="network">Network</SelectItem>
                    <SelectItem value="social">Social</SelectItem>
                    <SelectItem value="special">Special</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Rarity */}
              <div className="space-y-2">
                <Label htmlFor="rarity" className="text-gray-300">Rarity</Label>
                <Select value={rarity} onValueChange={(v) => setRarity(v as Rarity)}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="common">⚪ Common</SelectItem>
                    <SelectItem value="rare">🔵 Rare</SelectItem>
                    <SelectItem value="epic">🟣 Epic</SelectItem>
                    <SelectItem value="legendary">🟡 Legendary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Requirements */}
            <div className="grid grid-cols-2 gap-4">
              {/* Requirement Type */}
              <div className="space-y-2">
                <Label htmlFor="reqType" className="text-gray-300">Requirement Type</Label>
                <Select value={requirementType} onValueChange={setRequirementType}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="level">Level</SelectItem>
                    <SelectItem value="xp">Total XP</SelectItem>
                    <SelectItem value="messages">Messages Sent</SelectItem>
                    <SelectItem value="streak">Daily Streak</SelectItem>
                    <SelectItem value="reputation">Reputation</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Requirement Value */}
              <div className="space-y-2">
                <Label htmlFor="reqValue" className="text-gray-300">Requirement Value</Label>
                <Input
                  id="reqValue"
                  type="number"
                  value={requirementValue}
                  onChange={(e) => setRequirementValue(parseInt(e.target.value) || 0)}
                  className="bg-gray-700 border-gray-600 text-white"
                  min={0}
                />
              </div>
            </div>

            {/* Rewards & Settings */}
            <div className="grid grid-cols-2 gap-4">
              {/* XP Reward */}
              <div className="space-y-2">
                <Label htmlFor="xpReward" className="text-gray-300">XP Reward</Label>
                <Input
                  id="xpReward"
                  type="number"
                  value={xpReward}
                  onChange={(e) => setXpReward(parseInt(e.target.value) || 0)}
                  className="bg-gray-700 border-gray-600 text-white"
                  min={0}
                />
              </div>

              {/* Hidden */}
              <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                <div>
                  <div className="text-sm font-medium text-white">Hidden</div>
                  <div className="text-xs text-gray-400">Hide until earned</div>
                </div>
                <Switch checked={hidden} onCheckedChange={setHidden} />
              </div>
            </div>

            {/* Preview */}
            <div className="p-4 bg-gradient-to-br from-gray-700/50 to-gray-700/30 rounded-lg border border-gray-600">
              <div className="text-sm font-medium text-white mb-3">👁️ Preview:</div>
              <div className="flex items-start gap-3">
                <div className="text-4xl">{emoji}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-white">{name || "Achievement Name"}</span>
                    {hidden && <EyeOff className="h-3 w-3 text-gray-500" />}
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">
                      {RARITY_EMOJIS[rarity]} {rarity}
                    </Badge>
                    <Badge variant="outline" className="text-xs">{category}</Badge>
                  </div>
                  <p className="text-sm text-gray-400 mb-2">{description || "Description..."}</p>
                  <div className="text-xs text-gray-400">
                    Requirement: {requirementType.replace("_", " ")} {requirementValue} • Reward: +{xpReward} XP
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="gap-2 bg-gradient-to-r from-yellow-500 to-orange-500"
              disabled={!name}
            >
              <Trophy className="h-4 w-4" />
              {editing ? "Update" : "Create"} Achievement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
