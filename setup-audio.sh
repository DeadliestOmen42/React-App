#!/bin/bash
# Setup script for audio processing dependencies

echo "Installing Python audio processing dependencies..."
echo "This may take 5-10 minutes as it compiles librosa and related packages..."

pip3 install --upgrade pip setuptools wheel

echo "Installing audio processing libraries..."
pip3 install librosa==0.10.0
pip3 install numpy==1.24.3
pip3 install scipy==1.11.2
pip3 install soundfile==0.12.1
pip3 install spleeter==2.4.0
pip3 install essentia==2.1.0
pip3 install pedalboard==0.8.5

echo "✓ Audio processing dependencies installed successfully!"
echo ""
echo "To verify installation, run:"
echo "  python3 /workspaces/React-App/audio-processor/audio_processor.py"
echo ""
echo "The server will automatically use the Python processor for:"
echo "  - Audio analysis (BPM, key detection)"
echo "  - Stem separation (vocals, drums, bass, other)"
echo "  - AI mastering (loudness optimization)"
echo "  - Audio effects (reverb, EQ, compression, gain)"
