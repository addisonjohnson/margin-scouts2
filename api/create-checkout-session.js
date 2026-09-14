// Vercel serverless function: POST /api/create-checkout-session
// Body: { query: "bamboo cutting board" }
// Returns: { url: "https://checkout.stripe.com/..." }
//
// Requires an environment variable STRIPE_SECRET_KEY set in your
// Vercel project settings (Settings > Environment Variables).

const Stripe = require('stripe');
const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!stripe) {
    return res.status(500).json({ error: 'Stripe is not configured' });
  }

  const { query } = req.body || {};
  if (!query || typeof query !== 'string' || query.trim().length === 0 || query.length > 100) {
    return res.status(400).json({ error: 'Missing or invalid product query' });
  }

  try {
    const origin = process.env.SITE_URL;
    if (!origin) {
      return res.status(500).json({ error: 'Site URL is not configured' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: `Product research report: ${query}` },
            unit_amount: 499, // $4.99
          },
          quantity: 1,
        },
      ],
      metadata: { query },
      success_url: `${origin}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?canceled=1`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('create-checkout-session error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
};
