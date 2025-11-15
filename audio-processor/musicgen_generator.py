#!/usr/bin/env python3
"""
AI Music Generation using Meta's AudioCraft (MusicGen)
Generates music from text descriptions and lyrics
"""

import sys
import json
import os
import warnings
warnings.filterwarnings('ignore')

def check_dependencies():
    """Check if required ML dependencies are installed"""
    missing = []
    try:
        import torch
    except ImportError:
        missing.append('torch')
    
    try:
        import torchaudio
    except ImportError:
        missing.append('torchaudio')
    
    try:
        from transformers import MusicgenForConditionalGeneration
    except ImportError:
        missing.append('transformers')
    
    try:
        import scipy
    except ImportError:
        missing.append('scipy')
    
    if missing:
        return False, missing
    return True, []

def generate_music(description, duration=20, model_size='small'):
    """
    Generate music using MusicGen via HuggingFace Transformers
    
    Args:
        description: Text description of the music to generate
        duration: Duration in seconds (default 20)
        model_size: 'small' (300M), 'medium' (1.5B), or 'large' (3.3B)
    
    Returns:
        dict with audio data and metadata
    """
    import torch
    from transformers import AutoProcessor, MusicgenForConditionalGeneration
    from scipy.io.wavfile import write as write_wav
    import numpy as np
    
    try:
        # Load model and processor
        model_name = f"facebook/musicgen-{model_size}"
        print(f"Loading MusicGen model ({model_size})...", file=sys.stderr)
        
        processor = AutoProcessor.from_pretrained(model_name)
        model = MusicgenForConditionalGeneration.from_pretrained(model_name)
        
        # Move to GPU if available
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = model.to(device)
        
        print(f"Generating music: '{description[:50]}...'", file=sys.stderr)
        print(f"Device: {device}", file=sys.stderr)
        
        # Process text input
        inputs = processor(
            text=[description],
            padding=True,
            return_tensors="pt",
        ).to(device)
        
        # Calculate max length from duration and sample rate
        sample_rate = model.config.audio_encoder.sampling_rate
        max_new_tokens = int(duration * sample_rate / model.config.audio_encoder.hop_length)
        
        # Generate audio
        audio_values = model.generate(**inputs, max_new_tokens=max_new_tokens, do_sample=True)
        
        # Convert to numpy and normalize
        audio_np = audio_values[0, 0].cpu().numpy()
        
        # Normalize to [-1, 1]
        max_val = np.abs(audio_np).max()
        if max_val > 0:
            audio_np = audio_np / max_val
        
        # Save to temporary file
        output_path = '/tmp/generated_musicgen.wav'
        write_wav(output_path, sample_rate, (audio_np * 32767).astype(np.int16))
        
        actual_duration = len(audio_np) / sample_rate
        
        return {
            'success': True,
            'audio_path': output_path,
            'sample_rate': sample_rate,
            'duration': actual_duration,
            'metadata': {
                'model': f'MusicGen-{model_size} (HuggingFace)',
                'description': description,
                'model_params': f'{model_size} model',
                'generation_method': 'transformer-based music generation',
                'device': device
            }
        }
        
    except Exception as e:
        import traceback
        return {
            'success': False,
            'error': f'Music generation failed: {str(e)}',
            'traceback': traceback.format_exc()
        }

def generate_from_lyrics(lyrics, genre='pop', tempo=120, key='C major', duration=20):
    """
    Generate music from lyrics by creating a descriptive prompt
    
    Args:
        lyrics: Song lyrics
        genre: Music genre
        tempo: Tempo in BPM
        key: Musical key
        duration: Duration in seconds
    """
    # Create a rich description for MusicGen
    tempo_desc = 'fast' if tempo > 140 else 'moderate' if tempo > 100 else 'slow'
    
    # Build description
    description = f"{tempo_desc} {genre} song in {key}"
    
    # Add mood based on lyrics
    lyrics_lower = lyrics.lower()
    if any(word in lyrics_lower for word in ['love', 'heart', 'feel']):
        description += ", emotional and heartfelt"
    if any(word in lyrics_lower for word in ['dance', 'move', 'party']):
        description += ", upbeat and energetic"
    if any(word in lyrics_lower for word in ['sad', 'cry', 'alone']):
        description += ", melancholic"
    
    # Add instrumentation
    if genre.lower() == 'rock':
        description += ", with electric guitars and drums"
    elif genre.lower() == 'pop':
        description += ", with synths and modern production"
    elif genre.lower() == 'jazz':
        description += ", with piano and saxophone"
    elif genre.lower() == 'electronic':
        description += ", with synthesizers and electronic beats"
    
    print(f"Generated prompt: {description}", file=sys.stderr)
    
    return generate_music(description, duration=duration, model_size='small')

def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': 'Usage: python musicgen_generator.py <command> [args...]'
        }))
        sys.exit(1)
    
    command = sys.argv[1]
    
    # Check dependencies first
    deps_ok, missing = check_dependencies()
    if not deps_ok:
        print(json.dumps({
            'success': False,
            'error': 'Missing dependencies',
            'missing_packages': missing,
            'install_command': f'pip install torch torchaudio audiocraft'
        }))
        sys.exit(1)
    
    try:
        if command == 'generate':
            # Generate from lyrics
            if len(sys.argv) < 6:
                raise ValueError('Usage: generate <lyrics> <genre> <tempo> <key>')
            
            lyrics = sys.argv[2]
            genre = sys.argv[3]
            tempo = int(sys.argv[4])
            key = sys.argv[5]
            
            result = generate_from_lyrics(lyrics, genre, tempo, key)
            print(json.dumps(result))
            
        elif command == 'generate_description':
            # Generate from text description
            if len(sys.argv) < 3:
                raise ValueError('Usage: generate_description <description> [duration] [model_size]')
            
            description = sys.argv[2]
            duration = int(sys.argv[3]) if len(sys.argv) > 3 else 20
            model_size = sys.argv[4] if len(sys.argv) > 4 else 'small'
            
            result = generate_music(description, duration, model_size)
            print(json.dumps(result))
            
        elif command == 'check':
            # Check if dependencies are installed
            print(json.dumps({
                'success': True,
                'dependencies_installed': True,
                'models_available': ['small', 'medium', 'large']
            }))
            
        else:
            print(json.dumps({
                'success': False,
                'error': f'Unknown command: {command}'
            }))
            sys.exit(1)
            
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))
        sys.exit(1)

if __name__ == '__main__':
    main()
