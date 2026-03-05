"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Condition } from "@/types/requirement-builder"

interface ConditionBuilderProps {
  onAdd: (condition: Condition) => void
  onClose: () => void
  guildId: string
}

export function ConditionBuilder({ onAdd, onClose, guildId }: ConditionBuilderProps) {
  const [conditionType, setConditionType] = useState<string>("token_balance")
  const [label, setLabel] = useState("")
  const [formData, setFormData] = useState<any>({})

  const conditionTypes = [
    { value: "token_balance", label: "Token Balance", icon: "💰" },
    { value: "staked_amount", label: "Staked Amount", icon: "🔒" },
    { value: "nft_holding", label: "NFT Holding", icon: "🖼️" },
    { value: "reputation", label: "Reputation", icon: "⭐" },
    { value: "worker", label: "Worker Status", icon: "⚡" },
    { value: "validator", label: "Validator Status", icon: "✅" },
  ]

  const handleAdd = () => {
    const condition: Condition = {
      condition_type: conditionType,
      condition_data: formData,
      negate: false,
      position: 0,
      label: label || undefined,
    }

    onAdd(condition)
  }

  const renderForm = () => {
    switch (conditionType) {
      case "token_balance":
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Token Contract Address
              </label>
              <input
                type="text"
                placeholder="0x..."
                value={formData.token_address || ""}
                onChange={(e) =>
                  setFormData({ ...formData, token_address: e.target.value })
                }
                className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Minimum Balance (in wei)
              </label>
              <input
                type="text"
                placeholder="1000000000000000000"
                value={formData.min_balance || ""}
                onChange={(e) =>
                  setFormData({ ...formData, min_balance: e.target.value })
                }
                className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                1 token = 1000000000000000000 (1e18)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="include_staked"
                checked={formData.include_staked || false}
                onChange={(e) =>
                  setFormData({ ...formData, include_staked: e.target.checked })
                }
                className="w-4 h-4 text-blue-500"
              />
              <label htmlFor="include_staked" className="text-sm text-gray-300">
                Include staked tokens in balance
              </label>
            </div>
          </>
        )

      case "staked_amount":
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Minimum Staked Amount (in wei)
              </label>
              <input
                type="text"
                placeholder="5000000000000000000"
                value={formData.min_stake || ""}
                onChange={(e) =>
                  setFormData({ ...formData, min_stake: e.target.value })
                }
                className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Minimum Duration (days)
              </label>
              <input
                type="number"
                placeholder="30"
                value={formData.min_duration_days || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    min_duration_days: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </>
        )

      case "nft_holding":
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                NFT Contract Address
              </label>
              <input
                type="text"
                placeholder="0x..."
                value={formData.contract_address || ""}
                onChange={(e) =>
                  setFormData({ ...formData, contract_address: e.target.value })
                }
                className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Minimum NFT Count
              </label>
              <input
                type="number"
                placeholder="1"
                value={formData.min_count || ""}
                onChange={(e) =>
                  setFormData({ ...formData, min_count: parseInt(e.target.value) || 1 })
                }
                className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </>
        )

      case "reputation":
        return (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Minimum Reputation Points
            </label>
            <input
              type="number"
              placeholder="100"
              value={formData.min_reputation || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  min_reputation: parseInt(e.target.value) || 0,
                })
              }
              className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>
        )

      case "worker":
        return (
          <>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active_worker"
                checked={formData.is_active || false}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
                className="w-4 h-4 text-blue-500"
              />
              <label htmlFor="is_active_worker" className="text-sm text-gray-300">
                Must be active worker
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Minimum Completed Jobs
              </label>
              <input
                type="number"
                placeholder="10"
                value={formData.min_completed_jobs || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    min_completed_jobs: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </>
        )

      case "validator":
        return (
          <>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active_validator"
                checked={formData.is_active || false}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
                className="w-4 h-4 text-blue-500"
              />
              <label htmlFor="is_active_validator" className="text-sm text-gray-300">
                Must be active validator
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Minimum Uptime Percentage
              </label>
              <input
                type="number"
                placeholder="95"
                min="0"
                max="100"
                value={formData.min_uptime || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    min_uptime: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </>
        )

      default:
        return <p className="text-gray-400">Select a condition type</p>
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-gray-700 px-6 py-4">
          <h2 className="text-xl font-bold text-white">Add Condition</h2>
          <p className="text-sm text-gray-400 mt-1">
            Define a requirement that users must meet
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Condition Type Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Condition Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {conditionTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => {
                    setConditionType(type.value)
                    setFormData({})
                  }}
                  className={`
                    px-4 py-3 rounded-lg border-2 transition-all text-left
                    ${
                      conditionType === type.value
                        ? "border-blue-500 bg-blue-500/20 text-blue-300"
                        : "border-gray-600 bg-gray-700/30 text-gray-400 hover:border-gray-500"
                    }
                  `}
                >
                  <div className="text-2xl mb-1">{type.icon}</div>
                  <div className="text-sm font-semibold">{type.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Label */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Custom Label (optional)
            </label>
            <input
              type="text"
              placeholder="e.g., Whale Holder, Active Contributor"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Dynamic Form Fields */}
          {renderForm()}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-700 px-6 py-4 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAdd}>Add Condition</Button>
        </div>
      </div>
    </div>
  )
}
