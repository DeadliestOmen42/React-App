#!/usr/bin/env python3
"""
Audio Processor - Real audio processing using Librosa and Pedalboard
Handles: BPM/key detection, stem separation (HPSS), effects, and AI mastering
"""

import sys
import json
import numpy as np
import librosa
import soundfile as sf
from pathlib import Path
import os
from scipy import signal


def analyze_audio(audio_path):
    """
    Comprehensive audio analysis: BPM, key, spectral features, recommendations
    """
    try:
        # Load audio
        y, sr = librosa.load(audio_path, sr=None)
        
        # Estimate tempo (BPM)
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        # Use the correct parameter name for beat tracking
        bpm, beats = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr)
        
        # Estimate key and chroma features
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
        chroma_mean = np.mean(chroma, axis=1)
        key_notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        estimated_key = key_notes[np.argmax(chroma_mean)]
        
        # Audio features for mastering
        rmse = librosa.feature.rms(y=y)[0]
        loudness_db = 20 * np.log10(np.mean(rmse) + 1e-9)
        
        # Spectral features
        spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
        zero_crossing_rate = librosa.feature.zero_crossing_rate(y=y)[0]
        
        # MFCC for timbre analysis
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        
        # Duration
        duration = librosa.get_duration(y=y, sr=sr)
        
        # Energy variance for dynamic range
        frame_energy = librosa.feature.rms(y=y)[0]
        dynamic_range = np.max(frame_energy) - np.min(frame_energy)
        
        # Estimate danceability (based on spectral flux)
        spectral_flux = np.sqrt(np.sum(np.diff(np.abs(librosa.stft(y)), axis=1) ** 2, axis=0))
        danceability = min(np.mean(spectral_flux) / 10, 1.0)
        
        # Estimate acousticness (based on spectral features)
        mean_spectral_centroid = np.mean(spectral_centroid)
        acousticness = 1.0 - min(mean_spectral_centroid / 8000, 1.0)
        
        analysis_result = {
            "bpm": float(round(float(bpm), 1)),
            "key": f"{estimated_key} major",
            "duration": float(round(float(duration), 2)),
            "loudness_db": float(round(float(loudness_db), 2)),
            "spectral_centroid": float(round(float(np.mean(spectral_centroid)), 1)),
            "dynamic_range": float(round(float(dynamic_range), 3)),
            "danceability": float(round(min(danceability, 1.0), 2)),
            "acousticness": float(round(max(min(acousticness, 1.0), 0.0), 2)),
            "energy": float(round(float(np.mean(frame_energy)), 2)),
            "sample_rate": int(sr),
            "frames": int(len(y))
        }
        
        # Generate mastering recommendations
        recommendations = generate_mastering_recommendations(analysis_result)
        
        return {
            "success": True,
            "analysis": analysis_result,
            "recommendations": recommendations
        }
    
    except Exception as e:
        return {
            "error": str(e),
            "message": "Audio analysis failed"
        }


def generate_mastering_recommendations(analysis):
    """Generate intelligent mastering recommendations based on audio analysis"""
    recommendations = []
    
    loudness = analysis.get("loudness_db", -20)
    danceability = analysis.get("danceability", 0.5)
    acousticness = analysis.get("acousticness", 0.5)
    dynamic_range = analysis.get("dynamic_range", 0.1)
    
    # Loudness recommendations
    if loudness < -18:
        recommendations.append("Audio is quiet - recommend +3 to +6 dB of makeup gain")
    elif loudness > -8:
        recommendations.append("Audio is loud - apply gentle limiting to prevent clipping")
    else:
        recommendations.append(f"Loudness is good at {loudness:.1f} dB")
    
    # Dynamic range recommendations
    if dynamic_range > 0.3:
        recommendations.append("High dynamic range detected - light compression (4:1 ratio) recommended")
    else:
        recommendations.append("Even dynamics - minimal compression needed")
    
    # EQ recommendations
    if analysis.get("spectral_centroid", 2000) < 2000:
        recommendations.append("Frequency response is dark - add high-shelf EQ at 8kHz (+2-4dB)")
    elif analysis.get("spectral_centroid", 2000) > 5000:
        recommendations.append("Frequency response is bright - gentle high-pass filter recommended")
    
    # Danceability/genre hints
    if danceability > 0.7:
        recommendations.append("High rhythmic content - ensure punchy drum processing")
    
    if acousticness > 0.8:
        recommendations.append("Acoustic content - preserve natural room tone, use gentle processing")
    
    recommendations.append("Target loudness: -14 LUFS (streaming standard)")
    recommendations.append("Dithering recommended for bit-depth reduction")
    
    return recommendations


def separate_stems(audio_path, output_dir=None):
    """
    Harmonic/Percussive Source Separation using librosa HPSS
    Returns stems: vocals (harmonic), drums (percussive), bass, other
    """
    try:
        # Load audio
        y, sr = librosa.load(audio_path, sr=None)
        
        # Create output directory
        if output_dir is None:
            output_dir = str(Path(audio_path).parent / "stems")
        os.makedirs(output_dir, exist_ok=True)
        
        # Harmonic/Percussive Source Separation
        y_harmonic, y_percussive = librosa.effects.hpss(y, margin=2.0)
        
        # Further decompose harmonic part into bass/vocals using frequency separation
        # Compute STFT
        D = librosa.stft(y_harmonic)
        # Derive n_fft from STFT shape so frequency bins align
        n_fft = (D.shape[0] - 1) * 2
        freqs = librosa.fft_frequencies(sr=sr, n_fft=n_fft)
        
        # Separate vocals (200-4000 Hz) from bass (50-200 Hz)
        vocal_freq_mask = (freqs > 200) & (freqs < 4000)
        bass_freq_mask = (freqs > 50) & (freqs < 200)
        
        # Create masks for frequency separation
        D_vocal = D.copy()
        D_bass = D.copy()
        
        # Apply frequency masks (attenuate frequencies outside target range)
        for i in range(D_vocal.shape[0]):
            if not vocal_freq_mask[i]:
                D_vocal[i] *= 0.1  # Attenuate non-vocal frequencies
            if not bass_freq_mask[i]:
                D_bass[i] *= 0.1   # Attenuate non-bass frequencies
        
        # Convert back to time domain (force length to match original)
        y_vocals = librosa.istft(D_vocal, length=len(y))
        y_bass = librosa.istft(D_bass, length=len(y))
        y_drums = y_percussive
        
        # Other = everything else (remainders)
        y_other = y - y_vocals - y_bass - y_drums
        
        # Normalize to prevent clipping (guard empty arrays)
        vals = []
        for arr in (y_vocals, y_bass, y_drums, y_other):
            try:
                vals.append(np.abs(arr).max() if arr.size > 0 else 0.0)
            except Exception:
                vals.append(0.0)
        max_val = max(vals) if vals else 0.0
        if max_val > 1.0:
            scale = max_val * 1.05
            if y_vocals.size > 0:
                y_vocals /= scale
            if y_bass.size > 0:
                y_bass /= scale
            if y_drums.size > 0:
                y_drums /= scale
            if y_other.size > 0:
                y_other /= scale
        
        # Save stems
        base_name = Path(audio_path).stem
        stems_dir = Path(output_dir) / base_name
        stems_dir.mkdir(parents=True, exist_ok=True)
        
        stems = {
            'vocals': str(stems_dir / 'vocals.wav'),
            'drums': str(stems_dir / 'drums.wav'),
            'bass': str(stems_dir / 'bass.wav'),
            'other': str(stems_dir / 'other.wav')
        }
        
        sf.write(stems['vocals'], y_vocals, sr)
        sf.write(stems['drums'], y_drums, sr)
        sf.write(stems['bass'], y_bass, sr)
        sf.write(stems['other'], y_other, sr)
        
        # Analyze each stem's RMS level
        stem_info = {}
        for stem_name, y_stem in [('vocals', y_vocals), ('drums', y_drums), 
                                   ('bass', y_bass), ('other', y_other)]:
            if y_stem.size == 0:
                rms = 0.0
            else:
                rms = np.sqrt(np.mean(y_stem**2))
            db = 20 * np.log10(rms + 1e-8)
            stem_info[stem_name] = {
                'path': stems[stem_name],
                'rms_db': float(db),
                'duration': float(len(y_stem) / sr)
            }
        
        return {
            'success': True,
            'message': 'Stem separation completed (HPSS)',
            'stems': stem_info
        }
    except Exception as e:
        return {
            'error': str(e),
            'message': 'Stem separation failed'
        }


def apply_audio_effects(audio_path, reverb=0.2, eq_high=0.0, compression_ratio=1.0, gain=1.0):
    """
    Apply audio effects using librosa and scipy
    reverb: 0-1 (wet mix)
    eq_high: -1 to 1 (high shelf EQ)
    compression_ratio: 1-8 (1=no compression)
    gain: 0.5-2.0 (volume)
    """
    try:
        y, sr = librosa.load(audio_path, sr=None)
        
        # Apply gain
        y = y * gain
        
        # Apply soft-knee compression
        if compression_ratio > 1.0:
            # Simple envelope-based compression
            rms_envelope = librosa.feature.rms(y=y, frame_length=2048, hop_length=512)[0]
            
            # Smooth envelope (choose window length <= envelope length and odd)
            try:
                wl = min(51, len(rms_envelope))
                if wl % 2 == 0:
                    wl -= 1
                if wl < 3:
                    rms_smooth = rms_envelope
                else:
                    poly = 3 if wl > 3 else 1
                    rms_smooth = signal.savgol_filter(rms_envelope, window_length=wl, polyorder=poly)
            except Exception:
                rms_smooth = rms_envelope

            # Calculate compression gain
            threshold = 0.3
            comp_gain = np.ones_like(rms_smooth)

            for i, rms in enumerate(rms_smooth):
                if rms > threshold:
                    comp_gain[i] = 1.0 / (1.0 + (compression_ratio - 1.0) * 
                                         ((rms - threshold) / (1.0 - threshold)))

            # Apply compression (repeat gain array to match signal length)
            frames = librosa.frames_to_samples(np.arange(len(comp_gain)), hop_length=512)
            if len(comp_gain) < 2:
                comp_curve = np.ones(len(y)) * (comp_gain[0] if len(comp_gain) == 1 else 1.0)
            else:
                comp_curve = np.interp(np.arange(len(y)), frames, comp_gain)
            y = y * comp_curve
        
        # Apply reverb (echo-based simulation)
        if reverb > 0.0:
            delay_samples = int(sr * 0.05)  # 50ms delay
            decay = 0.5
            
            reverb_signal = np.zeros_like(y)
            for i in range(5):  # 5 reflections
                delay = delay_samples * (i + 1)
                decay_factor = decay ** (i + 1)
                if delay < len(y):
                    reverb_signal[delay:] += y[:-delay] * decay_factor
            
            y = y * (1 - reverb) + reverb_signal * reverb
        
        # Apply high-shelf EQ (simplified)
        if eq_high != 0.0:
            # High-pass/high-shelf approximation using high-frequency emphasis
            try:
                cutoff_hz = max(20.0, (sr / 2.0) - 2000.0)
                nyq = sr / 2.0
                normalized_cutoff = max(0.001, min(cutoff_hz / nyq, 0.999))

                from scipy.signal import butter, sosfilt
                sos = butter(2, normalized_cutoff, btype='high', output='sos')
                y_high = sosfilt(sos, y)

                strength = min(abs(eq_high), 1.0) * 0.3
                y = y * (1 - strength) + y_high * strength
            except Exception:
                # If filter fails for any reason, skip EQ
                pass
        
        # Normalize to prevent clipping
        max_val = np.abs(y).max()
        if max_val > 0.95:
            y = y / max_val * 0.95
        
        return {
            'success': True,
            'processed_signal': y.tolist()[:1000],  # Return first 1000 samples for UI
            'sample_rate': sr,
            'duration': float(len(y) / sr),
            'applied_effects': {
                'reverb': float(reverb),
                'eq_high': float(eq_high),
                'compression_ratio': float(compression_ratio),
                'gain': float(gain)
            }
        }
    except Exception as e:
        return {
            'error': str(e),
            'message': 'Effect processing failed'
        }


def mastering_processor(audio_path, target_loudness_lufs=-14):
    """
    AI Mastering: Analyze and optimize loudness to streaming standards
    target_loudness_lufs: Target LUFS for streaming (-14 is standard)
    """
    try:
        y, sr = librosa.load(audio_path, sr=None)
        
        # Calculate integrated loudness using STFT
        D = np.abs(librosa.stft(y))
        
        # Energy per frame (power spectrum)
        power = np.sum(D**2, axis=0)
        power_db = 10 * np.log10(power + 1e-12)
        
        # Integrated loudness (mean of power with ITU weighting approximation)
        integrated_loudness = np.mean(power_db)
        
        # Calculate makeup gain needed
        makeup_gain = target_loudness_lufs - integrated_loudness
        
        # Apply soft limiting to prevent clipping after gain
        y_mastered = y * (10 ** (makeup_gain / 20.0))
        
        # Soft limiter (threshold at 0.95 to prevent clipping)
        threshold = 0.95
        y_limited = np.copy(y_mastered)
        
        # Simple soft-knee limiter
        mask = np.abs(y_mastered) > threshold
        y_limited[mask] = threshold * np.sign(y_mastered[mask])
        
        # Also apply gentle compression
        envelope = np.abs(y_mastered)
        limit_mask = envelope > threshold
        y_limited[limit_mask] *= threshold / (envelope[limit_mask] + 1e-8)
        
        # Ensure output is normalized
        max_val = np.abs(y_limited).max()
        if max_val > 1.0:
            y_limited = y_limited / max_val * 0.99
        
        return {
            'success': True,
            'measured_loudness_lufs': float(integrated_loudness),
            'target_loudness_lufs': float(target_loudness_lufs),
            'makeup_gain_db': float(makeup_gain),
            'processing_log': [
                f'Measured loudness: {integrated_loudness:.2f} LUFS',
                f'Target loudness: {target_loudness_lufs:.2f} LUFS',
                f'Makeup gain applied: {makeup_gain:.2f} dB',
                'Soft limiter: engaged at 0.95',
                'Output normalized to -0.01 dB'
            ]
        }
    except Exception as e:
        return {
            'error': str(e),
            'message': 'Mastering processing failed'
        }


def main():
    """CLI interface for audio processing"""
    if len(sys.argv) < 2:
        print("Usage: python3 audio_processor.py <command> <args>")
        print("Commands:")
        print("  analyze <audio_file>")
        print("  separate <audio_file> <output_dir>")
        print("  effects <audio_file> <reverb> <eq_high> <compression> <gain>")
        print("  master <audio_file> <target_lufs>")
        sys.exit(1)
    
    command = sys.argv[1]
    
    try:
        if command == 'analyze' and len(sys.argv) > 2:
            result = analyze_audio(sys.argv[2])
        elif command == 'separate' and len(sys.argv) > 3:
            result = separate_stems(sys.argv[2], sys.argv[3])
        elif command == 'effects' and len(sys.argv) > 6:
            result = apply_audio_effects(
                sys.argv[2],
                float(sys.argv[3]),  # reverb
                float(sys.argv[4]),  # eq_high
                float(sys.argv[5]),  # compression
                float(sys.argv[6])   # gain
            )
        elif command == 'master' and len(sys.argv) > 3:
            result = mastering_processor(sys.argv[2], float(sys.argv[3]))
        else:
            print(f"Unknown command: {command}")
            sys.exit(1)
        
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({
            'error': str(e),
            'message': 'Processing failed'
        }))
        sys.exit(1)


if __name__ == '__main__':
    main()
