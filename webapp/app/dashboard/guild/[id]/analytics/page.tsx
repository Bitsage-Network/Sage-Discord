"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import {
  BarChart3,
  TrendingUp,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Shield,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

interface AnalyticsData {
  member_stats: {
    total: number
    verified: number
    pending: number
    unverified: number
  }
  member_growth: Array<{
    date: string
    new_members: number
    cumulative_members: number
  }>
  verification_stats: {
    total_attempts: number
    successful: number
    failed: number
    success_rate: number
    avg_verification_time: number
  }
  role_distribution: Array<{
    rule_name: string
    rule_type: string
    role_name: string
    member_count: number
  }>
  top_holders: Array<{
    wallet_address: string
    username: string
    cached_balance: string
    cached_stake: string
  }>
  recent_activity: Array<{
    event_type: string
    event_data: any
    created_at: string
    user_id: string
  }>
  rules_performance: Array<{
    id: number
    rule_name: string
    rule_type: string
    enabled: boolean
    passing_members: number
    failing_members: number
  }>
  failed_verifications: Array<{
    user_id: string
    username: string
    wallet_address: string
    created_at: string
    verification_method: string
  }>
}

const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4"]

export default function AnalyticsPage() {
  const params = useParams()
  const guildId = params.id as string

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState("30d")

  useEffect(() => {
    fetchAnalytics()
  }, [guildId, timeRange])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/guilds/${guildId}/analytics?range=${timeRange}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch analytics")
      }

      setAnalytics(data.analytics)
    } catch (err: any) {
      console.error("Error fetching analytics:", err)
      setError(err.message || "Failed to load analytics")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (error || !analytics) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <Card className="bg-red-900/20 border-red-800">
          <CardHeader>
            <CardTitle className="text-red-400">Error</CardTitle>
            <CardDescription className="text-red-300">{error || "No data available"}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // Prepare data for charts
  const memberStatusData = [
    { name: "Verified", value: analytics.member_stats.verified, color: "#10b981" },
    { name: "Pending", value: analytics.member_stats.pending, color: "#f59e0b" },
    { name: "Unverified", value: analytics.member_stats.unverified, color: "#6b7280" },
  ]

  const verificationData = [
    { name: "Successful", value: analytics.verification_stats.successful, color: "#10b981" },
    { name: "Failed", value: analytics.verification_stats.failed, color: "#ef4444" },
  ]

  return (
    <div className="max-w-7xl mx-auto p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-100 flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-blue-500" />
            Analytics
          </h1>
          <p className="text-gray-400 mt-2">Track member growth, verification stats, and engagement</p>
        </div>

        {/* Time Range Filter */}
        <div className="w-48">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Total Members</p>
                <p className="text-3xl font-bold text-gray-100 mt-2">
                  {analytics.member_stats.total}
                </p>
              </div>
              <Users className="h-12 w-12 text-blue-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Verified Members</p>
                <p className="text-3xl font-bold text-green-500 mt-2">
                  {analytics.member_stats.verified}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {Math.round((analytics.member_stats.verified / analytics.member_stats.total) * 100)}% of total
                </p>
              </div>
              <CheckCircle2 className="h-12 w-12 text-green-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Pending</p>
                <p className="text-3xl font-bold text-orange-500 mt-2">
                  {analytics.member_stats.pending}
                </p>
              </div>
              <Clock className="h-12 w-12 text-orange-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Success Rate</p>
                <p className="text-3xl font-bold text-blue-500 mt-2">
                  {analytics.verification_stats.success_rate.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {analytics.verification_stats.successful}/{analytics.verification_stats.total_attempts} attempts
                </p>
              </div>
              <TrendingUp className="h-12 w-12 text-blue-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 md:grid-cols-2 mb-8">
        {/* Member Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Member Status Distribution</CardTitle>
            <CardDescription>Breakdown of verification status</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={memberStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {memberStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Verification Success/Failure */}
        <Card>
          <CardHeader>
            <CardTitle>Verification Results</CardTitle>
            <CardDescription>Successful vs failed verifications</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={verificationData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }}
                  labelStyle={{ color: "#f3f4f6" }}
                />
                <Bar dataKey="value" fill="#3b82f6">
                  {verificationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Member Growth Chart */}
      {analytics.member_growth.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Member Growth</CardTitle>
            <CardDescription>New members over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.member_growth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="date"
                  stroke="#9ca3af"
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }}
                  labelStyle={{ color: "#f3f4f6" }}
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="cumulative_members"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Total Members"
                />
                <Line
                  type="monotone"
                  dataKey="new_members"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="New Members"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Role Distribution */}
      {analytics.role_distribution.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-500" />
              Token-Gated Role Distribution
            </CardTitle>
            <CardDescription>Members per role (based on token-gating rules)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.role_distribution.map((role, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-gray-100">{role.role_name}</p>
                      <Badge variant="outline" className="text-xs">
                        {role.rule_name}
                      </Badge>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min((parseInt(role.member_count as any) / analytics.member_stats.total) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-gray-100 ml-4 min-w-[60px] text-right">
                    {role.member_count}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Holders */}
      {analytics.top_holders.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Top Token Holders</CardTitle>
            <CardDescription>Members with the highest SAGE balance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.top_holders.map((holder, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                      #{index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-100">{holder.username || "Unknown"}</p>
                      <p className="text-xs text-gray-500">
                        {holder.wallet_address?.slice(0, 6)}...{holder.wallet_address?.slice(-4)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-blue-500">{holder.cached_balance || "0"} SAGE</p>
                    {holder.cached_stake && (
                      <p className="text-xs text-gray-500">{holder.cached_stake} staked</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rules Performance */}
      {analytics.rules_performance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Token-Gating Rules Performance</CardTitle>
            <CardDescription>How many members pass each rule</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.rules_performance.map((rule) => (
                <div key={rule.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-100">{rule.rule_name}</p>
                      <Badge variant={rule.enabled ? "success" : "secondary"}>
                        {rule.enabled ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-400">
                      {rule.passing_members} passing / {rule.failing_members} failing
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <div
                      className="bg-green-500 h-2 rounded-l-full"
                      style={{
                        width: `${(rule.passing_members / (rule.passing_members + rule.failing_members || 1)) * 100}%`,
                      }}
                    />
                    <div
                      className="bg-red-500 h-2 rounded-r-full"
                      style={{
                        width: `${(rule.failing_members / (rule.passing_members + rule.failing_members || 1)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
