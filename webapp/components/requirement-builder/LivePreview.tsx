"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp, CheckCircle2, XCircle } from "lucide-react"

interface ConditionResult {
  condition_id: number
  condition_type: string
  passes: boolean
  negate: boolean
  label?: string
  condition_label?: string
  condition_data?: any
}

interface EvaluationData {
  results: ConditionResult[]
  logic_operator: "AND" | "OR" | "NOT"
}

interface Member {
  user_id: string
  username: string
  avatar: string | null
  discriminator: string
  passes: boolean
  evaluation_data: EvaluationData
  evaluated_at: string
}

interface LivePreviewProps {
  guildId: string
  groupId: number
}

export function LivePreview({ guildId, groupId }: LivePreviewProps) {
  const [members, setMembers] = useState<Member[]>([])
  const [stats, setStats] = useState({ total: 0, passing: 0, failing: 0 })
  const [filter, setFilter] = useState<"all" | "passes" | "fails">("all")
  const [loading, setLoading] = useState(true)
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchPreview()
  }, [guildId, groupId, filter])

  const fetchPreview = async () => {
    try {
      setLoading(true)
      const res = await fetch(
        `/api/guilds/${guildId}/rule-groups/${groupId}/preview?filter=${filter}&limit=50&includeDetails=true`
      )
      const data = await res.json()

      if (data.success) {
        setMembers(data.members || [])
        setStats(data.stats || { total: 0, passing: 0, failing: 0 })
      }
    } catch (error) {
      console.error("Error fetching preview:", error)
    } finally {
      setLoading(false)
    }
  }

  const toggleMemberExpanded = (userId: string) => {
    setExpandedMembers((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(userId)) {
        newSet.delete(userId)
      } else {
        newSet.add(userId)
      }
      return newSet
    })
  }

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

  const getAvatarUrl = (member: Member) => {
    if (member.avatar) {
      return `https://cdn.discordapp.com/avatars/${member.user_id}/${member.avatar}.png`
    }
    return `https://cdn.discordapp.com/embed/avatars/${
      parseInt(member.discriminator) % 5
    }.png`
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-700 px-4 py-3">
        <h3 className="font-semibold text-white mb-2">Live Preview</h3>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center p-2 bg-gray-700/30 rounded">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-xs text-gray-400">Total</div>
          </div>
          <div className="text-center p-2 bg-green-500/20 rounded">
            <div className="text-2xl font-bold text-green-400">{stats.passing}</div>
            <div className="text-xs text-gray-400">Passing</div>
          </div>
          <div className="text-center p-2 bg-red-500/20 rounded">
            <div className="text-2xl font-bold text-red-400">{stats.failing}</div>
            <div className="text-xs text-gray-400">Failing</div>
          </div>
        </div>

        {/* Filter */}
        <div className="flex gap-1">
          {[
            { value: "all" as const, label: "All" },
            { value: "passes" as const, label: "✓ Pass" },
            { value: "fails" as const, label: "✗ Fail" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`
                flex-1 px-2 py-1 text-xs rounded transition-all
                ${
                  filter === f.value
                    ? "bg-blue-500 text-white"
                    : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                }
              `}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Members List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center text-gray-400 py-8">Loading...</div>
        ) : members.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <div className="text-4xl mb-2">👻</div>
            <p>No members found</p>
            <p className="text-xs mt-1">
              Members will appear after evaluation
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((member) => {
              const isExpanded = expandedMembers.has(member.user_id)
              const results = member.evaluation_data?.results || []
              const passingCount = results.filter((r) => r.passes).length
              const totalCount = results.length

              return (
                <div
                  key={member.user_id}
                  className={`
                    rounded-lg border transition-all
                    ${
                      member.passes
                        ? "border-green-500/30 bg-green-500/10"
                        : "border-red-500/30 bg-red-500/10"
                    }
                  `}
                >
                  {/* Member Header */}
                  <button
                    onClick={() => toggleMemberExpanded(member.user_id)}
                    className="w-full flex items-center gap-3 p-2 hover:bg-black/10 transition-colors"
                  >
                    {/* Avatar */}
                    <img
                      src={getAvatarUrl(member)}
                      alt={member.username}
                      className="w-8 h-8 rounded-full flex-shrink-0"
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-sm font-semibold text-white truncate">
                        {member.username}
                      </div>
                      <div className="text-xs text-gray-500">
                        {passingCount}/{totalCount} conditions
                      </div>
                    </div>

                    {/* Status & Expand */}
                    <div className="flex items-center gap-2">
                      {member.passes ? (
                        <CheckCircle2 className="h-4 w-4 text-green-400" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-400" />
                      )}
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-2 pb-2 space-y-1">
                      {/* Progress Bar */}
                      <div className="mb-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-400">Progress</span>
                          <span className="text-gray-300">
                            {passingCount}/{totalCount}
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              member.passes ? "bg-green-500" : "bg-orange-500"
                            }`}
                            style={{
                              width: `${totalCount > 0 ? (passingCount / totalCount) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Condition Results */}
                      {results.map((result, idx) => (
                        <div
                          key={idx}
                          className={`flex items-start gap-2 p-2 rounded text-xs ${
                            result.passes
                              ? "bg-green-500/10"
                              : "bg-red-500/10"
                          }`}
                        >
                          <div className="text-sm">
                            {getConditionIcon(result.condition_type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-white">
                              {result.condition_label || getConditionLabel(result.condition_type)}
                            </div>
                            {result.negate && (
                              <div className="text-xs text-orange-400">NOT condition</div>
                            )}
                          </div>
                          <div>
                            {result.passes ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-red-400" />
                            )}
                          </div>
                        </div>
                      ))}

                      {results.length === 0 && (
                        <div className="text-xs text-gray-500 text-center py-2">
                          No evaluation data available
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-700 px-4 py-3">
        <Button size="sm" onClick={fetchPreview} className="w-full">
          🔄 Refresh Preview
        </Button>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Updates every evaluation cycle
        </p>
      </div>
    </div>
  )
}
