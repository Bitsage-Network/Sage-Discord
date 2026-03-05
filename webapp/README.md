# Sage Realms - Webapp

**The first Starknet-native guild management platform with ZK-powered privacy and onchain reputation.**

Built with Next.js 14, TypeScript, and Tailwind CSS.

## 🚀 Features

- **Guild Management** - Create and manage guilds (communities) with custom pages
- **Token-Gating** - Starknet-based role assignment using token balances, staking, and reputation
- **Privacy-Preserving** - ZK proof verification for anonymous balance verification
- **Discord Integration** - Seamless integration with Discord for bot configuration
- **Analytics Dashboard** - Member growth, verification funnels, and engagement metrics
- **Reward Campaigns** - Token airdrops and incentive programs
- **Subscription Plans** - Tiered pricing with Stripe integration

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL database (shared with Discord bot)
- Discord OAuth application
- Stripe account (for subscriptions)

## 🛠️ Setup

### 1. Install Dependencies

```bash
cd webapp
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
cp .env.example .env.local
```

Required environment variables:

```env
# Database (shared with Discord bot)
DATABASE_URL=postgresql://user:password@localhost:5432/sage_discord

# NextAuth
NEXTAUTH_URL=https://sagerealms.xyz
NEXTAUTH_SECRET=<generate with `openssl rand -base64 32`>

# Discord OAuth
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_BOT_TOKEN=your_discord_bot_token

# Starknet
STARKNET_RPC_URL=https://rpc.starknet-testnet.lava.build
STARKNET_NETWORK=SN_SEPOLIA

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Vercel Blob (file uploads)
BLOB_READ_WRITE_TOKEN=vercel_blob_...

# Feature Flags
ENABLE_ZK_PROOFS=true
ENABLE_STEALTH_ADDRESSES=false
ENABLE_SUBSCRIPTIONS=true
```

### 3. Run Database Migrations

Run the webapp migration from the parent directory:

```bash
cd ..
psql $DATABASE_URL < migrations/007_webapp_guilds.sql
```

### 4. Start Development Server

```bash
cd webapp
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the result.

## 📁 Project Structure

```
webapp/
├── app/                    # Next.js 14 App Router
│   ├── (marketing)/        # Public pages
│   ├── (auth)/             # Authentication
│   ├── (dashboard)/        # Authenticated area
│   ├── api/                # API routes
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Landing page
│   └── globals.css         # Global styles
│
├── components/             # React components
│   ├── ui/                 # shadcn/ui components
│   ├── layout/             # Layout components
│   ├── guild/              # Guild-specific components
│   ├── roles/              # Role management
│   ├── wallet/             # Wallet connection
│   └── analytics/          # Charts and analytics
│
├── lib/                    # Utilities and integrations
│   ├── auth.ts             # NextAuth config
│   ├── db.ts               # Database client
│   ├── starknet.ts         # Starknet integration
│   ├── stripe.ts           # Stripe integration
│   └── utils.ts            # Helper functions
│
├── public/                 # Static assets
├── .env.example            # Environment template
├── next.config.js          # Next.js configuration
├── tailwind.config.ts      # Tailwind CSS config
└── tsconfig.json           # TypeScript config
```

## 🎨 Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Authentication:** NextAuth.js with Discord OAuth
- **Database:** PostgreSQL (shared with Discord bot)
- **Blockchain:** Starknet v7.1.0
- **State Management:** Zustand + React Query
- **Forms:** React Hook Form + Zod
- **Payments:** Stripe
- **File Storage:** Vercel Blob

## 🔗 Integration with Discord Bot

The webapp shares the same PostgreSQL database as the Discord bot:

- **Shared Tables:** `discord_users`, `server_config`, `token_gating_rules`, etc.
- **Webapp Tables:** `guilds`, `guild_pages`, `subscriptions`, `analytics_events`, `reward_campaigns`
- **Syncing:** Bot reads webapp config every 60 seconds (cached)

## 📦 Database Tables

The webapp adds 7 new tables (see `../migrations/007_webapp_guilds.sql`):

1. **guilds** - Guild/community information
2. **guild_pages** - Custom pages per guild
3. **guild_members** - Member tracking
4. **subscriptions** - Subscription plans (Stripe)
5. **analytics_events** - Event tracking for analytics
6. **reward_campaigns** - Reward campaign definitions
7. **reward_claims** - Individual reward claims

## 🚢 Deployment

### Vercel (Recommended)

1. Connect repository to Vercel
2. Set environment variables
3. Deploy

```bash
npm run build
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

## 📝 Development Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## 🛣️ Roadmap

### Phase 1: Foundation ✅
- [x] Next.js 14 setup
- [x] Tailwind CSS + shadcn/ui
- [x] Database migrations
- [x] Landing page

### Phase 2: Core Features (In Progress)
- [ ] Discord OAuth authentication
- [ ] Guild creation wizard
- [ ] Page editor
- [ ] Role builder
- [ ] Wallet verification UI

### Phase 3: Advanced Features
- [ ] Analytics dashboard
- [ ] Bot configuration UI
- [ ] Reward campaigns
- [ ] Subscription/billing

### Phase 4: Launch
- [ ] Testing & polish
- [ ] Production deployment
- [ ] Beta users

## 📄 License

MIT

## 🤝 Contributing

This is a private project. For issues or questions, contact the BitSage Network team.

## 🔗 Links

- **Discord Bot:** `../src/` (same repository)
- **Documentation:** See `../*.md` files
- **Website:** https://sagerealms.xyz (coming soon)
- **Discord:** https://discord.gg/bitsage
