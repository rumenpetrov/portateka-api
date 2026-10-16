# portateka-api

An API for a real estate portfolio management hub, built with **Hono** on **Cloudflare Workers**, **Neon Serverless Postgres**, and **Drizzle ORM**.

---

## Local Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure `.env`:**
   Copy `.env.example` to `.env` in the project root and fill in the values (used by both `wrangler dev` and `drizzle-kit`):
   ```bash
   cp .env.example .env
   ```
   ```env
   DATABASE_URL="postgresql://..."
   JWT_SECRET="your-random-32-plus-byte-secret"
   ```
   > **Tip:** During active development you can grab a disposable Postgres URL from [neon.new](https://neon.new) to avoid using your permanent Neon project quotas.
   > Do **not** create a `.dev.vars` file—if `.dev.vars` exists, Wrangler ignores `.env`.

3. **Generate Cloudflare types & run migrations:**
   ```bash
   npm run cf-typegen
   npm run db:migrate
   ```

4. **Start the local dev server:**
   ```bash
   npm run dev
   ```

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start local Cloudflare Workers dev server (`wrangler dev`) |
| `npm run typecheck` | Run TypeScript compiler check (`tsc --noEmit`) |
| `npm run cf-typegen` | Regenerate `worker-configuration.d.ts` from `wrangler.jsonc` and `.env` |
| `npm run db:push` | Push `src/db/schema.ts` changes directly to the DB (prototyping, no migration files) |
| `npm run db:generate` | Generate a new SQL migration in `migrations/` from `src/db/schema.ts` |
| `npm run db:migrate` | Apply pending SQL migrations from `migrations/` to the DB |
| `npm run db:studio` | Open Drizzle Studio GUI (`https://local.drizzle.studio`) |
| `npm run deploy` | Deploy Worker to Cloudflare (`wrangler deploy --minify`) |

---

## Database & Migration Workflow

### Prototyping vs. Committing Migrations
- **While prototyping a new feature (`npm run db:push`):**
  Edit `src/db/schema.ts` and run `npm run db:push` as many times as you like. Drizzle updates the live database immediately without cluttering `migrations/` with tiny experimental files.
- **When the feature schema is final (`npm run db:generate` + `npm run db:migrate`):**
  1. If you used `db:push` on the same database you want to run `db:migrate` on, drop the prototyped table first in `npm run db:studio` (or swap in a fresh `neon.new` DB) so `CREATE TABLE` doesn't collide with the pushed table.
  2. Run `npm run db:generate` once to create a single clean `.sql` migration file in `migrations/`.
  3. Run `npm run db:migrate` to apply it and commit the `migrations/` folder to git.

### Inspecting Local or Production Database
- **Local DB (from `.env`):**
  ```bash
  npm run db:studio
  ```
- **Production DB (override `DATABASE_URL` inline):**
  ```bash
  DATABASE_URL="postgresql://..." npm run db:studio
  ```
- **Quick terminal query against any DB:**
  ```bash
  DATABASE_URL="postgresql://..." node -e 'import("@neondatabase/serverless").then(async ({neon}) => console.table(await neon(process.env.DATABASE_URL).query("SELECT id, email, username, created_at FROM users")))'
  ```

---

## Deployment & Secrets (GitHub Actions)

Production deployments run automatically on push to `main` via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):
1. Runs `npm run typecheck`.
2. Runs `npm run db:migrate` against the production `DATABASE_URL`.
3. Deploys the Worker and syncs production secrets (`DATABASE_URL`, `JWT_SECRET`) from **GitHub Actions Secrets** directly to **Cloudflare Workers**.

**GitHub Secrets is the single source of truth for production secrets.** When adding a new secret to the app:
1. Add the key to `.env.example` and your value to `.env`.
2. Run `npm run cf-typegen` so `CloudflareBindings` includes it.
3. Add the secret in your GitHub repository settings (**Settings $\rightarrow$ Secrets and variables $\rightarrow$ Actions**) and list it under `secrets:` in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).
