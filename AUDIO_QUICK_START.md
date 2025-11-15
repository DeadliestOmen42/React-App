# Audio Processing Quick Start

## 🚀 Installation (5 minutes)

### Step 1: Install Audio Libraries
```bash
chmod +x /workspaces/React-App/setup-audio.sh
./setup-audio.sh
```

This installs:
- ✅ Librosa (BPM/key detection)
- ✅ Spleeter (stem separation)
- ✅ Essentia (audio features)
- ✅ Pedalboard (audio effects)

### Step 2: Verify Installation
```bash
python3 /workspaces/React-App/audio-processor/audio_processor.py
# Should show usage info
```

### Step 3: Start the Server
```bash
cd /workspaces/React-App
npm run server
# Or in another terminal: npm run dev
```

## 📊 What You Get

### 1. **Audio Analysis** (`POST /api/analyze-audio`)
Upload an MP3 and get:
- 🎵 BPM (tempo detection)
- 🎼 Musical Key
- 📈 Loudness (dB)
- 💃 Danceability (0-1)
- 🎻 Acousticness (0-1)
- ⏱️ Duration
- 🔊 Spectral analysis

### 2. **Stem Separation** (`POST /api/stem-separation`)
Separate into 4 stems:
- 🎤 Vocals
- 🥁 Drums
- 🎸 Bass
- ✨ Other (synths, strings, etc.)

### 3. **AI Mastering** (`POST /api/ai-mastering`)
Professional mastering:
- 📊 Loudness measurement (-14 LUFS standard)
- 🎚️ Automatic gain correction
- 🔒 Soft limiting
- 📻 Streaming platform optimization

### 4. **Audio Effects** (`POST /api/studio-process`)
Apply effects:
- 🌊 Reverb (0-100%)
- 🎛️ EQ (±12dB)
- 🎙️ Compression (1-8:1)
- 📈 Gain (0.5-2.0x)

## 🧪 Test It

### Test Audio Analysis
```bash
curl -X POST -F "file=@/path/to/song.mp3" http://localhost:3000/api/analyze-audio
```

### Test Stem Separation
```bash
curl -X POST -F "file=@/path/to/song.mp3" http://localhost:3000/api/stem-separation
```

### Test AI Mastering
```bash
curl -X POST -F "file=@/path/to/song.mp3" http://localhost:3000/api/ai-mastering
```

## 📝 Backend Architecture

```
React UI (Audio Upload)
    ↓
Express Server (Node.js)
    ↓ (spawns child process)
Python Audio Processor
    ↓
Librosa / Spleeter / Essentia
    ↓
Process Result
    ↓
JSON Response
    ↓
React UI (Display Results)
```

## 🔧 How It Works

1. User uploads audio in React UI
2. Express receives file → saves to `/tmp/`
3. Server spawns Python process with command
4. Python processes using Librosa/Spleeter
5. Results returned as JSON
6. Temp file deleted
7. React displays results

## ⚡ Performance

| Operation | Time | CPU | Memory |
|-----------|------|-----|--------|
| Analysis | 2-5s | Low | 500MB |
| Stem Sep | 30-60s | High | 2-3GB |
| Mastering | 1-2s | Low | 200MB |
| Effects | 2-5s | Medium | 500MB |

## 🐛 Troubleshooting

### ImportError: No module named 'librosa'
```bash
pip3 install librosa
```

### ImportError: No module named 'spleeter'
```bash
pip3 install tensorflow spleeter
```

### FFmpeg not found
```bash
# macOS
brew install ffmpeg

# Ubuntu
sudo apt-get install ffmpeg

# Windows: Download from https://ffmpeg.org/
```

### Stem separation takes too long
- First run downloads TensorFlow models (~1GB)
- Subsequent runs use cached models (much faster)
- Consider using 2-stem model if 4-stem is slow

## 📚 More Info

See `AUDIO_PROCESSING_SETUP.md` for:
- Detailed API documentation
- Production deployment
- Advanced usage
- Custom effect chains
- Troubleshooting guide

## 🎯 Next Steps

1. ✅ Install dependencies
2. ✅ Test audio analysis
3. ✅ Try stem separation
4. ✅ Generate mastering settings
5. 🔄 Integrate into your workflow
6. 📦 Deploy to production (see guide)

## 💡 Tips

- Use 22050 Hz sample rate for faster processing
- Stem separation works best with mixed audio (not already separated)
- Cache analysis results for identical files
- Store stems on cloud storage (S3, GCS) in production
- Use job queues for batch processing large files

---

**Ready to process audio like a pro!** 🎵🚀
