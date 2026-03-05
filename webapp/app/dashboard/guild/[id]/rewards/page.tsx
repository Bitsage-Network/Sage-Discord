"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Plus, Gift, Loader2, Users, Clock, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { CreateRewardDialog } from "@/components/rewards/CreateRewardDialog"

type Campaign = {
  id: string
  guild_id: string
  name: string
  description: string | null
  reward_type: "role" | "xp" | "access_grant" | "nft" | "poap" | "webhook"
  reward_config: any
  trigger_type: "manual" | "rule_pass" | "scheduled"
  trigger_config: any
  auto_claim: boolean
  rule_group_id: string | null
  rule_group_name: string | null
  eligibility_requirements: any
  max_claims: number | null
  cooldown_hours: number
  start_date: string | null
  end_date: string | null
  status: "active" | "paused" | "ended" | "draft"
  claimed_count: number
  total_claims: number
  successful_claims: number
  created_at: string
  updated_at: string
}

export default function RewardsPage() {
  const params = useParams()
  const router = useRouter()
  const guildId = params.id as string

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)

  useEffect(() => {
    fetchCampaigns()
  }, [guildId])

  const fetchCampaigns = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/guilds/${guildId}/rewards`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch campaigns")
      }

      setCampaigns(data.campaigns || [])
    } catch (err: any) {
      console.error("Error fetching campaigns:", err)
      setError(err.message || "Failed to load reward campaigns")
    } finally {
      setLoading(false)
    }
  }

  const handleToggleCampaign = async (campaignId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "paused" : "active"

    try {
      const response = await fetch(`/api/guilds/${guildId}/rewards/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update campaign")
      }

      // Update local state
      setCampaigns(campaigns.map(campaign =>
        campaign.id === campaignId ? { ...campaign, status: newStatus as any } : campaign
      ))
    } catch (err: any) {
      console.error("Error toggling campaign:", err)
      alert(err.message || "Failed to update campaign")
    }
  }

  const handleDeleteCampaign = async (campaignId: string, campaignName: string) => {
    if (!confirm(`Are you sure you want to delete the campaign "${campaignName}"?\n\nThis will remove all associated claims and delivery queue entries.`)) {
      return
    }

    try {
      const response = await fetch(`/api/guilds/${guildId}/rewards/${campaignId}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete campaign")
      }

      // Remove from local state
      setCampaigns(campaigns.filter(campaign => campaign.id !== campaignId))
    } catch (err: any) {
      console.error("Error deleting campaign:", err)
      alert(err.message || "Failed to delete campaign")
    }
  }

  const handleEditCampaign = (campaign: Campaign) => {
    setEditingCampaign(campaign)
    setDialogOpen(true)
  }

  const handleCreateCampaign = () => {
    setEditingCampaign(null)
    setDialogOpen(true)
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
    setEditingCampaign(null)
  }

  const handleDialogSuccess = () => {
    fetchCampaigns()
  }

  const handleViewClaims = (campaignId: string) => {
    router.push(`/dashboard/guild/${guildId}/rewards/${campaignId}/claims`)
  }

  const getRewardTypeDisplay = (type: string) => {
    const displays = {
      role: "Discord Role",
      xp: "XP/Points",
      access_grant: "Channel Access",
      nft: "NFT",
      poap: "Sage Achievement",
      webhook: "Webhook",
    }
    return displays[type as keyof typeof displays] || type
  }

  const getTriggerTypeDisplay = (type: string) => {
    const displays = {
      manual: "Manual Claim",
      rule_pass: "Rule-Based",
      scheduled: "Scheduled",
    }
    return displays[type as keyof typeof displays] || type
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "success"
      case "paused":
        return "secondary"
      case "ended":
        return "destructive"
      case "draft":
        return "outline"
      default:
        return "secondary"
    }
  }

  const renderRewardConfig = (campaign: Campaign) => {
    const config = campaign.reward_config

    switch (campaign.reward_type) {
      case "role":
        return (
          <div className="text-sm text-gray-400">
            <span className="font-medium text-gray-300">Roles:</span>{" "}
            {config.role_ids?.length || 0} role(s)
          </div>
        )

      case "xp":
        return (
          <div className="text-sm text-gray-400">
            <span className="font-medium text-gray-300">XP Amount:</span>{" "}
            {config.xp_amount || 0} XP
          </div>
        )

      case "access_grant":
        return (
          <div className="text-sm text-gray-400">
            <span className="font-medium text-gray-300">Channels:</span>{" "}
            {config.channel_ids?.length || 0} channel(s)
            {config.duration_hours && config.duration_hours > 0 && (
              <span className="ml-2">for {config.duration_hours}h</span>
            )}
            {(!config.duration_hours || config.duration_hours === 0) && (
              <span className="ml-2">(permanent)</span>
            )}
          </div>
        )

      case "nft":
        return (
          <div className="text-sm text-gray-400">
            <span className="font-medium text-gray-300">Contract:</span>{" "}
            {config.contract_address ? `${config.contract_address.slice(0, 8)}...` : "Not set"}
            {config.token_id_start && config.token_id_end && (
              <span className="ml-2">
                (IDs: {config.token_id_start}-{config.token_id_end})
              </span>
            )}
          </div>
        )

      case "poap":
        return (
          <div className="text-sm text-gray-400">
            <span className="font-medium text-gray-300">Achievement Type:</span>{" "}
            {config.achievement_type || "Not set"}
            <span className="ml-2 text-xs text-gray-500">(Soulbound)</span>
          </div>
        )

      case "webhook":
        return (
          <div className="text-sm text-gray-400">
            <span className="font-medium text-gray-300">URL:</span>{" "}
            {config.url ? new URL(config.url).hostname : "Not set"}
            {config.use_hmac && (
              <span className="ml-2 text-xs bg-green-900/30 text-green-400 px-1.5 py-0.5 rounded">
                HMAC Secured
              </span>
            )}
          </div>
        )

      default:
        return (
          <div className="text-sm text-gray-400">
            <span className="font-medium text-gray-300">Type:</span>{" "}
            {getRewardTypeDisplay(campaign.reward_type)}
          </div>
        )
    }
  }

  const renderEligibility = (campaign: Campaign) => {
    if (campaign.rule_group_id && campaign.rule_group_name) {
      return (
        <div className="text-sm text-gray-400">
          <span className="font-medium text-gray-300">Rule Group:</span>{" "}
          {campaign.rule_group_name}
        </div>
      )
    }

    const req = campaign.eligibility_requirements
    if (!req || Object.keys(req).length === 0) {
      return (
        <div className="text-sm text-gray-400">
          No eligibility requirements
        </div>
      )
    }

    const requirements: string[] = []
    if (req.min_level) requirements.push(`Level ${req.min_level}+`)
    if (req.min_xp) requirements.push(`${req.min_xp} XP`)
    if (req.min_messages) requirements.push(`${req.min_messages} messages`)
    if (req.min_reputation) requirements.push(`${req.min_reputation} reputation`)
    if (req.min_streak) requirements.push(`${req.min_streak} day streak`)
    if (req.verified) requirements.push("Verified")

    return (
      <div className="text-sm text-gray-400">
        <span className="font-medium text-gray-300">Requirements:</span>{" "}
        {requirements.length > 0 ? requirements.join(", ") : "None"}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <Card className="bg-red-900/20 border-red-800">
          <CardHeader>
            <CardTitle className="text-red-400">Error</CardTitle>
            <CardDescription className="text-red-300">{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={fetchCampaigns} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-100 flex items-center gap-2">
            <Gift className="h-8 w-8 text-purple-500" />
            Reward Campaigns
          </h1>
          <p className="text-gray-400 mt-2">
            Create and manage reward campaigns for your community members. Distribute roles, XP, or access grants.
          </p>
        </div>
        <Button onClick={handleCreateCampaign} size="lg">
          <Plus className="h-5 w-5 mr-2" />
          Create Campaign
        </Button>
      </div>

      {/* Empty State */}
      {campaigns.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-center">No Reward Campaigns</CardTitle>
            <CardDescription className="text-center">
              Create your first reward campaign to start distributing benefits to your community
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-8">
            <Button onClick={handleCreateCampaign} size="lg">
              <Plus className="h-5 w-5 mr-2" />
              Create Your First Campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Campaigns List */
        <div className="grid gap-6">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <CardTitle className="text-xl">{campaign.name}</CardTitle>
                      <Badge variant={getStatusColor(campaign.status) as any}>
                        {campaign.status}
                      </Badge>
                      <Badge variant="outline">
                        {getRewardTypeDisplay(campaign.reward_type)}
                      </Badge>
                      <Badge variant="secondary">
                        {getTriggerTypeDisplay(campaign.trigger_type)}
                      </Badge>
                      {campaign.auto_claim && (
                        <Badge variant="default" className="bg-green-600">
                          Auto-Claim
                        </Badge>
                      )}
                    </div>
                    {campaign.description && (
                      <CardDescription>{campaign.description}</CardDescription>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={campaign.status === "active"}
                        disabled={campaign.status === "ended"}
                        onCheckedChange={() => handleToggleCampaign(campaign.id, campaign.status)}
                      />
                      <Label className="text-sm">
                        {campaign.status === "active" ? "Active" : "Paused"}
                      </Label>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Reward Configuration */}
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Reward</h4>
                  {renderRewardConfig(campaign)}
                </div>

                {/* Eligibility Requirements */}
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Eligibility</h4>
                  {renderEligibility(campaign)}
                </div>

                {/* Campaign Settings */}
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Settings</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-400">
                    <div>
                      <span className="font-medium text-gray-300">Max Claims:</span>{" "}
                      {campaign.max_claims || "Unlimited"}
                    </div>
                    <div>
                      <span className="font-medium text-gray-300">Cooldown:</span>{" "}
                      {campaign.cooldown_hours === 0
                        ? "One-time"
                        : `${campaign.cooldown_hours}h`}
                    </div>
                    {campaign.start_date && (
                      <div>
                        <span className="font-medium text-gray-300">Start:</span>{" "}
                        {new Date(campaign.start_date).toLocaleDateString()}
                      </div>
                    )}
                    {campaign.end_date && (
                      <div>
                        <span className="font-medium text-gray-300">End:</span>{" "}
                        {new Date(campaign.end_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Claim Statistics */}
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2">
                    Statistics
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-blue-400" />
                      <div>
                        <div className="font-medium text-gray-300">
                          {campaign.total_claims || 0}
                        </div>
                        <div className="text-xs text-gray-500">Total Claims</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <TrendingUp className="h-4 w-4 text-green-400" />
                      <div>
                        <div className="font-medium text-gray-300">
                          {campaign.successful_claims || 0}
                        </div>
                        <div className="text-xs text-gray-500">Successful</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-purple-400" />
                      <div>
                        <div className="font-medium text-gray-300">
                          {campaign.max_claims
                            ? `${campaign.total_claims || 0} / ${campaign.max_claims}`
                            : "∞"}
                        </div>
                        <div className="text-xs text-gray-500">Limit</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-gray-800">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditCampaign(campaign)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewClaims(campaign.id)}
                  >
                    View Claims
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteCampaign(campaign.id, campaign.name)}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info Card */}
      {campaigns.length > 0 && (
        <Card className="mt-8 bg-purple-900/20 border-purple-800">
          <CardHeader>
            <CardTitle className="text-purple-400 text-lg">How Reward Campaigns Work</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-300">
            <p>• <strong>Manual Claim:</strong> Users run <code className="bg-gray-800 px-1 rounded">/reward claim [campaign]</code> to claim rewards</p>
            <p>• <strong>Rule-Based:</strong> Automatically triggered when users pass token-gating rule groups</p>
            <p>• <strong>Auto-Claim:</strong> Delivers rewards immediately without user action (rule-based only)</p>
            <p>• <strong>Eligibility:</strong> Link to rule groups or set custom requirements (level, XP, messages)</p>
            <p>• <strong>Cooldown:</strong> Control how often users can claim (one-time or recurring)</p>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Campaign Dialog */}
      <CreateRewardDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        guildId={guildId}
        onSuccess={handleDialogSuccess}
        editCampaign={editingCampaign}
      />
    </div>
  )
}
