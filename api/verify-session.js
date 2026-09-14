// Vercel serverless function: GET /api/verify-session?session_id=cs_test_...
// Returns: { query, report }  — only if Stripe confirms payment succeeded.
//
// This is the step that closes the "anyone can fake the URL" hole from
// the MVP version: the report is generated here, server-side, and only
// after asking Stripe directly whether this session was actually paid.

const Stripe = require('stripe');
const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;
const { generateReport } = require('./_report');

module.exports = async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe is not configured' });
  }

  const sessionId = req.query.session_id;
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing session_id' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return res.status(402).json({ error: 'Payment not completed' });
    }

    const query = session.metadata && session.metadata.query ? session.metadata.query : 'your product';
    const report = generateReport(query); // swap for a real data fetch when ready

    res.status(200).json({ query, report });
  } catch (err) {
    console.error('verify-session error:', err);
    res.status(500).json({ error: 'Could not verify payment' });
  }
};
