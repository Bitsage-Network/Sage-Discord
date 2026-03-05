# Sage Discord Bot - Quick Start Guide

## 🚀 Get Up and Running in 5 Minutes

### Step 1: Get Your Bot Token (2 minutes)

1. Visit [Discord Developer Portal](https://discord.com/developers/applications/1427094291226038302)
2. Go to **Bot** tab → Click **Reset Token**
3. Copy the token (save it somewhere safe!)

### Step 2: Install Dependencies (1 minute)

```bash
cd /Users/vaamx/bitsage-network/Sage-Discord
npm install
```

### Step 3: Configure Environment (1 minute)

```bash
cp .env.example .env
```

Edit `.env` and update these 3 required fields:

```env
DISCORD_BOT_TOKEN=<paste-your-token-here>
GUILD_ID=<your-discord-server-id>
BITSAGE_API_URL=http://localhost:8080  # or your coordinator URL
```

**How to get your Server ID:**
1. Enable Developer Mode in Discord (User Settings → Advanced → Developer Mode)
2. Right-click your server name → Copy Server ID

### Step 4: Invite Bot to Server (30 seconds)

Use this invite link (replace `YOUR_CLIENT_ID` if different):

```
https://discord.com/api/oauth2/authorize?client_id=1427094291226038302&permissions=277025770496&scope=bot%20applications.commands
```

Or generate at: Discord Developer Portal → OAuth2 → URL Generator

**Required Scopes:**
- `bot`
- `applications.commands`

**Required Permissions:**
- Send Messages
- Embed Links
- Read Message History
- Use Slash Commands

### Step 5: Deploy Commands & Start Bot (30 seconds)

```bash
# Build the bot
npm run build

# Register slash commands with Discord
npm run deploy-commands

# Start the bot
npm start
```

For development with auto-reload:
```bash
npm run dev
```

---

## ✅ Verify It Works

1. Go to your Discord server
2. Type `/` - you should see Sage bot commands appear:
   - `/stats`
   - `/workers`
   - `/jobs`
   - `/wallet`
   - `/rewards`
   - `/ping`

3. Try a command:
   ```
   /ping
   ```

   You should get a response showing bot latency and API status!

---

## 🎯 Next Steps

### Enable Job Notifications

1. Create a channel: `#job-notifications`
2. Right-click channel → Copy Channel ID
3. Add to `.env`:
   ```env
   JOB_NOTIFICATION_CHANNEL_ID=123456789012345678
   ENABLE_JOB_NOTIFICATIONS=true
   ```
4. Restart bot

### Enable Network Stats Updates

1. Create a channel: `#network-stats`
2. Right-click channel → Copy Channel ID
3. Add to `.env`:
   ```env
   NETWORK_STATS_CHANNEL_ID=123456789012345678
   ENABLE_NETWORK_STATS=true
   NETWORK_STATS_UPDATE_INTERVAL=30  # Every 30 minutes
   ```
4. Restart bot

---

## 🐛 Common Issues

### Commands not showing up?

**Solution:**
```bash
npm run deploy-commands
```

Wait 1-2 minutes, then restart Discord client.

### Bot offline?

**Check:**
1. Is `npm start` running?
2. Check logs: `tail -f logs/combined.log`
3. Bot token correct in `.env`?

### "API health check failed"?

**Ensure BitSage coordinator is running:**
```bash
# In rust-node directory
cargo run --bin sage-coordinator
```

Verify API is accessible:
```bash
curl http://localhost:8080/health
```

### Commands execute but show errors?

**Possible causes:**
- BitSage coordinator not running
- Database not set up
- Contract addresses not deployed

**Check coordinator logs** for errors.

---

## 📖 Full Documentation

See [README.md](./README.md) for complete documentation including:
- All command examples
- Automated notifications setup
- Production deployment
- Troubleshooting guide
- Development tips

---

## 🆘 Need Help?

- **Discord**: [discord.gg/QAXDpa7F5K](https://discord.gg/QAXDpa7F5K)
- **GitHub Issues**: [Sage-Discord Issues](https://github.com/Bitsage-Network/Sage-Discord/issues)
- **Website**: [bitsage.network](https://bitsage.network)

---

**Happy Building! 🎉**
