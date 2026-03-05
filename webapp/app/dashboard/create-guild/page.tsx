"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface DiscordServer {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
}

export default function CreateGuildPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [discordServers, setDiscordServers] = useState<DiscordServer[]>([]);
  const [loadingServers, setLoadingServers] = useState(true);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    twitter_url: "",
    website_url: "",
    discord_guild_id: "",
  });

  // Fetch user's Discord servers
  useEffect(() => {
    if (session) {
      fetchDiscordServers();
    }
  }, [session]);

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
      // Don't show error - Discord server selection is optional
    } finally {
      setLoadingServers(false);
    }
  };

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    setFormData({
      ...formData,
      name,
      slug: name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^\w\-]+/g, "")
        .replace(/\-\-+/g, "-")
        .replace(/^-+/, "")
        .replace(/-+$/, ""),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/guilds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create guild");
      }

      const guild = await response.json();
      router.push(`/dashboard/guild/${guild.id}`);
    } catch (err: any) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create a Guild</h1>
        <p className="text-muted-foreground mt-2">
          Set up your community with token-gating and custom pages
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Guild Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="BitSage Community"
              className="w-full px-3 py-2 rounded-md bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground">
              The name of your guild or community
            </p>
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
            <p className="text-xs text-muted-foreground">
              Optional - Describe your community
            </p>
          </div>

          {/* Discord Server Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Discord Server (Optional)
            </label>
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
                  <option value="">Select a Discord server (optional)</option>
                  {discordServers.map((server) => (
                    <option key={server.id} value={server.id}>
                      {server.name} {server.owner && "(Owner)"}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Link your Discord server to enable the bot
                </p>
              </>
            ) : (
              <div className="w-full px-3 py-2 rounded-md bg-muted border border-border text-muted-foreground text-sm">
                No Discord servers found. You can add one later in settings.
              </div>
            )}
          </div>

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

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/50 p-4">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Creating..." : "Create Guild"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="px-6 py-2 border border-border rounded-lg font-semibold hover:bg-accent transition"
          >
            Cancel
          </button>
        </div>
      </form>

      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="font-semibold mb-2">What happens next?</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">1.</span>
            <span>Your guild will be created with a public page</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">2.</span>
            <span>Connect your Discord server to enable the bot</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">3.</span>
            <span>Configure token-gating rules for Starknet tokens</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">4.</span>
            <span>Customize pages and manage members</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
