/*
 Minimal Express server with a /api/generate-lyrics endpoint that calls OpenAI's chat completions.
 This server expects OPENAI_API_KEY in process.env. No key is included in repo.
 Replace or extend with proper error handling, rate limiting, and auth for production.
*/

const express = require('express');
const fetch = require('node-fetch');
const multer = require('multer');
const path = require('path');
const app = express();
const upload = multer();
app.use(express.json());

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const PORT = process.env.PORT || 3000;

app.post('/api/generate-lyrics', async (req, res) => {
  try {
    const prompt = (req.body && req.body.prompt) ? req.body.prompt : 'Write a joyful pop chorus about sunrise.';
    if(!OPENAI_KEY){
      return res.status(500).json({ error: 'OPENAI_API_KEY not set on server. See README.' });
    }
    // Calls OpenAI Chat Completions (gpt-4 or gpt-3.5-turbo)
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that writes song lyrics. Keep structure and rhymes in mind.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 400
      })
    });
    if(!r.ok){
      const txt = await r.text();
      return res.status(500).json({ error: 'OpenAI error', detail: txt });
    }
    const data = await r.json();
    const lyrics = data.choices && data.choices[0] && (data.choices[0].message?.content || data.choices[0].text) ? (data.choices[0].message?.content || data.choices[0].text) : null;
    res.json({ lyrics });
  } catch(err){
    console.error(err);
    res.status(500).json({ error: 'server error', detail: String(err) });
  }
});

// Simple mocked studio process endpoint (no real audio processing)
app.post('/api/studio-process', upload.single('file'), (req, res) => {
  // This returns the same uploaded file URL if you implement file storage.
  res.json({ processedUrl: null, message: 'Studio processing is mocked in this prototype. Replace with real processing.' });
});

app.listen(PORT, ()=> console.log('Server listening on port', PORT));
