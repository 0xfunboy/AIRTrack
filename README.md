# AIRTrack — Trading Operations Dashboard

AIRTrack is a full-stack dashboard for managing discretionary trading activity. The project now ships as a lean TypeScript codebase with a Vite/React client, an Express API written in TypeScript, Prisma ORM, and a PostgreSQL database layer (SQLite remains an option if you tweak the schema).

## Features
- **Realtime trading board** – add, edit, and close trades with live P/L charts.
- **Web3 authentication** – Sign-In-With-Ethereum (SIWE) flow plus wallet connect UI.
- **Background automation** – worker loop keeps trade statuses and P/L in sync with live prices.
- **WebSocket fan-out** – clients receive trade updates instantly without manual refreshes.
- **Admin tooling** – API secrets, environment overrides, and database reset actions exposed in the UI.

## Tech Stack
- React 18 + Vite + Tailwind via CDN for the frontend experience.
- Express 5 (TypeScript) with JWT auth and SIWE verification for the API layer.
- Prisma ORM targeting PostgreSQL by default (switchable via `DATABASE_URL`).
- WebSockets (`ws`) for realtime broadcasting.
- WalletConnect / ethers.js for wallet interactions.

## Quickstart
1. **Clone & install**
   ```bash
   git clone https://github.com/0xfunboy/AIRTrack.git
   cd AIRTrack
   pnpm install
   ```
2. **Copy environment template**
   ```bash
   cp .env.example .env
   ```
   Update the values (at minimum `JWT_SECRET`, `VITE_WALLETCONNECT_PROJECT_ID`, and `ADMIN_WALLETS`).
3. **Provision the database**
   ```bash
   # One-time Postgres setup (skip if already done)
   sudo apt install postgresql postgresql-contrib
   sudo -u postgres psql <<'SQL'
   CREATE ROLE airtrack_user WITH LOGIN PASSWORD 'change-me';
   ALTER ROLE airtrack_user SET client_encoding TO 'UTF8';
   ALTER ROLE airtrack_user SET timezone TO 'UTC';
   CREATE DATABASE airtrack OWNER airtrack_user;
   GRANT ALL PRIVILEGES ON DATABASE airtrack TO airtrack_user;
   SQL
   sudo -u postgres psql -d airtrack -c \
     "GRANT ALL ON SCHEMA public TO airtrack_user;"
   ```

   Update `.env` with your connection string and then:
   ```bash
   pnpm db:push
   ```
   Prisma will sync the schema (`public` schema by default) and generate the client.
4. **Run the full stack**
   ```bash
   pnpm dev
   ```
   - Client: http://localhost:5173
   - API/WebSocket: http://localhost:5883

## Scripts
- `pnpm dev` — run client + server with hot reload.
- `pnpm dev:client` / `pnpm dev:server` — run each side independently.
- `pnpm build` — type-check and produce production builds (`dist/` for client, `server/dist/` for API).
- `pnpm start` — launch the compiled server (expects `dist/` assets in place).
- `pnpm db:push` — sync Prisma schema to the current database.
- `pnpm db:reset` — drop and recreate the database (dangerous in production).
- `pnpm migrate` — run Prisma migrations in production environments.
- `pnpm typecheck` — run TypeScript checks for both client and server.
- `./run.sh` — helper script used by the systemd unit to install, build, and start the app in production.

## Production service helper

`run.sh` wraps the `pnpm install → pnpm build → pnpm start` pipeline and is designed to be executed by a process manager. A sample systemd unit:

```ini
[Unit]
Description=AIRTrack dApp (API+UI on 127.0.0.1:5883)
After=network-online.target
Wants=network-online.target

[Service]
User=airtrack
Group=airtrack
WorkingDirectory=/opt/airtrack
EnvironmentFile=/opt/airtrack/.env
ExecStart=/opt/airtrack/run.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start with:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now airtrack-5883
```

## Environment Reference
All variables live in `.env` and are optional unless stated otherwise.

| Key | Purpose |
| --- | --- |
| `DATABASE_URL` | Prisma connection string (defaults to Postgres `postgresql://airtrack_user:change-me@localhost:5432/airtrack?schema=public`). |
| `PORT` / `WS_PORT` | API and WebSocket ports. |
| `JWT_SECRET` | Secret used to sign authentication tokens. |
| `API_SECRET_TOKEN` | Optional server-side bearer/`X-API-KEY` used for service-to-service access (pairs with the Profile UI field). |
| `API_SECRET_USERNAME` | Service account username created when the API secret is used (defaults to `api_service`). |
| `ADMIN_WALLETS` | Comma-separated wallet addresses promoted to admin on first login. |
| `CRYPTOCOMPARE_API_KEY` | Optional key that unlocks higher rate limits for price polling. |
| `WORKER_POLL_MS` | Interval for the background price worker (default 60 seconds). |
| `VITE_API_URL` | Client-side base URL for REST calls (default `http://localhost:5883/api`). |
| `VITE_WALLETCONNECT_PROJECT_ID` | Required for WalletConnect UI. Sign up at [walletconnect.com](https://cloud.walletconnect.com/). |
| `VITE_DEFAULT_CHAIN_ID` | Defaults to Ethereum mainnet (`1`). |
| `VITE_API_ENDPOINT_URL`, `VITE_API_SECRET_TOKEN` | API docs use these to build cURL snippets; `VITE_API_URL` is used if the override is absent. Secret must be ≤16 alphanumeric chars. |
| `VITE_DEFAULT_TIMEFRAME` | Default candlestick timeframe (`1m`, `5m`, `15m`, `30m`, `1h`, `4h`). |
| `VITE_TWEET_SOURCE` | Optional X (Twitter) username used to validate trade post URLs. |
| `VITE_X_*` and API key fields | Optional integrations for streaming trades from X (Twitter) or third-party data sources. |

## Admin & User Workflow
- **Wallet login**: set `ADMIN_WALLETS` to promote selected addresses on first SIWE authentication.
- **Adding trades**: admins can open the "Add New Trade" modal; real-time listeners pick up the changes.
- **Closing trades**: use the inline actions or the "Close all" button; P/L history is recalculated automatically.
- **API access**: copy the bearer token from the Profile view and follow the autogenerated cURL snippet inside the "API Docs" page. Setting the server-side `API_SECRET_TOKEN` allows service-to-service calls using the same value displayed in the UI.
- **Database maintenance**: the Danger Zone panel includes reset tools that call the protected API endpoints.

## Production Notes
1. Build artifacts:
   ```bash
   pnpm build
   pnpm start
   ```
2. Serve the client bundle from any static host; the Express server already exposes `dist/`.
3. For a managed database, set `DATABASE_URL` to your Postgres/MySQL instance and run `pnpm migrate`.
4. Consider running the server with a process manager such as PM2 or systemd and placing it behind a reverse proxy (Nginx/Caddy).

## Security Checklist
- Rotate `JWT_SECRET` in production and store it outside the repository.
- Use strong ACLs for `ADMIN_WALLETS`; wallet promotion happens automatically.
- Rate-limit public endpoints when deploying to the internet (e.g., via Nginx or Cloudflare).
- Configure HTTPS on the reverse proxy to protect SIWE responses and API calls.
- Restrict `.env` permissions; secrets never leave the machine thanks to `.gitignore`.

## Troubleshooting
| Symptom | Fix |
| --- | --- |
| `pnpm install` fails | Ensure you have internet access or use a local package mirror. The repo adds new dev dependencies (`tsx`, `concurrently`, `@types/*`). |
| Wallet modal crashes on load | Double-check `VITE_WALLETCONNECT_PROJECT_ID`. Without a valid value the modal cannot initialize. |
| Postgres connection fails | Confirm the service is running (`sudo systemctl status postgresql`) and that `DATABASE_URL` matches your credentials. |
| API rejects admin actions | Confirm your wallet address is listed in `ADMIN_WALLETS` and that you signed in via SIWE. |

---
Built with ❤️ by AIRewardrop for operational traders who need insight and control.
