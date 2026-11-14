# Tovolana Writers — Design System & Visual Architecture Specification (`DESIGN.md`)

**Brand / Platform:** Tovolana Writers (Online Writing Platform v1.0)
**Aesthetic Direction:** Editorial Ink & Warm Parchment — tactile, scholarly paper precision blended with high-contrast fintech/escrow transparency.

---

## 1. Visual & Typographic Tokens

### Color Palette
- **Primary Paper Canvas:** `#FAF7F2` (`--bg-canvas`) — warm alabaster paper backdrop that softens long-form reading across marketplace briefs, assessment studios, and order workspaces.
- **Elevated Card Surface:** `#FFFFFF` (`--surface-card`) framed by subtle `#E6E0D4` hairline borders (`--border-subtle`).
- **Secondary Parchment Well:** `#F2EDE3` (`--surface-muted`) for summary callouts, fee breakdown ledgers, and policy notices.
- **Primary Ink:** `#111827` (`--ink-primary`) — crisp obsidian black for high readability.
- **Secondary / Muted Ink:** `#4B5563` (`--ink-secondary`) and `#6B7280` (`--ink-muted`).
- **Primary Brand Accent (Oxford Blue):** `#1E3A8A` (`--brand-primary`), Hover `#172554`, Soft Tint `#EFF6FF`.
- **Creator Hub Emerald:** `#0F766E` (`--accent-creator`), Soft Tint `#F0FDFA`. Used to distinguish Creators Hub metrics, approved assessment badges, and escrow releases.
- **Pro Membership Gold:** `#B45309` (`--accent-pro`), Bright Highlight `#D97706`, Soft Tint `#FEF3C7`. Used for Pro Early Access tags, 50% service-fee discount callouts, and Pro subscriber badges.
- **Critical / Dispute Rose:** `#BE123C` (`--accent-danger`), Soft Tint `#FFF1F2`.

### Typography Stack
- **Display Serif (`Fraunces` / `var(--font-serif)`):** Page hero headlines, editorial section headers, task titles, and monograph callouts. Negative slight tracking (`-0.02em`) for authority.
- **UI & Body Sans (`Plus Jakarta Sans` / `var(--font-sans)`):** Forms, controls, navigation bars, card descriptions, and admin data tables.
- **Technical Monospace (`JetBrains Mono` / `var(--font-mono)`):** Booking references (`TVL-2026-...`), IntaSend API references, currency totals (`KES 6,500`), word counters (`385 / 600 words`), countdown timers, and listing validity dates.

---

## 2. Core UX Invariants & Component Grammar

1. **Zero-Ambiguity Financial Breakdown (`FeeLedgerCard`):**
   Every service detail page (`1.3`) and booking checkout wizard (`3.2`) MUST display:
   - Listed Price
   - Extra Charges (if any)
   - Platform Service Fee (10% standard)
   - Pro Discount (`-50%` on service fee for active Pro subscribers; previewed transparently for Free users too)
   - **Total Payable (`KES`)**
2. **Explicit Separation of Dates (`ValidityVsDeadlinePill`):**
   - **Listing `Valid Until`** (Standard 30d / Short 14d / Admin Custom) governs *new discovery & booking open window* (`bg-stone-100 text-stone-700`).
   - **Booking `Delivery Deadline`** governs *confirmed creator delivery* (`bg-blue-50 text-blue-900 border-blue-200`). Never conflated.
3. **Free vs Pro Equity Banner:**
   Public and Customer booking flows explicitly reinforce that Free accounts can book all public services immediately, while Pro adds early-access spotlights and 50% off service fees.
4. **Zero-Paperwork Creator Onboarding Gate (`4.1`–`4.3`):**
   Communicates clearly that **no government ID or academic certificates** are requested; Creator qualification relies purely on completing the profile, accepting the Academic Integrity Pledge, and passing the live 6-criteria writing assessment (`>= 75%`).
5. **5-Module Responsive Shell:**
   - Sticky top editorial header (`64px`) with instant module links (**Explore**, **Become a Creator**, **Pro Membership**, **Customer Dashboard**, **Creators Hub**, **Admin Console**), live notification bell counter, and active account badge.
   - Multi-column editorial grids on desktop (`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`) collapsing cleanly to single-column mobile cards with generous `44px+` touch targets.

---

## 3. Target Screen Coverage (35 Screens across 5 Modules)
1. **Public Discovery (7):** `/`, `/explore`, `/tasks/[slug]`, `/creators/[username]`, `/membership`, `/creators-hub/join`, `/policies`.
2. **Authentication & Identity (2):** `/auth`, `/auth/verify`.
3. **Customer Workspace (7):** `/dashboard`, `/book/[taskId]`, `/dashboard/bookings/[bookingRef]`, `/dashboard/bookings/[bookingRef]/revision`, `/dashboard/bookings/[bookingRef]/dispute`, `/dashboard/membership`, `/dashboard/settings`.
4. **Creators Hub (9):** `/creators-hub/onboarding`, `/creators-hub/assessment/live`, `/creators-hub/status`, `/creators-hub`, `/creators-hub/listings/new`, `/creators-hub/listings`, `/creators-hub/bookings/[ref]`, `/creators-hub/earnings`, `/creators-hub/profile`.
5. **Administrator Console (10):** `/admin`, `/admin/listings/moderation`, `/admin/listings/vault`, `/admin/categories`, `/admin/creators/vetting`, `/admin/users`, `/admin/bookings`, `/admin/finance`, `/admin/settings`, `/admin/reports`.
