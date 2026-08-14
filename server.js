require("dotenv").config();
const express = require("express");
const { isInServiceArea, ESTIMATE_INTENT_HINTS } = require("./config");
const { classifyEstimateIntent, draftReply } = require("./claudeClient");
const { addTagToContact, sendWhatsAppMessage } = require("./ghlClient");
const { notifyOwnerLeadReady } = require("./notify");

const app = express();
app.use(express.json());

const AUTO_REPLY_LIVE = process.env.AUTO_REPLY_LIVE === "true";

// Simple shared-secret check so random traffic can't hit this endpoint.
// Set the same value as a custom header in GHL's webhook config.
function verifyWebhook(req, res, next) {
  const secret = req.headers["x-webhook-secret"];
  if (!process.env.WEBHOOK_SHARED_SECRET || secret === process.env.WEBHOOK_SHARED_SECRET) {
    return next();
  }
  return res.status(401).json({ error: "unauthorized" });
}

/**
 * Pulls the fields we care about out of a GHL webhook payload.
 * GHL's payload shape varies by trigger type (contact created vs.
 * inbound message vs. form submitted) — adjust these paths to match
 * whatever your specific workflow/webhook sends. Log req.body once in
 * a real event to confirm the exact shape, then tighten this up.
 */
function extractLeadFields(body) {
  const contact = body.contact || body;
  return {
    contactId: contact.id || contact.contactId || body.contactId,
    name:
      contact.name ||
      [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
      undefined,
    phone: contact.phone,
    zip: contact.postalCode || contact.zip,
    city: contact.city,
    address: [contact.address1, contact.city, contact.state, contact.postalCode]
      .filter(Boolean)
      .join(", "),
    messageText:
      body.message?.body || body.messageBody || body.message || contact.message || "",
  };
}

function looksLikeEstimateRequest(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return ESTIMATE_INTENT_HINTS.some((hint) => lower.includes(hint));
}

app.post("/webhook/ghl", verifyWebhook, async (req, res) => {
  // Acknowledge immediately so GHL doesn't retry/timeout; do the real work after.
  res.status(200).json({ received: true });

  try {
    const lead = extractLeadFields(req.body);
    if (!lead.contactId) {
      console.warn("Webhook payload missing contact id, skipping:", req.body);
      return;
    }

    const inArea = isInServiceArea({ zip: lead.zip, city: lead.city });

    // Cheap keyword pre-filter before spending a Claude call. If there's no
    // message text at all (e.g. a bare "contact created" event with no
    // message yet), skip intent classification for now.
    let wantsEstimate = false;
    let reason = "";
    if (lead.messageText && looksLikeEstimateRequest(lead.messageText)) {
      const result = await classifyEstimateIntent({
        messageText: lead.messageText,
        contactName: lead.name,
      });
      wantsEstimate = result.wantsEstimate;
      reason = result.reason;
    }

    console.log(
      `Lead ${lead.contactId} (${lead.name || "unknown"}): inArea=${inArea} wantsEstimate=${wantsEstimate} reason="${reason}"`
    );

    if (inArea && wantsEstimate) {
      await addTagToContact(lead.contactId, "qualified-onsite-estimate");
      await notifyOwnerLeadReady({
        name: lead.name,
        phone: lead.phone,
        address: lead.address,
      });
    }

    // Reply handling: draft-only by default, live send if enabled.
    if (lead.messageText) {
      const reply = await draftReply({
        messageText: lead.messageText,
        contactName: lead.name,
      });

      if (AUTO_REPLY_LIVE) {
        await sendWhatsAppMessage(lead.contactId, reply);
      } else {
        console.log(`[DRAFT REPLY - not sent] To ${lead.contactId}: ${reply}`);
      }
    }
  } catch (err) {
    console.error("Error processing GHL webhook:", err.response?.data || err.message);
  }
});

app.get("/health", (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`GHL <-> Claude middleware listening on :${port}`));
