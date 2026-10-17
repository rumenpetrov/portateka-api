# portateka-api

An API for a real estate portfolio management hub, built with **Hono** on **Cloudflare Workers**, **Neon Serverless Postgres**, and **Drizzle ORM**. The codebase targets standard Web and **Node.js** APIs (`nodejs_compat`) to minimize vendor lock-in and remain portable across runtimes.

---

## Requirements

- **Node.js:** `>=24.22.0`
- **npm:** `>=11.19.1` (enforced via `devEngines` in `package.json`)

---

## Local Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Configure `.env`:**
   Copy `.env.example` to `.env` in the project root and fill in the values (used by `wrangler dev`, `drizzle-kit`, and `vitest`):

   ```bash
   cp .env.example .env
   ```

   > **Tip:** During active development you can grab a disposable Postgres URL from [neon.new](https://neon.new) to avoid using your permanent Neon project quotas.
   > Do **not** create a `.dev.vars` file—if `.dev.vars` exists, Wrangler ignores `.env`.

3. **Generate Cloudflare types, run migrations & seed demo data:**

   ```bash
   npm run cf-typegen
   npm run db:migrate
   npm run db:seed
   ```

4. **Start the local dev server:**
   ```bash
   npm run dev
   ```

---

## Scripts

| Command                 | Description                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `npm run dev`           | Start local Cloudflare Workers dev server (`wrangler dev`)                           |
| `npm run typecheck`     | Run TypeScript compiler check (`tsc --noEmit`)                                       |
| `npm test`              | Run automated tests once with Vitest (`vitest run`)                                  |
| `npm run test:watch`    | Run Vitest in watch mode (`vitest`)                                                  |
| `npm run test:coverage` | Run Vitest with code coverage (`vitest run --coverage`)                              |
| `npm run cf-typegen`    | Regenerate `worker-configuration.d.ts` from `wrangler.jsonc` and `.env`              |
| `npm run db:push`       | Push `src/db/schema.ts` changes directly to the DB (prototyping, no migration files) |
| `npm run db:generate`   | Generate a new SQL migration in `migrations/` from `src/db/schema.ts`                |
| `npm run db:migrate`    | Apply pending SQL migrations from `migrations/` to the DB                            |
| `npm run db:reset`      | Drop `public` and `drizzle` schemas on the local DB (`src/db/reset.ts`)              |
| `npm run db:seed`       | Clear rows and insert demo users into the local DB (`src/db/seed.ts`)                |
| `npm run db:studio`     | Open Drizzle Studio GUI (`https://local.drizzle.studio`)                             |
| `npm run deploy`        | Deploy Worker to Cloudflare (`wrangler deploy --minify`)                             |

---

## Database & Migration Workflow

### How to Build a Feature That Changes the DB Schema

When experimenting with new tables or columns, you don't want to generate 20 tiny migration files while changing your mind. Use this two-phase workflow instead:

#### Phase 1: Experiment freely with `db:push`

1. Edit `src/db/schema.ts` (add columns, try a new table, rename fields, delete the table, etc.).
2. Run `npm run db:push` as many times as you want while testing your code.
   - **What it touches:** Only your **local dev database** (in `.env`).
   - **What it does NOT touch:** Your `migrations/` folder on disk and your production database remain 100% untouched.

#### Phase 2: Lock in the final schema (`generate` $\rightarrow$ `reset` $\rightarrow$ `migrate` $\rightarrow$ `seed`)

Once you are happy with `src/db/schema.ts` and ready to commit your feature, run these 4 commands in order:

```bash
# 1. Generate a single clean migration file from your final schema.ts
npm run db:generate

# 2. Wipe the local dev DB (removes experimental db:push tables and resets the local checklist)
npm run db:reset

# 3. Replay all migrations (0000 -> latest) on your clean local dev DB
npm run db:migrate

# 4. Populate local demo data (john@example.com, jane@example.com)
npm run db:seed
```

#### Why `db:reset` does NOT lose your migration history

There are two separate things to keep in mind:

1. **Your real migration history (`migrations/` folder in git):**
   All your `.sql` files (`0000_...sql`, `0001_...sql`) and snapshots (`migrations/meta/`) live on disk in your repository. `npm run db:reset` **never touches files on disk**.
2. **The database's internal checklist (`drizzle.__drizzle_migrations` table in Postgres):**
   Inside Postgres, Drizzle keeps a table recording which `.sql` files have already been executed on _that specific database_. Because `db:push` modified your local DB tables without updating that checklist, running `db:migrate` directly would fail with _"relation/column already exists"_.
   Running `npm run db:reset` empties your **local dev database** so `npm run db:migrate` can replay every `.sql` file from `0000` to the latest cleanly, proving your migration chain works end-to-end before you push to GitHub.

#### What happens to Production data when you deploy?

- On push to `main`, GitHub Actions **never** runs `db:reset` or `db:seed`—it **only** runs `npm run db:migrate`.
- Drizzle checks the production DB's `drizzle.__drizzle_migrations` table, sees that previous migrations (`0000`, etc.) were already applied, and executes **only the new migration file** (`0001_...sql`).
- **All existing production rows stay intact.**
- **Production gotcha for new columns:** If you add a new `notNull()` column to a table that already has rows in production, always include `.default(...)` (or make the column nullable) so Postgres knows what value to put in existing rows during `ALTER TABLE`.

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
