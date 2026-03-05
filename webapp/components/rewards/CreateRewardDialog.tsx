"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
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
  RewardTypeEnum,
  TriggerTypeEnum,
  getRewardTypeDescription,
  getTriggerTypeDescription,
  type RewardType,
  type TriggerType,
} from "@/lib/schemas"
import { Loader2, X, Plus, Gift, Zap, Lock } from "lucide-react"

// Form schema
const createRewardFormSchema = z.object({
  name: z.string().min(1, "Campaign name is required").max(200),
  description: z.string().max(500).optional(),
  reward_type: RewardTypeEnum,
  trigger_type: TriggerTypeEnum,
  auto_claim: z.boolean().default(false),

  // Reward config fields (Phase 1)
  role_ids: z.array(z.string()).optional(),
  xp_amount: z.number().int().positive().optional(),
  channel_ids: z.array(z.string()).optional(),
  duration_hours: z.number().int().min(0).optional(),

  // Reward config fields (Phase 2 - NFT)
  nft_contract_address: z.string().optional(),
  nft_metadata_uri: z.string().optional(),
  nft_token_id_start: z.number().int().min(0).optional(),
  nft_token_id_end: z.number().int().min(0).optional(),

  // Reward config fields (Phase 2 - POAP)
  poap_contract_address: z.string().optional(),
  poap_achievement_type: z.number().int().min(100).max(199).optional(),
  poap_metadata_uri: z.string().optional(),

  // Reward config fields (Phase 2 - Webhook)
  webhook_url: z.string().url().optional(),
  webhook_method: z.enum(["POST", "GET", "PUT", "PATCH"]).optional(),
  webhook_headers: z.string().optional(), // JSON string
  webhook_use_hmac: z.boolean().optional(),
  webhook_hmac_secret: z.string().optional(),
  webhook_rate_limit: z.number().int().min(1).optional(),
  webhook_timeout: z.number().int().min(1000).optional(),

  // Eligibility
  rule_group_id: z.string().optional(),
  min_level: z.number().int().min(0).optional(),
  min_xp: z.number().int().min(0).optional(),
  min_messages: z.number().int().min(0).optional(),

  // Settings
  max_claims: z.number().int().positive().optional(),
  cooldown_hours: z.number().int().min(0).default(0),
})

type CreateRewardFormData = z.infer<typeof createRewardFormSchema>

interface CreateRewardDialogProps {
  open: boolean
  onClose: () => void
  guildId: string
  onSuccess?: () => void
  editCampaign?: any
}

export function CreateRewardDialog({
  open,
  onClose,
  guildId,
  onSuccess,
  editCampaign,
}: CreateRewardDialogProps) {
  const [loading, setLoading] = useState(false)
  const [roles, setRoles] = useState<any[]>([])
  const [channels, setChannels] = useState<any[]>([])
  const [ruleGroups, setRuleGroups] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateRewardFormData>({
    resolver: zodResolver(createRewardFormSchema),
    defaultValues: {
      auto_claim: false,
      cooldown_hours: 0,
      duration_hours: 0,
    },
  })

  const rewardType = watch("reward_type")
  const triggerType = watch("trigger_type")
  const selectedRoles = watch("role_ids") || []
  const selectedChannels = watch("channel_ids") || []

  // Fetch roles, channels, and rule groups when dialog opens
  useEffect(() => {
    if (open) {
      fetchData()
    }
  }, [open, guildId])

  // Populate form when editing
  useEffect(() => {
    if (editCampaign && open) {
      setValue("name", editCampaign.name)
      setValue("description", editCampaign.description || "")
      setValue("reward_type", editCampaign.reward_type)
      setValue("trigger_type", editCampaign.trigger_type)
      setValue("auto_claim", editCampaign.auto_claim || false)
      setValue("max_claims", editCampaign.max_claims || undefined)
      setValue("cooldown_hours", editCampaign.cooldown_hours || 0)

      // Set reward config fields
      const config = editCampaign.reward_config
      if (config.role_ids) setValue("role_ids", config.role_ids)
      if (config.xp_amount) setValue("xp_amount", config.xp_amount)
      if (config.channel_ids) setValue("channel_ids", config.channel_ids)
      if (config.duration_hours) setValue("duration_hours", config.duration_hours)

      // Set eligibility requirements
      const reqs = editCampaign.eligibility_requirements || {}
      if (reqs.min_level) setValue("min_level", reqs.min_level)
      if (reqs.min_xp) setValue("min_xp", reqs.min_xp)
      if (reqs.min_messages) setValue("min_messages", reqs.min_messages)

      if (editCampaign.rule_group_id) {
        setValue("rule_group_id", editCampaign.rule_group_id)
      }
    }
  }, [editCampaign, open])

  const fetchData = async () => {
    setLoadingData(true)
    try {
      // Fetch roles
      const rolesRes = await fetch(`/api/guilds/${guildId}/roles`)
      if (rolesRes.ok) {
        const rolesData = await rolesRes.json()
        setRoles(rolesData.roles || [])
      }

      // Fetch channels
      const channelsRes = await fetch(`/api/guilds/${guildId}/channels`)
      if (channelsRes.ok) {
        const channelsData = await channelsRes.json()
        setChannels(channelsData.channels || [])
      }

      // Fetch rule groups
      const groupsRes = await fetch(`/api/guilds/${guildId}/rule-groups`)
      if (groupsRes.ok) {
        const groupsData = await groupsRes.json()
        setRuleGroups(groupsData.groups || [])
      }
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoadingData(false)
    }
  }

  const onSubmit = async (data: CreateRewardFormData) => {
    try {
      setLoading(true)

      // Build reward_config based on reward_type
      let reward_config: any = {}

      if (data.reward_type === "role") {
        if (!data.role_ids || data.role_ids.length === 0) {
          alert("Please select at least one role")
          return
        }
        reward_config = { role_ids: data.role_ids }
      } else if (data.reward_type === "xp") {
        if (!data.xp_amount || data.xp_amount <= 0) {
          alert("Please enter a positive XP amount")
          return
        }
        reward_config = { xp_amount: data.xp_amount }
      } else if (data.reward_type === "access_grant") {
        if (!data.channel_ids || data.channel_ids.length === 0) {
          alert("Please select at least one channel")
          return
        }
        reward_config = {
          channel_ids: data.channel_ids,
          duration_hours: data.duration_hours || 0,
        }
      } else if (data.reward_type === "nft") {
        if (!data.nft_contract_address) {
          alert("Please enter NFT contract address")
          return
        }
        reward_config = {
          contract_address: data.nft_contract_address,
          metadata_uri: data.nft_metadata_uri || "",
          auto_increment: true,
        }
        if (data.nft_token_id_start !== undefined) {
          reward_config.token_id_start = data.nft_token_id_start
        }
        if (data.nft_token_id_end !== undefined) {
          reward_config.token_id_end = data.nft_token_id_end
        }
      } else if (data.reward_type === "poap") {
        if (!data.poap_contract_address) {
          alert("Please enter Sage Achievement contract address")
          return
        }
        if (!data.poap_achievement_type || data.poap_achievement_type < 100 || data.poap_achievement_type > 199) {
          alert("Achievement type must be between 100 and 199")
          return
        }
        reward_config = {
          contract_address: data.poap_contract_address,
          achievement_type: data.poap_achievement_type,
          metadata_uri: data.poap_metadata_uri || "",
        }
      } else if (data.reward_type === "webhook") {
        if (!data.webhook_url) {
          alert("Please enter webhook URL")
          return
        }
        reward_config = {
          url: data.webhook_url,
          method: data.webhook_method || "POST",
        }

        // Parse headers if provided
        if (data.webhook_headers) {
          try {
            reward_config.headers = JSON.parse(data.webhook_headers)
          } catch (e) {
            alert("Invalid JSON in webhook headers")
            return
          }
        }

        if (data.webhook_use_hmac) {
          reward_config.use_hmac = true
          if (data.webhook_hmac_secret) {
            reward_config.hmac_secret = data.webhook_hmac_secret
          }
        }

        if (data.webhook_rate_limit) {
          reward_config.rate_limit = data.webhook_rate_limit
        }
        if (data.webhook_timeout) {
          reward_config.timeout = data.webhook_timeout
        }
      }

      // Build eligibility_requirements
      const eligibility_requirements: any = {}
      if (data.min_level) eligibility_requirements.min_level = data.min_level
      if (data.min_xp) eligibility_requirements.min_xp = data.min_xp
      if (data.min_messages) eligibility_requirements.min_messages = data.min_messages

      // Build payload
      const payload = {
        name: data.name,
        description: data.description || null,
        reward_type: data.reward_type,
        reward_config,
        trigger_type: data.trigger_type,
        trigger_config: {},
        auto_claim: data.auto_claim,
        rule_group_id: data.rule_group_id && data.rule_group_id !== "none" ? data.rule_group_id : null,
        eligibility_requirements,
        max_claims: data.max_claims || null,
        cooldown_hours: data.cooldown_hours,
      }

      const url = editCampaign
        ? `/api/guilds/${guildId}/rewards/${editCampaign.id}`
        : `/api/guilds/${guildId}/rewards`

      const method = editCampaign ? "PATCH" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to save campaign")
      }

      onSuccess?.()
      handleClose()
    } catch (error: any) {
      console.error("Error saving campaign:", error)
      alert(error.message || "Failed to save campaign")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const toggleRole = (roleId: string) => {
    const current = selectedRoles || []
    const updated = current.includes(roleId)
      ? current.filter((id) => id !== roleId)
      : [...current, roleId]
    setValue("role_ids", updated)
  }

  const toggleChannel = (channelId: string) => {
    const current = selectedChannels || []
    const updated = current.includes(channelId)
      ? current.filter((id) => id !== channelId)
      : [...current, channelId]
    setValue("channel_ids", updated)
  }

  const renderRewardConfigFields = () => {
    if (!rewardType) return null

    switch (rewardType) {
      case "role":
        return (
          <div className="space-y-3">
            <Label>Roles to Assign</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Select the Discord roles to assign when users claim this reward
            </p>
            {loadingData ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
                {roles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No roles found</p>
                ) : (
                  <div className="space-y-2">
                    {roles.map((role) => (
                      <div
                        key={role.id}
                        className="flex items-center space-x-2 p-2 hover:bg-accent rounded cursor-pointer"
                        onClick={() => toggleRole(role.id)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedRoles.includes(role.id)}
                          onChange={() => {}}
                          className="h-4 w-4"
                        />
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: role.color || "#99AAB5" }}
                        />
                        <span className="text-sm">{role.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {selectedRoles.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedRoles.map((roleId) => {
                  const role = roles.find((r) => r.id === roleId)
                  return role ? (
                    <Badge key={roleId} variant="secondary">
                      {role.name}
                      <X
                        className="h-3 w-3 ml-1 cursor-pointer"
                        onClick={() => toggleRole(roleId)}
                      />
                    </Badge>
                  ) : null
                })}
              </div>
            )}
          </div>
        )

      case "xp":
        return (
          <div className="space-y-3">
            <Label htmlFor="xp_amount">XP Amount</Label>
            <Input
              id="xp_amount"
              type="number"
              min="1"
              placeholder="500"
              {...register("xp_amount", { valueAsNumber: true })}
            />
            <p className="text-sm text-muted-foreground">
              How much XP to award (may trigger level-up)
            </p>
          </div>
        )

      case "access_grant":
        return (
          <div className="space-y-4">
            <div className="space-y-3">
              <Label>Channels to Grant Access</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Select channels users will gain access to
              </p>
              {loadingData ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : (
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
                  {channels.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No channels found</p>
                  ) : (
                    <div className="space-y-2">
                      {channels.map((channel) => (
                        <div
                          key={channel.id}
                          className="flex items-center space-x-2 p-2 hover:bg-accent rounded cursor-pointer"
                          onClick={() => toggleChannel(channel.id)}
                        >
                          <input
                            type="checkbox"
                            checked={selectedChannels.includes(channel.id)}
                            onChange={() => {}}
                            className="h-4 w-4"
                          />
                          <span className="text-sm">#{channel.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {selectedChannels.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedChannels.map((channelId) => {
                    const channel = channels.find((c) => c.id === channelId)
                    return channel ? (
                      <Badge key={channelId} variant="secondary">
                        #{channel.name}
                        <X
                          className="h-3 w-3 ml-1 cursor-pointer"
                          onClick={() => toggleChannel(channelId)}
                        />
                      </Badge>
                    ) : null
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration_hours">
                Duration (hours, 0 = permanent)
              </Label>
              <Input
                id="duration_hours"
                type="number"
                min="0"
                placeholder="24"
                {...register("duration_hours", { valueAsNumber: true })}
              />
              <p className="text-sm text-muted-foreground">
                Leave as 0 for permanent access
              </p>
            </div>
          </div>
        )

      case "nft":
        return (
          <div className="space-y-4">
            <div className="p-3 border border-purple-500/50 bg-purple-500/10 rounded-md">
              <p className="text-sm text-purple-400 flex items-center gap-2">
                <Gift className="h-4 w-4" />
                NFT Rewards require users to verify their Starknet wallet with /verify
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nft_contract_address">
                NFT Contract Address * <Badge variant="outline">Starknet</Badge>
              </Label>
              <Input
                id="nft_contract_address"
                placeholder="0x..."
                {...register("nft_contract_address")}
              />
              <p className="text-sm text-muted-foreground">
                Starknet ERC721 contract address (you must have minter role)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nft_metadata_uri">Metadata URI</Label>
              <Input
                id="nft_metadata_uri"
                placeholder="ipfs://Qm.../metadata/"
                {...register("nft_metadata_uri")}
              />
              <p className="text-sm text-muted-foreground">
                Base URI for token metadata (IPFS or HTTP)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nft_token_id_start">Token ID Start</Label>
                <Input
                  id="nft_token_id_start"
                  type="number"
                  min="0"
                  placeholder="1"
                  {...register("nft_token_id_start", { valueAsNumber: true })}
                />
                <p className="text-sm text-muted-foreground">Optional range start</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nft_token_id_end">Token ID End</Label>
                <Input
                  id="nft_token_id_end"
                  type="number"
                  min="0"
                  placeholder="1000"
                  {...register("nft_token_id_end", { valueAsNumber: true })}
                />
                <p className="text-sm text-muted-foreground">Optional range end</p>
              </div>
            </div>
          </div>
        )

      case "poap":
        return (
          <div className="space-y-4">
            <div className="p-3 border border-blue-500/50 bg-blue-500/10 rounded-md">
              <p className="text-sm text-blue-400 flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Sage Achievements are soulbound (non-transferable) NFTs on your Gamification contract
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="poap_contract_address">
                Achievement NFT Contract * <Badge variant="outline">Starknet</Badge>
              </Label>
              <Input
                id="poap_contract_address"
                placeholder="0x..."
                {...register("poap_contract_address")}
              />
              <p className="text-sm text-muted-foreground">
                BitSage achievement_nft.cairo contract address
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="poap_achievement_type">
                Achievement Type (100-199)
              </Label>
              <Input
                id="poap_achievement_type"
                type="number"
                min="100"
                max="199"
                placeholder="100"
                {...register("poap_achievement_type", { valueAsNumber: true })}
              />
              <p className="text-sm text-muted-foreground">
                100-199 reserved for Discord rewards (e.g., 100 = Early Adopter)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="poap_metadata_uri">Metadata URI</Label>
              <Input
                id="poap_metadata_uri"
                placeholder="ipfs://Qm.../achievement.json"
                {...register("poap_metadata_uri")}
              />
              <p className="text-sm text-muted-foreground">
                Achievement metadata (image, attributes, description)
              </p>
            </div>
          </div>
        )

      case "webhook":
        return (
          <div className="space-y-4">
            <div className="p-3 border border-green-500/50 bg-green-500/10 rounded-md">
              <p className="text-sm text-green-400 flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Webhooks call external APIs when users claim rewards
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook_url">Webhook URL *</Label>
              <Input
                id="webhook_url"
                type="url"
                placeholder="https://api.example.com/discord-rewards"
                {...register("webhook_url")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook_method">HTTP Method</Label>
              <Select
                onValueChange={(value) => setValue("webhook_method", value as any)}
                defaultValue="POST"
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook_headers">
                Custom Headers (JSON)
              </Label>
              <Textarea
                id="webhook_headers"
                placeholder='{"X-API-Key": "secret", "Content-Type": "application/json"}'
                rows={3}
                {...register("webhook_headers")}
              />
              <p className="text-sm text-muted-foreground">
                Optional: JSON object with custom headers
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="webhook_use_hmac"
                onCheckedChange={(checked) => setValue("webhook_use_hmac", checked)}
              />
              <Label htmlFor="webhook_use_hmac">Enable HMAC Signature</Label>
            </div>

            {watch("webhook_use_hmac") && (
              <div className="space-y-2">
                <Label htmlFor="webhook_hmac_secret">HMAC Secret</Label>
                <Input
                  id="webhook_hmac_secret"
                  type="password"
                  placeholder="shared-secret-key"
                  {...register("webhook_hmac_secret")}
                />
                <p className="text-sm text-muted-foreground">
                  Shared secret for HMAC SHA256 signature verification
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="webhook_rate_limit">
                  Rate Limit (calls/hour)
                </Label>
                <Input
                  id="webhook_rate_limit"
                  type="number"
                  min="1"
                  placeholder="100"
                  {...register("webhook_rate_limit", { valueAsNumber: true })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhook_timeout">Timeout (ms)</Label>
                <Input
                  id="webhook_timeout"
                  type="number"
                  min="1000"
                  placeholder="10000"
                  {...register("webhook_timeout", { valueAsNumber: true })}
                />
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editCampaign ? "Edit Reward Campaign" : "Create Reward Campaign"}
          </DialogTitle>
          <DialogDescription>
            {editCampaign
              ? "Update your reward campaign settings"
              : "Set up a new reward campaign for your community members"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name *</Label>
              <Input
                id="name"
                placeholder="Early Supporter"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Reward for early community members..."
                rows={3}
                {...register("description")}
              />
            </div>
          </div>

          {/* Reward Type */}
          <div className="space-y-2">
            <Label>Reward Type *</Label>
            <Select
              value={rewardType}
              onValueChange={(value) => setValue("reward_type", value as RewardType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select reward type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="role">
                  <div className="flex items-center gap-2">
                    <Gift className="h-4 w-4" />
                    <span>Discord Role(s)</span>
                  </div>
                </SelectItem>
                <SelectItem value="xp">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    <span>XP/Points</span>
                  </div>
                </SelectItem>
                <SelectItem value="access_grant">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    <span>Channel Access</span>
                  </div>
                </SelectItem>
                <SelectItem value="nft">
                  <div className="flex items-center gap-2">
                    <Gift className="h-4 w-4" />
                    <span>NFT (Transferable)</span>
                  </div>
                </SelectItem>
                <SelectItem value="poap">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    <span>Sage Achievement (Soulbound)</span>
                  </div>
                </SelectItem>
                <SelectItem value="webhook">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    <span>Custom Webhook</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            {rewardType && (
              <p className="text-sm text-muted-foreground">
                {getRewardTypeDescription(rewardType)}
              </p>
            )}
          </div>

          {/* Reward Config */}
          {rewardType && (
            <div className="p-4 border rounded-md bg-accent/50">
              <h3 className="text-sm font-medium mb-3">Reward Configuration</h3>
              {renderRewardConfigFields()}
            </div>
          )}

          {/* Trigger Type */}
          <div className="space-y-2">
            <Label>Trigger Type *</Label>
            <Select
              value={triggerType}
              onValueChange={(value) => setValue("trigger_type", value as TriggerType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select trigger type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual Claim</SelectItem>
                <SelectItem value="rule_pass">Rule Pass (Automatic)</SelectItem>
                <SelectItem value="scheduled">Scheduled (Phase 2)</SelectItem>
              </SelectContent>
            </Select>
            {triggerType && (
              <p className="text-sm text-muted-foreground">
                {getTriggerTypeDescription(triggerType)}
              </p>
            )}
          </div>

          {/* Auto-claim (only for rule_pass) */}
          {triggerType === "rule_pass" && (
            <div className="flex items-center space-x-2">
              <Switch
                id="auto_claim"
                checked={watch("auto_claim")}
                onCheckedChange={(checked) => setValue("auto_claim", checked)}
              />
              <Label htmlFor="auto_claim" className="cursor-pointer">
                Auto-deliver reward (no manual claim required)
              </Label>
            </div>
          )}

          {/* Eligibility */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Eligibility Requirements</h3>

            <div className="space-y-2">
              <Label htmlFor="rule_group_id">Rule Group (Token-Gating)</Label>
              <Select
                value={watch("rule_group_id") || ""}
                onValueChange={(value) => setValue("rule_group_id", value || undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {ruleGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="min_level">Min Level</Label>
                <Input
                  id="min_level"
                  type="number"
                  min="0"
                  placeholder="0"
                  {...register("min_level", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min_xp">Min XP</Label>
                <Input
                  id="min_xp"
                  type="number"
                  min="0"
                  placeholder="0"
                  {...register("min_xp", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min_messages">Min Messages</Label>
                <Input
                  id="min_messages"
                  type="number"
                  min="0"
                  placeholder="0"
                  {...register("min_messages", { valueAsNumber: true })}
                />
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Campaign Settings</h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="max_claims">Max Claims (0 = unlimited)</Label>
                <Input
                  id="max_claims"
                  type="number"
                  min="0"
                  placeholder="100"
                  {...register("max_claims", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cooldown_hours">Cooldown (hours, 0 = one-time)</Label>
                <Input
                  id="cooldown_hours"
                  type="number"
                  min="0"
                  placeholder="0"
                  {...register("cooldown_hours", { valueAsNumber: true })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {editCampaign ? "Updating..." : "Creating..."}
                </>
              ) : (
                <>{editCampaign ? "Update Campaign" : "Create Campaign"}</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
