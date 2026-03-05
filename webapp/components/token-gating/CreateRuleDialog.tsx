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
  RuleTypeEnum,
  getRuleTypeDisplayName,
  getRuleTypeDescription,
  getDefaultRequirements,
  type RuleType,
} from "@/lib/schemas"
import { Loader2, X } from "lucide-react"

// Form schema
const createRuleFormSchema = z.object({
  rule_name: z.string().min(1, "Rule name is required").max(100),
  description: z.string().max(500).optional(),
  rule_type: RuleTypeEnum,
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).max(100).default(0),
  privacy_enabled: z.boolean().default(false),
  require_zk_proof: z.boolean().default(false),
  allow_stealth_address: z.boolean().default(false),
  // Requirements (type-specific)
  min_balance: z.string().optional(),
  include_staked: z.boolean().optional(),
  min_staked: z.string().optional(),
  min_stake_duration: z.string().optional(),
  min_reputation: z.string().optional(),
  min_level: z.string().optional(),
  must_be_active: z.boolean().optional(),
  min_jobs_completed: z.string().optional(),
  min_success_rate: z.string().optional(),
  // Roles
  selected_roles: z.array(z.string()).min(1, "At least one role is required"),
})

type CreateRuleFormData = z.infer<typeof createRuleFormSchema>

interface CreateRuleDialogProps {
  open: boolean
  onClose: () => void
  guildId: string
  onSuccess?: () => void
  editRule?: any // Existing rule to edit
}

export function CreateRuleDialog({
  open,
  onClose,
  guildId,
  onSuccess,
  editRule,
}: CreateRuleDialogProps) {
  const [loading, setLoading] = useState(false)
  const [roles, setRoles] = useState<any[]>([])
  const [loadingRoles, setLoadingRoles] = useState(false)
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set())

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateRuleFormData>({
    resolver: zodResolver(createRuleFormSchema),
    defaultValues: {
      enabled: true,
      priority: 0,
      privacy_enabled: false,
      require_zk_proof: false,
      allow_stealth_address: false,
      include_staked: false,
      must_be_active: true,
      selected_roles: [],
    },
  })

  const ruleType = watch("rule_type")
  const privacyEnabled = watch("privacy_enabled")

  useEffect(() => {
    if (open) {
      fetchRoles()

      // Pre-fill form if editing
      if (editRule) {
        reset({
          rule_name: editRule.rule_name,
          description: editRule.description || "",
          rule_type: editRule.rule_type,
          enabled: editRule.enabled,
          priority: editRule.priority,
          privacy_enabled: editRule.privacy_enabled,
          require_zk_proof: editRule.require_zk_proof,
          allow_stealth_address: editRule.allow_stealth_address,
          ...editRule.requirements,
          selected_roles: editRule.roles?.map((r: any) => r.role_id) || [],
        })
        setSelectedRoles(new Set(editRule.roles?.map((r: any) => r.role_id) || []))
      } else {
        reset()
        setSelectedRoles(new Set())
      }
    }
  }, [open, editRule])

  const fetchRoles = async () => {
    try {
      setLoadingRoles(true)
      const response = await fetch(`/api/guilds/${guildId}/roles`)
      const data = await response.json()

      if (response.ok) {
        setRoles(data.roles || [])
      }
    } catch (err) {
      console.error("Error fetching roles:", err)
    } finally {
      setLoadingRoles(false)
    }
  }

  const toggleRole = (roleId: string) => {
    const newSelected = new Set(selectedRoles)
    if (newSelected.has(roleId)) {
      newSelected.delete(roleId)
    } else {
      newSelected.add(roleId)
    }
    setSelectedRoles(newSelected)
    setValue("selected_roles", Array.from(newSelected))
  }

  const onSubmit = async (data: CreateRuleFormData) => {
    try {
      setLoading(true)

      // Build requirements object based on rule type
      let requirements: any = {}

      switch (data.rule_type) {
        case "token_balance":
          requirements = {
            min_balance: data.min_balance,
            include_staked: data.include_staked || false,
          }
          break

        case "staked_amount":
          requirements = {
            min_staked: data.min_staked,
            min_stake_duration: data.min_stake_duration
              ? parseInt(data.min_stake_duration)
              : undefined,
          }
          break

        case "reputation":
          requirements = {
            min_reputation: parseInt(data.min_reputation || "0"),
            min_level: data.min_level ? parseInt(data.min_level) : undefined,
          }
          break

        case "validator":
          requirements = {
            must_be_active: data.must_be_active ?? true,
          }
          break

        case "worker":
          requirements = {
            must_be_active: data.must_be_active ?? true,
            min_jobs_completed: data.min_jobs_completed
              ? parseInt(data.min_jobs_completed)
              : undefined,
          }
          break
      }

      // Build roles array
      const rolesList = Array.from(selectedRoles).map(roleId => {
        const role = roles.find(r => r.id === roleId)
        return {
          role_id: roleId,
          role_name: role?.name || "Unknown Role",
          auto_assign: true,
          auto_remove: true,
        }
      })

      // Build request payload
      const payload = {
        rule_name: data.rule_name,
        description: data.description,
        rule_type: data.rule_type,
        requirements,
        privacy_enabled: data.privacy_enabled,
        require_zk_proof: data.require_zk_proof,
        allow_stealth_address: data.allow_stealth_address,
        enabled: data.enabled,
        priority: data.priority,
        roles: rolesList,
      }

      // Send request
      const url = editRule
        ? `/api/guilds/${guildId}/token-gating/${editRule.id}`
        : `/api/guilds/${guildId}/token-gating`

      const method = editRule ? "PATCH" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to save rule")
      }

      // Success
      onSuccess?.()
      onClose()
      reset()
    } catch (err: any) {
      console.error("Error saving rule:", err)
      alert(err.message || "Failed to save rule")
    } finally {
      setLoading(false)
    }
  }

  const renderRequirementFields = () => {
    switch (ruleType) {
      case "token_balance":
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="min_balance">Minimum Balance (SAGE)</Label>
              <Input
                id="min_balance"
                type="text"
                placeholder="1000"
                {...register("min_balance")}
              />
              {errors.min_balance && (
                <p className="text-sm text-red-500 mt-1">{errors.min_balance.message}</p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="include_staked"
                checked={watch("include_staked")}
                onCheckedChange={(checked) => setValue("include_staked", checked)}
              />
              <Label htmlFor="include_staked">Include staked tokens in balance</Label>
            </div>
          </div>
        )

      case "staked_amount":
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="min_staked">Minimum Staked Amount (SAGE)</Label>
              <Input
                id="min_staked"
                type="text"
                placeholder="1000"
                {...register("min_staked")}
              />
              {errors.min_staked && (
                <p className="text-sm text-red-500 mt-1">{errors.min_staked.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="min_stake_duration">Minimum Stake Duration (days)</Label>
              <Input
                id="min_stake_duration"
                type="number"
                placeholder="30"
                {...register("min_stake_duration")}
              />
              <p className="text-sm text-gray-500 mt-1">Optional - leave empty for no duration requirement</p>
            </div>
          </div>
        )

      case "reputation":
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="min_reputation">Minimum Reputation Score</Label>
              <Input
                id="min_reputation"
                type="number"
                placeholder="100"
                {...register("min_reputation")}
              />
              {errors.min_reputation && (
                <p className="text-sm text-red-500 mt-1">{errors.min_reputation.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="min_level">Minimum Level (Optional)</Label>
              <Input
                id="min_level"
                type="number"
                placeholder="5"
                {...register("min_level")}
              />
            </div>
          </div>
        )

      case "validator":
        return (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="must_be_active"
                checked={watch("must_be_active")}
                onCheckedChange={(checked) => setValue("must_be_active", checked)}
              />
              <Label htmlFor="must_be_active">Must be an active validator</Label>
            </div>
            <p className="text-sm text-gray-500">
              Users must have an active validator node on the Starknet network
            </p>
          </div>
        )

      case "worker":
        return (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="must_be_active_worker"
                checked={watch("must_be_active")}
                onCheckedChange={(checked) => setValue("must_be_active", checked)}
              />
              <Label htmlFor="must_be_active_worker">Must be an active worker node</Label>
            </div>

            <div>
              <Label htmlFor="min_jobs_completed">Minimum Jobs Completed (Optional)</Label>
              <Input
                id="min_jobs_completed"
                type="number"
                placeholder="10"
                {...register("min_jobs_completed")}
              />
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editRule ? "Edit Token-Gating Rule" : "Create Token-Gating Rule"}</DialogTitle>
          <DialogDescription>
            Configure automatic role assignment based on Starknet wallet holdings and activity
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-100">Basic Information</h3>

            <div>
              <Label htmlFor="rule_name">Rule Name</Label>
              <Input
                id="rule_name"
                placeholder="SAGE Holder"
                {...register("rule_name")}
              />
              {errors.rule_name && (
                <p className="text-sm text-red-500 mt-1">{errors.rule_name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                placeholder="Users who hold at least 1000 SAGE tokens"
                {...register("description")}
              />
            </div>
          </div>

          {/* Rule Type */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-100">Rule Type</h3>

            <div>
              <Label htmlFor="rule_type">Type</Label>
              <Select
                value={ruleType}
                onValueChange={(value) => setValue("rule_type", value as RuleType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select rule type" />
                </SelectTrigger>
                <SelectContent>
                  {(["token_balance", "staked_amount", "reputation", "validator", "worker"] as const).map((type) => (
                    <SelectItem key={type} value={type}>
                      <div>
                        <div className="font-medium">{getRuleTypeDisplayName(type)}</div>
                        <div className="text-xs text-gray-500">{getRuleTypeDescription(type)}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.rule_type && (
                <p className="text-sm text-red-500 mt-1">{errors.rule_type.message}</p>
              )}
            </div>

            {ruleType && (
              <div className="bg-gray-800/50 p-4 rounded-md">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Requirements</h4>
                {renderRequirementFields()}
              </div>
            )}
          </div>

          {/* Role Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-100">Assign Roles</h3>

            {loadingRoles ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              </div>
            ) : roles.length === 0 ? (
              <p className="text-sm text-gray-500">
                No roles available. Please link a Discord server first.
              </p>
            ) : (
              <div>
                <p className="text-sm text-gray-500 mb-3">
                  Select which Discord roles to assign when users meet the requirements
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-700 rounded-md p-3">
                  {roles.map((role) => (
                    <div
                      key={role.id}
                      className="flex items-center space-x-2 p-2 hover:bg-gray-800 rounded cursor-pointer"
                      onClick={() => toggleRole(role.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedRoles.has(role.id)}
                        onChange={() => toggleRole(role.id)}
                        className="rounded"
                      />
                      <span className="text-sm">{role.name}</span>
                    </div>
                  ))}
                </div>

                {selectedRoles.size > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Array.from(selectedRoles).map(roleId => {
                      const role = roles.find(r => r.id === roleId)
                      return (
                        <Badge key={roleId} variant="secondary">
                          {role?.name}
                          <button
                            type="button"
                            onClick={() => toggleRole(roleId)}
                            className="ml-2 hover:text-red-400"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      )
                    })}
                  </div>
                )}

                {errors.selected_roles && (
                  <p className="text-sm text-red-500 mt-1">{errors.selected_roles.message}</p>
                )}
              </div>
            )}
          </div>

          {/* Privacy Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-100">Privacy Settings (Advanced)</h3>

            <div className="flex items-center space-x-2">
              <Switch
                id="privacy_enabled"
                checked={privacyEnabled}
                onCheckedChange={(checked) => setValue("privacy_enabled", checked)}
              />
              <Label htmlFor="privacy_enabled">Enable privacy-preserving verification</Label>
            </div>

            {privacyEnabled && (
              <div className="ml-6 space-y-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="require_zk_proof"
                    checked={watch("require_zk_proof")}
                    onCheckedChange={(checked) => setValue("require_zk_proof", checked)}
                  />
                  <Label htmlFor="require_zk_proof">Require ZK proof (balance privacy)</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="allow_stealth_address"
                    checked={watch("allow_stealth_address")}
                    onCheckedChange={(checked) => setValue("allow_stealth_address", checked)}
                  />
                  <Label htmlFor="allow_stealth_address">Allow stealth addresses</Label>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editRule ? (
                "Update Rule"
              ) : (
                "Create Rule"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
