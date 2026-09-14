// Shared "analysis" logic. This is the ONE place to change when you're
// ready to plug in real product data (Keepa / Jungle Scout / RapidAPI /
// Amazon SP-API) instead of the demo numbers. Everything that calls
// generateReport() elsewhere in the backend doesn't need to change —
// just make this function async and fetch real data inside it, then
// update the two callers (create-checkout-session.js doesn't need the
// report itself, only verify-session.js does) to `await` it.

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateReport(query) {
  const rand = seededRandom(hashString(query.toLowerCase().trim()));

  const score = Math.round(15 + rand() * 80);
  const searches = Math.round(500 + rand() * 45000);
  const competitionRaw = rand();
  const competitionLabel = competitionRaw < 0.33 ? "Low" : competitionRaw < 0.66 ? "Medium" : "High";
  const price = (8 + rand() * 42).toFixed(2);
  const margin = Math.round(20 + rand() * 45);
  const bars = Array.from({ length: 12 }, () => 20 + rand() * 80);

  const verdict = score >= 65 ? "go" : score >= 40 ? "caution" : "avoid";
  const verdictText = { go: "WORTH EXPLORING", caution: "PROCEED CAREFULLY", avoid: "TOUGH MARKET" }[verdict];

  const competitorNames = [
    "Generic 3rd-party listing, 4.1 stars, 200+ reviews",
    "Established brand, 4.6 stars, 3,000+ reviews — hard to unseat",
    "New seller, 3.8 stars, under 50 reviews — weak listing photos",
    "Mid-size brand, 4.3 stars, 800 reviews — no bundle offer",
    "Budget import, 3.5 stars, thin description — easy to outshine"
  ];

  return { score, searches, competitionLabel, price, margin, bars, verdict, verdictText, competitorNames };
}

module.exports = { generateReport };
