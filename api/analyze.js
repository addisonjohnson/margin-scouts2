// Vercel serverless function: POST /api/analyze
// Body: { productName: "bamboo cutting board" }
// Requires RAINFOREST_API_KEY in the Vercel environment.

const MAX_PRODUCT_NAME_LENGTH = 200;

function parseRecentSales(value) {
  if (typeof value !== 'string') return 0;

  const match = value.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*([kKmM])?\+?\s*bought/i);
  if (!match) return 0;

  const amount = Number(match[1]);
  const multiplier = match[2]?.toLowerCase() === 'k' ? 1_000 : match[2]?.toLowerCase() === 'm' ? 1_000_000 : 1;
  return Math.round(amount * multiplier);
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;

  const number = Number(typeof value === 'string' ? value.replace(/,/g, '') : value);
  return Number.isFinite(number) ? number : null;
}

function calculateOpportunityScore(listings) {
  if (listings.length === 0) return 0;

  const competitorScore = Math.max(0, 100 - Math.min(listings.length, 50) * 2);
  const averageRatingsTotal = listings.reduce((sum, listing) => sum + listing.ratingsTotal, 0) / listings.length;
  const reviewScore = Math.max(0, 100 - Math.min(averageRatingsTotal, 10_000) / 100);
  const averageRecentSales = listings.reduce((sum, listing) => sum + listing.recentSales, 0) / listings.length;
  const demandScore = Math.min(100, (averageRecentSales / 1_000) * 20);

  const prices = listings.map((listing) => listing.price).filter((price) => price !== null);
  const meanPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
  const priceVariance = prices.length > 1 && meanPrice > 0
    ? Math.sqrt(prices.reduce((sum, price) => sum + (price - meanPrice) ** 2, 0) / prices.length) / meanPrice
    : 0;
  const priceOpportunityScore = Math.min(100, priceVariance * 200);

  return Math.round(
    competitorScore * 0.35 +
    reviewScore * 0.25 +
    demandScore * 0.25 +
    priceOpportunityScore * 0.15
  );
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { productName } = req.body || {};
  if (
    typeof productName !== 'string' ||
    productName.trim().length === 0 ||
    productName.length > MAX_PRODUCT_NAME_LENGTH
  ) {
    return res.status(400).json({ error: 'productName must be a non-empty string up to 200 characters' });
  }

  if (!process.env.RAINFOREST_API_KEY) {
    console.error('RAINFOREST_API_KEY is not configured');
    return res.status(500).json({ error: 'Product analysis is not configured' });
  }

  const url = new URL('https://api.rainforestapi.com/request');
  url.search = new URLSearchParams({
    api_key: process.env.RAINFOREST_API_KEY,
    type: 'search',
    amazon_domain: 'amazon.com',
    search_term: productName.trim(),
  }).toString();

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error('Rainforest API error:', response.status);
      return res.status(502).json({ error: 'Product search provider request failed' });
    }

    const payload = await response.json();
    const topListings = (Array.isArray(payload.search_results) ? payload.search_results : [])
      .filter((listing) => listing && listing.sponsored !== true)
      .map((listing) => ({
        title: typeof listing.title === 'string' ? listing.title : null,
        asin: typeof listing.asin === 'string' ? listing.asin : null,
        rating: toFiniteNumber(listing.rating),
        ratingsTotal: toFiniteNumber(listing.ratings_total) ?? 0,
        price: toFiniteNumber(listing.price?.value),
        recentSales: parseRecentSales(listing.recent_sales),
      }));

    const prices = topListings.map((listing) => listing.price).filter((price) => price !== null);
    const avgPrice = prices.length
      ? Number((prices.reduce((sum, price) => sum + price, 0) / prices.length).toFixed(2))
      : null;

    return res.status(200).json({
      opportunityScore: calculateOpportunityScore(topListings),
      topListings,
      avgPrice,
      competitorCount: topListings.length,
    });
  } catch (error) {
    console.error('analyze error:', error);
    return res.status(502).json({ error: 'Failed to retrieve product analysis' });
  }
};

module.exports.parseRecentSales = parseRecentSales;
module.exports.calculateOpportunityScore = calculateOpportunityScore;
