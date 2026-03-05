"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Plus, Shield, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { getRuleTypeDisplayName, getRuleTypeDescription, type TokenGatingRule } from "@/lib/schemas"
import { CreateRuleDialog } from "@/components/token-gating/CreateRuleDialog"

export default function TokenGatingPage() {
  const params = useParams()
  const router = useRouter()
  const guildId = params.id as string

  const [rules, setRules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<any | null>(null)

  useEffect(() => {
    fetchRules()
  }, [guildId])

  const fetchRules = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/guilds/${guildId}/token-gating`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch rules")
      }

      setRules(data.rules || [])
    } catch (err: any) {
      console.error("Error fetching rules:", err)
      setError(err.message || "Failed to load token-gating rules")
    } finally {
      setLoading(false)
    }
  }

  const handleToggleRule = async (ruleId: number, currentEnabled: boolean) => {
    try {
      const response = await fetch(`/api/guilds/${guildId}/token-gating/${ruleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !currentEnabled }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update rule")
      }

      // Update local state
      setRules(rules.map(rule =>
        rule.id === ruleId ? { ...rule, enabled: !currentEnabled } : rule
      ))
    } catch (err: any) {
      console.error("Error toggling rule:", err)
      alert(err.message || "Failed to update rule")
    }
  }

  const handleDeleteRule = async (ruleId: number, ruleName: string) => {
    if (!confirm(`Are you sure you want to delete the rule "${ruleName}"?\n\nThis will remove all associated role mappings.`)) {
      return
    }

    try {
      const response = await fetch(`/api/guilds/${guildId}/token-gating/${ruleId}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete rule")
      }

      // Remove from local state
      setRules(rules.filter(rule => rule.id !== ruleId))
    } catch (err: any) {
      console.error("Error deleting rule:", err)
      alert(err.message || "Failed to delete rule")
    }
  }

  const handleEditRule = (rule: any) => {
    setEditingRule(rule)
    setDialogOpen(true)
  }

  const handleCreateRule = () => {
    setEditingRule(null)
    setDialogOpen(true)
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
    setEditingRule(null)
  }

  const handleDialogSuccess = () => {
    fetchRules()
  }

  const renderRequirements = (rule: any) => {
    const req = rule.requirements

    switch (rule.rule_type) {
      case "token_balance":
        return (
          <div className="text-sm text-gray-400">
            <span className="font-medium text-gray-300">Minimum Balance:</span> {req.min_balance} SAGE
            {req.include_staked && <span className="ml-2">(includes staked)</span>}
          </div>
        )

      case "staked_amount":
        return (
          <div className="text-sm text-gray-400">
            <span className="font-medium text-gray-300">Minimum Staked:</span> {req.min_staked} SAGE
            {req.min_stake_duration && (
              <span className="ml-2">for {req.min_stake_duration} days</span>
            )}
          </div>
        )

      case "reputation":
        return (
          <div className="text-sm text-gray-400">
            <span className="font-medium text-gray-300">Minimum Reputation:</span> {req.min_reputation}
            {req.min_level && <span className="ml-2">(Level {req.min_level}+)</span>}
          </div>
        )

      case "validator":
        return (
          <div className="text-sm text-gray-400">
            <span className="font-medium text-gray-300">Requirements:</span> Must be an active validator
            {req.min_stake && <span className="ml-2">with {req.min_stake} SAGE staked</span>}
          </div>
        )

      case "worker":
        return (
          <div className="text-sm text-gray-400">
            <span className="font-medium text-gray-300">Requirements:</span> Must be an active worker node
            {req.min_jobs_completed && (
              <span className="ml-2">with {req.min_jobs_completed}+ jobs completed</span>
            )}
          </div>
        )

      default:
        return null
    }
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
            <Button onClick={fetchRules} variant="outline">
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
            <Shield className="h-8 w-8 text-blue-500" />
            Token-Gating Rules
          </h1>
          <p className="text-gray-400 mt-2">
            Configure automatic role assignment based on Starknet wallet holdings, staking, and reputation.
          </p>
        </div>
        <Button onClick={handleCreateRule} size="lg">
          <Plus className="h-5 w-5 mr-2" />
          Create Rule
        </Button>
      </div>

      {/* Empty State */}
      {rules.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-center">No Token-Gating Rules</CardTitle>
            <CardDescription className="text-center">
              Create your first rule to start automatically assigning roles based on wallet holdings
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-8">
            <Button onClick={handleCreateRule} size="lg">
              <Plus className="h-5 w-5 mr-2" />
              Create Your First Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Rules List */
        <div className="grid gap-6">
          {rules.map((rule) => (
            <Card key={rule.id} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <CardTitle className="text-xl">{rule.rule_name}</CardTitle>
                      <Badge variant={rule.enabled ? "success" : "secondary"}>
                        {rule.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                      <Badge variant="outline">
                        {getRuleTypeDisplayName(rule.rule_type as any)}
                      </Badge>
                      {rule.privacy_enabled && (
                        <Badge variant="default" className="bg-purple-600">
                          Privacy
                        </Badge>
                      )}
                    </div>
                    {rule.description && (
                      <CardDescription>{rule.description}</CardDescription>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={() => handleToggleRule(rule.id, rule.enabled)}
                      />
                      <Label className="text-sm">{rule.enabled ? "On" : "Off"}</Label>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Requirements */}
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Requirements</h4>
                  {renderRequirements(rule)}
                </div>

                {/* Associated Roles */}
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2">
                    Assigned Roles ({rule.roles?.length || 0})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {rule.roles && rule.roles.length > 0 ? (
                      rule.roles.map((role: any) => (
                        <Badge key={role.id} variant="secondary">
                          {role.role_name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-gray-500">No roles assigned</span>
                    )}
                  </div>
                </div>

                {/* Privacy Settings */}
                {rule.privacy_enabled && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-300 mb-2">Privacy Settings</h4>
                    <div className="flex gap-4 text-sm text-gray-400">
                      {rule.require_zk_proof && (
                        <span className="flex items-center gap-1">
                          ✓ ZK Proof Required
                        </span>
                      )}
                      {rule.allow_stealth_address && (
                        <span className="flex items-center gap-1">
                          ✓ Stealth Addresses Allowed
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-gray-800">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditRule(rule)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteRule(rule.id, rule.rule_name)}
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
      {rules.length > 0 && (
        <Card className="mt-8 bg-blue-900/20 border-blue-800">
          <CardHeader>
            <CardTitle className="text-blue-400 text-lg">How Token-Gating Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-300">
            <p>• Users connect their Starknet wallet to verify ownership</p>
            <p>• The bot checks if they meet the requirements (balance, staking, etc.)</p>
            <p>• Roles are automatically assigned or removed based on the rules</p>
            <p>• Rules are re-checked periodically to keep roles up-to-date</p>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Rule Dialog */}
      <CreateRuleDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        guildId={guildId}
        onSuccess={handleDialogSuccess}
        editRule={editingRule}
      />
    </div>
  )
}
