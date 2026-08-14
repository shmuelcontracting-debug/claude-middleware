// --------------------------------------------------------------------------
// Service area definition: Homestead -> Port St. Lucie corridor
// (Miami-Dade, Broward, Palm Beach, Martin, St. Lucie counties)
//
// This is an approximate ZIP-prefix list, not a precise geocoded radius.
// It's deliberately simple so it's easy for you to edit. If a lead's ZIP
// isn't in this list but you know it should be (or shouldn't be), just
// add/remove it below.
// --------------------------------------------------------------------------

// 3-digit ZIP prefixes covering Miami-Dade through St. Lucie county.
// e.g. "330" matches any ZIP starting with 330 (33010, 33012, 33099, etc.)
const SOFLO_ZIP_PREFIXES_CLEAN = [
  "330", "331", "332", "333", // Miami-Dade
  "334", "335", "336",        // Broward / south Palm Beach
  "337",                      // Palm Beach
  "349",                      // Martin & St. Lucie (Stuart, Port St. Lucie, Fort Pierce)
];

// Known city names as a backup check, in case a ZIP is missing/malformed
// on the lead record but the city name came through.
const SOFLO_CITIES = [
  "homestead", "florida city", "miami", "hialeah", "kendall", "doral",
  "coral gables", "aventura", "north miami beach", "north miami",
  "hollywood", "fort lauderdale", "pembroke pines", "miramar",
  "coral springs", "pompano beach", "deerfield beach",
  "boca raton", "delray beach", "boynton beach", "west palm beach",
  "jupiter", "palm beach gardens", "wellington", "lake worth",
  "stuart", "port st. lucie", "port saint lucie", "fort pierce", "vero beach",
];

function isInServiceArea({ zip, city }) {
  if (zip) {
    const prefix = String(zip).trim().slice(0, 3);
    if (SOFLO_ZIP_PREFIXES_CLEAN.includes(prefix)) return true;
  }
  if (city) {
    const c = String(city).trim().toLowerCase();
    if (SOFLO_CITIES.some((known) => c.includes(known))) return true;
  }
  return false;
}

// Keywords used as a cheap pre-filter before calling Claude (not the final
// decision — Claude reads the actual message for real intent). This just
// avoids wasting API calls on obvious non-leads.
const ESTIMATE_INTENT_HINTS = [
  "estimate", "quote", "quote request", "onsite", "on-site", "on site",
  "come out", "come look", "come by", "assessment", "inspection",
  "how much", "pricing", "price", "consult", "consultation",
];

module.exports = {
  isInServiceArea,
  ESTIMATE_INTENT_HINTS,
};
