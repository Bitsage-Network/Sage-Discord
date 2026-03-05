"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Settings, Shield, UserCheck, Trash2, MessageSquare, Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface BotConfig {
  guild_id: string
  captcha_enabled: boolean
  captcha_on_join: boolean
  captcha_type: string
  captcha_difficulty: string
  captcha_timeout_minutes: number
  max_captcha_attempts: number
  verified_role_id: string | null
  verified_role_name: string
  auto_create_verified_role: boolean
  auto_assign_verified_role: boolean
  waiting_room_enabled: boolean
  waiting_room_role_id: string | null
  waiting_room_channel_id: string | null
  prune_unverified_enabled: boolean
  prune_timeout_hours: number
  prune_send_dm: boolean
  rules_enabled: boolean
  rules_text: string | null
  rules_channel_id: string | null
  require_rules_acceptance: boolean
}

interface GuildRule {
  rule_number: number
  rule_text: string
  emoji: string | null
  enabled: boolean
}

export default function BotConfigPage() {
  const params = useParams()
  const guildId = params.id as string

  const [config, setConfig] = useState<BotConfig | null>(null)
  const [rules, setRules] = useState<GuildRule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchConfig()
  }, [guildId])

  const fetchConfig = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/guilds/${guildId}/bot-config`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch configuration")
      }

      setConfig(data.config)
      setRules(data.rules || [])
    } catch (err: any) {
      console.error("Error fetching config:", err)
      setError(err.message || "Failed to load configuration")
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!config) return

    try {
      setSaving(true)
      setError(null)
      setSuccessMessage(null)

      const response = await fetch(`/api/guilds/${guildId}/bot-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...config,
          rules,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to save configuration")
      }

      setSuccessMessage("Configuration saved successfully!")
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err: any) {
      console.error("Error saving config:", err)
      setError(err.message || "Failed to save configuration")
    } finally {
      setSaving(false)
    }
  }

  const updateConfig = (field: keyof BotConfig, value: any) => {
    if (!config) return
    setConfig({ ...config, [field]: value })
  }

  const updateRule = (index: number, field: keyof GuildRule, value: any) => {
    const newRules = [...rules]
    newRules[index] = { ...newRules[index], [field]: value }
    setRules(newRules)
  }

  const addRule = () => {
    if (rules.length >= 5) {
      alert("Maximum 5 rules allowed")
      return
    }
    setRules([
      ...rules,
      {
        rule_number: rules.length + 1,
        rule_text: "",
        emoji: null,
        enabled: true,
      },
    ])
  }

  const removeRule = (index: number) => {
    const newRules = rules.filter((_, i) => i !== index)
    setRules(newRules.map((rule, i) => ({ ...rule, rule_number: i + 1 })))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (error && !config) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <Card className="bg-red-900/20 border-red-800">
          <CardHeader>
            <CardTitle className="text-red-400">Error</CardTitle>
            <CardDescription className="text-red-300">{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={fetchConfig} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!config) return null

  return (
    <div className="max-w-7xl mx-auto p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-100 flex items-center gap-2">
            <Settings className="h-8 w-8 text-blue-500" />
            Bot Configuration
          </h1>
          <p className="text-gray-400 mt-2">Configure bot protection and verification settings</p>
        </div>
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-5 w-5 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <Card className="mb-6 bg-green-900/20 border-green-800">
          <CardContent className="pt-6">
            <p className="text-green-400">{successMessage}</p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="mb-6 bg-red-900/20 border-red-800">
          <CardContent className="pt-6">
            <p className="text-red-400">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Captcha Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" />
            Captcha Verification
          </CardTitle>
          <CardDescription>Configure captcha challenges for new members</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Captcha</Label>
              <p className="text-sm text-gray-500">Require captcha verification for members</p>
            </div>
            <Switch
              checked={config.captcha_enabled}
              onCheckedChange={(checked) => updateConfig("captcha_enabled", checked)}
            />
          </div>

          {config.captcha_enabled && (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Captcha on Join</Label>
                  <p className="text-sm text-gray-500">Automatically send captcha when users join</p>
                </div>
                <Switch
                  checked={config.captcha_on_join}
                  onCheckedChange={(checked) => updateConfig("captcha_on_join", checked)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Captcha Type</Label>
                  <Select
                    value={config.captcha_type}
                    onValueChange={(value) => updateConfig("captcha_type", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="number">Number (Math Problem)</SelectItem>
                      <SelectItem value="text">Text (Question)</SelectItem>
                      <SelectItem value="image">Image (Visual)</SelectItem>
                      <SelectItem value="random">Random</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Difficulty</Label>
                  <Select
                    value={config.captcha_difficulty}
                    onValueChange={(value) => updateConfig("captcha_difficulty", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Timeout (minutes)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="60"
                    value={config.captcha_timeout_minutes}
                    onChange={(e) => updateConfig("captcha_timeout_minutes", parseInt(e.target.value))}
                  />
                </div>

                <div>
                  <Label>Max Attempts</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={config.max_captcha_attempts}
                    onChange={(e) => updateConfig("max_captcha_attempts", parseInt(e.target.value))}
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Verified Role Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-green-500" />
            Verified Role
          </CardTitle>
          <CardDescription>Configure the role assigned to verified members</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label>Verified Role Name</Label>
            <Input
              value={config.verified_role_name}
              onChange={(e) => updateConfig("verified_role_name", e.target.value)}
              placeholder="Verified"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-Create Role</Label>
              <p className="text-sm text-gray-500">Automatically create the verified role if it doesn't exist</p>
            </div>
            <Switch
              checked={config.auto_create_verified_role}
              onCheckedChange={(checked) => updateConfig("auto_create_verified_role", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-Assign Role</Label>
              <p className="text-sm text-gray-500">Automatically assign the role after verification</p>
            </div>
            <Switch
              checked={config.auto_assign_verified_role}
              onCheckedChange={(checked) => updateConfig("auto_assign_verified_role", checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Member Pruning */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-orange-500" />
            Member Pruning
          </CardTitle>
          <CardDescription>Automatically remove unverified members after a timeout</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Pruning</Label>
              <p className="text-sm text-gray-500">Remove members who don't verify within the timeout</p>
            </div>
            <Switch
              checked={config.prune_unverified_enabled}
              onCheckedChange={(checked) => updateConfig("prune_unverified_enabled", checked)}
            />
          </div>

          {config.prune_unverified_enabled && (
            <>
              <div>
                <Label>Timeout (hours)</Label>
                <Input
                  type="number"
                  min="1"
                  max="168"
                  value={config.prune_timeout_hours}
                  onChange={(e) => updateConfig("prune_timeout_hours", parseInt(e.target.value))}
                />
                <p className="text-sm text-gray-500 mt-1">Members will be removed after this many hours</p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Send Warning DM</Label>
                  <p className="text-sm text-gray-500">Send a DM before removing the member</p>
                </div>
                <Switch
                  checked={config.prune_send_dm}
                  onCheckedChange={(checked) => updateConfig("prune_send_dm", checked)}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Server Rules */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-purple-500" />
            Server Rules
          </CardTitle>
          <CardDescription>Configure up to 5 server rules (shown during verification)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Rules</Label>
              <p className="text-sm text-gray-500">Display rules during verification</p>
            </div>
            <Switch
              checked={config.rules_enabled}
              onCheckedChange={(checked) => updateConfig("rules_enabled", checked)}
            />
          </div>

          {config.rules_enabled && (
            <>
              <div className="space-y-4">
                {rules.map((rule, index) => (
                  <div key={index} className="p-4 border border-gray-700 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Rule {rule.rule_number}</Label>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeRule(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Textarea
                      value={rule.rule_text}
                      onChange={(e) => updateRule(index, "rule_text", e.target.value)}
                      placeholder="Enter rule text..."
                      rows={2}
                    />
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <Input
                          value={rule.emoji || ""}
                          onChange={(e) => updateRule(index, "emoji", e.target.value)}
                          placeholder="Emoji (optional)"
                          maxLength={2}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={(checked) => updateRule(index, "enabled", checked)}
                        />
                        <Label>Enabled</Label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {rules.length < 5 && (
                <Button onClick={addRule} variant="outline" className="w-full">
                  Add Rule
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Save Button (Bottom) */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-5 w-5 mr-2" />
              Save All Changes
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
