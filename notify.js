const { sendWhatsAppMessage } = require("./ghlClient");

async function notifyOwnerLeadReady({ name, phone, address }) {
  const message = [
    "🟢 Lead ready for you",
    `Name: ${name || "Unknown"}`,
    `Phone: ${phone || "Unknown"}`,
    `Address: ${address || "Unknown"}`,
  ].join("\n");

  await sendWhatsAppMessage(process.env.OWNER_GHL_CONTACT_ID, message);
}

module.exports = { notifyOwnerLeadReady };
