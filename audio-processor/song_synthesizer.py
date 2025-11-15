#!/usr/bin/env python3
"""
Song Synthesizer - Generate songs from lyrics
Creates MIDI, synthesizes audio, and applies genre-specific effects
"""

import sys
import json
import numpy as np
import librosa
from pathlib import Path
from scipy import signal
import soundfile as sf


def note_to_frequency(note, octave=4):
    """Convert note name to frequency in Hz"""
    # Normalize common flat names to their sharp equivalents
    enharmonic = {
        'Bb': 'A#', 'Cb': 'B', 'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#', 'Ab': 'G#',
        'E#': 'F', 'B#': 'C'
    }
    if note in enharmonic:
        note = enharmonic[note]

    notes = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
             'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}

    # If note is still unknown, default to C
    if note not in notes:
        note = 'C'

    # Calculate semitone offset relative to A4 (440 Hz)
    semitone_offset = notes[note] - notes['A'] + (octave - 4) * 12
    return 440 * (2 ** (semitone_offset / 12.0))


def generate_sine_note(frequency, duration, sr=22050, amplitude=0.3):
    """Generate a sine wave note"""
    t = np.linspace(0, duration, int(sr * duration), False)
    wave = amplitude * np.sin(2 * np.pi * frequency * t)
    # Add envelope (attack-decay-sustain-release)
    envelope = np.ones_like(wave)
    attack = int(0.01 * sr)  # 10ms attack
    release = int(0.1 * sr)   # 100ms release
    envelope[:attack] = np.linspace(0, 1, attack)
    envelope[-release:] = np.linspace(1, 0, release)
    return wave * envelope


def key_to_notes(key_str):
    """Convert key string to available notes"""
    key_mapping = {
        'C major': ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
        'G major': ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
        'D major': ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'],
        'A major': ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#'],
        'E major': ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#'],
        'B major': ['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#'],
        'F# major': ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#'],
        'C# major': ['C#', 'D#', 'E#', 'F#', 'G#', 'A#', 'B#'],
        'F major': ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'],
        'Bb major': ['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A'],
        'Eb major': ['Eb', 'F', 'G', 'Ab', 'Bb', 'C', 'D'],
        'Ab major': ['Ab', 'Bb', 'C', 'Db', 'Eb', 'F', 'G'],
        'Db major': ['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C'],
        'Gb major': ['Gb', 'Ab', 'Bb', 'Cb', 'Db', 'Eb', 'F'],
        'Cb major': ['Cb', 'Db', 'Eb', 'Fb', 'Gb', 'Ab', 'Bb'],
        'A minor': ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
        'E minor': ['E', 'F#', 'G', 'A', 'B', 'C', 'D'],
        'B minor': ['B', 'C#', 'D', 'E', 'F#', 'G', 'A'],
    }
    return key_mapping.get(key_str, ['C', 'D', 'E', 'F', 'G', 'A', 'B'])


def lyrics_to_melody(lyrics, key, tempo=120):
    """Convert lyrics to a simple melody"""
    notes = key_to_notes(key)
    words = lyrics.lower().split()
    
    # Map syllables to note indices
    melody = []
    for word in words[:16]:  # Limit to 16 notes
        char_sum = sum(ord(c) for c in word) % len(notes)
        melody.append(notes[char_sum])
    
    return melody


def generate_drum_pattern(tempo, duration, pattern='pop'):
    """Generate drum pattern based on genre"""
    sr = 22050
    beat_duration = 60 / tempo  # Duration of one beat
    samples_per_beat = int(beat_duration * sr)
    total_samples = int(duration * sr)
    
    drums = np.zeros(total_samples)
    
    if pattern == 'pop':
        # Kick on 1,3; snare on 2,4
        kick_freq = 60
        snare_freq = 200
        for beat in range(int(duration * tempo / 60)):
            if beat % 4 in [0, 2]:  # Kick pattern
                start = beat * samples_per_beat
                kick = generate_sine_note(kick_freq, 0.3, sr, amplitude=0.5)
                drums[start:start+len(kick)] += kick
            if beat % 4 in [1, 3]:  # Snare pattern
                start = beat * samples_per_beat
                snare = generate_sine_note(snare_freq, 0.15, sr, amplitude=0.4)
                drums[start:start+len(snare)] += snare
    
    elif pattern == 'rock':
        # Heavy kick and snare
        kick_freq = 80
        snare_freq = 250
        for beat in range(int(duration * tempo / 60)):
            if beat % 2 == 0:  # Kick on every beat
                start = beat * samples_per_beat
                kick = generate_sine_note(kick_freq, 0.4, sr, amplitude=0.6)
                drums[start:start+len(kick)] += kick
            if beat % 4 == 1:  # Snare on 2,4
                start = beat * samples_per_beat
                snare = generate_sine_note(snare_freq, 0.2, sr, amplitude=0.5)
                drums[start:start+len(snare)] += snare
    
    elif pattern == 'edm':
        # Fast kick pattern
        kick_freq = 100
        for beat in range(int(duration * tempo / 60)):
            start = beat * samples_per_beat
            kick = generate_sine_note(kick_freq, 0.25, sr, amplitude=0.7)
            drums[start:start+len(kick)] += kick
    
    # Normalize
    max_val = np.abs(drums).max()
    if max_val > 0:
        drums = drums / max_val * 0.5
    
    return drums


def generate_bass_line(melody_notes, tempo, duration, key):
    """Generate bass line following melody"""
    sr = 22050
    bass = np.zeros(int(duration * sr))
    beat_duration = 60 / tempo
    samples_per_beat = int(beat_duration * sr)
    
    for i, note in enumerate(melody_notes):
        # Bass is lower (use octave 2) for all notes; enharmonic handled in note_to_frequency
        freq = note_to_frequency(note, octave=2)

        start = (i * 2) * samples_per_beat
        if start < len(bass):
            note_audio = generate_sine_note(freq, 0.5, sr, amplitude=0.2)
            end = min(start + len(note_audio), len(bass))
            bass[start:end] += note_audio[:end-start]
    
    return bass


def generate_synth_pad(duration, sr=22050, amplitude=0.15):
    """Generate atmospheric synth pad"""
    t = np.linspace(0, duration, int(sr * duration), False)
    
    # Multiple frequencies for rich pad
    freqs = [100, 150, 225, 300]
    pad = np.zeros_like(t)
    
    for freq in freqs:
        pad += 0.25 * np.sin(2 * np.pi * freq * t)
    
    # Add envelope (handle short durations safely)
    total_len = len(t)
    fade_len = min(int(0.5 * sr), total_len)
    envelope = np.ones(total_len)
    if fade_len > 0:
        # ramp up over fade_len samples
        ramp = np.linspace(0, 1, fade_len)
        envelope[:fade_len] = ramp

    return pad * envelope * amplitude


def compose_from_lyrics(lyrics, genre='pop', tempo=120, key='C major', duration=None):
    """Compose a complete song from lyrics"""
    sr = 22050
    
    if duration is None:
        duration = max(20, len(lyrics.split()) * 2)  # ~2s per word
    
    try:
        # Generate melody from lyrics
        melody_notes = lyrics_to_melody(lyrics, key, tempo)
        
        # Generate all tracks
        melody = np.zeros(int(duration * sr))
        beat_duration = 60 / tempo
        samples_per_beat = int(beat_duration * sr)
        
        # Synthesize melody
        for i, note in enumerate(melody_notes):
            freq = note_to_frequency(note, octave=4)
            start = (i * 2) * samples_per_beat
            if start < len(melody):
                note_audio = generate_sine_note(freq, beat_duration * 2, sr, amplitude=0.3)
                end = min(start + len(note_audio), len(melody))
                melody[start:end] += note_audio[:end-start]
        
        # Generate genre-specific drums
        drums = generate_drum_pattern(tempo, duration, pattern=genre)
        
        # Generate bass line
        bass = generate_bass_line(melody_notes, tempo, duration, key)
        
        # Generate synth pad
        pad = generate_synth_pad(duration, sr, amplitude=0.1)
        
        # Mix all tracks
        mix = melody * 0.4 + drums * 0.3 + bass * 0.25 + pad * 0.05
        
        # Normalize
        max_val = np.abs(mix).max()
        if max_val > 0:
            mix = mix / max_val * 0.95
        
        # Add compression
        threshold = 0.5
        ratio = 4
        compressed = np.copy(mix)
        mask = np.abs(compressed) > threshold
        compressed[mask] = threshold + (np.abs(compressed[mask]) - threshold) / ratio
        compressed[mask] *= np.sign(mix[mask])
        
        return {
            'success': True,
            'audio': compressed,
            'sample_rate': sr,
            'duration': duration,
            'metadata': {
                'lyrics': lyrics,
                'genre': genre,
                'tempo': tempo,
                'key': key,
                'melody_notes': melody_notes,
                'structure': ['Intro', 'Verse', 'Chorus', 'Verse', 'Chorus', 'Bridge', 'Chorus', 'Outro']
            }
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'message': 'Song composition failed'
        }


def main():
    """CLI interface for song generation"""
    if len(sys.argv) < 3:
        print("Usage: python3 song_synthesizer.py <command> <lyrics> [genre] [tempo] [key]")
        print("Commands:")
        print("  generate <lyrics> [genre] [tempo] [key]")
        sys.exit(1)
    
    command = sys.argv[1]
    
    try:
        if command == 'generate' and len(sys.argv) > 2:
            # Support multi-word lyrics and optional trailing args: [genre] [tempo] [key]
            args = sys.argv[2:]
            # Defaults
            genre = 'pop'
            tempo = 120
            key = 'C major'

            # Known keys (mirror of key_to_notes mapping)
            known_keys = {
                'C major', 'G major', 'D major', 'A major', 'E major', 'B major', 'F# major', 'C# major',
                'F major', 'Bb major', 'Eb major', 'Ab major', 'Db major', 'Gb major', 'Cb major',
                'A minor', 'E minor', 'B minor'
            }
            # Known genres
            known_genres = {'pop', 'rock', 'edm'}

            # Parse optional trailing params from the end. Iterate until no more
            args_copy = args[:]
            changed = True
            # Loop to allow params in any order at the end (e.g., genre tempo key)
            while changed and args_copy:
                changed = False
                # Tempo: last token is integer
                if args_copy and args_copy[-1].isdigit():
                    try:
                        tempo = int(args_copy.pop())
                        changed = True
                    except ValueError:
                        pass

                if not args_copy:
                    break

                # Key: either last token is a full key (may be quoted as one token),
                # or last two tokens form a known key (e.g., ['C', 'major']).
                if len(args_copy) >= 2 and ' '.join(args_copy[-2:]) in known_keys:
                    key = ' '.join(args_copy[-2:])
                    args_copy = args_copy[:-2]
                    changed = True
                elif args_copy and args_copy[-1] in known_keys:
                    key = args_copy.pop()
                    changed = True

                if not args_copy:
                    break

                # Genre: last token is a known genre
                if args_copy and args_copy[-1].lower() in known_genres:
                    genre = args_copy.pop().lower()
                    changed = True

            lyrics = ' '.join(args_copy).strip()
            if not lyrics:
                print(json.dumps({'error': 'No lyrics provided', 'message': 'Provide lyrics to generate'}))
                sys.exit(1)

            result = compose_from_lyrics(lyrics, genre, tempo, key)
            
            if result['success']:
                # Save audio to file
                output_path = '/tmp/generated_song.wav'
                sf.write(output_path, result['audio'], result['sample_rate'])
                result['audio_path'] = output_path
                result['audio'] = result['audio'].tolist()[:1000]  # Return preview only
                print(json.dumps(result))
            else:
                print(json.dumps(result))
        else:
            print(json.dumps({
                'error': 'Unknown command',
                'message': 'Use: generate <lyrics> [genre] [tempo] [key]'
            }))
    except Exception as e:
        print(json.dumps({
            'error': str(e),
            'message': 'Processing failed'
        }))
        sys.exit(1)


if __name__ == '__main__':
    main()
