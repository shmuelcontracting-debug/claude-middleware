# GHL <-> Claude Lead Triage Middleware

Listens for GoHighLevel webhooks, uses Claude to judge whether a lead (a)
is in your Homestead-to-Port-St.-Lucie service area and (b) wants an onsite
estimate, and if both are true, sends you a WhatsApp message: "Lead ready
for you" with their name, phone, and address. It can also draft (or,
once you flip a setting, auto-send) replies to inbound lead messages.

## What you need before this works

1. **A GHL WhatsApp connection** — Settings → Integrations → WhatsApp in
   your GHL account, so WhatsApp shows up as a channel.
2. **A GHL Private Integration token** — Settings → Private Integrations →
   Create. Scope it to Contacts, Conversations, and Tags at minimum.
3. **A GHL contact record for yourself** — with your own WhatsApp number on
   it — so the middleware has a contactId to send your "lead ready" alerts
   to. Copy that contact's ID from the GHL URL when viewing it.
4. **An Anthropic API key** — console.anthropic.com.
5. **Somewhere to host this** — any Node-capable host works: Railway,
   Render, Fly.io, a small VPS, etc. It needs a public URL for GHL's
   webhooks to reach.

## Setup

```bash
npm install
cp .env.example .env
# fill in .env with your real values
npm start
```

This starts a server on the port in `.env` (default 3000) with one route:
`POST /webhook/ghl`.

## Wiring it into GHL

In GHL, set up a Workflow (or the native webhook action) that fires on the
events you care about — e.g. "Contact Created", "Form Submitted", or
"Inbound Message Received" — and add a **Webhook** action pointing at:

```
https://your-server.com/webhook/ghl
```

Add a custom header `x-webhook-secret: <the value from WEBHOOK_SHARED_SECRET>`
so random traffic can't hit your endpoint and trigger fake alerts.

**Important:** GHL's webhook payload shape differs depending on which
trigger fired. The `extractLeadFields()` function in `src/server.js` makes
reasonable guesses (`contact.phone`, `contact.postalCode`, etc.) but you
should log `req.body` once for a real event from your actual workflow and
adjust the field paths to match exactly. This is the one part that's
genuinely trial-and-error since GHL doesn't have a single canonical
webhook schema across all trigger types.

## How the decision logic works

1. Cheap keyword pre-filter (`ESTIMATE_INTENT_HINTS` in `src/config.js`)
   avoids burning a Claude API call on messages with zero chance of being
   an estimate request.
2. If it passes the pre-filter, Claude reads the actual message and
   returns a yes/no + one-sentence reason on whether they want an onsite
   estimate.
3. Location is checked against ZIP prefixes / city names for Miami-Dade,
   Broward, Palm Beach, Martin, and St. Lucie counties (`src/config.js`).
   This is an approximation, not a real geocoded radius — edit
   `SOFLO_ZIP_PREFIXES_CLEAN` or `SOFLO_CITIES` directly if you find gaps.
4. If both checks pass: the contact gets tagged `qualified-onsite-estimate`
   in GHL, and you get a WhatsApp message via `notifyOwnerLeadReady()`.

## Reply behavior

By default (`AUTO_REPLY_LIVE=false` in `.env`), Claude drafts a reply to
inbound messages but only logs it to your server console — nothing gets
sent to the lead. Once you've reviewed enough drafts and trust the tone,
set `AUTO_REPLY_LIVE=true` to have it send automatically via WhatsApp.

## Things to double check before relying on this

- **GHL API paths/versions do change.** The base URL and `Version` header
  in `src/ghlClient.js` reflect GHL's current public API as of this
  writing — verify against `marketplace.gohighlevel.com/docs` if calls
  start failing.
- **Rate limits / costs**: every qualifying message triggers a Claude API
  call. Fine at lead volumes most small businesses see, but worth knowing.
- **False negatives**: the ZIP/city list is manually curated — if a real
  lead in your area gets missed, it's almost certainly a ZIP/city not yet
  in `src/config.js`. Add it and redeploy.
