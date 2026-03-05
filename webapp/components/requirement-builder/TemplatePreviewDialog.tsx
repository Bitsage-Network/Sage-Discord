"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, XCircle } from "lucide-react"

interface TemplateCondition {
  type: string
  params: any
  label?: string
  negate?: boolean
}

interface Template {
  id: number
  name: string
  description: string
  category: string
  icon: string
  structure: {
    operator: "AND" | "OR" | "NOT"
    conditions: TemplateCondition[]
    groups?: any[]
  }
  usage_count: number
  is_public: boolean
}

interface TemplatePreviewDialogProps {
  template: Template
  onApply: () => void
  onClose: () => void
}

export function TemplatePreviewDialog({
  template,
  onApply,
  onClose,
}: TemplatePreviewDialogProps) {
  const getConditionIcon = (type: string) => {
    const icons: Record<string, string> = {
      token_balance: "💰",
      staked_amount: "🔒",
      nft_holding: "🖼️",
      reputation: "⭐",
      worker: "⚡",
      validator: "✅",
    }
    return icons[type] || "📋"
  }

  const getConditionLabel = (type: string) => {
    const labels: Record<string, string> = {
      token_balance: "Token Balance",
      staked_amount: "Staked Amount",
      nft_holding: "NFT Holding",
      reputation: "Reputation",
      worker: "Worker Status",
      validator: "Validator Status",
    }
    return labels[type] || type
  }

  const getConditionDescription = (condition: TemplateCondition) => {
    const data = condition.params || {}

    switch (condition.type) {
      case "token_balance":
        return `Minimum: ${formatBalance(data.min_balance)} tokens${
          data.include_staked ? " (includes staked)" : ""
        }`
      case "staked_amount":
        return `Minimum: ${formatBalance(data.min_stake)} staked${
          data.min_duration_days ? ` for ${data.min_duration_days} days` : ""
        }`
      case "nft_holding":
        return `Minimum: ${data.min_count || 1} NFTs${
          data.contract_address ? ` from ${data.contract_address.slice(0, 10)}...` : ""
        }`
      case "reputation":
        return `Minimum: ${data.min_reputation || 0} reputation points`
      case "worker":
        return `${data.is_active ? "Active worker" : "Worker"}${
          data.min_completed_jobs ? ` with ${data.min_completed_jobs}+ jobs` : ""
        }`
      case "validator":
        return `${data.is_active ? "Active validator" : "Validator"}${
          data.min_uptime ? ` with ${data.min_uptime}% uptime` : ""
        }`
      default:
        return "Custom condition"
    }
  }

  const formatBalance = (balance: string | number) => {
    if (!balance) return "0"
    try {
      const bn = BigInt(balance)
      const decimals = BigInt(10 ** 18)
      const whole = bn / decimals
      return whole.toString()
    } catch {
      return balance.toString()
    }
  }

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      defi: "DeFi",
      nft: "NFT",
      work: "Work & Contribution",
      advanced: "Advanced",
      custom: "Custom",
    }
    return labels[category] || category
  }

  const conditions = template.structure?.conditions || []

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-gray-700 px-6 py-4">
          <div className="flex items-start gap-4">
            <div className="text-4xl">{template.icon}</div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white">{template.name}</h2>
              <p className="text-sm text-gray-400 mt-1">{template.description}</p>
              <div className="flex gap-2 mt-3">
                <Badge variant="default" className="bg-blue-500">
                  {getCategoryLabel(template.category)}
                </Badge>
                <Badge variant="outline" className="text-gray-400">
                  Used {template.usage_count}x
                </Badge>
                {template.is_public && (
                  <Badge variant="outline" className="text-green-400 border-green-400">
                    Public
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Logic Operator */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Logic Operator</h3>
            <div className="inline-flex items-center gap-2 px-3 py-2 bg-gray-700 rounded-lg border border-gray-600">
              <span className="text-2xl">
                {template.structure?.operator === "AND"
                  ? "∧"
                  : template.structure?.operator === "OR"
                    ? "∨"
                    : "¬"}
              </span>
              <div>
                <div className="text-white font-semibold">
                  {template.structure?.operator || "AND"}
                </div>
                <div className="text-xs text-gray-400">
                  {template.structure?.operator === "AND"
                    ? "All conditions must be true"
                    : template.structure?.operator === "OR"
                      ? "At least one condition must be true"
                      : "Negate all conditions"}
                </div>
              </div>
            </div>
          </div>

          {/* Conditions */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-2">
              Conditions ({conditions.length})
            </h3>

            {conditions.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-gray-700 rounded-lg">
                <p className="text-gray-500">No conditions in this template</p>
              </div>
            ) : (
              <div className="space-y-2">
                {conditions.map((condition, index) => (
                  <div key={index}>
                    {index > 0 && (
                      <div className="flex items-center justify-center py-1">
                        <span className="text-xs font-mono font-semibold px-2 py-1 bg-gray-700 rounded text-gray-300">
                          {template.structure?.operator || "AND"}
                        </span>
                      </div>
                    )}

                    <div
                      className={`relative border rounded-lg p-4 ${
                        condition.negate
                          ? "border-red-500/50 bg-red-500/5"
                          : "border-gray-600 bg-gray-700/30"
                      }`}
                    >
                      {/* Negate Badge */}
                      {condition.negate && (
                        <div className="absolute top-2 right-2">
                          <Badge variant="default" className="bg-red-500/20 text-red-300">
                            NOT
                          </Badge>
                        </div>
                      )}

                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className="text-2xl">{getConditionIcon(condition.type)}</div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-white">
                            {condition.label || getConditionLabel(condition.type)}
                          </h4>
                          <p className="text-sm text-gray-400 mt-1">
                            {getConditionDescription(condition)}
                          </p>
                        </div>

                        {/* Visual indicator */}
                        <div className="text-blue-400">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Additional Info */}
          {template.structure?.groups && template.structure.groups.length > 0 && (
            <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <div className="text-blue-400">ℹ️</div>
                <div>
                  <div className="text-sm font-semibold text-blue-300">
                    Nested Groups
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    This template includes {template.structure.groups.length} nested
                    group(s) with additional logic
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-700 px-6 py-4 flex justify-between items-center">
          <div className="text-xs text-gray-500">
            Applying this template will create a new requirement group
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={onApply}>Apply Template</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
