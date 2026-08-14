const axios = require("axios");

// GHL's current public API base. Verify this against GHL's docs
// (marketplace.gohighlevel.com/docs) periodically — they do version bumps.
const GHL_API_BASE = "https://services.leadconnectorhq.com";
const GHL_API_VERSION = "2021-07-28";

function ghlHeaders() {
  return {
    Authorization: `Bearer ${process.env.GHL_API_TOKEN}`,
    Version: GHL_API_VERSION,
    "Content-Type": "application/json",
  };
}

async function getContact(contactId) {
  const res = await axios.get(`${GHL_API_BASE}/contacts/${contactId}`, {
    headers: ghlHeaders(),
  });
  return res.data.contact;
}

async function addTagToContact(contactId, tag) {
  await axios.post(
    `${GHL_API_BASE}/contacts/${contactId}/tags`,
    { tags: [tag] },
    { headers: ghlHeaders() }
  );
}

/**
 * Send a WhatsApp message to a given GHL contact (works for both real
 * leads and for your own "owner" contact used for self-notifications).
 */
async function sendWhatsAppMessage(contactId, message) {
  await axios.post(
    `${GHL_API_BASE}/conversations/messages`,
    {
      type: "WhatsApp",
      contactId,
      message,
    },
    { headers: ghlHeaders() }
  );
}

module.exports = { getContact, addTagToContact, sendWhatsAppMessage };
