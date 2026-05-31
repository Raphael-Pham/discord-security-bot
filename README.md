# Discord Security Bot

A production-ready Discord bot that monitors voice channels and fires automated security alerts whenever users remain in a voice channel longer than a configurable threshold.

---

## Features

- **Voice session monitoring** — tracks every voice channel in real time using Discord Gateway events (no polling)
- **One alert per session** — fires exactly one alert embed when the threshold is exceeded; resets automatically when the channel empties
- **Rich embed alerts** — colour-coded Discord embed with server name, channel name, user mentions, duration, and timestamp
- **Slash commands** — `/ping`, `/status`, `/config`, `/sessions`, `/test-alert`
- **Crash recovery** — active sessions are persisted to SQLite (or PostgreSQL) and resumed on bot restart
- **Webhook forwarding** — optional forwarding to a Discord webhook URL and/or a Slack incoming webhook
- **Ignore lists** — skip specific channels, roles, or users
- **Lightweight HTTP health server** — prevents free-tier hosts from sleeping the container
- **Structured JSON logging** — pino-based, production-ready
- **Graceful shutdown** — cleans up timers and DB connections on SIGTERM/SIGINT
- **Docker support** — multi-stage production image plus a hot-reload development image
- **Free cloud deployment** — one-command deploy to Render, Koyeb, Railway, or Fly.io

---

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 22 LTS |
| Language | TypeScript 5 |
| Discord library | discord.js v14 |
| ORM | Prisma 5 |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Logging | pino + pino-pretty |
| Linting | ESLint 9 + @typescript-eslint |
| Formatting | Prettier |
| Containerisation | Docker (multi-stage) |

---

## Project Structure

```
discord-security-bot/
├── src/
│   ├── commands/          # Slash command handlers
│   │   ├── config.ts
│   │   ├── ping.ts
│   │   ├── sessions.ts
│   │   ├── status.ts
│   │   └── testAlert.ts
│   ├── events/            # Discord.js event handlers
│   │   ├── interactionCreate.ts
│   │   ├── ready.ts
│   │   └── voiceStateUpdate.ts
│   ├── services/          # Business logic
│   │   ├── healthServer.ts   — lightweight HTTP /health endpoint
│   │   └── voiceMonitor.ts   — core session tracking & alert dispatch
│   ├── database/
│   │   └── client.ts      # Prisma singleton
│   ├── config/
│   │   └── index.ts       # Validated env-var config
│   ├── utils/
│   │   ├── format.ts      # Duration/timestamp helpers
│   │   └── logger.ts      # pino logger
│   ├── types/
│   │   └── index.ts       # Shared TypeScript interfaces
│   ├── deploy-commands.ts # Slash command registration script
│   └── index.ts           # Application entry point
├── prisma/
│   └── schema.prisma
├── .env.example
├── Dockerfile             # Production multi-stage image
├── Dockerfile.dev         # Development hot-reload image
├── docker-compose.yml
├── render.yaml            # Render Blueprint
├── tsconfig.json
├── eslint.config.mjs
└── .prettierrc
```

---

## Local Development Setup

### Prerequisites

- Node.js 20+ (`node -v`)
- npm 10+
- A Discord bot application (see below)

### 1. Clone & Install

```bash
git clone https://github.com/your-username/discord-security-bot.git
cd discord-security-bot
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Open `.env` and fill in the required values (see **Environment Variables** below).

### 3. Set Up the Database

```bash
npx prisma db push        # creates data/bot.db and applies the schema
npx prisma generate       # generates the Prisma client (auto-run on install)
```

### 4. Register Slash Commands

```bash
npm run register-commands
```

Set `DISCORD_GUILD_ID` for instant guild-scoped registration during development. Leave it blank for global commands (takes up to 1 hour).

### 5. Run the Bot

```bash
npm run dev       # hot-reload (ts-node-dev)
# or
npm run build && npm start   # compiled JS
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DISCORD_TOKEN` | ✅ | — | Bot token from Discord Developer Portal |
| `DISCORD_CLIENT_ID` | ✅ | — | Application/client ID |
| `DISCORD_GUILD_ID` | ❌ | — | Guild ID for dev-only command registration |
| `DATABASE_URL` | ✅ | — | SQLite: `file:./data/bot.db` or PostgreSQL URL |
| `ALERT_CHANNEL_ID` | ❌ | — | Text channel ID for alerts (auto-discovery fallback) |
| `ALERT_DELAY_SECONDS` | ❌ | `60` | Seconds before alert fires |
| `IGNORED_CHANNEL_IDS` | ❌ | — | Comma-separated voice channel IDs to skip |
| `IGNORED_ROLE_IDS` | ❌ | — | Comma-separated role IDs to skip |
| `IGNORED_USER_IDS` | ❌ | — | Comma-separated user IDs to skip |
| `LOG_LEVEL` | ❌ | `info` | `trace\|debug\|info\|warn\|error\|fatal` |
| `LOG_PRETTY` | ❌ | `false` | Pretty-print logs (dev only) |
| `ALERT_WEBHOOK_URL` | ❌ | — | Discord webhook URL for forwarding alerts |
| `SLACK_WEBHOOK_URL` | ❌ | — | Slack incoming webhook URL |
| `PORT` | ❌ | `3000` | Health server port |
| `NODE_ENV` | ❌ | `production` | `development\|production` |

---

## Discord Bot Setup

### 1. Create a Discord Application

1. Go to [https://discord.com/developers/applications](https://discord.com/developers/applications)
2. Click **New Application** → name it (e.g. "Security Bot") → **Create**
3. Go to **Bot** → **Add Bot** → confirm

### 2. Copy Credentials

- **Token**: Bot → **Reset Token** → copy → paste as `DISCORD_TOKEN`
- **Client ID**: OAuth2 → General → copy **Application ID** → paste as `DISCORD_CLIENT_ID`

### 3. Enable Privileged Intents

Under **Bot → Privileged Gateway Intents**, enable:

- ✅ **Server Members Intent** (required to read member list from voice channels)
- ✅ **Voice States Intent** (enabled by default but confirm it is on)

> `MESSAGE CONTENT INTENT` is **not** required.

### 4. Required Bot Permissions

Generate an invite URL using the **OAuth2 → URL Generator**:

| Scope | Permission |
|---|---|
| `bot` | View Channels |
| `bot` | Connect |
| `bot` | Send Messages |
| `bot` | Embed Links |
| `bot` | Read Message History |
| `applications.commands` | (for slash commands) |

Or use permission integer **`277025392640`**.

### 5. Invite the Bot

Replace `CLIENT_ID` in the URL below and open it in a browser:

```
https://discord.com/oauth2/authorize?client_id=CLIENT_ID&scope=bot+applications.commands&permissions=277025392640
```

---

## Alert Channel Configuration

The bot finds its alert channel in this order:

1. `ALERT_CHANNEL_ID` env var (exact channel ID — most reliable)
2. Auto-discovery: looks for a text channel named `security-alerts`, `alerts`, or `security-log`

If no channel is found the bot logs a warning and continues running — it will not crash.

Create a channel named `security-alerts` in your server for zero-config setup.

---

## Slash Commands Reference

| Command | Description |
|---|---|
| `/ping` | Health check; returns round-trip and WS latency |
| `/status` | Bot uptime, memory, active sessions |
| `/config` | Current configuration (alert channel, delay, ignore lists) |
| `/sessions` | Lists active voice sessions in this server |
| `/test-alert` | Sends a fake alert embed to the configured alert channel |

---

## Running with Docker

### Production

```bash
cp .env.example .env
# edit .env

docker compose up -d
```

The container:
- runs as non-root (`botuser`)
- auto-applies Prisma migrations on start
- exposes the health server on port 3000
- persists SQLite data in a named volume (`bot_data`)

### Development (hot-reload)

```bash
docker compose --profile dev up bot-dev
```

Source files are mounted read-only; changes trigger automatic restarts.

---

## Deploying to Render (Recommended)

Render is the **top recommendation** for this bot because:

- Free tier runs as a **Background Worker** — no HTTP request needed to keep it alive
- Persistent disk available on free tier (SQLite state survives redeploys)
- Automatic deploys from GitHub
- No credit card required for free tier
- Reliable uptime; containers don't spin down like web services do

### Steps

1. Push the repo to GitHub
2. Go to [https://render.com](https://render.com) → **New → Blueprint** → connect your repo
3. Render will detect `render.yaml` automatically
4. Add secrets in the Render dashboard:
   - `DISCORD_TOKEN`
   - `DISCORD_CLIENT_ID`
   - `DISCORD_GUILD_ID` (optional)
   - `ALERT_CHANNEL_ID` (optional)
5. Click **Apply** — Render builds and starts the bot

The `render.yaml` in this repo configures:
- Free plan Background Worker
- 1 GB persistent disk mounted at `data/`
- SQLite database stored on that disk
- Automatic `prisma db push` on each deploy

---

## Deploying to Koyeb

1. Go to [https://www.koyeb.com](https://www.koyeb.com) → **Create Service → Docker**
2. Connect your GitHub repo
3. Set build command: `npm ci && npx prisma generate && npm run build && npx prisma db push`
4. Set run command: `node dist/index.js`
5. Add env vars (same as above)
6. Select the **Free** instance type (512 MB RAM)
7. Deploy

> Koyeb free tier does **not** sleep between requests — good for background workers.

---

## Deploying to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli
railway login
railway init
railway up
```

Set environment variables in the Railway dashboard. Railway's free tier provides $5/month credit — usually enough for a lightweight bot.

---

## Deploying to Fly.io

```bash
# Install flyctl
brew install flyctl
fly auth login
fly launch    # detects Dockerfile automatically
fly secrets set DISCORD_TOKEN=xxx DISCORD_CLIENT_ID=xxx DATABASE_URL="file:./data/bot.db"
fly deploy
```

Fly.io free tier: 3 shared-CPU VMs, 256 MB RAM each. Suitable for this bot.

---

## Free Hosting Comparison

| Platform | Free? | Sleeps? | Persistent DB | Easy Setup | No Credit Card | Recommended |
|---|---|---|---|---|---|---|
| **Render** | ✅ Free Worker | No | ✅ 1 GB disk | ✅ Very easy | ✅ Yes | ⭐ Best |
| **Koyeb** | ✅ Free tier | No | No persistent disk | ✅ Easy | ✅ Yes | Good |
| **Railway** | $5/mo credit | No | ✅ Volumes | ✅ Easy | Card required | Good |
| **Fly.io** | ✅ 3 free VMs | No | ✅ Volumes ($) | Medium | Card required | Good |
| **Replit** | ✅ Free | Sleeps | Limited | ✅ Easy | ✅ Yes | Poor uptime |
| **Oracle Cloud** | ✅ Always Free | No | ✅ Block storage | Complex | Card required | Best uptime |

### Why Render is the Best Choice

Render is the only major free platform that simultaneously:
1. Runs background workers **without needing an incoming HTTP request** to stay alive
2. Provides a **persistent disk** (so SQLite state survives redeploys)
3. **Requires no credit card**
4. Has straightforward **GitHub-based auto-deploy**

The bot already ships a `render.yaml` Blueprint — deployment is three clicks after the initial repo push.

---

## Free Hosting Limitations

| Limitation | Impact | Mitigation in this bot |
|---|---|---|
| 512 MB–1 GB RAM on free instances | Low — bot uses ~50–80 MB at idle | Pino logging, efficient Maps, no polling |
| SQLite not available on some platforms | Medium | Switch to PostgreSQL via `DATABASE_URL` |
| Cold starts after deploy | Bot offline ~30–60 s during deploy | Session recovery on restart |
| No persistent disk on Koyeb | Sessions lost on restart | Use PostgreSQL (Neon free tier) |

---

## Switching to PostgreSQL

For production or platforms without persistent disks:

- **Neon** (recommended): [https://neon.tech](https://neon.tech) — 512 MB free, no sleeping
- **Supabase**: [https://supabase.com](https://supabase.com) — 500 MB free

1. Update `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. Set `DATABASE_URL` to your PostgreSQL connection string
3. Run `npx prisma db push`

---

## Troubleshooting

**Bot is online but no alerts fire**
- Confirm `ALERT_DELAY_SECONDS` is set correctly (default is 60 seconds)
- Confirm the alert channel exists and the bot has `Send Messages` + `Embed Links` permissions
- Run `/test-alert` to verify the alert channel is reachable
- Check logs for `No alert channel found for guild`

**Slash commands not showing in Discord**
- Run `npm run register-commands`
- For guild commands, confirm `DISCORD_GUILD_ID` matches the target server
- Global commands can take up to 1 hour to propagate

**`DISCORD_TOKEN` or `DISCORD_CLIENT_ID` missing at startup**
- Copy `.env.example` to `.env` and fill in all required values
- On hosted platforms, set secrets in the dashboard — never commit `.env`

**Database errors on Render**
- Ensure the persistent disk is mounted at `/opt/render/project/src/data`
- `DATABASE_URL` should be `file:./data/bot.db`

**High memory usage**
- Set `LOG_LEVEL=warn` or `error` in production
- Ensure `LOG_PRETTY=false` in production

---

## Scaling Considerations

This bot handles multiple guilds natively (sessions are keyed by `guildId:channelId`). For larger scale:

- **High-traffic servers**: Replace SQLite with PostgreSQL and add connection pooling
- **Sharding**: discord.js supports automatic sharding via `ShardingManager` — add when approaching 2,500+ guilds
- **Metrics**: Replace pino with OpenTelemetry for distributed tracing

---

## Security Notes

- Bot token is read from environment variables only — never hardcoded
- The health HTTP server returns no sensitive data
- Slash command responses are ephemeral (private) where appropriate
- Only non-privileged intents are requested
- The Docker container runs as a non-root user (`botuser`)

---

## License

MIT