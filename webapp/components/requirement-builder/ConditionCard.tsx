"use client"

import { Button } from "@/components/ui/button"
import { Condition } from "@/types/requirement-builder"
import { Pencil, GripVertical } from "lucide-react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

interface ConditionCardProps {
  condition: Condition
  conditionIndex: number
  onUpdate: (updates: Partial<Condition>) => void
  onDelete: () => void
  onToggleNegate: () => void
  onEdit: (conditionIndex: number) => void
  guildId: string
}

export function ConditionCard({
  condition,
  conditionIndex,
  onUpdate,
  onDelete,
  onToggleNegate,
  onEdit,
  guildId,
}: ConditionCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: condition.id || `temp-${conditionIndex}` })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const getConditionIcon = (type: string) => {
    const icons: Record<string, string> = {
      token_balance: "💰",
      staked_amount: "🔒",
      nft_holding: "🖼️",
      reputation: "⭐",
      worker: "⚡",
      validator: "✅",
      social_follow: "👥",
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
      social_follow: "Social Follow",
    }
    return labels[type] || type
  }

  const getConditionDescription = () => {
    const data = condition.condition_data

    switch (condition.condition_type) {
      case "token_balance":
        return `Min: ${formatBalance(data.min_balance)} tokens`
      case "staked_amount":
        return `Min: ${formatBalance(data.min_stake)} staked${
          data.min_duration_days ? ` for ${data.min_duration_days}d` : ""
        }`
      case "nft_holding":
        return `Min: ${data.min_count} NFTs${
          data.contract_address ? ` from ${data.contract_address.slice(0, 8)}...` : ""
        }`
      case "reputation":
        return `Min: ${data.min_reputation} reputation points`
      case "worker":
        return `Active: ${data.is_active ? "Yes" : "No"}${
          data.min_completed_jobs ? `, ${data.min_completed_jobs}+ jobs` : ""
        }`
      case "validator":
        return `Active: ${data.is_active ? "Yes" : "No"}${
          data.min_uptime ? `, ${data.min_uptime}% uptime` : ""
        }`
      default:
        return JSON.stringify(data)
    }
  }

  const formatBalance = (balance: string | number) => {
    if (!balance) return "0"
    const bn = BigInt(balance)
    const decimals = BigInt(10 ** 18)
    const whole = bn / decimals
    return whole.toString()
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`relative border rounded-lg p-4 ${
        condition.negate
          ? "border-red-500/50 bg-red-500/5"
          : "border-gray-600 bg-gray-700/30"
      }`}
    >
      {/* Negate Badge */}
      {condition.negate && (
        <div className="absolute top-2 right-2">
          <span className="px-2 py-0.5 bg-red-500/20 border border-red-500/50 rounded text-xs text-red-300 font-semibold">
            NOT
          </span>
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Drag Handle */}
        <button
          {...listeners}
          className="touch-none cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300 transition-colors pt-1"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-5 w-5" />
        </button>

        {/* Icon */}
        <div className="text-2xl">{getConditionIcon(condition.condition_type)}</div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-white">
            {condition.label || getConditionLabel(condition.condition_type)}
          </h4>
          <p className="text-sm text-gray-400 mt-1">{getConditionDescription()}</p>

          {/* Raw data (collapsible for debugging) */}
          {process.env.NODE_ENV === "development" && (
            <details className="mt-2">
              <summary className="text-xs text-gray-500 cursor-pointer">
                Raw Data
              </summary>
              <pre className="text-xs text-gray-500 mt-1 overflow-x-auto">
                {JSON.stringify(condition.condition_data, null, 2)}
              </pre>
            </details>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(conditionIndex)
            }}
            className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
            title="Edit condition"
          >
            <Pencil className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onToggleNegate()
            }}
            className={
              condition.negate
                ? "text-red-400 hover:text-red-300"
                : "text-gray-400 hover:text-gray-300"
            }
            title={condition.negate ? "Remove NOT" : "Add NOT"}
          >
            {condition.negate ? "⊗" : "○"}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            title="Delete condition"
          >
            🗑️
          </Button>
        </div>
      </div>
    </div>
  )
}
