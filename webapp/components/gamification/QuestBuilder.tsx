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
import { Loader2, Target, Plus, Edit, Trash2, Calendar, Clock, Star, Gift, CheckCircle2 } from "lucide-react"

interface QuestBuilderProps {
  guildId: string
}

type Quest = {
  id: number
  title: string
  description: string
  emoji: string
  quest_type: string
  requirement_type: string
  requirement_value: number
  xp_reward: number
  active: boolean
  featured: boolean
  start_date: string | null
  end_date: string | null
  reset_frequency: string | null
  completion_count: number
}

const QUEST_EMOJIS = [
  "🎯", "📋", "✅", "⭐", "🏆", "🎁", "💎", "🔥", "⚡", "🌟",
  "🎉", "🎊", "🎈", "🎀", "🏅", "🥇", "🥈", "🥉", "🏵️", "🎖️",
  "📚", "📝", "✏️", "📌", "📍", "🗂️", "📊", "📈", "📉", "💪"
]

export function QuestBuilder({ guildId }: QuestBuilderProps) {
  const [quests, setQuests] = useState<Quest[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Quest | null>(null)

  // Form state
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [emoji, setEmoji] = useState("🎯")
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [questType, setQuestType] = useState("daily")
  const [requirementType, setRequirementType] = useState("messages")
  const [requirementValue, setRequirementValue] = useState(10)
  const [xpReward, setXpReward] = useState(50)
  const [active, setActive] = useState(true)
  const [featured, setFeatured] = useState(false)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [resetFrequency, setResetFrequency] = useState("daily")

  useEffect(() => {
    fetchQuests()
  }, [guildId])

  const fetchQuests = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/guilds/${guildId}/gamification/quests`)
      const data = await res.json()
      if (data.success) {
        setQuests(data.quests || [])
      }
    } catch (error) {
      console.error("Error fetching quests:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditing(null)
    resetForm()
    setDialogOpen(true)
  }

  const handleEdit = (quest: Quest) => {
    setEditing(quest)
    setTitle(quest.title)
    setDescription(quest.description || "")
    setEmoji(quest.emoji || "🎯")
    setQuestType(quest.quest_type)
    setRequirementType(quest.requirement_type)
    setRequirementValue(quest.requirement_value)
    setXpReward(quest.xp_reward)
    setActive(quest.active)
    setFeatured(quest.featured)
    setStartDate(quest.start_date ? quest.start_date.split('T')[0] : "")
    setEndDate(quest.end_date ? quest.end_date.split('T')[0] : "")
    setResetFrequency(quest.reset_frequency || "daily")
    setDialogOpen(true)
  }

  const resetForm = () => {
    setTitle("")
    setDescription("")
    setEmoji("🎯")
    setQuestType("daily")
    setRequirementType("messages")
    setRequirementValue(10)
    setXpReward(50)
    setActive(true)
    setFeatured(false)
    setStartDate("")
    setEndDate("")
    setResetFrequency("daily")
  }

  const handleSave = async () => {
    try {
      const body = {
        title,
        description,
        emoji,
        quest_type: questType,
        requirement_type: requirementType,
        requirement_value: requirementValue,
        xp_reward: xpReward,
        active,
        featured,
        start_date: startDate || null,
        end_date: endDate || null,
        reset_frequency: questType !== "one_time" ? resetFrequency : null
      }

      const url = editing
        ? `/api/guilds/${guildId}/gamification/quests/${editing.id}`
        : `/api/guilds/${guildId}/gamification/quests`

      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })

      const data = await res.json()

      if (data.success) {
        await fetchQuests()
        setDialogOpen(false)
        resetForm()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`Delete quest "${title}"?`)) return

    try {
      const res = await fetch(`/api/guilds/${guildId}/gamification/quests/${id}`, {
        method: "DELETE"
      })

      const data = await res.json()

      if (data.success) {
        await fetchQuests()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const handleToggleActive = async (quest: Quest) => {
    try {
      const res = await fetch(`/api/guilds/${guildId}/gamification/quests/${quest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !quest.active })
      })

      const data = await res.json()

      if (data.success) {
        await fetchQuests()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const getQuestTypeBadge = (type: string) => {
    switch (type) {
      case "daily": return <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500">Daily</Badge>
      case "weekly": return <Badge variant="outline" className="bg-purple-500/20 text-purple-400 border-purple-500">Weekly</Badge>
      case "monthly": return <Badge variant="outline" className="bg-pink-500/20 text-pink-400 border-pink-500">Monthly</Badge>
      case "one_time": return <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500">One-Time</Badge>
      case "tutorial": return <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500">Tutorial</Badge>
      default: return <Badge variant="outline">{type}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Quest Builder</h2>
          <p className="text-sm text-gray-400 mt-1">
            Design daily, weekly, and special challenges to keep users engaged
          </p>
        </div>
        <Button
          onClick={handleCreate}
          className="gap-2 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
        >
          <Plus className="h-4 w-4" />
          Create Quest
        </Button>
      </div>

      {/* Quest List */}
      {quests.length === 0 ? (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Target className="h-16 w-16 text-gray-600 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Quests Yet</h3>
            <p className="text-gray-400 mb-6 text-center max-w-md">
              Create your first quest to give users daily or weekly challenges
            </p>
            <Button onClick={handleCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Create First Quest
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {quests.map((quest) => (
            <Card
              key={quest.id}
              className={`bg-gray-800/50 border-gray-700 hover:border-pink-500/50 transition-all group ${
                !quest.active ? 'opacity-60' : ''
              }`}
            >
              <CardContent className="p-6">
                {/* Quest Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="text-3xl">{quest.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white truncate">{quest.title}</h3>
                        {quest.featured && (
                          <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {getQuestTypeBadge(quest.quest_type)}
                        <Switch
                          checked={quest.active}
                          onCheckedChange={() => handleToggleActive(quest)}
                          className="scale-75"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                  {quest.description || "No description"}
                </p>

                {/* Quest Details */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Objective:</span>
                    <span className="text-white capitalize">
                      {quest.requirement_type.replace("_", " ")} {quest.requirement_value}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Reward:</span>
                    <Badge variant="outline" className="text-green-400">
                      +{quest.xp_reward} XP
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Completions:</span>
                    <Badge variant="outline">
                      {quest.completion_count} <CheckCircle2 className="h-3 w-3 ml-1" />
                    </Badge>
                  </div>
                  {quest.reset_frequency && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Resets:</span>
                      <Badge variant="outline" className="capitalize">
                        <Clock className="h-3 w-3 mr-1" />
                        {quest.reset_frequency}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Schedule */}
                {(quest.start_date || quest.end_date) && (
                  <div className="p-3 bg-gray-700/30 rounded-lg mb-4">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Calendar className="h-3 w-3" />
                      {quest.start_date && <span>Start: {new Date(quest.start_date).toLocaleDateString()}</span>}
                      {quest.start_date && quest.end_date && <span>•</span>}
                      {quest.end_date && <span>End: {new Date(quest.end_date).toLocaleDateString()}</span>}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(quest)}
                    className="flex-1 gap-2"
                  >
                    <Edit className="h-3 w-3" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(quest.id, quest.title)}
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
              <Target className="h-5 w-5 text-pink-500" />
              {editing ? "Edit Quest" : "Create Quest"}
            </DialogTitle>
            <DialogDescription>
              Design a challenge for your community to complete
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-4 gap-4">
              {/* Icon */}
              <div className="space-y-2">
                <Label className="text-gray-300">Icon</Label>
                <div className="relative">
                  <button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="w-full h-20 bg-gray-700 border border-gray-600 rounded-lg flex items-center justify-center text-3xl hover:bg-gray-600 transition-colors"
                  >
                    {emoji}
                  </button>
                  {showEmojiPicker && (
                    <div className="absolute top-full mt-2 left-0 z-50 bg-gray-700 border border-gray-600 rounded-lg p-3 grid grid-cols-5 gap-2 max-h-48 overflow-y-auto">
                      {QUEST_EMOJIS.map((e) => (
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

              {/* Title */}
              <div className="col-span-3 space-y-2">
                <Label htmlFor="title" className="text-gray-300">Quest Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Daily Message Challenge"
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
                placeholder="Describe what users need to do..."
                className="bg-gray-700 border-gray-600 text-white min-h-[80px]"
              />
            </div>

            {/* Quest Type & Timing */}
            <div className="grid grid-cols-2 gap-4">
              {/* Quest Type */}
              <div className="space-y-2">
                <Label htmlFor="questType" className="text-gray-300">Quest Type</Label>
                <Select value={questType} onValueChange={setQuestType}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily Quest</SelectItem>
                    <SelectItem value="weekly">Weekly Quest</SelectItem>
                    <SelectItem value="monthly">Monthly Quest</SelectItem>
                    <SelectItem value="one_time">One-Time Quest</SelectItem>
                    <SelectItem value="tutorial">Tutorial Quest</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reset Frequency */}
              {questType !== "one_time" && (
                <div className="space-y-2">
                  <Label htmlFor="resetFreq" className="text-gray-300">Reset Frequency</Label>
                  <Select value={resetFrequency} onValueChange={setResetFrequency}>
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily (midnight)</SelectItem>
                      <SelectItem value="weekly">Weekly (Monday)</SelectItem>
                      <SelectItem value="monthly">Monthly (1st)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Objective */}
            <div className="grid grid-cols-2 gap-4">
              {/* Requirement Type */}
              <div className="space-y-2">
                <Label htmlFor="reqType" className="text-gray-300">Objective Type</Label>
                <Select value={requirementType} onValueChange={setRequirementType}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="messages">Send Messages</SelectItem>
                    <SelectItem value="reputation">Earn Reputation</SelectItem>
                    <SelectItem value="verify">Complete Verification</SelectItem>
                    <SelectItem value="daily_claim">Claim Daily Reward</SelectItem>
                    <SelectItem value="level_up">Level Up</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Requirement Value */}
              <div className="space-y-2">
                <Label htmlFor="reqValue" className="text-gray-300">Target Amount</Label>
                <Input
                  id="reqValue"
                  type="number"
                  value={requirementValue}
                  onChange={(e) => setRequirementValue(parseInt(e.target.value) || 0)}
                  className="bg-gray-700 border-gray-600 text-white"
                  min={1}
                />
              </div>
            </div>

            {/* Rewards */}
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

            {/* Schedule */}
            <div className="grid grid-cols-2 gap-4">
              {/* Start Date */}
              <div className="space-y-2">
                <Label htmlFor="startDate" className="text-gray-300">Start Date (Optional)</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>

              {/* End Date */}
              <div className="space-y-2">
                <Label htmlFor="endDate" className="text-gray-300">End Date (Optional)</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
            </div>

            {/* Settings */}
            <div className="grid grid-cols-2 gap-4">
              {/* Active */}
              <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                <div>
                  <div className="text-sm font-medium text-white">Active</div>
                  <div className="text-xs text-gray-400">Quest is available</div>
                </div>
                <Switch checked={active} onCheckedChange={setActive} />
              </div>

              {/* Featured */}
              <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                <div>
                  <div className="text-sm font-medium text-white">Featured</div>
                  <div className="text-xs text-gray-400">Show at top</div>
                </div>
                <Switch checked={featured} onCheckedChange={setFeatured} />
              </div>
            </div>

            {/* Preview */}
            <div className="p-4 bg-gradient-to-br from-pink-900/30 to-purple-900/30 rounded-lg border border-pink-700/50">
              <div className="text-sm font-medium text-white mb-3">👁️ Preview:</div>
              <div className="flex items-start gap-3">
                <div className="text-3xl">{emoji}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-white">{title || "Quest Title"}</span>
                    {featured && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                  </div>
                  {getQuestTypeBadge(questType)}
                  <p className="text-sm text-gray-400 mt-2">{description || "Description..."}</p>
                  <div className="text-xs text-gray-400 mt-2">
                    {requirementType.replace("_", " ")} {requirementValue} • Reward: +{xpReward} XP
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
              className="gap-2 bg-gradient-to-r from-pink-500 to-purple-500"
              disabled={!title}
            >
              <Target className="h-4 w-4" />
              {editing ? "Update" : "Create"} Quest
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
