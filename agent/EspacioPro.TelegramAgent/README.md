# EspacioPro.TelegramAgent — PoC v0

Minimal end-to-end Telegram adapter for Espacio Pro. A .NET 10 isolated-worker
Azure Function receives Telegram updates, enforces a chat/user allowlist, and
routes commands through a pluggable `IAgentRouter`.

## Architecture

```
Telegram private group
        │  POST update (webhook + secret_token header)
        ▼
┌──────────────────────────────────────────────┐
│ EspacioPro.TelegramAgent (Azure Function)     │
│  TelegramWebhookFunction                       │
│   1. validate X-Telegram-Bot-Api-Secret-Token  │
│   2. allowlist chat id + user id (AccessPolicy) │
│   3. IAgentRouter.RouteAsync                    │
│        DeterministicAgentRouter (v0)            │
│        └─ FoundryAgentRouter (v1 plug-in)       │
│   4. TelegramClient.SendMessage                 │
└───────────────┬───────────────────────────────┘
                │ HTTP (read-only in v0)
                ▼
   Espacio Pro REST API  ──►  Cosmos DB
   GET /api/v1/schedules
```

The agent **never writes Cosmos directly**. Every read (and later, every write via
draft → CONFIRMAR) goes through the existing REST API so validation, audit and
soft-delete rules are preserved.

## v0 scope

| Command      | Behaviour                                            |
|--------------|------------------------------------------------------|
| `/ping`      | replies `pong` — liveness check                      |
| `/horarios`  | calls `GET /api/v1/schedules?status=active` and lists |
| anything else| help text                                            |

Audio (create schedules) and image (register payments) are **v1**, delegated to a
Foundry Hosted Agent via a future `FoundryAgentRouter : IAgentRouter`.

## Telegram setup (one-time)

```bash
# 1. Create the bot in @BotFather (/newbot) and copy the TOKEN.
# 2. @BotFather → /mybots → <bot> → Bot Settings → Group Privacy → OFF
# 3. Create a private group, add the bot as admin.
# 4. Post a message in the group, then read the ids:
curl "https://api.telegram.org/bot<TOKEN>/getUpdates"
#    → message.chat.id  → TELEGRAM_ALLOWED_CHAT_ID  (negative number)
#    → message.from.id  → TELEGRAM_ALLOWED_USER_IDS (comma-separated)
```

## Run the PoC locally (with tunnel)

```bash
# Terminal A — backend API with dev auth bypass (so /horarios needs no Clerk token)
cd backend/src/EspacioPro.Api
# in local.settings.json set: "DEV_AUTH_BYPASS": "true" (and AZURE_FUNCTIONS_ENVIRONMENT=Development)
func start                       # listens on http://localhost:7071

# Terminal B — Telegram adapter
cd agent/EspacioPro.TelegramAgent
cp local.settings.json.example local.settings.json   # fill TOKEN / ids / secret
func start --port 7072           # listens on http://localhost:7072

# Terminal C — public tunnel to the adapter
devtunnel host -p 7072 --allow-anonymous
# or: ngrok http 7072
# copy the https URL it prints → <PUBLIC_URL>

# Register the webhook (secret must match TELEGRAM_WEBHOOK_SECRET)
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=<PUBLIC_URL>/api/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Then in the group send `/ping` → `pong`, and `/horarios` → the active schedules.

To stop: `curl "https://api.telegram.org/bot<TOKEN>/deleteWebhook"`.

## Configuration

See `local.settings.json.example`. Secrets (`TELEGRAM_BOT_TOKEN`,
`TELEGRAM_WEBHOOK_SECRET`) must never be committed — `local.settings.json` is
git-ignored.

## Production notes (out of v0 scope)

- The adapter would call the **deployed** API, which requires a real admin
  identity. Replace dev-bypass with a Clerk machine token / service credential.
- Deploy as its own Function App; register the webhook against its public URL.
- Wire `FoundryAgentRouter` for audio/image and natural-language turns.
