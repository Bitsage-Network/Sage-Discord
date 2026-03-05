"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Users, Search, Filter, Loader2, CheckCircle2, XCircle, Clock, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatAddress } from "@/lib/utils"

interface Member {
  id: number
  discord_id: string
  username: string
  avatar: string | null
  discriminator: string | null
  is_admin: boolean
  joined_at: string
  verification_id: number | null
  wallet_address: string | null
  verified: boolean | null
  verification_method: string | null
  verified_at: string | null
  token_gated_roles: Array<{
    rule_id: number
    rule_name: string
    role_id: string
    role_name: string
  }>
}

export default function MembersPage() {
  const params = useParams()
  const guildId = params.id as string

  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [verificationFilter, setVerificationFilter] = useState<string>("all")
  const [total, setTotal] = useState(0)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  useEffect(() => {
    fetchMembers()
  }, [guildId, verificationFilter])

  const fetchMembers = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (verificationFilter !== "all") {
        params.append("verification", verificationFilter)
      }
      if (searchQuery) {
        params.append("search", searchQuery)
      }

      const response = await fetch(`/api/guilds/${guildId}/members?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch members")
      }

      setMembers(data.members || [])
      setTotal(data.total || 0)
    } catch (err: any) {
      console.error("Error fetching members:", err)
      setError(err.message || "Failed to load members")
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    fetchMembers()
  }

  const getVerificationBadge = (member: Member) => {
    if (member.verified) {
      return (
        <Badge variant="success" className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Verified
        </Badge>
      )
    } else if (member.verification_id) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      )
    } else {
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          Unverified
        </Badge>
      )
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
            <Button onClick={fetchMembers} variant="outline">
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
            <Users className="h-8 w-8 text-blue-500" />
            Members
          </h1>
          <p className="text-gray-400 mt-2">
            Manage and view all guild members ({total} total)
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input
                    placeholder="Search by username or Discord ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="pl-10"
                  />
                </div>
                <Button onClick={handleSearch}>Search</Button>
              </div>
            </div>

            {/* Verification Filter */}
            <div className="w-full md:w-48">
              <Select value={verificationFilter} onValueChange={setVerificationFilter}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Members</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="unverified">Unverified</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Members List */}
      {members.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-center">No Members Found</CardTitle>
            <CardDescription className="text-center">
              {verificationFilter !== "all"
                ? `No members with status "${verificationFilter}"`
                : "This guild has no members yet"}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-4">
          {members.map((member) => (
            <Card key={member.id} className="hover:border-blue-500/50 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  {/* Member Info */}
                  <div className="flex items-start gap-4 flex-1">
                    {/* Avatar */}
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                      {member.username ? member.username[0].toUpperCase() : "?"}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-100 truncate">
                          {member.username || "Unknown User"}
                          {member.discriminator && (
                            <span className="text-gray-500">#{member.discriminator}</span>
                          )}
                        </h3>
                        {member.is_admin && (
                          <Badge variant="default" className="bg-purple-600">
                            Admin
                          </Badge>
                        )}
                        {getVerificationBadge(member)}
                      </div>

                      <div className="space-y-1 text-sm text-gray-400">
                        <p>
                          <span className="font-medium text-gray-300">Discord ID:</span>{" "}
                          {member.discord_id}
                        </p>
                        {member.wallet_address && (
                          <p>
                            <span className="font-medium text-gray-300">Wallet:</span>{" "}
                            {formatAddress(member.wallet_address)}
                          </p>
                        )}
                        {member.verified_at && (
                          <p>
                            <span className="font-medium text-gray-300">Verified:</span>{" "}
                            {new Date(member.verified_at).toLocaleDateString()}
                          </p>
                        )}
                        <p>
                          <span className="font-medium text-gray-300">Joined:</span>{" "}
                          {new Date(member.joined_at).toLocaleDateString()}
                        </p>
                      </div>

                      {/* Token-Gated Roles */}
                      {member.token_gated_roles && member.token_gated_roles.length > 0 && (
                        <div className="mt-3">
                          <p className="text-sm font-medium text-gray-300 mb-2">
                            Token-Gated Roles:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {member.token_gated_roles.map((role, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {role.role_name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedMember(member)
                        setDetailsOpen(true)
                      }}
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info Card */}
      {members.length > 0 && (
        <Card className="mt-8 bg-blue-900/20 border-blue-800">
          <CardHeader>
            <CardTitle className="text-blue-400 text-lg">Member Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-300">
            <p>• <strong>Verified</strong> - Members with confirmed Starknet wallet</p>
            <p>• <strong>Pending</strong> - Verification in progress</p>
            <p>• <strong>Unverified</strong> - No wallet connected</p>
            <p>• <strong>Token-Gated Roles</strong> - Roles automatically assigned based on wallet holdings</p>
          </CardContent>
        </Card>
      )}

      {/* Member Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-2xl text-white">
              {selectedMember?.username || "Member Details"}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Complete member information and verification status
            </DialogDescription>
          </DialogHeader>

          {selectedMember && (
            <div className="space-y-6 mt-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Discord Username</p>
                  <p className="text-white font-medium">{selectedMember.username}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Discord ID</p>
                  <p className="text-white font-mono text-sm">{selectedMember.discord_user_id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Joined Server</p>
                  <p className="text-white">{new Date(selectedMember.joined_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Role</p>
                  <Badge variant={selectedMember.is_admin ? "default" : "secondary"}>
                    {selectedMember.is_admin ? "Admin" : "Member"}
                  </Badge>
                </div>
              </div>

              {/* Verification Status */}
              <div className="border-t border-gray-800 pt-4">
                <h3 className="text-lg font-semibold text-white mb-3">Wallet Verification</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-400">Status:</p>
                    {selectedMember.verified ? (
                      <Badge variant="default" className="bg-green-600">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Verified
                      </Badge>
                    ) : selectedMember.verification_id ? (
                      <Badge variant="secondary" className="bg-yellow-600">
                        <Clock className="w-3 h-3 mr-1" />
                        Pending
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-gray-600">
                        <XCircle className="w-3 h-3 mr-1" />
                        Unverified
                      </Badge>
                    )}
                  </div>

                  {selectedMember.wallet_address && (
                    <>
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Wallet Address</p>
                        <div className="flex items-center gap-2">
                          <code className="text-sm bg-gray-800 px-3 py-1 rounded text-white font-mono">
                            {formatAddress(selectedMember.wallet_address)}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(`https://starkscan.co/contract/${selectedMember.wallet_address}`, '_blank')}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {selectedMember.verification_method && (
                        <div>
                          <p className="text-sm text-gray-400 mb-1">Verification Method</p>
                          <p className="text-white capitalize">{selectedMember.verification_method}</p>
                        </div>
                      )}

                      {selectedMember.verified_at && (
                        <div>
                          <p className="text-sm text-gray-400 mb-1">Verified At</p>
                          <p className="text-white">{new Date(selectedMember.verified_at).toLocaleString()}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Token-Gated Roles */}
              {selectedMember.token_gated_roles && selectedMember.token_gated_roles.length > 0 && (
                <div className="border-t border-gray-800 pt-4">
                  <h3 className="text-lg font-semibold text-white mb-3">Token-Gated Roles</h3>
                  <div className="space-y-2">
                    {selectedMember.token_gated_roles.map((role, index) => (
                      <div key={index} className="bg-gray-800/50 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white font-medium">{role.role_name}</p>
                            <p className="text-sm text-gray-400">Rule: {role.rule_name}</p>
                          </div>
                          <Badge variant="secondary" className="bg-green-600/20 text-green-400">
                            Active
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
