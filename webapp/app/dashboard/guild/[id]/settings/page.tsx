"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

interface GuildDetails {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo_url: string | null;
  banner_url: string | null;
  twitter_url: string | null;
  website_url: string | null;
  discord_guild_id: string | null;
  is_public: boolean;
  owner_discord_id: string;
  is_admin: boolean;
}

interface DiscordServer {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
}

export default function GuildSettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const guildId = params.id as string;

  const [guild, setGuild] = useState<GuildDetails | null>(null);
  const [discordServers, setDiscordServers] = useState<DiscordServer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingServers, setLoadingServers] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    twitter_url: "",
    website_url: "",
    discord_guild_id: "",
    is_public: true,
  });

  useEffect(() => {
    if (session && guildId) {
      fetchGuild();
      fetchDiscordServers();
    }
  }, [session, guildId]);

  const fetchGuild = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/guilds/${guildId}`);

      if (!response.ok) {
        throw new Error("Failed to fetch guild");
      }

      const data = await response.json();
      setGuild(data);
      setFormData({
        name: data.name,
        slug: data.slug,
        description: data.description || "",
        twitter_url: data.twitter_url || "",
        website_url: data.website_url || "",
        discord_guild_id: data.discord_guild_id || "",
        is_public: data.is_public,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDiscordServers = async () => {
    try {
      setLoadingServers(true);
      const response = await fetch("/api/discord/servers");

      if (!response.ok) {
        throw new Error("Failed to fetch Discord servers");
      }

      const servers = await response.json();
      setDiscordServers(servers);
    } catch (err: any) {
      console.error("Error fetching Discord servers:", err);
    } finally {
      setLoadingServers(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const response = await fetch(`/api/guilds/${guildId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update guild");
      }

      setSuccess("Guild settings updated successfully!");
      fetchGuild(); // Refresh guild data
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error && !guild) {
    return (
      <div className="rounded-lg bg-red-500/10 border border-red-500/50 p-6 text-center">
        <h3 className="text-lg font-semibold text-red-500 mb-2">{error}</h3>
        <button
          onClick={() => router.push("/dashboard")}
          className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const isOwner = guild?.owner_discord_id === session?.user?.discordId;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => router.push(`/dashboard/guild/${guildId}`)}
            className="text-muted-foreground hover:text-foreground transition"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h1 className="text-3xl font-bold">Guild Settings</h1>
        </div>
        <p className="text-muted-foreground">
          Manage your guild's information and preferences
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h2 className="text-xl font-semibold">Basic Information</h2>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Guild Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="BitSage Community"
              className="w-full px-3 py-2 rounded-md bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              URL Slug <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                sagerealms.xyz/guild/
              </span>
              <input
                type="text"
                required
                value={formData.slug}
                onChange={(e) =>
                  setFormData({ ...formData, slug: e.target.value })
                }
                placeholder="bitsage-community"
                pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                className="flex-1 px-3 py-2 rounded-md bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Lowercase letters, numbers, and hyphens only
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="A brief description of your guild..."
              rows={3}
              className="w-full px-3 py-2 rounded-md bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>
        </div>

        {/* Discord Integration */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-4" id="discord">
          <h2 className="text-xl font-semibold">Discord Integration</h2>

          <div className="space-y-2">
            <label className="text-sm font-medium">Discord Server</label>
            {loadingServers ? (
              <div className="w-full px-3 py-2 rounded-md bg-background border border-border text-muted-foreground">
                Loading your Discord servers...
              </div>
            ) : discordServers.length > 0 ? (
              <>
                <select
                  value={formData.discord_guild_id}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      discord_guild_id: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded-md bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">No Discord server connected</option>
                  {discordServers.map((server) => (
                    <option key={server.id} value={server.id}>
                      {server.name} {server.owner && "(Owner)"}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Connect your Discord server to enable the bot and token-gating
                </p>
              </>
            ) : (
              <div className="w-full px-3 py-2 rounded-md bg-muted border border-border text-muted-foreground text-sm">
                No Discord servers found where you have admin permissions.
              </div>
            )}
          </div>

          {formData.discord_guild_id && (
            <div className="rounded-lg bg-green-500/10 border border-green-500/50 p-4">
              <p className="text-sm text-green-500">
                ✅ Discord server connected! Bot features are now available.
              </p>
            </div>
          )}
        </div>

        {/* Social Links */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h2 className="text-xl font-semibold">Social Links</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Twitter URL</label>
              <input
                type="url"
                value={formData.twitter_url}
                onChange={(e) =>
                  setFormData({ ...formData, twitter_url: e.target.value })
                }
                placeholder="https://twitter.com/bitsagenetwork"
                className="w-full px-3 py-2 rounded-md bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Website URL</label>
              <input
                type="url"
                value={formData.website_url}
                onChange={(e) =>
                  setFormData({ ...formData, website_url: e.target.value })
                }
                placeholder="https://bitsage.network"
                className="w-full px-3 py-2 rounded-md bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Privacy Settings */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h2 className="text-xl font-semibold">Privacy Settings</h2>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Public Guild</p>
              <p className="text-sm text-muted-foreground">
                Make your guild visible in the explorer
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_public}
                onChange={(e) =>
                  setFormData({ ...formData, is_public: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
            </label>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/50 p-4">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {success && (
          <div className="rounded-lg bg-green-500/10 border border-green-500/50 p-4">
            <p className="text-sm text-green-500">{success}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/dashboard/guild/${guildId}`)}
            className="px-6 py-2 border border-border rounded-lg font-semibold hover:bg-accent transition"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Danger Zone (Owner Only) */}
      {isOwner && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-6 space-y-4">
          <h2 className="text-xl font-semibold text-red-500">Danger Zone</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Delete Guild</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete this guild and all associated data
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    "Are you sure you want to delete this guild? This action cannot be undone."
                  )
                ) {
                  handleDeleteGuild();
                }
              }}
              className="px-6 py-2 bg-red-500 text-white rounded-lg font-semibold hover:opacity-90 transition"
            >
              Delete Guild
            </button>
          </div>
        </div>
      )}
    </div>
  );

  async function handleDeleteGuild() {
    try {
      const response = await fetch(`/api/guilds/${guildId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete guild");
      }

      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
    }
  }
}
