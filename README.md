# Margin Scouts — product research tool

A one-page site where someone types a product idea, sees a teaser report,
pays $4.99 once via a real, server-verified Stripe payment, and unlocks
the full analysis (demand trend, suggested price, margin estimate,
competitor list).

## What's in this build

- `index.html` — the whole frontend, no build step needed.
- `api/create-checkout-session.js` — creates a real Stripe Checkout Session.
- `api/verify-session.js` — after Stripe redirects back, asks Stripe
  directly whether that session was actually paid, and only then
  generates and returns the report. This is what makes the payment
  wall real: nothing about "did they pay" is trusted from the browser.
- `api/_report.js` — the report-generation logic. Currently demo data
  (deterministic per product name). This is the one file to change when
  you're ready to use real product data — see step 3.

## 1. Deploy it (Vercel — free tier, works out of the box)

This is built for **Vercel**, because it turns the `api/` folder into
serverless functions automatically with zero config. (Netlify and others
can also run this, but the function setup differs slightly — ask if you
want those instructions instead.)

1. Create a free account at [vercel.com](https://vercel.com).
2. Install the CLI: `npm install -g vercel`
3. From inside this folder, run: `vercel`
   — follow the prompts (link or create a project). It'll deploy and
   give you a live URL.
4. In your Stripe Dashboard, go to **Developers → API keys** and copy
   your **secret key** (starts with `sk_live_` or `sk_test_` — use the
   test key while you're trying this out).
5. In your Vercel project settings → **Environment Variables**, add:
   - `STRIPE_SECRET_KEY` = your secret key
6. Redeploy (`vercel --prod`) so the new environment variable takes effect.

That's the whole setup. Test it with Stripe's test card `4242 4242 4242 4242`,
any future expiry date, any CVC — it'll go through the full flow without
charging a real card while you're using a test key.

When you're ready to take real payments, switch `STRIPE_SECRET_KEY` to
your **live** secret key in Vercel's environment variables and redeploy.

## 2. How the payment flow works, step by step

1. Person types a product, sees the teaser, clicks **Unlock this report**.
2. Frontend calls `/api/create-checkout-session` with the product name.
3. That function asks Stripe to create a $4.99 one-time Checkout Session
   and returns Stripe's checkout URL. The product name is stored in the
   session's `metadata` so we can find it again after payment.
4. Browser redirects to Stripe's hosted checkout page (Stripe handles
   all the card details — none of that touches your server).
5. On success, Stripe redirects back to your site with `?session_id=...`.
6. Frontend calls `/api/verify-session?session_id=...`.
7. That function asks Stripe: "was this session actually paid?" Only if
   Stripe confirms `paid` does it generate the report and send it back.

If someone tries to fake the URL (e.g. typing a random `session_id`),
Stripe will simply say that session doesn't exist or isn't paid, and no
report is returned. This is the fix for the "just type ?paid=1" gap in
the earlier static version.

## 3. Swap in real product data

Open `api/_report.js`. The `generateReport(query)` function is the only
place that needs to change. Right now it invents numbers from the product
name; replace its body with a real lookup, for example:

- **Keepa API** — Amazon price/sales-rank history, cheapest to start with.
- **Jungle Scout API** — closer to what Helium 10 itself uses.
- **RapidAPI marketplace scrapers** (Amazon, Etsy, eBay) — fast to wire up.
- **Amazon SP-API** — free but requires an approved seller account.

Store that provider's API key the same way as Stripe's — as an
environment variable in Vercel, never in the frontend code — and call it
from inside `generateReport()` (you'll need to make it `async` and add
`await` where it's called in `verify-session.js`).

## 4. A few things worth knowing

- **Refunds/disputes**: handle these from your Stripe Dashboard directly;
  nothing extra to build for that.
- **Receipts**: Stripe emails a receipt automatically if you enable it in
  Checkout settings — no code needed.
- **If a customer pays but the report page fails to load** (bad connection,
  closed the tab): their `session_id` is still valid in Stripe. You could
  add a "look up my report" box that takes a session ID or receipt email
  and calls `/api/verify-session` again — happy to build that if it comes up.
