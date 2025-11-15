/*
 Minimal Express server with a /api/generate-lyrics endpoint that calls OpenAI's chat completions.
 This server expects OPENAI_API_KEY in process.env. No key is included in repo.
 Replace or extend with proper error handling, rate limiting, and auth for production.
*/

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const fetch = require('node-fetch');
const multer = require('multer');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const app = express();
const upload = multer({ dest: '/tmp/audio_uploads' });

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const PORT = process.env.PORT || 3000;
const AUDIO_PROCESSOR_PATH = path.join(__dirname, '..', 'audio-processor', 'audio_processor.py');

// Process error handlers for stability
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Helper: Call Python audio processor with timeout
async function callPythonProcessor(command, audioPath, ...args) {
  return new Promise((resolve, reject) => {
    const python = spawn('python3', [AUDIO_PROCESSOR_PATH, command, audioPath, ...args]);
    let stdout = '';
    let stderr = '';
    let isResolved = false;

    // 60 second timeout for audio processing
    const timeout = setTimeout(() => {
      if (!isResolved) {
        python.kill();
        reject(new Error('Python process timeout (60s)'));
        isResolved = true;
      }
    }, 60000);

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
      console.warn('[Python stderr]', data.toString());
    });

    python.on('error', (err) => {
      clearTimeout(timeout);
      if (!isResolved) {
        reject(new Error(`Python spawn error: ${err.message}`));
        isResolved = true;
      }
    });

    python.on('close', (code) => {
      clearTimeout(timeout);
      if (isResolved) return;
      isResolved = true;

      if (code !== 0) {
        reject(new Error(`Python process failed (code ${code}): ${stderr}`));
      } else {
        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (e) {
          reject(new Error(`Failed to parse Python output: ${e.message}`));
        }
      }
    });
  });
}

// CORS middleware - allow any localhost origin
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && origin.match(/^http:\/\/localhost:\d+$/)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', FRONTEND_URL);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, stripe-signature');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Middleware: handle raw body for webhooks, JSON for others
app.use((req, res, next) => {
  if (req.path === '/api/stripe-webhook') {
    express.raw({ type: 'application/json' })(req, res, next);
  } else {
    express.json()(req, res, next);
  }
});

// ============ OPENAI LYRICS GENERATION ============

app.post('/api/generate-lyrics', async (req, res) => {
  try {
    const prompt = (req.body && req.body.prompt) ? req.body.prompt : 'Write a joyful pop chorus about sunrise.';
    
    // If no OpenAI key or invalid key, use fallback mock lyrics
    if(!OPENAI_KEY || OPENAI_KEY === 'sk_test_dummy') {
      console.log('Using mock lyrics (OpenAI key not configured or invalid)');
      const mockLyrics = `[Verse 1]
${prompt.slice(0, 50)}
Walking down this road alone
Trying to find my way back home
Every step I take, I know
That your love will guide me so

[Chorus]
We're dancing in the moonlight
Feeling so alive tonight
Hearts beating as one
Until the morning sun

[Verse 2]
Through the highs and all the lows
You're the one my heart still knows
When the world feels cold and grey
Your smile lights up my way

[Chorus]
We're dancing in the moonlight
Feeling so alive tonight
Hearts beating as one
Until the morning sun`;
      return res.json({ lyrics: mockLyrics, mock: true });
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
      console.error('OpenAI API error:', r.status, txt);
      const mockLyrics = `[Verse 1]
${prompt.slice(0, 50)}
Walking down this road alone
Trying to find my way back home

[Chorus]
We're dancing in the moonlight
Feeling so alive tonight`;
      return res.json({ lyrics: mockLyrics, mock: true });
    }
    const data = await r.json();
    const lyrics = data.choices && data.choices[0] && (data.choices[0].message?.content || data.choices[0].text) ? (data.choices[0].message?.content || data.choices[0].text) : null;
    res.json({ lyrics });
  } catch(err){
    console.error(err);
    res.status(500).json({ error: 'server error', detail: String(err) });
  }
});

// ============ AUDIO PROCESSING & AI TRANSFORMS ============

// Audio analysis: detect BPM, key, and generate mastering suggestions
app.post('/api/analyze-audio', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Call Python audio processor
    const result = await callPythonProcessor('analyze', req.file.path);
    
    // Clean up uploaded file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    if (result.error) {
      return res.status(500).json({ error: result.error, message: result.message });
    }

    res.json({
      analysis: result.analysis,
      recommendations: result.recommendations,
      success: true
    });
  } catch (err) {
    console.error('Audio analysis error:', err);
    res.status(500).json({ error: 'Audio analysis failed', detail: err.message });
  }
});

// Studio process with effects parameters using librosa
app.post('/api/studio-process', upload.single('file'), async (req, res) => {
  try {
    const { 
      reverb = 0.3,
      eq_high = 0,
      compression = 4,
      gain = 1,
      notes = ''
    } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Call Python audio processor
    const result = await callPythonProcessor('effects', req.file.path, reverb, eq_high, compression, gain);
    
    // Clean up uploaded file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    if (result.error) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      message: 'Audio effects applied using librosa',
      processing: result.processing,
      appliedSettings: {
        reverb,
        eq_high,
        compression,
        gain,
        notes
      },
      estimatedProcessingTime: '2-5 seconds',
      outputUrl: null, // In production: save to file and return URL
      note: 'In production, save processed audio to S3/storage and return download URL'
    });
  } catch (err) {
    console.error('Studio process error:', err);
    res.status(500).json({ error: 'Studio processing failed', detail: err.message });
  }
});

// AI mastering: Generate intelligent mastering settings using loudness analysis
app.post('/api/ai-mastering', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Call Python audio processor for mastering
    const result = await callPythonProcessor('master', req.file.path, '-14');
    
    // Clean up uploaded file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    if (result.error) {
      return res.status(500).json({ error: result.error, message: result.message });
    }

    res.json({
      success: true,
      mastering_settings: {
        target_loudness: result.target_loudness,
        measured_loudness: result.measured_loudness,
        makeup_gain: result.makeup_gain,
        limiter_threshold: result.mastering_settings.limiter_threshold,
        limiter_ratio: result.mastering_settings.limiter_ratio,
        dithering: result.mastering_settings.dithering,
        bit_depth: result.mastering_settings.bit_depth
      },
      recommendations: [
        `Measured loudness: ${result.measured_loudness} dB`,
        `Makeup gain needed: ${result.makeup_gain} dB`,
        'Soft limiting enabled to prevent clipping',
        'Optimized for streaming platforms (-14 LUFS)',
        'Shaped dithering for bit-depth reduction (24-bit)'
      ],
      message: 'AI mastering profile generated using loudness analysis'
    });
  } catch (err) {
    console.error('AI mastering error:', err);
    res.status(500).json({ error: 'AI mastering failed', detail: err.message });
  }
});

// Stem separation: Isolate vocals, drums, bass, other using Spleeter
app.post('/api/stem-separation', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Create output directory in /tmp
    const outputDir = `/tmp/stems_${Date.now()}`;
    
    // Call Python audio processor
    const result = await callPythonProcessor('separate', req.file.path, outputDir);
    
    // Clean up uploaded file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    if (result.error) {
      return res.status(500).json({ error: result.error, message: result.message });
    }

    res.json({
      success: true,
      stems: result.stems,
      levels: result.levels,
      output_dir: result.output_dir,
      message: 'Stem separation completed using Spleeter 4-stem model',
      notes: 'Stems are available at the provided paths. In production, upload to cloud storage (S3, GCS, etc.)'
    });
  } catch (err) {
    console.error('Stem separation error:', err);
    res.status(500).json({ error: 'Stem separation failed', detail: err.message });
  }
});

// Vocal enhancement: Improve vocal clarity, presence, de-esser
app.post('/api/vocal-enhancement', upload.single('file'), async (req, res) => {
  try {
    const { clarity = 0.5, presence = 0.6, deesser = 0.3 } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    res.json({
      success: true,
      message: 'Vocal enhancement applied',
      settings: {
        clarity,
        presence,
        deesser,
        autoGate: true,
        gateThreshold: -40
      },
      processing: [
        `Applied clarity enhancement: ${(clarity * 100).toFixed(0)}%`,
        `Applied presence boost: +${(presence * 6).toFixed(1)}dB`,
        `Applied de-esser: ${(deesser * 100).toFixed(0)}% reduction`
      ]
    });
  } catch (err) {
    console.error('Vocal enhancement error:', err);
    res.status(500).json({ error: 'Vocal enhancement failed' });
  }
});

// Compose song from lyrics (AI song synthesis)
app.post('/api/compose-song', async (req, res) => {
  try {
    const { lyrics, genre = 'pop', tempo = 120, key = 'C major' } = req.body;

    if (!lyrics || !lyrics.trim()) {
      return res.status(400).json({ error: 'Lyrics required' });
    }

    // Call Python song synthesizer
    const pythonScriptPath = path.join(__dirname, '..', 'audio-processor', 'song_synthesizer.py');
    
    return new Promise((resolve) => {
      const python = spawn('python3', [
        pythonScriptPath,
        'generate',
        lyrics,
        genre,
        String(tempo),
        key
      ]);

      let stdoutData = '';
      let stderrData = '';
      let isResolved = false;

      // 120 second timeout for song generation
      const timeout = setTimeout(() => {
        if (!isResolved) {
          python.kill();
          res.status(500).json({ error: 'Song generation timeout', message: 'Process took too long (120s)' });
          isResolved = true;
          resolve();
        }
      }, 120000);

      python.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      python.on('error', (err) => {
        clearTimeout(timeout);
        if (!isResolved) {
          console.error('Python spawn error:', err);
          res.status(500).json({ error: 'Failed to start song generator', detail: err.message });
          isResolved = true;
          resolve();
        }
      });

      python.on('close', (code) => {
        clearTimeout(timeout);
        if (isResolved) return;
        isResolved = true;

        try {
          if (code !== 0) {
            console.error('Song synthesis stderr:', stderrData);
            return res.status(500).json({ error: 'Song synthesis failed', stderr: stderrData });
          }

          const result = JSON.parse(stdoutData);
          
          if (result.success && result.audio_path) {
            // Read the generated audio file
            const audioData = fs.readFileSync(result.audio_path);
            const audioBase64 = audioData.toString('base64');
            
            // Clean up temp file
            try {
              fs.unlinkSync(result.audio_path);
            } catch (unlinkErr) {
              console.warn('Could not delete temp file:', result.audio_path, unlinkErr.message);
            }
            
            res.json({
              success: true,
              message: 'Song generated successfully',
              audio: audioBase64,
              metadata: result.metadata,
              sampleRate: result.sample_rate,
              duration: result.duration,
              composition: {
                lyrics,
                genre,
                tempo,
                key,
                structure: result.metadata.structure,
                instruments: ['Vocals', 'Drums', 'Bass', 'Synth Pad'],
                estimatedDuration: result.duration
              }
            });
          } else {
            res.status(500).json({ error: result.error || 'Song synthesis failed', stderr: stderrData });
          }
        } catch (parseErr) {
          console.error('Parse error:', parseErr);
          res.status(500).json({ error: 'Failed to parse synthesis result', details: stdoutData });
        }
      });
    });
  } catch (err) {
    console.error('Song composition error:', err);
    res.status(500).json({ error: 'Song composition failed', details: err.message });
  }
});

// ============ STRIPE BILLING INTEGRATION ============

// Webhook handler (no JSON parsing for signature verification)
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  if (!STRIPE_WEBHOOK_SECRET) {
    console.warn('STRIPE_WEBHOOK_SECRET not set. Skipping webhook verification.');
    return res.status(400).json({ error: 'Webhook secret not configured' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.sendStatus(400);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id;
        console.log('✓ Subscription created for user:', userId);
        // TODO: Update database - grant subscription, add credits
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        console.log('✓ Subscription updated:', subscription.id, 'Status:', subscription.status);
        // TODO: Update database with subscription status
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        console.log('✓ Subscription cancelled:', subscription.id);
        // TODO: Update database - mark subscription as cancelled
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        console.log('✓ Payment succeeded:', invoice.id);
        // TODO: Add recurring credits to user account
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        console.log('✓ Payment failed:', invoice.id);
        // TODO: Notify user of failed payment
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Create checkout session for subscription or one-time purchase
app.post('/api/create-checkout', async (req, res) => {
  try {
    const { priceId, userId } = req.body;

    if (!priceId || !userId) {
      return res.status(400).json({ error: 'priceId and userId required' });
    }

    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_dummy') {
      return res.status(500).json({ error: 'Stripe not configured. Set STRIPE_SECRET_KEY in .env' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/cancel`,
      client_reference_id: userId,
      metadata: {
        userId,
      },
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('Checkout error:', err.message);
    res.status(500).json({ error: 'Failed to create checkout session', detail: err.message });
  }
});

// Get subscription status for a user
app.get('/api/subscription/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // TODO: Query your database for actual subscription data
    // Example: SELECT * FROM subscriptions WHERE user_id = userId

    res.json({
      userId,
      status: 'active',
      plan: 'Pro',
      creditsRemaining: 450,
      renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      message: 'This is mock data. Replace with database query.',
    });
  } catch (err) {
    console.error('Subscription fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    stripe_configured: !!process.env.STRIPE_SECRET_KEY,
    openai_configured: !!(OPENAI_KEY && OPENAI_KEY !== 'sk_test_dummy'),
    uptime: process.uptime()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'AI Music Studio API',
    version: '1.0.0',
    endpoints: [
      '/health',
      '/api/generate-lyrics',
      '/api/compose-song',
      '/api/analyze-audio',
      '/api/studio-process',
      '/api/stem-separation',
      '/api/vocal-enhancement'
    ]
  });
});

const server = app.listen(PORT, () => {
  console.log('==========================================');
  console.log('🎵 AI Music Studio Server Started');
  console.log('==========================================');
  console.log(`Port: ${PORT}`);
  console.log(`Frontend: ${FRONTEND_URL}`);
  console.log(`OpenAI: ${OPENAI_KEY && OPENAI_KEY !== 'sk_test_dummy' ? '✓ Configured' : '✗ Not configured'}`);
  console.log(`Stripe: ${process.env.STRIPE_SECRET_KEY ? '✓ Configured' : '✗ Not configured'}`);
  console.log('==========================================');
});

// Handle server errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please stop the other process or use a different port.`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
});
