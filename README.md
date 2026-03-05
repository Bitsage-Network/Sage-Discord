# Sage Realms

> **Platform**: 🚀 **Sage Realms** - The first Starknet-native guild management platform with ZK-powered privacy
>
> **Discord Bot**: ✅ **Production Ready** - TypeScript Discord bot for BitSage Network
>
> **Webapp**: 🏗️ **In Development** - Next.js 14 guild management dashboard

**Sage Realms** is a comprehensive platform combining:
- **Discord Bot** - Real-time network stats, wallet integration, token-gating, and bot protection
- **Web Dashboard** - Guild management, analytics, reward campaigns, and subscription billing

Built for the BitSage Network on Starknet with privacy-preserving verification.

---

## 📁 **Repository Structure**

This is a monorepo containing both the Discord bot and webapp:

```
Sage-Discord/
├── src/                    # Discord bot source code
│   ├── commands/           # Slash commands (15+ commands)
│   ├── events/             # Discord event handlers
│   ├── token-gating/       # Token-gating module (3,500+ lines)
│   ├── bot-protection/     # Bot protection module (2,775+ lines)
│   ├── services/           # Core services
│   └── utils/              # Utilities
│
├── webapp/                 # Next.js 14 webapp (NEW!)
│   ├── app/                # Next.js App Router
│   │   ├── (marketing)/    # Public pages
│   │   ├── dashboard/      # Authenticated dashboard
│   │   ├── api/            # API routes
│   │   └── login/          # Authentication
│   ├── components/         # React components
│   ├── lib/                # Utilities (auth, db, starknet)
│   └── public/             # Static assets
│
├── migrations/             # Shared database migrations
│   ├── 001-006_*.sql       # Discord bot migrations
│   └── 007_webapp_guilds.sql # Webapp migrations
│
├── dist/                   # Compiled Discord bot
├── package.json            # Discord bot dependencies
├── tsconfig.json           # Discord bot TypeScript config
└── README.md              # This file
```

**Shared Infrastructure:**
- Same PostgreSQL database
- Same Starknet contracts (37 deployed on Sepolia)
- Shared types and migrations

---

## 🎯 **Features**

### Slash Commands
- **`/stats`** - View BitSage Network statistics (workers, jobs, proofs)
- **`/workers [address]`** - View active workers or get specific worker info
- **`/jobs [job_id] [limit]`** - View recent jobs or get specific job details
- **`/wallet <address>`** - Check wallet/validator information (stake, reputation, earnings)
- **`/rewards <address>`** - View pending and claimed rewards
- **`/ping`** - Check bot and API status

### Automated Features
- **Job Notifications**: Real-time alerts when jobs are completed
- **Network Stats Updates**: Periodic network health updates
- **API Integration**: Direct connection to BitSage coordinator API

---

## 🛠️ **Tech Stack**

- **Language**: TypeScript 5.7+
- **Framework**: discord.js 14.x
- **Runtime**: Node.js 18+
- **Database**: PostgreSQL (shared with BitSage coordinator)
- **API**: BitSage Rust coordinator API integration
- **Logging**: Winston

---

## 📦 **Setup**

### Prerequisites

- Node.js 18 or higher
- Discord Application with bot token
- BitSage coordinator running (default: `http://localhost:8080`)

### Installation

1. **Clone the repository**:
   ```bash
   cd /Users/vaamx/bitsage-network/Sage-Discord
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and update the following:
   ```env
   # Required
   DISCORD_BOT_TOKEN=your-bot-token-here
   DISCORD_APPLICATION_ID=1427094291226038302
   DISCORD_CLIENT_ID=1427094291226038302
   GUILD_ID=your-server-id-here

   # BitSage API
   BITSAGE_API_URL=http://localhost:8080

   # Optional: Enable notifications
   JOB_NOTIFICATION_CHANNEL_ID=your-channel-id
   NETWORK_STATS_CHANNEL_ID=your-channel-id
   ```

4. **Build the bot**:
   ```bash
   npm run build
   ```

5. **Deploy slash commands**:
   ```bash
   npm run deploy-commands
   ```

6. **Start the bot**:
   ```bash
   npm start
   ```

   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

---

## 🤖 **Getting Your Discord Bot Token**

### Step 1: Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" or use existing Application ID: `1427094291226038302`
3. Give it a name (e.g., "Sage Bot")

### Step 2: Create Bot User

1. Navigate to the "Bot" tab
2. Click "Add Bot"
3. Click "Reset Token" to get your bot token
4. **Important**: Copy this token to `.env` as `DISCORD_BOT_TOKEN`

### Step 3: Configure Bot Permissions

Required bot permissions:
- `applications.commands` (for slash commands)
- `bot` scope
- Permissions integer: `277025770496`

Specific permissions:
- Send Messages
- Embed Links
- Read Message History
- Use Slash Commands

### Step 4: Invite Bot to Server

1. Go to OAuth2 → URL Generator
2. Select scopes: `bot`, `applications.commands`
3. Select permissions above
4. Copy the generated URL
5. Open URL in browser and invite to your server
6. Get your server ID (enable Developer Mode in Discord, right-click server → Copy Server ID)
7. Add server ID to `.env` as `GUILD_ID`

---

## 📚 **Command Examples**

### Network Statistics
```
/stats
```
Shows network-wide stats including active workers, jobs, and proofs generated.

### View Workers
```
/workers
```
Lists all active workers with reputation scores.

```
/workers 0x0759a4374389b0e3cfcc59d49310b6bc75bb12bbf8ce550eb5c2f026918bb344
```
Get detailed information about a specific worker.

### Check Jobs
```
/jobs
```
Shows 10 most recent jobs.

```
/jobs limit:25
```
Shows 25 most recent jobs.

```
/jobs job_id:abc123...
```
Get details about a specific job.

### Wallet Information
```
/wallet address:0x0759a4374389b0e3cfcc59d49310b6bc75bb12bbf8ce550eb5c2f026918bb344
```
View stake, reputation, and earnings for a wallet.

### Check Rewards
```
/rewards address:0x0759a4374389b0e3cfcc59d49310b6bc75bb12bbf8ce550eb5c2f026918bb344
```
View pending and claimed rewards.

### Health Check
```
/ping
```
Check bot latency and API status.

---

## 🔔 **Automated Notifications**

### Job Completion Alerts

Configure a channel to receive job completion notifications:

1. Create a dedicated channel (e.g., `#job-notifications`)
2. Get the channel ID (right-click channel → Copy Channel ID)
3. Add to `.env`:
   ```env
   JOB_NOTIFICATION_CHANNEL_ID=123456789012345678
   ENABLE_JOB_NOTIFICATIONS=true
   JOB_POLL_INTERVAL=5  # Check every 5 minutes
   ```

The bot will post messages like:
```
✅ Job Completed
Job ID: `abc123...`
Type: ZK Proof Generation
Worker: `0x0759a4...bb344`
Payment: 1000000000000000000 wei
```

### Network Stats Updates

Configure a channel for periodic network updates:

1. Create a channel (e.g., `#network-stats`)
2. Get the channel ID
3. Add to `.env`:
   ```env
   NETWORK_STATS_CHANNEL_ID=123456789012345678
   ENABLE_NETWORK_STATS=true
   NETWORK_STATS_UPDATE_INTERVAL=30  # Post every 30 minutes
   ```

---

## 🏗️ **Project Structure**

```
Sage-Discord/
├── src/
│   ├── commands/          # Slash command implementations
│   │   ├── stats.ts       # /stats command
│   │   ├── workers.ts     # /workers command
│   │   ├── jobs.ts        # /jobs command
│   │   ├── wallet.ts      # /wallet command
│   │   ├── rewards.ts     # /rewards command
│   │   └── ping.ts        # /ping command
│   ├── types/
│   │   └── index.ts       # TypeScript types and interfaces
│   ├── utils/
│   │   ├── api-client.ts  # BitSage API client
│   │   ├── config.ts      # Environment config loader
│   │   ├── formatters.ts  # Display formatting utilities
│   │   └── logger.ts      # Winston logging setup
│   ├── index.ts           # Main bot entry point
│   └── deploy-commands.ts # Slash command registration
├── .env.example           # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🐛 **Troubleshooting**

### Bot not responding to commands

1. Check bot is online in Discord
2. Verify commands were deployed: `npm run deploy-commands`
3. Check logs for errors: `tail -f logs/combined.log`
4. Ensure bot has proper permissions in Discord server

### "API health check failed" warning

- Ensure BitSage coordinator is running at `BITSAGE_API_URL`
- Test API: `curl http://localhost:8080/health`
- Check coordinator logs for errors

### Commands not showing in Discord

- Run `npm run deploy-commands` again
- If using `GLOBAL_COMMANDS=true`, wait up to 1 hour for propagation
- If using `GUILD_ID`, verify the ID is correct

### Missing environment variables error

- Copy `.env.example` to `.env`
- Fill in all required variables
- Restart the bot

---

## 📊 **Monitoring**

### Logs

Logs are stored in the `logs/` directory:
- `combined.log` - All logs
- `error.log` - Errors only

View live logs:
```bash
tail -f logs/combined.log
```

### Log Levels

Set `LOG_LEVEL` in `.env`:
- `error` - Errors only
- `warn` - Warnings and errors
- `info` - General information (default)
- `debug` - Detailed debugging

---

## 🔧 **Development**

### Running in Development Mode

```bash
npm run dev
```

Auto-reloads on file changes.

### Linting

```bash
npm run lint
```

### Formatting

```bash
npm run format
```

### Building

```bash
npm run build
```

Compiles TypeScript to JavaScript in `dist/` directory.

---

## 🚀 **Production Deployment**

### Using PM2

1. Install PM2:
   ```bash
   npm install -g pm2
   ```

2. Build the bot:
   ```bash
   npm run build
   ```

3. Start with PM2:
   ```bash
   pm2 start dist/index.js --name sage-bot
   pm2 save
   pm2 startup
   ```

4. Monitor:
   ```bash
   pm2 logs sage-bot
   pm2 monit
   ```

### Using Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .
RUN npm run build

CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t sage-bot .
docker run -d --env-file .env --name sage-bot sage-bot
```

---

## 🔗 **Related Repositories**

- **[rust-node](https://github.com/Bitsage-Network/rust-node)** - Core node implementation
- **[BitSage-Cairo-Smart-Contracts](https://github.com/Bitsage-Network/BitSage-Cairo-Smart-Contracts)** - Smart contracts
- **[BitSage-WebApp](https://github.com/Bitsage-Network/BitSage-WebApp)** - Web interface

---

## 📄 **License**

MIT License - See LICENSE file for details

---

## 🤝 **Contributing**

This repository is currently a placeholder. Check back soon for updates!

For general BitSage contributions, see [CONTRIBUTING.md](https://github.com/Bitsage-Network/.github/blob/main/CONTRIBUTING.md)

---

**Join our Discord**: [discord.gg/QAXDpa7F5K](https://discord.gg/QAXDpa7F5K)  
**Website**: [bitsage.network](https://bitsage.network)

