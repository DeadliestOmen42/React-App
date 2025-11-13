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

  return (
    <div className="min-h-screen bg-gray-50 p-6 sm:p-12">
      <header className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-semibold">AI Music Studio — Lyrics & Studio</h1>
        <p className="mt-2 text-sm text-gray-600">Generate lyrics using AI. Starter credits: {credits}</p>
      </header>

      <main className="max-w-4xl mx-auto mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-xl font-medium">Lyrics Generator</h2>
          <p className="text-sm text-gray-500 mt-1">Uses 1 credit per generation. Free starter credits available.</p>

          <form onSubmit={handleGenerateLyrics} className="mt-4">
            <textarea
              value={lyricsPrompt}
              onChange={e=>setLyricsPrompt(e.target.value)}
              placeholder="Describe the song: mood, genre, key lines, tempo..."
              className="w-full rounded-md border p-3 h-32 resize-none"
            />
            <div className="flex items-center justify-between mt-3">
              <div className="text-sm text-gray-600">Credits: <strong>{credits}</strong></div>
              <div className="flex gap-2">
                <button type="button" onClick={()=>{ setLyricsPrompt('A wistful indie-pop chorus about late-night city lights and moving on.'); }} className="px-3 py-1 rounded-md border">Try sample</button>
                <button type="submit" disabled={isGenerating} className="px-4 py-1 rounded-md bg-indigo-600 text-white disabled:opacity-60">{isGenerating? 'Generating...' : 'Generate Lyrics (1 credit)'}</button>
              </div>
            </div>
          </form>

          <div className="mt-4">
            <h3 className="font-medium">Output</h3>
            <div className="mt-2 min-h-[120px] rounded-md border p-3 bg-gray-50 whitespace-pre-wrap">{lyricsResult || <span className="text-gray-400">Your generated lyrics will appear here.</span>}</div>
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow p-6">
          <div className="flex justify-between items-start">
            <h2 className="text-xl font-medium">AI Music Studio</h2>
            <div className="text-sm text-gray-600">Subscription required</div>
          </div>

          <div className="mt-3 text-sm text-gray-600">Upload audio to apply AI edits (mixing, mastering, stem editing). You can also paste generated lyrics into this workflow and pair with vocal models (backend work required).</div>

          <div className="mt-4">
            <label className="block text-sm font-medium">Upload audio</label>
            <input type="file" accept="audio/*" onChange={handleFileChange} className="mt-2" />
          </div>

          {audioFile && (
            <div className="mt-4">
              <audio controls src={audioFile} ref={audioRef} className="w-full" />
              <div className="mt-2">
                <label className="block text-sm">Studio notes (what do you want changed)</label>
                <input value={studioNotes} onChange={e=>setStudioNotes(e.target.value)} placeholder="e.g. reduce reverb, boost vocal presence, add upbeat drum fill" className="w-full rounded-md border p-2 mt-1" />
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={handleStudioProcess} className="px-4 py-1 rounded-md bg-green-600 text-white" disabled={processing || !subscriptionActive}>{processing ? 'Processing...' : 'Process with AI (subscription)'}</button>
                <button onClick={()=>setSubscriptionActive(false)} className="px-3 py-1 rounded-md border">Sign out (mock)</button>
              </div>
            </div>
          )}

          <div className="mt-6 border-t pt-4">
            <h3 className="font-medium">History</h3>
            <ul className="mt-2 text-sm space-y-2">
              {history.length===0 && <li className="text-gray-400">No actions yet.</li>}
              {history.map((h,i)=> (
                <li key={i} className="flex justify-between items-center">
                  <div>{h.type} {h.name ? `- ${h.name}` : ''} {h.notes ? `: ${h.notes}` : ''}</div>
                  <div className="text-xs text-gray-500">{new Date(h.time).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 text-sm text-gray-500">Note: This Studio UI is a frontend shell — real audio editing and AI transforms require backend services and audio models (Spleeter, OpenAI audio models, or specialized music ML stacks).</div>
        </section>

        <section className="col-span-1 lg:col-span-2 bg-white rounded-2xl shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Account & Billing</h3>
              <div className="text-sm text-gray-600">Credits: <strong>{credits}</strong> • Subscription: {subscriptionActive ? 'Active' : 'Inactive'}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>{ setCredits(c => c + 2); }} className="px-3 py-1 rounded-md border">Add 2 free credits (dev)</button>
              <button onClick={handleOpenPaywall} className="px-3 py-1 rounded-md bg-indigo-600 text-white">Manage Billing</button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-md border">
              <div className="text-sm text-gray-500">Free plan</div>
              <div className="font-medium">{STARTER_CREDITS} starter credits</div>
            </div>
            <div className="p-4 rounded-md border">
              <div className="text-sm text-gray-500">Pro (monthly)</div>
              <div className="font-medium">Subscription unlocks Studio</div>
            </div>
            <div className="p-4 p-4 rounded-md border">
              <div className="text-sm text-gray-500">Pay per job</div>
              <div className="font-medium">Buy credits & single-run studio jobs</div>
            </div>
          </div>
        </section>
      </main>

      {isPaywallOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={()=>setIsPaywallOpen(false)} />
          <div className="relative bg-white p-6 rounded-2xl shadow max-w-md w-full">
            <h3 className="text-xl font-medium">Unlock AI Music Studio</h3>
            <p className="text-sm text-gray-600 mt-2">Subscribe to access Studio features and receive credits. (This is a prototype: integrate Stripe or Paddle on your backend.)</p>
            <ul className="mt-3 list-disc list-inside text-sm text-gray-700">
              <li>Unlimited Studio access while subscribed</li>
              <li>Discounted pay-per-job credit packs</li>
              <li>Priority processing</li>
            </ul>
            <div className="mt-4 flex gap-2 justify-end">
              <button onClick={()=>setIsPaywallOpen(false)} className="px-3 py-1 rounded-md border">Cancel</button>
              <button onClick={handleMockPurchase} className="px-4 py-1 rounded-md bg-indigo-600 text-white">Mock Purchase (simulate)</button>
            </div>
          </div>
        </div>
      )}

      <footer className="max-w-4xl mx-auto mt-8 text-sm text-gray-500">Prototype — Backend wiring required for production. See comments at top of the source code for endpoints to implement.</footer>
    </div>
  )
}
