# Token-Gating Quick Start

## 🚀 Start Development Server

```bash
cd webapp
npm run dev
```

Visit: `http://localhost:3000/dashboard`

---

## 📍 Navigation

1. **Dashboard** → Click your guild
2. **Guild Overview** → Click "Token-Gating" card
3. **Token-Gating Admin** → Manage rules

---

## ⚡ Create Your First Rule (1 Minute)

### Example: SAGE Holder (1000+ tokens)

1. **Click** "Create Rule"
2. **Fill in:**
   - Name: `SAGE Holder`
   - Type: `Token Balance`
   - Min Balance: `1000`
   - Select Role: `Holder`
3. **Click** "Create Rule"

Done! ✅

---

## 🎯 Common Rule Examples

### 1. Token Holder Tier
```
Name: SAGE Holder
Type: Token Balance
Requirements:
  - min_balance: 1000
  - include_staked: true
Roles: Holder
```

### 2. Whale Tier
```
Name: SAGE Whale
Type: Token Balance
Requirements:
  - min_balance: 10000
Roles: Whale, VIP
```

### 3. Staker Tier
```
Name: Long-term Staker
Type: Staked Amount
Requirements:
  - min_staked: 5000
  - min_stake_duration: 30 days
Roles: Staker
```

### 4. Validator
```
Name: Active Validator
Type: Active Validator
Requirements:
  - must_be_active: true
Roles: Validator
```

### 5. Reputation
```
Name: Trusted Member
Type: Reputation Score
Requirements:
  - min_reputation: 100
  - min_level: 5
Roles: Trusted
```

---

## 🔧 API Quick Reference

### List Rules
```bash
curl http://localhost:3000/api/guilds/[guild-id]/token-gating \
  -H "Cookie: ..."
```

### Create Rule
```bash
curl -X POST http://localhost:3000/api/guilds/[guild-id]/token-gating \
  -H "Content-Type: application/json" \
  -H "Cookie: ..." \
  -d '{
    "rule_name": "SAGE Holder",
    "rule_type": "token_balance",
    "requirements": { "min_balance": "1000" },
    "enabled": true,
    "roles": [
      { "role_id": "123", "role_name": "Holder", "auto_assign": true, "auto_remove": true }
    ]
  }'
```

### Update Rule (Enable/Disable)
```bash
curl -X PATCH http://localhost:3000/api/guilds/[guild-id]/token-gating/[rule-id] \
  -H "Content-Type: application/json" \
  -H "Cookie: ..." \
  -d '{ "enabled": false }'
```

### Delete Rule
```bash
curl -X DELETE http://localhost:3000/api/guilds/[guild-id]/token-gating/[rule-id] \
  -H "Cookie: ..."
```

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Discord server not linked" | Go to Settings → Link Discord Server |
| "No roles available" | Invite bot to server with role permissions |
| "Failed to create rule" | Check form validation, ensure roles selected |
| Can't access page | Verify you're logged in and have owner/admin role |

---

## 📁 Key Files

```
webapp/
├── app/dashboard/guild/[id]/token-gating/page.tsx    # Admin UI
├── components/token-gating/CreateRuleDialog.tsx      # Create/Edit Form
├── app/api/guilds/[id]/token-gating/route.ts         # API: List, Create
├── app/api/guilds/[id]/token-gating/[ruleId]/route.ts # API: Get, Update, Delete
├── app/api/guilds/[id]/roles/route.ts                # API: Discord Roles
└── lib/schemas.ts                                     # Validation
```

---

## ✅ Testing Checklist

- [ ] Create rule
- [ ] Edit rule
- [ ] Enable/disable rule
- [ ] Delete rule
- [ ] Fetch Discord roles
- [ ] Test all 5 rule types

---

## 🎨 UI Components Used

- `Button` - Actions (Create, Edit, Delete)
- `Card` - Rule cards, info cards
- `Dialog` - Create/Edit modal
- `Select` - Rule type dropdown
- `Switch` - Enable/disable toggle
- `Input` - Form fields
- `Badge` - Status indicators

---

## 🔗 URLs

- **Admin Dashboard**: `/dashboard`
- **Guild Overview**: `/dashboard/guild/[id]`
- **Token-Gating**: `/dashboard/guild/[id]/token-gating`
- **Settings**: `/dashboard/guild/[id]/settings`

---

## 📞 Support

- **Documentation**: See `TOKEN_GATING_ADMIN_GUIDE.md`
- **Bot Commands**: See bot `README.md`
- **Issues**: https://github.com/bitsage-network/sage-discord/issues

---

**Built with:** Next.js 14, TypeScript, Radix UI, Tailwind CSS, Zod, PostgreSQL

**Status:** ✅ Production Ready
