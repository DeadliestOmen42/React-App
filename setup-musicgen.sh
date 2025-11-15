#!/bin/bash

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  AI Music Generation Setup - Meta AudioCraft (MusicGen)  ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check Python version
python_version=$(python3 --version 2>&1 | grep -oP '\d+\.\d+')
required_version="3.8"

if [ "$(printf '%s\n' "$required_version" "$python_version" | sort -V | head -n1)" != "$required_version" ]; then
    echo "❌ Python 3.8+ required (found $python_version)"
    exit 1
fi

echo "✓ Python version: $python_version"
echo ""

# Detect GPU
if command -v nvidia-smi &> /dev/null; then
    echo "🎮 NVIDIA GPU detected - installing with CUDA support"
    GPU_AVAILABLE=true
else
    echo "💻 No GPU detected - installing CPU-only version"
    GPU_AVAILABLE=false
fi
echo ""

cd "$(dirname "$0")/audio-processor" || exit 1

echo "📦 Installing dependencies..."
echo ""

if [ "$GPU_AVAILABLE" = true ]; then
    # GPU installation
    echo "Installing PyTorch with CUDA 11.8..."
    pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118
    
    echo "Installing AudioCraft..."
    pip install audiocraft
    
    echo "Installing optional GPU accelerators..."
    pip install xformers accelerate
else
    # CPU installation
    echo "Installing PyTorch (CPU-only)..."
    pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
    
    echo "Installing AudioCraft..."
    pip install audiocraft
fi

echo ""
echo "🔍 Testing installation..."

python3 musicgen_generator.py check 2>&1 | grep -q "success" && {
    echo "✅ Installation successful!"
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                    Setup Complete!                        ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""
    echo "🎵 MusicGen Models Available:"
    echo "   • small  (300M params, ~2GB RAM)   - Fast"
    echo "   • medium (1.5B params, ~8GB RAM)   - Better"
    echo "   • large  (3.3B params, ~16GB RAM)  - Best"
    echo ""
    echo "🚀 Quick Test:"
    echo "   python3 audio-processor/musicgen_generator.py generate_description \"happy pop song\" 10 small"
    echo ""
    echo "🌐 Start the app:"
    echo "   ./start-servers.sh"
    echo "   Open: http://localhost:5173"
    echo ""
    
    if [ "$GPU_AVAILABLE" = true ]; then
        echo "⚡ GPU acceleration enabled - generation will be ~5-10x faster!"
    else
        echo "💡 For faster generation, use a GPU-enabled system"
    fi
    echo ""
} || {
    echo "❌ Installation test failed"
    echo ""
    echo "Troubleshooting:"
    echo "1. Check Python version: python3 --version"
    echo "2. Try manual installation:"
    echo "   pip install torch torchaudio audiocraft"
    echo "3. See MUSIC_ML_SETUP.md for details"
    exit 1
}
