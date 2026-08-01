# PaperTrade — NSE/BSE Paper Trading Terminal

A free, simulated equity + options trading terminal: live-ticking prices,
TradingView-style candlestick charts, an options chain with Black-Scholes
premiums, market news, a trade journal, and per-user accounts backed by
Supabase. No real money, no real market data feed — everything trades
against a simulated price engine so it's safe to practice on.

---

## What you need before starting

- A **GitHub account** (free) — for hosting the code and the live site
- A **Supabase account** (free) — [supabase.com](https://supabase.com) — for login and the database
- **Node.js** installed on your computer (v18 or newer) — [nodejs.org](https://nodejs.org)
- **Git** installed — [git-scm.com](https://git-scm.com)

You do not need to pay for anything. GitHub Pages hosting and Supabase's
free tier are both enough to run this.

---

## Step 1 — Get the project onto your computer

Unzip the project folder you downloaded, then open a terminal inside it
(on Windows: Command Prompt or PowerShell; on Mac: Terminal).

```bash
cd papertrade-pro
```

## Step 2 — Install dependencies

```bash
npm install
```

This downloads React, Supabase's client library, the charting library,
and everything else the project needs.

## Step 3 — Create your Supabase project

1. Go to [supabase.com](https://supabase.com) → **Start your project** → sign in
2. Click **New project**
3. Give it a name (e.g. `papertrade`), set a database password (save it
   somewhere), pick a region close to India (e.g. Mumbai / `ap-south-1`
   if offered), then **Create new project**
4. Wait ~2 minutes while it provisions

## Step 4 — Run the database schema

1. In your Supabase project, open **SQL Editor** (left sidebar)
2. Click **New query**
3. Open `supabase/schema.sql` from this project, copy the entire contents
4. Paste into the SQL Editor and click **Run**

This creates every table (profiles, positions, option positions, orders,
watchlist, journal), locks each one down with row-level security so users
can only ever see their own data, and sets up a trigger that automatically
gives every new user ₹10,00,000 virtual cash and a starter watchlist the
moment they sign up.

## Step 5 — Connect your app to Supabase

1. In Supabase, go to **Project Settings → API**
2. Copy the **Project URL** and the **anon public** key
3. In the project folder, copy `.env.example` to a new file named `.env`:

```bash
cp .env.example .env
```

4. Open `.env` and paste your values:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

(Leave `VITE_NEWS_FUNCTION_URL` for now — you'll fill it in during Step 6.)

## Step 6 — Deploy the news Edge Function

The News page needs a tiny server-side function (because news sites block
direct requests from a browser). Supabase Edge Functions run this for
free.

1. Install the Supabase CLI:

```bash
npm install -g supabase
```

2. Log in and link your project:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

(Your project ref is the random string in your Supabase project URL,
e.g. `xxxxxxxxxxxx` from `https://xxxxxxxxxxxx.supabase.co`.)

3. Deploy the function:

```bash
supabase functions deploy fetch-news --no-verify-jwt
```

4. It will print a URL like:
`https://xxxxxxxxxxxx.supabase.co/functions/v1/fetch-news`

Copy that into your `.env` file as `VITE_NEWS_FUNCTION_URL`.

## Step 7 — Run it locally and test everything

```bash
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`). Create an
account, confirm your email (check your inbox — Supabase sends a
confirmation link by default), sign in, and click through every tab —
Dashboard, Options, Charts, News, Journal, Profile — to make sure it all
works before you deploy it publicly.

> If sign-up emails don't arrive: Supabase's default email sender is
> rate-limited on the free tier. For testing, you can turn off email
> confirmation in **Authentication → Providers → Email → Confirm email**
> (toggle off), then re-enable it later if you want it for a real launch.

## Step 8 — Push the code to GitHub

1. On [github.com](https://github.com), click **New repository** (e.g.
   name it `papertrade-pro`), keep it empty (no README/license), **Create
   repository**
2. Back in your terminal:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/papertrade-pro.git
git push -u origin main
```

Your `.env` file is excluded automatically (it's in `.gitignore`) so your
Supabase keys never get uploaded to GitHub.

## Step 9 — Deploy to GitHub Pages

The project already includes a one-command deploy script.

```bash
npm run deploy
```

This builds the app (baking in the `.env` values from your machine) and
pushes the result to a `gh-pages` branch on your repo.

Then, on GitHub:

1. Go to your repo → **Settings → Pages**
2. Under **Build and deployment → Source**, choose **Deploy from a
   branch**
3. Branch: `gh-pages`, folder: `/ (root)` → **Save**
4. Wait a minute, then your site is live at:
   `https://YOUR_USERNAME.github.io/papertrade-pro/`

## Step 10 — Keep it updated

Whenever you or I change the code, redeploy with:

```bash
git add .
git commit -m "Update"
git push
npm run deploy
```

---

## Troubleshooting

- **Blank page after deploying** — open the browser console (F12). If you
  see Supabase connection errors, double check `.env` was filled in
  *before* you ran `npm run deploy` (env values are baked in at build
  time, not read at runtime).
- **"News feed unavailable"** — the Edge Function isn't deployed yet, or
  `VITE_NEWS_FUNCTION_URL` in `.env` doesn't match the URL Supabase gave
  you in Step 6.
- **Can't sign in after signing up** — check your email for the
  confirmation link, or disable email confirmation as noted in Step 7.
- **Charts look empty** — make sure you're on a recent browser; the chart
  library needs a modern JS engine (any browser from the last few years
  works).

## What's real vs simulated

- **Real**: your account, login, and all trade data — genuinely persisted
  per-user in your own Supabase database.
- **Simulated**: stock/index prices, candles, and option premiums. There
  is no free, reliable, real-time NSE/BSE data feed available for a
  hobby project — real ones are paid or require a broker API account.
  Everything here moves on a randomized-but-realistic model so you can
  practice order mechanics, P&L, and position sizing without that cost.
- **Illustrative**: options expiry dates and stock-level lot sizes are
  simplified for the simulator. Index option lot sizes (Nifty 65, Bank
  Nifty 30, Sensex 20) reflect NSE's January 2026 revision at the time
  this was built — check NSE's site for the current figures before
  treating them as authoritative.
