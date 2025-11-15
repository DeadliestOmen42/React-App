// AI Music Studio — Single-file React app (TailwindCSS)
import React, { useEffect, useState, useRef } from "react";

export default function App(){
  const STARTER_CREDITS = 5;
  const [credits, setCredits] = useState(() => {
    const val = localStorage.getItem("amstudio_credits");
    return val ? Number(val) : STARTER_CREDITS;
  });
  const [lyricsPrompt, setLyricsPrompt] = useState("");
  const [lyricsResult, setLyricsResult] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const [showStudio, setShowStudio] = useState(false);
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [subscriptionActive, setSubscriptionActive] = useState(false);

  const [audioFile, setAudioFile] = useState(null);
  const audioRef = useRef(null);
  const [processing, setProcessing] = useState(false);
  const [studioNotes, setStudioNotes] = useState('');
  const [history, setHistory] = useState([]);

  const [songFromLyrics, setSongFromLyrics] = useState(false);
  const [songGenre, setSongGenre] = useState('pop');
  const [songTempo, setSongTempo] = useState('120');
  const [songKey, setSongKey] = useState('C major');
  const [isComposing, setIsComposing] = useState(false);
  const [useOriginalLyrics, setUseOriginalLyrics] = useState(false);
  const [originalLyrics, setOriginalLyrics] = useState('');

  // Audio editing state
  const [reverbAmount, setReverbAmount] = useState(0.3);
  const [eqLow, setEqLow] = useState(0);
  const [eqMid, setEqMid] = useState(0);
  const [eqHigh, setEqHigh] = useState(0);
  const [compressionRatio, setCompressionRatio] = useState(4);
  const [gainAmount, setGainAmount] = useState(1);
  const [vocalClarity, setVocalClarity] = useState(0.5);
  const [vocalPresence, setVocalPresence] = useState(0.6);
  const [audioAnalysis, setAudioAnalysis] = useState(null);
  const [masteringSettings, setMasteringSettings] = useState(null);
  const [showAdvancedEditor, setShowAdvancedEditor] = useState(false);
  
  // Generated song state
  const [generatedSong, setGeneratedSong] = useState(null);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState(null);
  const [showSongEditor, setShowSongEditor] = useState(false);

  useEffect(()=>{
    localStorage.setItem("amstudio_credits", String(credits));
  }, [credits]);

  function useCredit(amount=1){
    if(credits >= amount){
      setCredits(c => c - amount);
      return true;
    }
    return false;
  }

  async function handleGenerateLyrics(e){
    e.preventDefault();
    if(!lyricsPrompt.trim()) return;
    if(!useCredit(1)){
      setIsPaywallOpen(true);
      return;
    }
    setIsGenerating(true);
    setLyricsResult("");
    try{
      const res = await fetch("http://localhost:3000/api/generate-lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: lyricsPrompt })
      });
      if(!res.ok) throw new Error("Lyrics API error");
      const data = await res.json();
      setLyricsResult(data.lyrics || "(no lyrics returned)");
    }catch(err){
      console.error(err);
      setLyricsResult("Error generating lyrics. Check console.");
      setCredits(c => c + 1);
    }finally{
      setIsGenerating(false);
    }
  }

  function handleFileChange(ev){
    const f = ev.target.files[0];
    if(!f) return;
    setAudioFile(URL.createObjectURL(f));
    setHistory(h => [{ type: 'upload', name: f.name, time: Date.now() }, ...h]);
  }

  async function handleStudioProcess(e){
    e.preventDefault();
    if(!audioFile) return alert('Upload an audio file first');
    if(!subscriptionActive){
      setIsPaywallOpen(true);
      return;
    }
    setProcessing(true);
    try{
      const form = new FormData();
      form.append('notes', studioNotes);
      const res = await fetch('http://localhost:3000/api/studio-process', { method: 'POST', body: form });
      if(!res.ok) throw new Error('studio process failed');
      const data = await res.json();
      setAudioFile(data.processedUrl || audioFile);
      setHistory(h => [{ type:'processed', notes: studioNotes, time: Date.now() }, ...h]);
    }catch(err){
      console.error(err);
      alert('Processing failed');
    }finally{
      setProcessing(false);
    }
  }

  async function handleOpenPaywall(){
    setIsPaywallOpen(true);
  }
  async function handleMockPurchase(){
    setSubscriptionActive(true);
    setCredits(c => c + 50);
    setIsPaywallOpen(false);
    alert('Mock purchase complete: subscription activated and 50 credits added (prototype).');
  }

  async function handleCreateSongFromLyrics(e){
    e.preventDefault();
    const lyricsToUse = useOriginalLyrics ? originalLyrics : lyricsResult;
    if(!lyricsToUse.trim()) return alert('Add lyrics first (generate or paste)');
    if(!useCredit(2)){
      setIsPaywallOpen(true);
      return;
    }
    setIsComposing(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 130000); // 130s timeout
      
      const res = await fetch('http://localhost:3000/api/compose-song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lyrics: lyricsToUse,
          genre: songGenre,
          tempo: parseInt(songTempo),
          key: songKey
        }),
        signal: controller.signal
      }).finally(() => clearTimeout(timeoutId));
      
      if(!res.ok) {
        let errorMsg = 'Composition failed';
        try {
          const err = await res.json();
          errorMsg = err.error || err.message || errorMsg;
        } catch(e) {
          errorMsg = `Server error (${res.status})`;
        }
        throw new Error(errorMsg);
      }
      const data = await res.json();
      
      // Convert base64 audio to blob and create URL
      const binaryString = atob(data.audio);
      const bytes = new Uint8Array(binaryString.length);
      for(let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const audioBlob = new Blob([bytes], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      setGeneratedSong(data);
      setGeneratedAudioUrl(audioUrl);
      setAudioFile(audioUrl);
      setShowSongEditor(true);
      setHistory(h => [{ type: 'composed', genre: songGenre, tempo: songTempo, key: songKey, time: Date.now() }, ...h]);
      const modelInfo = data.model ? `\n\n🤖 Generated with: ${data.model}` : '';
      alert(`🎵 Song generated successfully!${modelInfo}\n\nYou can now:\n• Play and listen\n• Apply audio effects\n• Analyze and master\n• Download the track`);
    } catch(err) {
      console.error('Song generation error:', err);
      let errorMsg = 'Song generation failed';
      if (err.name === 'AbortError') {
        errorMsg = 'Request timeout - song generation took too long. Please try again.';
      } else if (err.message) {
        errorMsg = 'Song generation failed: ' + err.message;
      }
      alert(errorMsg);
      setCredits(c => c + 2); // Refund credits on failure
    } finally {
      setIsComposing(false);
    }
  }

  async function handleAnalyzeAudio(e){
    e.preventDefault();
    if(!audioFile) return alert('Upload an audio file first');
    
    setProcessing(true);
    try{
      const form = new FormData();
      const blob = await fetch(audioFile).then(r => r.blob());
      form.append('file', blob, 'audio.mp3');
      form.append('notes', studioNotes);
      
      const res = await fetch('http://localhost:3000/api/analyze-audio', {
        method: 'POST',
        body: form
      });
      if(!res.ok) throw new Error('Analysis failed');
      const data = await res.json();
      setAudioAnalysis(data.analysis);
      setHistory(h => [{ type: 'analyzed', bpm: data.analysis.bpm, key: data.analysis.key, time: Date.now() }, ...h]);
      alert('Audio analysis complete!\n\nBPM: ' + data.analysis.bpm + '\nKey: ' + data.analysis.key + '\nDanceability: ' + (data.analysis.danceability * 100).toFixed(0) + '%');
    }catch(err){
      console.error(err);
      alert('Audio analysis failed');
    }finally{
      setProcessing(false);
    }
  }

  async function handleApplyAudioEffects(e){
    e.preventDefault();
    if(!audioFile) return alert('Upload an audio file first');
    if(!subscriptionActive){
      setIsPaywallOpen(true);
      return;
    }
    
    setProcessing(true);
    try{
      const form = new FormData();
      const blob = await fetch(audioFile).then(r => r.blob());
      form.append('file', blob, 'audio.mp3');
      form.append('reverb', reverbAmount);
      form.append('eq', JSON.stringify({ low: eqLow, mid: eqMid, high: eqHigh }));
      form.append('compression', JSON.stringify({ threshold: -20, ratio: compressionRatio }));
      form.append('gain', gainAmount);
      form.append('notes', studioNotes);
      
      const res = await fetch('http://localhost:3000/api/studio-process', {
        method: 'POST',
        body: form
      });
      if(!res.ok) throw new Error('Processing failed');
      const data = await res.json();
      setHistory(h => [{ type: 'processed', settings: 'custom effects', time: Date.now() }, ...h]);
      alert('Audio effects applied!\n\nLog:\n' + data.processingLog.join('\n'));
    }catch(err){
      console.error(err);
      alert('Audio processing failed');
    }finally{
      setProcessing(false);
    }
  }

  async function handleAIMastering(e){
    e.preventDefault();
    if(!audioFile) return alert('Upload an audio file first');
    if(!subscriptionActive){
      setIsPaywallOpen(true);
      return;
    }
    
    setProcessing(true);
    try{
      const form = new FormData();
      const blob = await fetch(audioFile).then(r => r.blob());
      form.append('file', blob, 'audio.mp3');
      
      const res = await fetch('http://localhost:3000/api/ai-mastering', {
        method: 'POST',
        body: form
      });
      if(!res.ok) throw new Error('AI mastering failed');
      const data = await res.json();
      setMasteringSettings(data.masteringSettings);
      setHistory(h => [{ type: 'mastered', loudness: data.masteringSettings.targetLoudness, time: Date.now() }, ...h]);
      alert('AI Mastering applied!\n\nTarget Loudness: ' + data.masteringSettings.targetLoudness + ' LUFS\n\n' + data.masteringSettings.recommendations.join('\n'));
    }catch(err){
      console.error(err);
      alert('AI mastering failed');
    }finally{
      setProcessing(false);
    }
  }

  async function handleStemSeparation(e){
    e.preventDefault();
    if(!audioFile) return alert('Upload an audio file first');
    if(!subscriptionActive){
      setIsPaywallOpen(true);
      return;
    }
    
    setProcessing(true);
    try{
      const form = new FormData();
      const blob = await fetch(audioFile).then(r => r.blob());
      form.append('file', blob, 'audio.mp3');
      
      const res = await fetch('http://localhost:3000/api/stem-separation', {
        method: 'POST',
        body: form
      });
      if(!res.ok) throw new Error('Stem separation failed');
      const data = await res.json();
      setHistory(h => [{ type: 'stems_separated', stems: 'vocals, drums, bass, other', time: Date.now() }, ...h]);
      alert('Stem Separation Complete!\n\nStems extracted:\n• Vocals (Level: ' + data.stems.vocals.dbFS.toFixed(1) + ' dB)\n• Drums (Level: ' + data.stems.drums.dbFS.toFixed(1) + ' dB)\n• Bass (Level: ' + data.stems.bass.dbFS.toFixed(1) + ' dB)\n• Other (Level: ' + data.stems.other.dbFS.toFixed(1) + ' dB)');
    }catch(err){
      console.error(err);
      alert('Stem separation failed');
    }finally{
      setProcessing(false);
    }
  }

  async function handleVocalEnhancement(e){
    e.preventDefault();
    if(!audioFile) return alert('Upload an audio file first');
    if(!subscriptionActive){
      setIsPaywallOpen(true);
      return;
    }
    
    setProcessing(true);
    try{
      const form = new FormData();
      const blob = await fetch(audioFile).then(r => r.blob());
      form.append('file', blob, 'audio.mp3');
      form.append('clarity', vocalClarity);
      form.append('presence', vocalPresence);
      form.append('deesser', 0.3);
      
      const res = await fetch('http://localhost:3000/api/vocal-enhancement', {
        method: 'POST',
        body: form
      });
      if(!res.ok) throw new Error('Vocal enhancement failed');
      const data = await res.json();
      setHistory(h => [{ type: 'vocals_enhanced', settings: 'clarity, presence, de-esser', time: Date.now() }, ...h]);
      alert('Vocal Enhancement Applied!\n\n' + data.processing.join('\n'));
    }catch(err){
      console.error(err);
      alert('Vocal enhancement failed');
    }finally{
      setProcessing(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 sm:p-12">
      <header className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-500 to-purple-700 bg-clip-text text-transparent">AI Music Studio</h1>
        <p className="mt-2 text-sm text-gray-300">Generate lyrics using AI. Starter credits: <span className="text-purple-400 font-semibold">{credits}</span></p>
      </header>

      <main className="max-w-4xl mx-auto mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section className="bg-gray-900 rounded-2xl shadow-lg shadow-purple-950/40 p-6 border border-purple-800/40">
          <h2 className="text-xl font-bold text-purple-500">Lyrics Generator</h2>
          <p className="text-sm text-gray-400 mt-1">Uses 1 credit per generation. Free starter credits available.</p>

          <div className="mt-4 flex gap-2 mb-4">
            <button type="button" onClick={()=>setUseOriginalLyrics(false)} className={`px-3 py-1 rounded-md font-medium transition ${!useOriginalLyrics ? 'bg-purple-800 text-white' : 'border border-purple-700/50 text-gray-300 hover:border-purple-600'}`}>Generate with AI</button>
            <button type="button" onClick={()=>setUseOriginalLyrics(true)} className={`px-3 py-1 rounded-md font-medium transition ${useOriginalLyrics ? 'bg-purple-800 text-white' : 'border border-purple-700/50 text-gray-300 hover:border-purple-600'}`}>Paste Original</button>
          </div>

          {!useOriginalLyrics ? (
            <form onSubmit={handleGenerateLyrics} className="mt-4">
              <textarea
                value={lyricsPrompt}
                onChange={e=>setLyricsPrompt(e.target.value)}
                placeholder="Describe the song: mood, genre, key lines, tempo..."
                className="w-full rounded-md border border-purple-700/30 bg-gray-800 text-white placeholder-gray-500 p-3 h-32 resize-none focus:border-purple-700 focus:outline-none transition"
              />
              <div className="flex items-center justify-between mt-3">
                <div className="text-sm text-gray-400">Credits: <span className="text-purple-500 font-semibold">{credits}</span></div>
                <div className="flex gap-2">
                  <button type="button" onClick={()=>{ setLyricsPrompt('A wistful indie-pop chorus about late-night city lights and moving on.'); }} className="px-3 py-1 rounded-md border border-purple-700/50 text-gray-300 hover:border-purple-600 transition">Try sample</button>
                  <button type="submit" disabled={isGenerating} className="px-4 py-1 rounded-md bg-purple-800 hover:bg-purple-900 text-white disabled:opacity-60 disabled:cursor-not-allowed transition font-medium">{isGenerating? 'Generating...' : 'Generate Lyrics (1 credit)'}</button>
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={e=>{ e.preventDefault(); if(originalLyrics.trim()) setLyricsResult(originalLyrics); }} className="mt-4">
              <textarea
                value={originalLyrics}
                onChange={e=>setOriginalLyrics(e.target.value)}
                placeholder="Paste your original lyrics here..."
                className="w-full rounded-md border border-purple-700/30 bg-gray-800 text-white placeholder-gray-500 p-3 h-32 resize-none focus:border-purple-700 focus:outline-none transition"
              />
              <div className="flex items-center justify-between mt-3">
                <div className="text-sm text-gray-400">No cost to load <span className="text-purple-500">(2 credits to compose)</span></div>
                <div className="flex gap-2">
                  <button type="button" onClick={()=>{ setOriginalLyrics('Verse 1:\nWalking down the neon-lit street\nFeel the rhythm under my feet\nDreams are alive in the city tonight\nLights dancing bright in the starry sky'); }} className="px-3 py-1 rounded-md border border-purple-700/50 text-gray-300 hover:border-purple-600 transition">Try sample</button>
                  <button type="submit" className="px-4 py-1 rounded-md bg-purple-800 hover:bg-purple-900 text-white transition font-medium">Use These Lyrics</button>
                </div>
              </div>
            </form>
          )}

          <div className="mt-4">
            <h3 className="font-semibold text-gray-300">Output</h3>
            <div className="mt-2 min-h-[120px] rounded-md border border-purple-700/30 bg-gray-800 p-3 whitespace-pre-wrap text-gray-200">{lyricsResult || <span className="text-gray-500">Your generated lyrics will appear here.</span>}</div>
          </div>

          {lyricsResult && (
            <div className="mt-6 border-t border-purple-700/30 pt-4">
              <h3 className="font-semibold text-purple-500 mb-3">Create Song from These Lyrics</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-300 font-medium">Genre</label>
                  <select value={songGenre} onChange={e=>setSongGenre(e.target.value)} className="w-full rounded-md border border-purple-700/30 bg-gray-800 text-white p-2 mt-1 focus:border-purple-700 focus:outline-none transition">
                    <option value="pop">Pop</option>
                    <option value="rock">Rock</option>
                    <option value="indie">Indie</option>
                    <option value="electronic">Electronic</option>
                    <option value="folk">Folk</option>
                    <option value="hiphop">Hip-Hop</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 font-medium">Tempo (BPM)</label>
                  <input type="number" value={songTempo} onChange={e=>setSongTempo(e.target.value)} min="60" max="200" className="w-full rounded-md border border-purple-700/30 bg-gray-800 text-white p-2 mt-1 focus:border-purple-700 focus:outline-none transition" />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 font-medium">Key</label>
                  <select value={songKey} onChange={e=>setSongKey(e.target.value)} className="w-full rounded-md border border-purple-700/30 bg-gray-800 text-white p-2 mt-1 focus:border-purple-700 focus:outline-none transition">
                    <option value="C major">C major</option>
                    <option value="D major">D major</option>
                    <option value="E major">E major</option>
                    <option value="F major">F major</option>
                    <option value="G major">G major</option>
                    <option value="A major">A major</option>
                    <option value="B major">B major</option>
                    <option value="A minor">A minor</option>
                    <option value="E minor">E minor</option>
                    <option value="D minor">D minor</option>
                  </select>
                </div>
                <button
                  onClick={handleCreateSongFromLyrics}
                  disabled={isComposing}
                  className="w-full px-4 py-2 rounded-md bg-gradient-to-r from-purple-800 to-purple-900 hover:from-purple-900 hover:to-purple-950 text-white disabled:opacity-60 disabled:cursor-not-allowed transition font-semibold"
                >
                  {isComposing ? 'Composing...' : 'Compose Song (2 credits)'}
                </button>
                <p className="text-xs text-gray-500">Requires a music ML backend (MusicLM, Jukebox, or similar).</p>
              </div>
            </div>
          )}
        </section>

        <section className="bg-gray-900 rounded-2xl shadow-lg shadow-purple-950/40 p-6 border border-purple-800/40">
          <div className="flex justify-between items-start mb-2">
            <h2 className="text-xl font-bold text-purple-500">AI Music Studio</h2>
            <div className="text-xs text-gray-500">Pro feature</div>
          </div>

          <div className="mt-3 text-sm text-gray-400">Upload audio for AI editing, analysis, mastering & stem separation.</div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-300">Upload audio</label>
            <input type="file" accept="audio/*" onChange={handleFileChange} className="mt-2 text-gray-400 file:rounded-md file:border-0 file:bg-purple-800 file:text-white file:font-medium file:px-3 file:py-1 file:cursor-pointer hover:file:bg-purple-900 transition" />
          </div>

          {audioFile && (
            <div className="mt-4 space-y-4">
              <audio controls src={audioFile} ref={audioRef} className="w-full rounded-md" />
              
              {/* Analysis Section */}
              <div className="p-3 rounded-md bg-gray-800 border border-purple-700/20">
                <button onClick={handleAnalyzeAudio} disabled={processing || !subscriptionActive} className="w-full px-3 py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium disabled:opacity-60 transition">
                  {processing ? '🔄 Analyzing...' : '🎵 Analyze Audio (BPM, Key, Danceability)'}
                </button>
                {audioAnalysis && <p className="text-xs text-gray-400 mt-2">BPM: {audioAnalysis.bpm} | Key: {audioAnalysis.key} | Danceability: {(audioAnalysis.danceability * 100).toFixed(0)}%</p>}
              </div>

              {/* EQ & Effects Controls */}
              <div className="p-3 rounded-md bg-gray-800 border border-purple-700/20">
                <h4 className="text-sm font-semibold text-purple-400 mb-2">Audio Effects</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <label className="text-xs text-gray-400">Reverb: {(reverbAmount * 100).toFixed(0)}%</label>
                    <input type="range" min="0" max="1" step="0.05" value={reverbAmount} onChange={e=>setReverbAmount(Number(e.target.value))} className="w-full" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">EQ High: {eqHigh > 0 ? '+' : ''}{eqHigh}dB</label>
                    <input type="range" min="-12" max="12" step="1" value={eqHigh} onChange={e=>setEqHigh(Number(e.target.value))} className="w-full" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Compression Ratio: {compressionRatio}:1</label>
                    <input type="range" min="1" max="8" step="0.5" value={compressionRatio} onChange={e=>setCompressionRatio(Number(e.target.value))} className="w-full" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Gain: {(gainAmount * 100).toFixed(0)}%</label>
                    <input type="range" min="0.5" max="2" step="0.1" value={gainAmount} onChange={e=>setGainAmount(Number(e.target.value))} className="w-full" />
                  </div>
                </div>
                <button onClick={handleApplyAudioEffects} disabled={processing || !subscriptionActive} className="w-full mt-2 px-3 py-1 rounded-md bg-purple-800 hover:bg-purple-900 text-white text-sm font-medium disabled:opacity-60 transition">
                  {processing ? 'Applying...' : '⚙️ Apply Effects'}
                </button>
              </div>

              {/* AI Mastering */}
              <button onClick={handleAIMastering} disabled={processing || !subscriptionActive} className="w-full px-3 py-2 rounded-md bg-cyan-700 hover:bg-cyan-800 text-white text-sm font-medium disabled:opacity-60 transition">
                {processing ? 'Mastering...' : '✨ AI Auto-Mastering'}
              </button>
              {masteringSettings && <p className="text-xs text-gray-400 mt-1">Target: {masteringSettings.targetLoudness} LUFS</p>}

              {/* Stem Separation */}
              <button onClick={handleStemSeparation} disabled={processing || !subscriptionActive} className="w-full px-3 py-2 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium disabled:opacity-60 transition">
                {processing ? 'Separating...' : '🎸 Stem Separation (Vocals, Drums, Bass, Other)'}
              </button>

              {/* Vocal Enhancement */}
              <div className="p-3 rounded-md bg-gray-800 border border-purple-700/20">
                <h4 className="text-sm font-semibold text-purple-400 mb-2">Vocal Enhancement</h4>
                <div className="space-y-2 text-sm mb-2">
                  <div>
                    <label className="text-xs text-gray-400">Clarity: {(vocalClarity * 100).toFixed(0)}%</label>
                    <input type="range" min="0" max="1" step="0.05" value={vocalClarity} onChange={e=>setVocalClarity(Number(e.target.value))} className="w-full" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Presence: {(vocalPresence * 100).toFixed(0)}%</label>
                    <input type="range" min="0" max="1" step="0.05" value={vocalPresence} onChange={e=>setVocalPresence(Number(e.target.value))} className="w-full" />
                  </div>
                </div>
                <button onClick={handleVocalEnhancement} disabled={processing || !subscriptionActive} className="w-full px-3 py-1 rounded-md bg-pink-700 hover:bg-pink-800 text-white text-sm font-medium disabled:opacity-60 transition">
                  {processing ? 'Enhancing...' : '🎤 Enhance Vocals'}
                </button>
              </div>

              <div className="text-sm text-gray-500 text-xs">Studio notes (optional):</div>
              <input value={studioNotes} onChange={e=>setStudioNotes(e.target.value)} placeholder="e.g. reduce reverb, boost bass, brighten vocals..." className="w-full rounded-md border border-purple-700/30 bg-gray-800 text-white placeholder-gray-500 p-2 text-sm focus:border-purple-700 focus:outline-none transition" />
            </div>
          )}

          <div className="mt-4 border-t border-purple-700/30 pt-4">
            <h3 className="font-semibold text-purple-500 text-sm">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
              <button onClick={()=>{ setCredits(c => c + 5); }} className="px-2 py-1 rounded border border-purple-700/50 text-gray-300 hover:border-purple-600 transition">+ 5 credits (dev)</button>
              <button onClick={()=>{ setSubscriptionActive(!subscriptionActive); }} className={`px-2 py-1 rounded transition ${subscriptionActive ? 'bg-red-700 hover:bg-red-800' : 'bg-green-700 hover:bg-green-800'} text-white`}>{subscriptionActive ? 'End Subscription' : 'Start Free Trial'}</button>
            </div>
          </div>

          <div className="mt-4 text-xs text-gray-500">💡 Backend integrations needed: Librosa (audio analysis), SoX/Spleeter (stem separation), specialized ML models for mastering</div>
        </section>

        <section className="col-span-1 lg:col-span-2 bg-gray-900 rounded-2xl shadow-lg shadow-purple-950/40 p-6 border border-purple-800/40">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-purple-500">Account & Billing</h3>
              <div className="text-sm text-gray-400 mt-1">Credits: <span className="text-purple-500 font-semibold">{credits}</span> • Subscription: <span className={subscriptionActive ? 'text-green-400 font-semibold' : 'text-gray-400'}>{subscriptionActive ? 'Active' : 'Inactive'}</span></div>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>{ setCredits(c => c + 2); }} className="px-3 py-1 rounded-md border border-purple-700/50 text-gray-300 hover:border-purple-600 transition font-medium">Add 2 free credits (dev)</button>
              <button onClick={handleOpenPaywall} className="px-3 py-1 rounded-md bg-purple-800 hover:bg-purple-900 text-white transition font-medium">Manage Billing</button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-md border border-purple-700/30 bg-gray-800">
              <div className="text-sm text-gray-400">Free plan</div>
              <div className="font-semibold text-purple-500 mt-1">{STARTER_CREDITS} starter credits</div>
            </div>
            <div className="p-4 rounded-md border border-purple-700/30 bg-gray-800">
              <div className="text-sm text-gray-400">Pro (monthly)</div>
              <div className="font-semibold text-purple-500 mt-1">Subscription unlocks Studio</div>
            </div>
            <div className="p-4 rounded-md border border-purple-700/30 bg-gray-800">
              <div className="text-sm text-gray-400">Pay per job</div>
              <div className="font-semibold text-purple-500 mt-1">Buy credits & single-run studio jobs</div>
            </div>
          </div>
        </section>
      </main>

      {isPaywallOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={()=>setIsPaywallOpen(false)} />
          <div className="relative bg-gray-900 p-6 rounded-2xl shadow-2xl shadow-purple-950/50 max-w-md w-full border border-purple-800/40">
            <h3 className="text-xl font-bold text-purple-500">Unlock AI Music Studio</h3>
            <p className="text-sm text-gray-300 mt-2">Subscribe to access Studio features and receive credits. (This is a prototype: integrate Stripe or Paddle on your backend.)</p>
            <ul className="mt-3 list-disc list-inside text-sm text-gray-300">
              <li>Unlimited Studio access while subscribed</li>
              <li>Discounted pay-per-job credit packs</li>
              <li>Priority processing</li>
            </ul>
            <div className="mt-4 flex gap-2 justify-end">
              <button onClick={()=>setIsPaywallOpen(false)} className="px-3 py-1 rounded-md border border-purple-700/50 text-gray-300 hover:border-purple-600 transition font-medium">Cancel</button>
              <button onClick={handleMockPurchase} className="px-4 py-1 rounded-md bg-purple-800 hover:bg-purple-900 text-white transition font-medium">Mock Purchase (simulate)</button>
            </div>
          </div>
        </div>
      )}

      <footer className="max-w-4xl mx-auto mt-8 text-sm text-gray-500 text-center">Prototype — Backend wiring required for production. See comments at top of the source code for endpoints to implement.</footer>
    </div>
  )
}
