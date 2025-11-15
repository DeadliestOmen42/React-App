# AI Music Studio - Now with Real AI Music Generation! 🎵🤖

Transform lyrics into professional music using Meta's AudioCraft (MusicGen) AI model.

## 🎯 What's New

This app now uses **real AI music generation** instead of basic synthesis:

- ✅ **MusicGen AI Model** - Meta's state-of-the-art music transformer
- ✅ **High-Quality Output** - Professional-sounding music from text descriptions
- ✅ **Genre Support** - Pop, Rock, Jazz, Electronic, and more
- ✅ **Automatic Fallback** - Uses basic synthesizer if ML dependencies not installed

## 🚀 Quick Start

### 1. Install AI Music Generation (Optional but Recommended)

```bash
./setup-musicgen.sh
```

This installs:
- PyTorch (with CUDA support if GPU available)
- AudioCraft (Meta's MusicGen)
- Optional accelerators (xformers, etc.)

**System Requirements:**
- Python 3.8+
- 4GB+ RAM (2GB for model, 2GB for generation)
- Optional: NVIDIA GPU with CUDA (5-10x faster generation)

### 2. Start the Application

```bash
./start-servers.sh
```

Open http://localhost:5173 in your browser.

### 3. Generate Music

1. Click "Generate Lyrics" or paste your own
2. Choose genre, tempo, and key
3. Click "Create Song from Lyrics"
4. Wait 10-30 seconds for AI generation
5. Listen to your AI-generated music!

## 📚 Documentation

- **[MUSIC_ML_SETUP.md](./MUSIC_ML_SETUP.md)** - Complete ML setup guide
- **[AI_SONG_GENERATION.md](./AI_SONG_GENERATION.md)** - Original audio features
- **[AUDIO_QUICK_START.md](./AUDIO_QUICK_START.md)** - Audio processing guide

## 🎵 How It Works

### With MusicGen (AI Mode)

1. **Input:** Lyrics + Genre + Tempo + Key
2. **Prompt Engineering:** System creates description
   - Example: "upbeat pop song in C major, emotional, with synths"
3. **AI Generation:** MusicGen generates 20 seconds of music
4. **Output:** Professional-quality audio

### Without MusicGen (Fallback Mode)

If ML dependencies aren't installed, the app uses basic synthesis:
- Rule-based melody generation
- Simple waveform synthesis
- Basic but functional

## ⚙️ Configuration

### Model Size

Edit `server/index.cjs` line ~395:

```javascript
const python = spawn('python3', [
    pythonScriptPath,
    'generate',
    lyrics,
    genre,
    tempo,
    key,
    'small'  // Options: 'small', 'medium', 'large'
]);
```

### Generation Duration

Default: 20 seconds (configurable in Python script)

## 🔍 Testing

### Test AI Backend

```bash
# Check installation
python3 audio-processor/musicgen_generator.py check

# Generate test music
python3 audio-processor/musicgen_generator.py generate_description "happy piano melody" 10 small

# Generate from lyrics
python3 audio-processor/musicgen_generator.py generate "I love you" pop 120 "C major"
```

### Test Full Stack

```bash
curl -X POST http://localhost:3000/api/compose-song \
  -H "Content-Type: application/json" \
  -d '{"lyrics":"Test lyrics","genre":"pop","tempo":120,"key":"C major"}' \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'Model: {d.get(\"model\")}, Duration: {d.get(\"duration\")}s')"
```

## 📊 Performance

| Configuration | Generation Time (20s audio) | Memory | Quality |
|--------------|----------------------------|---------|---------|
| Small model + CPU | ~20-30 seconds | 2GB | Good |
| Small model + GPU | ~5-10 seconds | 2GB | Good |
| Medium model + GPU | ~15-30 seconds | 8GB | Better |
| Large model + GPU | ~30-60 seconds | 16GB | Best |

## 🐛 Troubleshooting

### "Missing dependencies" error

Install ML dependencies:
```bash
./setup-musicgen.sh
# or manually:
pip install torch torchaudio audiocraft
```

### Generation is slow

- Use GPU if available
- Reduce model size to 'small'
- Reduce duration to 10-15 seconds

### Out of memory

- Use 'small' model (requires ~2GB)
- Close other applications
- Reduce generation duration

### Still not working?

The app will automatically fall back to basic synthesis - all features will work, just without AI-generated music.

## 🎨 Tips for Better Results

### Good Prompts

The system converts your lyrics + parameters into prompts like:

- "upbeat pop song with synthesizers, emotional and heartfelt"
- "slow rock ballad with electric guitars, melancholic"
- "fast electronic dance music with driving beats"

### Genre Selection

- **Pop:** Synth-based, modern production
- **Rock:** Guitar-driven, energetic
- **Jazz:** Piano and saxophone, sophisticated
- **Electronic:** Synthesizers, electronic beats

### Tempo Guidelines

- Slow: 60-90 BPM (ballads)
- Moderate: 90-120 BPM (pop, rock)
- Fast: 120-180 BPM (dance, electronic)

## 🔄 Fallback Behavior

If MusicGen is not installed:
1. Backend checks for dependencies
2. Falls back to basic synthesizer
3. Returns error response with installation instructions
4. App continues working with basic synthesis

No features are broken - you just get simpler audio.

## 📦 What's Installed

### Python Packages

```
torch>=2.0.0          # Deep learning framework
torchaudio>=2.0.0     # Audio processing
audiocraft>=1.3.0     # MusicGen model
```

### Models Downloaded (on first use)

- MusicGen-small: ~300MB download
- MusicGen-medium: ~1.5GB download
- MusicGen-large: ~3.3GB download

Models are cached in `~/.cache/huggingface/`

## 🌐 Alternative Options

### Cloud-Based (No Local Installation)

If you don't want to install locally:

1. **Replicate API:** https://replicate.com/meta/musicgen
2. **Hugging Face Inference:** https://huggingface.co/facebook/musicgen-small

Update `server/index.cjs` to use API instead of local model.

### Other Models

See `MUSIC_ML_SETUP.md` for alternatives:
- Riffusion (Stable Diffusion for music)
- AudioLDM (text-to-audio)
- Jukebox (OpenAI - requires 16GB+ RAM)

## 📈 Roadmap

- [ ] Style transfer (apply existing song style)
- [ ] Longer generation (30-60 seconds)
- [ ] Vocal synthesis integration
- [ ] Real-time generation preview
- [ ] Custom model fine-tuning

## 💡 Production Notes

For production deployment:

1. Use GPU servers (AWS g4dn, GCP T4/V100)
2. Implement caching (store by lyrics hash)
3. Add queue system (generation takes time)
4. Rate limit API endpoints
5. Consider cloud APIs (Replicate, HF Inference)

## 📞 Support

Issues? Check:
1. `MUSIC_ML_SETUP.md` - Detailed troubleshooting
2. Backend logs: `tail -f /tmp/backend.log`
3. Test ML backend: `python3 audio-processor/musicgen_generator.py check`

## 🎵 Example Output

With lyrics "I love you more each day":

**MusicGen (AI):** Full song with melody, harmony, production - sounds like real music

**Fallback:** Simple tones and rhythms - functional but basic

**The difference is night and day!** 🌟
