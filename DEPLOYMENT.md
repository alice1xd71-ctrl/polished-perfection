# P4 Deployment Guide

Two services. Deploy them independently. Once both are live and the engine's
env vars are set correctly, PAPER_V1 and LIVE_V2 register automatically and
the dashboard populates in realtime — no runtime UI configuration.

---

## 1. Dashboard (this repo, `polished-perfection`)

Hosted on Lovable / Cloudflare Workers. Publish from the Lovable editor.

### Required runtime secrets (Project Settings → Secrets)

| Name                          | Purpose                                                          |
| ----------------------------- | ---------------------------------------------------------------- |
| `SUPABASE_URL`                | Supabase project URL (auto)                                      |
| `SUPABASE_PUBLISHABLE_KEY`    | Anon key (auto)                                                  |
| `SUPABASE_SERVICE_ROLE_KEY`   | Service role — server-side writes on `/api/public/engine/*`      |
| `ENGINE_API_TOKEN`            | Shared secret. **Same value on both dashboard and engine.**      |
| `LOVABLE_API_KEY`             | Managed                                                          |

`ENGINE_API_BASE_URL` is **optional** — a single-tenant fallback for the
control proxy. When the engine registers its own `control_url` (the normal
case), the dashboard auto-discovers it and this var is not needed.

### Endpoints exposed to the engine

Base URL: `https://<your-published-dashboard>.lovable.app`

All routes below require `Authorization: Bearer <ENGINE_API_TOKEN>` and
`x-user-id: <supabase auth user uuid>`.

| Method | Path                                       | Purpose                             |
| ------ | ------------------------------------------ | ----------------------------------- |
| GET    | `/api/public/engine/health`                | Unauthenticated health probe        |
| POST   | `/api/public/engine/register`              | Announce a mode + `control_url`     |
| POST   | `/api/public/engine/heartbeat`             | Uptime / CPU / memory / latency     |
| POST   | `/api/public/engine/event`                 | Structured engine events            |
| POST   | `/api/public/engine/feed_status`           | Feed / WS status transitions        |
| POST   | `/api/public/engine/wallet`                | Wallet snapshot                     |
| POST   | `/api/public/engine/market`                | BTC 5-minute market ticks           |
| POST   | `/api/public/engine/order`                 | Order intent upserts                |
| POST   | `/api/public/engine/trade`                 | Executed trades                     |
| POST   | `/api/public/engine/standing_order`        | Standing limit order state          |
| POST   | `/api/public/engine/standing_order_event`  | SLO lifecycle events                |
| POST   | `/api/public/engine/latency`               | Latency samples                     |
| POST   | `/api/public/engine/log`                   | Order log lines                     |
| POST   | `/api/public/engine/notification`          | User-visible notifications          |
| POST   | `/api/public/engine/contract_archive`      | Closed-contract summaries           |
| POST   | `/api/public/engine/audit`                 | Audit trail entries                 |

---

## 2. Trading Engine (`P1` repo)

Node.js / Next.js. Runs on your VPS. This dashboard talks to P1's real
control endpoint: **`POST /api/v2/bot/control`** with `{ action, mode }`.

### Required environment variables

```env
# Dashboard sync
ENGINE_DASHBOARD_SYNC=on
ENGINE_DASHBOARD_URL=https://<your-published-dashboard>.lovable.app
ENGINE_API_TOKEN=<same shared secret as dashboard>
ENGINE_USER_ID=<supabase auth.users.id — the operator>
ENGINE_CONTROL_URL=https://<engine-public-host>   # what dashboard calls back
ENGINE_MODE=paper                                  # or `live`

# Optional
ENGINE_INSTANCE_ID=<stable id>                     # defaults to hostname
ENGINE_INSTANCE_NAME="P1 - VPS-01"

# P1 auth for its own /api/v2/bot/* endpoints
BOT_CONTROL_TOKEN=<same as ENGINE_API_TOKEN>       # verified by checkControlAuth
```

Run **two processes** side-by-side, one per mode, to populate both cards:

```bash
ENGINE_MODE=paper PORT=3001 pm2 start npm --name p1-paper -- start
ENGINE_MODE=live  PORT=3002 pm2 start npm --name p1-live  -- start
```

`ENGINE_CONTROL_URL` should point at the public URL that reaches each
process (typically the same reverse-proxied host on different paths, or two
subdomains).

### PM2 (`ecosystem.config.js`)

```js
module.exports = {
  apps: [
    {
      name: "p1-paper",
      script: "npm",
      args: "start",
      env: { PORT: 3001, ENGINE_MODE: "paper", ENGINE_CONTROL_URL: "https://paper.engine.example.com" },
    },
    {
      name: "p1-live",
      script: "npm",
      args: "start",
      env: { PORT: 3002, ENGINE_MODE: "live", ENGINE_CONTROL_URL: "https://live.engine.example.com" },
    },
  ],
};
```

### systemd (`/etc/systemd/system/p1-paper.service`)

```ini
[Unit]
Description=P1 Trading Engine (Paper)
After=network.target

[Service]
Type=simple
User=p1
WorkingDirectory=/opt/p1
EnvironmentFile=/etc/p1/paper.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Duplicate as `p1-live.service` with the live env file. Then:

```bash
sudo systemctl enable --now p1-paper p1-live
```

### Nginx reverse proxy

```nginx
server {
  server_name paper.engine.example.com;
  listen 443 ssl http2;
  # ssl_certificate ...;

  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 30s;
  }
}

server {
  server_name live.engine.example.com;
  listen 443 ssl http2;
  # ssl_certificate ...;

  location / {
    proxy_pass http://127.0.0.1:3002;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 30s;
  }
}
```

Set `ENGINE_CONTROL_URL` to the matching `https://…engine.example.com`.

### VPS quick start

```bash
git clone https://github.com/alice1xd71-ctrl/P1.git /opt/p1 && cd /opt/p1
pnpm install --prod
cp .env.example /etc/p1/paper.env    # edit — set ENGINE_MODE=paper and ENGINE_CONTROL_URL
cp .env.example /etc/p1/live.env     # edit — set ENGINE_MODE=live
sudo systemctl enable --now p1-paper p1-live
```

Within ~15 s of first startup, P1 posts `register` (both modes) and the
dashboard's Engine Manager lights up.

---

## Verifying the pipeline

1. `curl https://<dashboard>/api/public/engine/health` → `{ ok: true }`
2. Sign in to the dashboard → note your user id in the URL of `/settings`.
3. Set `ENGINE_USER_ID` in the P1 env files to that value.
4. `systemctl restart p1-paper p1-live` (or `pm2 restart all`).
5. Dashboard → `/dashboard`:
   - Engine Manager shows PAPER_V1 and LIVE_V2 with heartbeats.
   - Feed / WebSocket pills leave `Waiting` once P1 posts `feed_status`.
   - BTC 5-minute market card populates on the first `market` push.
6. Click **Start** on a card → P1 receives `POST /api/v2/bot/control`
   with `{ action: "start", mode: "paper" }`.

## Troubleshooting

- **`Engine offline` toast** — P1 hasn't posted `register` yet, or its
  `control_url` is unreachable from the dashboard's Worker runtime (public
  HTTPS only). Verify DNS + certificate.
- **Cards stay empty for one mode** — only one P1 process is running.
  Start the sibling with `ENGINE_MODE` set to the other value.
- **`unauthorized` in engine logs** — `ENGINE_API_TOKEN` mismatch. Rotate
  and set the identical value on both sides.
