# Imaginaries

## Overview

AI-powered jewelry image generation app featuring:
- Generate from prompt and predefined presets
- Sketch-to-image capabilities
- Public gallery with likes and sharing
- Real-time AI Price estimation
- Quote requests
- Email-based authentication with confirmations
- Subscription-based (different plans with different limits) usage limits

**Full-stack monorepo** with:
- **Frontend**: React + Vite
- **Backend**: Node/Express
- **Database**: Postgres (production) or JSON files (development)
- **Storage**: Optional Cloudinary integration

## Architecture

### Client
- **Tech Stack**: React 18, Vite, Tailwind, Redux Toolkit, React Query, Radix UI
- **Entry Point**: `apps/client/frontend/main.jsx`
- **App Router & State**: `apps/client/frontend/App.jsx`
- **API Client**: `apps/client/frontend/services/api.js`
- **Development**: Vite proxies API to backend

### Server
- **Framework**: Express with modular routes and middleware
- **Features**:
  - Email via Nodemailer
  - Image generation via OpenAI/Replicate/Fal
  - Cloudinary storage (production)
- **Bootstrap**: `apps/client/backend/index.js` handles:
  - Environment loading
  - Database connection
  - Migrations
  - Route setup
  - Health checks
  - Error handling

### Database
- **Production**: Postgres (`apps/client/backend/config/db.js`)
- **Development**: File-based (`apps/client/backend/config/dev.js`)
- **Migrations**: `apps/client/backend/config/migrations.js` + `apps/client/backend/migrations/*.sql`

### Key Components
- **Generation Pipeline**: `apps/client/backend/routes/generate.js` + `apps/client/backend/config/imageGenerators.js`
- **Price Estimation**: `apps/client/backend/utils/estimationUtils.js`
- **Sketch Analysis**: `apps/client/backend/utils/sketchUtils.js`
- **Email Service**: `apps/client/backend/config/email.js`
- **Subscription Plans & Limits**: 
  - `apps/client/backend/config/plans.js`
  - `apps/client/backend/middleware/subscriptionLimits.js`
  - `apps/client/backend/middleware/rateLimiter.js`

## Key Features

### Image Generation
- **Text-to-Image**: Multiple providers supported:
  - OpenAI DALL·E/gpt-image-1
  - Replicate Flux
  - Fal.ai Flux Pro
- **Sketch-to-Image**: Two modes:
  1. OpenAI Vision to derive prompt, then generate
  2. Direct gpt-image-1 edit with sketch

### File Storage
- **Development**: Local storage
- **Production**: Cloudinary integration
- **Watermarking**: Applied on download for non-Business plans

### Authentication & Authorization
- Email/password with JWT cookies
- Email confirmation
- Password reset functionality
- Resend confirmation
- Sign out

### Subscription Plans
- **Free/Pro/Business** tiers
- Controls:
  - Generations per day
  - Private images
  - Watermark requirements

### Gallery Features
- Public gallery
- User history
- Likes system
- Shareable image pages

### Additional Features
- **Price Estimation**: OpenAI-based heuristic with dollar range per image
- **Feedback System**: Bug/feature reports with attachments
- **Quote Requests**: Direct email to admin

## API Surface

### Authentication (`apps/client/backend/routes/auth.js`)
- `POST /api/auth/signup|signin|signout|resend-confirmation|reset-password`
- `GET /api/auth/me|confirm-email|verify-reset-token`

### Generation (`apps/client/backend/routes/generate.js`)
- `POST /api/generate` - Generate from prompt or sketch
- `GET /api/generate/public` - Public generations
- `GET /api/generate/shared/:imageId` - Get shared image
- `PUT /api/generate/:imageId/privacy` - Update image privacy
- `POST /api/generate/download/:imageId` - Download image
- `POST /api/generate/estimate/:imageId` - Get price estimate
- `DELETE /api/generate/history/delete` - Delete generation history

### Images (`apps/client/backend/routes/images.js`)
- `GET /api/images/recent|top` - Dual-mode (user history vs public)

### Likes (`apps/client/backend/routes/likes.js`)
- `POST /api/likes/status/get` - Get like status
- `POST|DELETE /api/likes/:imageId` - Add/remove like

### Users (`apps/client/backend/routes/users.js`)
- `GET /api/users/:userId` - Subscription details

### Quotes (`apps/client/backend/routes/quotes.js`)
- `POST /api/quotes` - Submit quote request

### Feedback (`apps/client/backend/routes/feedback.js`)
- `POST /api/feedback/report` - Submit bug/feature report (authenticated, supports file uploads)

## Data Model

### Users
- `email`
- `password` (hashed)
- `email_confirmed`
- `subscription_plan`
- `promo_code`
- Confirmation/reset tokens
- IP/UA tracking
- Timestamps

### Images
- `id`
- `user_id`
- `prompt`
- `image_url`
- `watermarked_url`
- `metadata`
- `is_private`
- `estimated_cost`
- `created_at`

### Likes
- `user_id`
- `image_id` (with uniqueness constraint)
- Count functionality

### Promo Codes
- `id`
- `plan`
- `validity`

See migrations in `apps/client/backend/migrations/*.sql` for schema details.

## Development vs Production

### Development Mode
- **Database**: JSON-backed store at `apps/client/backend/dev-data/*.json`
- **Uploads**: On-disk storage
- **Auto-seeding**: Test admin user (`apps/client/backend/config/dev.js:160`)
- **Static Uploads**: Served from `GET /api/generate/uploads`
- **AI Services**: OpenAI/Replicate/Fal remain active unless disabled

### Production Mode
- **Database**: Postgres (configured via `DATABASE_URL`)
- **Storage**: Cloudinary for image/watermark uploads
- **Migrations**: Automatically run on startup
- **Client**: Served from `dist/` directory

## Configuration

### Server Environment
Required variables in `apps/client/backend/config/env.js`:
- `PORT`
- `SMTP_*` (SMTP configuration)
- `QUOTE_REQUEST_EMAIL`
- `OPENAI_API_KEY`
- `DATABASE_URL`
- `JWT_SECRET`

Additional configurations:
- Provider settings: `apps/client/backend/config/apiSettings.js`
- Image generators: `apps/client/backend/config/imageGenerators.js`
- Vite configuration: `apps/client/vite.config.js`
- Client API host: `apps/client/frontend/config/api.js`

## Getting Started

### Development
1. Install dependencies: `npm install`
2. Start development server: `npm run dev`
   - Starts Vite dev server and Express backend
   - Ensure `apps/client/backend/.env` is properly configured

### Production
- Build and start: `npm run start`
- Docker images available for separate frontend/backend deployment
  - Main Dockerfile
  - `apps/client/backend/Dockerfile`

## Important Notes

### Security
- ⚠️ **Critical**: `apps/client/backend/.env` contains real secrets and should not be committed to version control
- Move secrets to a secure secret management system
- Never expose server secrets to client-side code

### Docker
- The root `Dockerfile` references `nginx.conf` which is missing from the repository
- Builds will fail until this file is added

### Code Quality
- **Bug**: In `apps/client/backend/index.js:97` - Typo in event listener: `'uncaught Exception'` should be `'uncaughtException'`

### Database Security
- Some queries directly interpolate validated `userId` into template strings
- Affected files:
  - `apps/client/backend/routes/generate.js` (lines 311, 429)
  - Images routes
- **Recommendation**: Use parameterized queries for consistency and security


# NEXT JS ADMIN APP
Polished AI jewelry generation platform with a React client, Express API, and a dedicated Next.js admin app for rapid operations.

**Repository Structure**
- **Client (Vite)**: root project (`apps/client/frontend/`, `vite.config.js`) — end‑user experience.
- **API Server (Express)**: `apps/client/backend/` — auth, generation, gallery, likes, users, admin endpoints.
- **Admin App (Next 14 + Refine + AntD)**: `apps/admin/` — operations dashboard (Users resource scaffolded).
- **Dev Script**: `dev.sh` — starts app(s) in different modes.

**Stacks**
- **Client**: React 18, Vite, Tailwind, Redux Toolkit, React Query, Radix UI.
- **Server**: Node/Express, Postgres (prod) or JSON files (dev), Cloudinary (prod media), Nodemailer, OpenAI/Replicate/Fal.
- **Admin**: Next.js 14 (app router), Refine, Ant Design 5, React Query.

**Dev Scripts**
- **Full stack**: `./dev.sh` or `./dev.sh full` — client:5173, server:3000, admin:3001.
- **Admin only**: `./dev.sh admin` — server:3000, admin:3001.
- The script installs missing deps for the selected apps on first run.

**Environment Files**
- **Server**: `apps/client/backend/.env` (or `.env.local` in dev). Contains secrets (DB, JWT, SMTP, OpenAI, Cloudinary). Loaded by `apps/client/backend/config/env.js`.
- **Client (Vite)**: `.env.local` with `VITE_*` vars only (exposed to browser). Proxy to server via Vite config in dev.
- **Admin (Next)**: `apps/admin/.env.local` with `NEXT_PUBLIC_*` vars only (exposed to browser). Set `NEXT_PUBLIC_API_URL=http://localhost:3000` for dev if cross‑origin.

**Admin App (Next + Refine + AntD)**
- **Location**: `apps/admin`
- **Purpose**: Ship a polished admin dashboard quickly.
- **Auth**: Uses existing JWT cookie from the main app (`/api/auth/me`).
- **Current resource**: Users list with server‑side pagination.

**Backend Changes For Admin**
- **Role support**:
  - Migration: `apps/client/backend/migrations/20250831090000_user_roles.sql` (default `user`).
  - Dev seed: `apps/client/backend/config/dev.js` seeds an admin user `admin@yastrub.com` (password `admin`).
  - Middleware: `apps/client/backend/middleware/auth.js` attaches `role`; `apps/client/backend/middleware/requireAdmin.js` gates admin endpoints.
- **Admin routes**:
  - `GET /api/admin/users` — list users with pagination and `q` email search.
  - `GET /api/admin/users/:id` — fetch a user.
  - `PATCH /api/admin/users/:id` — update `role` and/or `email_confirmed`.

**Run Locally**
- Start server: `npm run dev:server` (or via `./dev.sh`).
- Start client: `npm run dev:client` (or via `./dev.sh full`).
- Start admin: `cd apps/admin && npm run dev` (or via `./dev.sh`).

**Planned Features (TODO)**
- **User Management Dashboard**: CRUD, search, filters; lock/unlock; force confirm email.
- **Packages Management Dashboard**: CRUD for plans/packages; features; visibility; promo codes management.
- **Activation/Renewal System**: Stripe products/prices + subscriptions; portal integration.
- **Payment Gateway Module**: Stripe Checkout + Webhooks; transaction mirror tables.
- **Security & Audit**: `audit_logs` with actor/entity/diff; request IDs; export CSV.
- **User Onboarding**: guided steps; saved progress; invite/promos.
- **User Account Interface**: profile, password, email confirmation, billing portal.
- **UX Improvements & Bug Fixes**: table presets; skeletons; better errors; toasts.
- **QA Tests**: Playwright E2E (admin flows), Supertest API tests, RTL unit tests.

**Roadmap (Phased)**
- **Phase 1: Admin Baseline (Week 1)**
  - Users list/detail/edit; role gates; basic audit logging (create table + hooks).
  - Promo codes CRUD; packages skeleton.
- **Phase 2: Billing Integration (Weeks 2–3)**
  - Stripe products/prices; Checkout; Customer Portal; webhooks (idempotent) → `subscriptions`/`transactions` mirrors.
  - Admin: subscriptions/transactions views; links to Stripe.
- **Phase 3: Security & UX (Week 4)**
  - Full audit coverage on admin mutations; CSV export; filters.
  - UX polish: saved table filters; batch actions; charts (KPIs).
- **Phase 4: Onboarding & Account (Week 5)**
  - Onboarding flow; account page; self‑serve billing.
- **Phase 5: Hardening & QA (Week 6)**
  - E2E smoke and regression suite; load test critical endpoints.

**Notes**
- **CORS/Cookies (dev)**: server allows `http://localhost:5173` and `http://localhost:3001` with credentials.
- **Production Routing**: recommended to route `/api` → Express, `/admin` → Next, `/` → Vite build; cookies work cleanly on same apex domain.
- **Secrets**: do not commit real secrets; use `.env.example` files and a secret manager in prod.

