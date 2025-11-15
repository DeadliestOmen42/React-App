# AI Music Generation Setup

This app now supports **real AI music generation** using Meta's AudioCraft (MusicGen) model.

## 🎵 What is MusicGen?

MusicGen is a transformer-based model from Meta AI that generates high-quality music from text descriptions. It can create:
- Complete songs with melody, harmony, and rhythm
- Various genres (pop, rock, jazz, electronic, etc.)
- Different moods and tempos
- Instrument-specific compositions

## 📦 Installation

### Option 1: Quick Install (CPU)

```bash
cd /workspaces/React-App/audio-processor
pip install -r requirements-ml.txt
```

For CPU-only (faster install, slower generation):
```bash
pip install torch torchaudio audiocraft --index-url https://download.pytorch.org/whl/cpu
```

### Option 2: GPU Install (Recommended for Production)

If you have NVIDIA GPU with CUDA:
```bash
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118
pip install audiocraft
```

## 🚀 Model Sizes

MusicGen comes in three sizes:

| Model | Parameters | Memory | Quality | Generation Speed |
|-------|-----------|---------|---------|------------------|
| **small** | 300M | ~2GB RAM | Good | Fast (~10s for 20s audio) |
| **medium** | 1.5B | ~8GB RAM | Better | Moderate (~30s) |
| **large** | 3.3B | ~16GB RAM | Best | Slow (~60s) |

**Default:** The app uses `small` for fast generation suitable for development.

## 🔧 Usage

### From Command Line

Generate music from description:
```bash
python3 musicgen_generator.py generate_description "upbeat pop song with piano" 20 small
```

Generate from lyrics:
```bash
python3 musicgen_generator.py generate "I love you" pop 120 "C major"
```

Check installation:
```bash
python3 musicgen_generator.py check
```

### From the Web App

1. Start the servers: `./start-servers.sh`
2. Open http://localhost:5173
3. Click "Generate Lyrics" or paste your own
4. Click "Create Song from Lyrics"
5. Wait 10-30 seconds for AI generation
6. Listen to your AI-generated song!

## ⚙️ Configuration

Edit `server/index.cjs` to change the model:

```javascript
// Change model size: 'small', 'medium', or 'large'
const python = spawn('python3', [
    pythonScriptPath,
    'generate',
    lyrics,
    genre,
    tempo,
    key,
    'small'  // Change this
]);
```

## 🎯 How It Works

1. **Lyrics Input** → User provides lyrics and song parameters (genre, tempo, key)
2. **Prompt Engineering** → System creates a rich text description:
   - "fast pop song in C major, emotional and heartfelt, with synths and modern production"
3. **AI Generation** → MusicGen model generates audio (10-30 seconds)
4. **Post-Processing** → Audio is normalized and converted to WAV
5. **Delivery** → Frontend plays the generated audio

## 🔍 Technical Details

### Model Architecture
- **Type:** Transformer-based language model for music
- **Training:** Trained on 20,000 hours of licensed music
- **Output:** 32kHz stereo audio
- **Context:** Can generate up to 30 seconds in one pass

### Performance
- **CPU:** ~30 seconds to generate 20 seconds of audio (small model)
- **GPU (CUDA):** ~5-10 seconds (small model)
- **Memory:** ~2GB for small model

### Fallback Behavior
If MusicGen dependencies are not installed, the system will:
1. Check for dependencies
2. Return an error with installation instructions
3. Allow the app to continue working with other features

## 🐛 Troubleshooting

### "Missing dependencies" error
```bash
cd audio-processor
pip install torch torchaudio audiocraft
```

### Out of Memory (OOM)
- Use the `small` model
- Reduce generation duration to 10-15 seconds
- Close other applications

### Slow generation
- Use GPU if available
- Install xformers for faster attention: `pip install xformers`
- Use smaller model size

### CUDA not available
```bash
# Check PyTorch CUDA status
python3 -c "import torch; print(f'CUDA: {torch.cuda.is_available()}')"

# Reinstall with CUDA support
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118
```

## 📚 Resources

- [AudioCraft GitHub](https://github.com/facebookresearch/audiocraft)
- [MusicGen Paper](https://arxiv.org/abs/2306.05284)
- [Demo Site](https://huggingface.co/spaces/facebook/MusicGen)

## 🔄 Alternative Models

If you want to try other models:

### Riffusion (Stable Diffusion for Music)
```bash
pip install riffusion
```

### AudioLDM (Text-to-Audio)
```bash
pip install audioldm
```

### Jukebox (OpenAI)
```bash
pip install jukebox
# Warning: Requires 16GB+ RAM and is very slow
```

## ⚡ Quick Test

Test the ML backend:
```bash
python3 audio-processor/musicgen_generator.py check
python3 audio-processor/musicgen_generator.py generate_description "happy piano melody" 10 small
```

If successful, you'll get a JSON response with `success: true` and an audio file path.

## 🎨 Prompt Engineering Tips

Better prompts = better music. Try:

- **Be specific:** "upbeat 80s synthwave with driving bassline"
- **Mention instruments:** "acoustic guitar ballad with soft drums"
- **Add mood:** "melancholic piano piece, slow and emotional"
- **Genre mixing:** "jazz-fusion with electronic elements"
- **Reference style:** "90s grunge rock, distorted guitars"

## 💡 Production Deployment

For production use:

1. **Use GPU servers** (AWS g4dn, GCP with T4/V100)
2. **Cache generated songs** (store by lyrics hash)
3. **Use medium or large model** for better quality
4. **Implement queue system** (generation can take time)
5. **Add rate limiting** (prevent abuse)
6. **Consider API services** like Replicate or Hugging Face Inference API

## 🎵 Example Generations

With the lyrics "I love you more each day":
- **Pop:** Upbeat synth melody, 120 BPM
- **Rock:** Electric guitars, driving drums
- **Jazz:** Smooth piano, walking bass
- **Electronic:** Atmospheric pads, electronic beats

Generation time: ~10-20 seconds per song (small model, CPU)
