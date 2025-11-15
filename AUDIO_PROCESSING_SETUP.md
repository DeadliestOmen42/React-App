# Audio Processing Setup Guide

## Overview

The AI Music Studio now includes real audio processing capabilities using industry-standard libraries:

- **Librosa**: Audio analysis (BPM detection, key detection, spectral features)
- **Spleeter**: Stem separation (vocals, drums, bass, other)
- **Essentia**: Advanced audio feature extraction
- **Pedalboard**: Real-time audio effects processing

## Installation

### Quick Setup

Run the setup script:
```bash
chmod +x /workspaces/React-App/setup-audio.sh
./setup-audio.sh
```

### Manual Installation

Install Python audio libraries:
```bash
pip3 install -r /workspaces/React-App/audio-processor/requirements.txt
```

### Required Dependencies

- Python 3.7+
- Homebrew (macOS): `brew install ffmpeg libsndfile`
- Ubuntu/Debian: `sudo apt-get install ffmpeg libsndfile1`
- Windows: Download FFmpeg from https://ffmpeg.org/download.html

## Features

### 1. Audio Analysis (`/api/analyze-audio`)
Analyzes uploaded audio files and returns:
- **BPM Detection**: Estimates tempo using onset strength
- **Key Detection**: Chromatic analysis for musical key
- **Loudness**: RMS and dB calculations
- **Spectral Features**: Centroid, rolloff, zero-crossing rate
- **Danceability**: Based on spectral flux analysis
- **Acousticness**: Estimated from spectral characteristics
- **Duration & Sample Rate**: Metadata

**Recommendations generated:**
- Loudness correction suggestions
- Dynamic range compression advice
- EQ recommendations based on frequency profile
- Genre-specific processing hints
- Streaming platform optimization tips

### 2. Stem Separation (`/api/stem-separation`)
Uses Spleeter to separate audio into 4 stems:
- **Vocals**: Human voice track
- **Drums**: Percussion instruments
- **Bass**: Low-frequency instruments
- **Other**: Everything else (strings, synth, etc.)

Output includes:
- File paths to each stem
- Individual stem loudness levels (dB)
- Total processing time
- Output directory for retrieval

### 3. AI Mastering (`/api/ai-mastering`)
Applies intelligent loudness and dynamic processing:
- **Loudness Measurement**: Integrated loudness in LUFS (ITU-R BS.1770-4 standard)
- **Makeup Gain**: Calculates gain needed to reach -14 LUFS (streaming standard)
- **Soft Limiting**: Prevents clipping at 95% threshold
- **Dithering**: Shaped dithering for bit-depth reduction

Output includes:
- Target vs. measured loudness
- Required makeup gain
- Limiter settings
- Dithering configuration

### 4. Audio Effects (`/api/studio-process`)
Applies real-time audio effects:
- **Reverb**: Configurable wet amount (0-100%)
- **EQ**: High-shelf equalization (±12dB)
- **Compression**: Adjustable ratio (1-8:1)
- **Gain**: Makeup gain (0.5-2.0x)

Effects are chained in this order:
1. Gain
2. Compression
3. Reverb
4. EQ
5. Normalization to prevent clipping

## Architecture

```
Frontend (React)
    ↓
Express Server (Node.js)
    ↓
Python Audio Processor (Child Process)
    ↓
Librosa / Spleeter / Essentia
```

### How It Works

1. **File Upload**: React sends audio file to Express server
2. **Temporary Storage**: Server saves to `/tmp/audio_uploads/`
3. **Python Processing**: Server spawns Python process with audio path and parameters
4. **Processing**: Python libraries process the audio
5. **Response**: Results returned as JSON back to frontend
6. **Cleanup**: Temporary files deleted after processing

## API Usage Examples

### Analyze Audio
```bash
curl -X POST -F "file=@song.mp3" http://localhost:3000/api/analyze-audio
```

Response:
```json
{
  "analysis": {
    "bpm": 120.5,
    "key": "C major",
    "loudness_db": -8.2,
    "danceability": 0.82,
    "acousticness": 0.15,
    "duration": 210.5
  },
  "recommendations": [
    "Audio is quiet - recommend +3 to +6 dB of makeup gain",
    "High dynamic range detected - light compression (4:1 ratio) recommended",
    "Frequency response is dark - add high-shelf EQ at 8kHz (+2-4dB)",
    "Target loudness: -14 LUFS (streaming standard)"
  ]
}
```

### Stem Separation
```bash
curl -X POST -F "file=@song.mp3" http://localhost:3000/api/stem-separation
```

Response:
```json
{
  "success": true,
  "stems": {
    "vocals": "/tmp/stems_1234567890/song/vocals.wav",
    "drums": "/tmp/stems_1234567890/song/drums.wav",
    "bass": "/tmp/stems_1234567890/song/bass.wav",
    "other": "/tmp/stems_1234567890/song/other.wav"
  },
  "levels": {
    "vocals": -8.5,
    "drums": -6.2,
    "bass": -9.1,
    "other": -10.2
  }
}
```

### AI Mastering
```bash
curl -X POST -F "file=@song.mp3" http://localhost:3000/api/ai-mastering
```

Response:
```json
{
  "success": true,
  "mastering_settings": {
    "target_loudness": -14,
    "measured_loudness": -18.5,
    "makeup_gain": 4.5,
    "limiter_threshold": -0.3,
    "limiter_ratio": 10
  },
  "recommendations": [
    "Measured loudness: -18.5 dB",
    "Makeup gain needed: +4.5 dB"
  ]
}
```

## Performance Considerations

### Processing Times
- **Analysis**: 2-5 seconds (depending on file length)
- **Stem Separation**: 15-60 seconds (CPU intensive)
- **Mastering**: 1-2 seconds
- **Effects**: 2-5 seconds

### Memory Requirements
- Librosa: ~1GB for typical audio processing
- Spleeter: ~2-3GB for stem separation
- Recommended: 4GB+ RAM, multi-core processor

### Optimization Tips

1. **Use Cloud Storage**: Save stems to S3/GCS instead of local disk
2. **Queue Processing**: Implement job queue (Bull, RabbitMQ) for large files
3. **Caching**: Cache analysis results for identical files
4. **Compression**: Pre-compress audio files before processing
5. **Parallel Processing**: Use worker threads for multiple requests

## Production Deployment

### Docker Container
Create a Dockerfile with all dependencies:
```dockerfile
FROM python:3.10-slim
RUN apt-get update && apt-get install -y ffmpeg libsndfile1
COPY audio-processor/requirements.txt .
RUN pip install -r requirements.txt
COPY audio-processor/ /app/
WORKDIR /app
```

### AWS Lambda (Serverless)
Use Lambda container image with precompiled wheels:
```bash
pip install --platform manylinux2014_x86_64 --target ./python --only-binary=:all: librosa
```

### GCP Cloud Run
Package as container and deploy:
```bash
gcloud run deploy audio-processor --source . --memory 2Gi --timeout 300
```

## Troubleshooting

### "librosa not available" Error
```bash
pip3 install librosa
# Verify:
python3 -c "import librosa; print(librosa.__version__)"
```

### "spleeter not available" Error
Spleeter requires TensorFlow - large download (500MB+):
```bash
pip3 install tensorflow spleeter
```

### FFmpeg Not Found
- **macOS**: `brew install ffmpeg`
- **Ubuntu**: `sudo apt-get install ffmpeg`
- **Windows**: Download from https://ffmpeg.org/download.html

### Memory Issues with Stem Separation
Reduce memory usage:
```python
# In audio_processor.py, modify separator initialization:
separator = Separator('spleeter:2stems')  # Use 2-stem instead of 4-stem
```

### Slow Processing
- Upgrade CPU or use multi-core processing
- Reduce audio sample rate: `librosa.load(path, sr=22050)`
- Use GPU acceleration (requires CUDA): `TensorFlow with GPU`

## Advanced Usage

### Custom Effect Chain
Create custom audio processing pipeline in `audio_processor.py`:
```python
def custom_mastering(audio_path):
    y, sr = librosa.load(audio_path)
    
    # 1. Normalize
    y = librosa.util.normalize(y)
    
    # 2. EQ
    y = apply_eq(y, sr)
    
    # 3. Compression
    y = compress(y)
    
    # 4. Limiting
    y = limit(y)
    
    return y
```

### Real-time Processing
Use Pedalboard for real-time effects:
```python
import pedalboard

board = pedalboard.Pedalboard([
    pedalboard.Compressor(threshold_db=-20, ratio=4),
    pedalboard.Reverb(room_size=0.5),
    pedalboard.HighShelfFilter(cutoff_frequency_hz=8000, gain_db=2)
])

processed = board(audio, sr)
```

## Resources

- **Librosa Documentation**: https://librosa.org/
- **Spleeter**: https://github.com/deezer/spleeter
- **Essentia**: https://essentia.upf.edu/
- **Pedalboard**: https://spotify.github.io/pedalboard/
- **Audio Standards**: https://www.youtube.com/watch?v=Eo-KmB5cuK8 (Loudness Standards)

## License

Audio processing libraries are open source:
- Librosa: ISC License
- Spleeter: MIT License
- Essentia: AGPL License (check usage restrictions)
- Pedalboard: GPL 3.0 License

