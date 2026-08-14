const axios = require("axios");

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6"; // update if you want a different model

async function callClaude(systemPrompt, userMessage) {
  const res = await axios.post(
    ANTHROPIC_API_URL,
    {
      model: MODEL,
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    },
    {
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
    }
  );
  const block = res.data.content.find((c) => c.type === "text");
  return block ? block.text : "";
}

/**
 * Ask Claude whether this inbound message is someone wanting an onsite
 * estimate/quote/inspection, as opposed to spam, a general question,
 * a vendor pitch, wrong number, etc.
 *
 * Returns { wantsEstimate: boolean, reason: string }
 */
async function classifyEstimateIntent({ messageText, contactName }) {
  const system = `You are triaging inbound messages for a home-service contractor.
Decide if the message is from someone who wants an ONSITE ESTIMATE, QUOTE, or
INSPECTION for work at their property (fence/gate install, repair, etc. - or
whatever service context is implied). This does NOT include: general
questions with no request for a visit, spam/marketing, wrong numbers,
job applicants, or vendors trying to sell something.

Respond with ONLY valid JSON, no other text, in this exact shape:
{"wantsEstimate": true or false, "reason": "one short sentence"}`;

  const user = `Contact name: ${contactName || "unknown"}
Message: """${messageText}"""`;

  const raw = await callClaude(system, user);
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      wantsEstimate: Boolean(parsed.wantsEstimate),
      reason: parsed.reason || "",
    };
  } catch (err) {
    console.error("Failed to parse Claude classification response:", raw);
    return { wantsEstimate: false, reason: "parse_error" };
  }
}

/**
 * Draft (but do not send) a reply to an inbound lead message. Used when
 * AUTO_REPLY_LIVE is false, so you can review what Claude would have said.
 */
async function draftReply({ messageText, contactName }) {
  const system = `You are drafting a short, friendly SMS/WhatsApp reply on
behalf of a home-service contractor to a prospective customer. Keep it under
400 characters, warm but professional, and if they want an estimate,
confirm that and ask for their address and a couple of times that work for
an onsite visit. Do not invent availability, pricing, or promises you can't
verify. Output ONLY the reply text, nothing else.`;

  const user = `Contact name: ${contactName || "there"}
Their message: """${messageText}"""`;

  return callClaude(system, user);
}

module.exports = { classifyEstimateIntent, draftReply };
