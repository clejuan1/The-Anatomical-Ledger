// liaison/server.js
// Minimal Node/Express proxy for /api/liaison
// - Keeps API key server-side (process.env.GEN_AI_KEY)
// - Proxies client messages to Google's Generative API (example)
// - Do NOT commit your keys. Use Secret Manager or env vars in production.

const express = require('express');
const fetch = require('node-fetch'); // If Node >=18 you can use global fetch
const rateLimit = require('express-rate-limit');
const app = express();
app.use(express.json());

// Basic rate limiting to reduce accidental key exposure via abuse
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 requests per windowMs
});
app.use(limiter);

// Simple health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// /api/liaison endpoint
app.post('/api/liaison', async (req, res) => {
  const message = (req.body && req.body.message) || '';
  if (!message) return res.status(400).json({ error: 'missing message' });

  // Read key from env var (or integrate with Secret Manager)
  const key = process.env.GEN_AI_KEY;
  if (!key) return res.status(500).json({ error: 'server misconfigured: missing GEN_AI_KEY' });

  try {
    // Example: Google Generative Language REST (keep payload shape aligned to your version)
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-mini:generateText?key=${key}`;

    const payload = {
      // Adapt to the API you are using. This example uses a simple text generation shape.
      prompt: {
        text: message
      },
      // Optional: tune temperature, max output tokens
      temperature: 0.2,
      maxOutputTokens: 512
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Generative API error', response.status, text);
      return res.status(502).json({ error: 'upstream generative API error' });
    }

    const json = await response.json();

    // Example: extract reply depending on the API's response structure
    // Adjust the extraction to match your exact response shape (candidates/outputs/choices etc.)
    const reply = json.candidates?.[0]?.output || json.output?.[0]?.content || json.output?.[0]?.text || JSON.stringify(json);

    return res.json({ response_text: reply });
  } catch (err) {
    console.error('liaison proxy error', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Liaison server listening on ${PORT}`));
