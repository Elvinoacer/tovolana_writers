# Tovolana Writers

An escrow-protected writing services marketplace connecting clients with assessment-vetted researchers, technical writers, strategists, and editors—built with transparent KES pricing, protected delivery deadlines, live brief bidding, and Cloudflare R2 document storage.

---

## Architecture & Tech Stack

| Layer | Technology |
| --- | --- |
| **Framework** | Next.js 16 (App Router, Turbopack), React 19, TypeScript 5 |
| **Styling & Typography** | Tailwind CSS 4, `Inter` + `Plus Jakarta Sans` (`tabular-nums`), Lucide Icons |
| **Database & ORM** | Neon PostgreSQL (`@prisma/adapter-pg`), Prisma 7 (`prisma/schema.prisma`) |
| **Caching & Rate Limits** | Redis (`ioredis`) |
| **Payments & Escrow** | IntaSend (M-Pesa STK Push, Card Checkout, Webhook Idempotency) |
| **File & Media Storage** | Cloudflare R2 (`@aws-sdk/client-s3`, presigned & signed access) |
| **Notifications & Cron** | Email (`nodemailer`) + In-App / Push Outbox, Vercel Cron (`vercel.json`) |

---

## Core Platform Modules

1. **Public Discovery (`/`, `/explore`, `/tasks/[slug]`, `/creators/[username]`, `/membership`, `/policies`)**
   - Browse published services across 7 writing disciplines, compare Free vs. Pro rates (`50%` service fee discount & Pro Early Access), inspect creator rubrics/portfolios, and commission via Full Escrow (`100%`), Milestone Split (`25%`), or First-Page Outline (`KES 490`).
2. **Customer Escrow Workspace (`/book/[taskId]`, `/dashboard`, `/dashboard/bookings/[bookingRef]`)**
   - Structured brief intake and encrypted file uploads, IntaSend checkout, protected delivery deadlines independent of listing expiry (`Valid Until ≠ Delivery Deadline`), structured revision requests, and dispute resolution.
3. **Live Bidding & Connects Marketplace (`/bidding`, `/bidding/[id]`, `/creators-hub/connects`)**
   - Clients publish open briefs; vetted writers submit ranked, boosted, or sealed bids using Connects balances.
4. **Creators Hub & Automated Vetting (`/creators-hub/join`, `/creators-hub/onboarding`, `/creators-hub/assessment/live`, `/creators-hub`)**
   - Zero-paperwork onboarding gated by the Academic Integrity Pledge and a live 6-criteria writing assessment (`>= 75%` auto-approval), plus listing management, order workspaces, earnings ledger, and M-Pesa payouts.
5. **Administrator Console (`/admin/*`)**
   - Moderation queues, listing vault management, category schemas, creator assessment overrides, booking/dispute mediation, finance ledgers, and audit logs.

---

## Quick Start

### 1. Install & Configure Environment

```bash
npm install
cp .env.example .env
```

Configure database (`DATABASE_URL`, `DATABASE_URL_UNPOOLED` / `DIRECT_URL`), Redis (`REDIS_URL`), `AUTH_SECRET`, IntaSend keys, and Cloudflare R2 credentials in `.env`.

### 2. Initialize Database

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Developer Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start local Next.js development server |
| `npm run build` | Build production bundle |
| `npm run start` | Start production Next.js server |
| `npm run lint` | Run ESLint across the repository |
| `npx tsc --noEmit` | Run strict TypeScript typechecking |
| `npm test` | Run end-to-end backend & storage test suite (`tests/*.test.ts`) |
| `npm run db:generate` | Generate Prisma Client from `prisma/schema.prisma` |
| `npm run db:migrate` | Run Prisma development migrations |
| `npm run db:seed` | Seed categories, demo personas, and sample listings (`prisma/seed.ts`) |
| `npm run storage:sync-r2` | Sync local/editorial media assets to Cloudflare R2 (`scripts/sync-r2.ts`) |
| `npm run codebase:export` | Export/update full codebase & directory tree to `PLATFORM_CODEBASE.md` |

---

## Full Codebase Documentation Export

To generate or refresh a single, navigable Markdown documentation snapshot containing all source files (with relative paths, module grouping, line counts, and the full `Project Structure` tree at the end—including any newly added files and folders):

```bash
npm run codebase:export
# Or specify a custom output path:
npm run codebase:export -- --out docs/SNAPSHOT.md
```

---

## Scheduled Jobs (`vercel.json`)

- `/api/cron/listings-lifecycle` (`0 1 * * *`) — Expires stale listings and archives lapsed entries.
- `/api/cron/notifications-outbox` (`*/15 * * * *`) — Dispatches queued email and notification outbox items.
- `/api/cron/deadline-alerts` (`0 */4 * * *`) — Sends upcoming booking delivery deadline reminders.
