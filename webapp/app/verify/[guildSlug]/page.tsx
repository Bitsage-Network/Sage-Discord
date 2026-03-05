"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Wallet, Shield, CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { connect, disconnect } from "starknetkit"
import { shortString } from "starknet"

interface Guild {
  id: string
  name: string
  slug: string
}

interface TokenGatingRule {
  id: number
  rule_name: string
  description: string
  rule_type: string
  requirements: any
  roles: Array<{
    role_id: string
    role_name: string
  }>
}

interface VerificationSession {
  session_id: string
  session_token: string
  challenge_message: string
  expires_at: string
}

export default function VerifyPage() {
  const params = useParams()
  const guildSlug = params.guildSlug as string

  // State
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guild, setGuild] = useState<Guild | null>(null)
  const [requirements, setRequirements] = useState<TokenGatingRule[]>([])
  const [session, setSession] = useState<VerificationSession | null>(null)

  // Wallet state
  const [walletConnected, setWalletConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [walletProvider, setWalletProvider] = useState<any>(null)

  // Verification state
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState(false)
  const [verificationResult, setVerificationResult] = useState<any>(null)

  // Get Discord ID from localStorage or query param
  const getDiscordId = () => {
    if (typeof window === "undefined") return null

    // Check query param first
    const urlParams = new URLSearchParams(window.location.search)
    const paramDiscordId = urlParams.get("discord_id")
    if (paramDiscordId) {
      localStorage.setItem("discord_id", paramDiscordId)
      return paramDiscordId
    }

    // Fall back to localStorage
    return localStorage.getItem("discord_id")
  }

  useEffect(() => {
    checkExistingVerification()
  }, [guildSlug])

  const checkExistingVerification = async () => {
    const discordId = getDiscordId()
    if (!discordId) {
      setError("Discord ID not found. Please start verification from Discord.")
      return
    }

    try {
      const response = await fetch(`/api/verify/status?discord_id=${discordId}&guild_slug=${guildSlug}`)
      const data = await response.json()

      if (data.verified) {
        setVerified(true)
        setVerificationResult(data)
      }
    } catch (err) {
      console.error("Error checking verification:", err)
    }
  }

  const handleConnectWallet = async () => {
    try {
      setLoading(true)
      setError(null)

      const { wallet } = await connect({
        modalMode: "alwaysAsk",
        modalTheme: "dark",
      })

      if (!wallet) {
        throw new Error("Wallet connection failed")
      }

      // Type assertion needed because starknetkit types don't fully match runtime
      const walletAny = wallet as any
      const address = walletAny.selectedAddress || walletAny.account?.address || null
      const provider = walletAny.account || walletAny

      setWalletConnected(true)
      setWalletAddress(address)
      setWalletProvider(provider)

      // Start verification process
      await startVerification(address || "")
    } catch (err: any) {
      console.error("Wallet connection error:", err)
      setError(err.message || "Failed to connect wallet")
    } finally {
      setLoading(false)
    }
  }

  const startVerification = async (address: string) => {
    const discordId = getDiscordId()
    if (!discordId) {
      setError("Discord ID not found")
      return
    }

    try {
      setLoading(true)
      const response = await fetch("/api/verify/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guild_slug: guildSlug,
          discord_id: discordId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to start verification")
      }

      setGuild(data.guild)
      setRequirements(data.requirements || [])
      setSession(data.session)
    } catch (err: any) {
      console.error("Start verification error:", err)
      setError(err.message || "Failed to start verification")
    } finally {
      setLoading(false)
    }
  }

  const handleSignMessage = async () => {
    if (!session || !walletProvider) {
      setError("No active session or wallet")
      return
    }

    try {
      setVerifying(true)
      setError(null)

      // Sign message with wallet
      const signature = await walletProvider.signMessage({
        message: session.challenge_message,
      })

      // Complete verification
      const response = await fetch("/api/verify/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_token: session.session_token,
          wallet_address: walletAddress,
          signature: signature,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Verification failed")
      }

      setVerified(true)
      setVerificationResult(data)
    } catch (err: any) {
      console.error("Signature error:", err)
      setError(err.message || "Failed to sign message")
    } finally {
      setVerifying(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      await disconnect()
      setWalletConnected(false)
      setWalletAddress(null)
      setWalletProvider(null)
      setSession(null)
    } catch (err) {
      console.error("Disconnect error:", err)
    }
  }

  // Already verified state
  if (verified && verificationResult) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>
            <CardTitle className="text-2xl">Wallet Verified!</CardTitle>
            <CardDescription>Your Starknet wallet has been successfully verified</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-gray-800/50 rounded-lg">
              <p className="text-sm text-gray-400 mb-1">Verified Wallet</p>
              <p className="font-mono text-sm text-gray-100">
                {verificationResult.verification?.wallet_address}
              </p>
            </div>

            {verificationResult.assigned_roles && verificationResult.assigned_roles.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-500" />
                  Assigned Roles
                </h3>
                <div className="flex flex-wrap gap-2">
                  {verificationResult.assigned_roles.map((role: any, index: number) => (
                    <Badge key={index} variant="default">
                      {role.role_name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="text-center text-sm text-gray-400">
              <p>You can now access token-gated channels in Discord!</p>
              <p className="mt-2">Roles will be automatically updated based on your wallet holdings.</p>
            </div>

            <Button onClick={handleDisconnect} variant="outline" className="w-full">
              Disconnect Wallet
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (error && !walletConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full bg-red-900/20 border-red-800">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertCircle className="h-10 w-10 text-red-500" />
            </div>
            <CardTitle className="text-2xl text-red-400">Verification Error</CardTitle>
            <CardDescription className="text-red-300">{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => window.location.reload()} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Main verification flow
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-blue-500/20 flex items-center justify-center">
            <Shield className="h-10 w-10 text-blue-500" />
          </div>
          <CardTitle className="text-2xl">Verify Your Wallet</CardTitle>
          <CardDescription>
            {guild ? `Connect your Starknet wallet to access ${guild.name}` : "Connect your Starknet wallet to get started"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Connection Status */}
          {!walletConnected ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-gray-400">
                Connect your Starknet wallet to verify your holdings and get access to token-gated roles.
              </p>
              <Button
                onClick={handleConnectWallet}
                disabled={loading}
                size="lg"
                className="w-full max-w-sm mx-auto"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Wallet className="h-5 w-5 mr-2" />
                    Connect Wallet
                  </>
                )}
              </Button>
              <p className="text-xs text-gray-500">Supports ArgentX and Braavos wallets</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Connected Wallet */}
              <div className="p-4 bg-green-900/20 border border-green-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Connected Wallet</p>
                    <p className="font-mono text-sm text-gray-100 mt-1">
                      {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : ""}
                    </p>
                  </div>
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                </div>
              </div>

              {/* Requirements */}
              {requirements.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Token-Gating Requirements</h3>
                  <div className="space-y-3">
                    {requirements.map((req) => (
                      <div key={req.id} className="p-4 bg-gray-800/50 rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium text-gray-100">{req.rule_name}</p>
                            {req.description && (
                              <p className="text-sm text-gray-400 mt-1">{req.description}</p>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {req.rule_type.replace("_", " ")}
                          </Badge>
                        </div>
                        {req.roles && req.roles.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-gray-500 mb-1">Grants roles:</p>
                            <div className="flex flex-wrap gap-1">
                              {req.roles.map((role: any, index: number) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {role.role_name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sign Message Button */}
              {session && (
                <Button
                  onClick={handleSignMessage}
                  disabled={verifying}
                  size="lg"
                  className="w-full"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Sign Message to Verify"
                  )}
                </Button>
              )}

              {error && (
                <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <Button onClick={handleDisconnect} variant="ghost" className="w-full">
                Disconnect Wallet
              </Button>
            </div>
          )}

          {/* Info */}
          <div className="text-center text-xs text-gray-500 space-y-1">
            <p>🔒 Your wallet signature proves ownership without exposing your private keys</p>
            <p>⚡ Roles are automatically assigned based on your token holdings</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
