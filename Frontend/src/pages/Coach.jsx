import { useEffect, useRef, useState } from 'react';

const starters = [
  'How should my opening range change from UTG to the button?',
  'What information should I include when reviewing a hand?',
  'Explain the difference between a value bet and a bluff.',
];

export default function Coach() {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState('constructive');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [configured, setConfigured] = useState(null);
  const request = useRef(null);
  const locked = useRef(false);
  const transcript = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/health', { signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => setConfigured(Boolean(data.configured)))
      .catch(() => {});
    return () => { controller.abort(); request.current?.abort(); };
  }, []);

  useEffect(() => {
    const log = transcript.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, busy, error]);

  async function send(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || locked.current) return;
    const pending = [...messages, { role: 'user', content: text }];
    // Bound history to the API contract, retaining complete recent conversation turns.
    const history = pending.slice(-19);
    if (history.reduce((total, item) => total + item.content.length, 0) > 24000) {
      setError('This conversation is too long. Start a new chat before sending more.');
      return;
    }
    locked.current = true;
    setBusy(true); setError('');
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, mode }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof data?.detail === 'string' ? data.detail : 'Could not send your message. Check the Python API and try again.');
      if (typeof data?.reply !== 'string' || !data.reply.trim()) throw new Error('The coach returned no reply. Please try again.');
      setMessages([...pending, { role: 'assistant', content: data.reply }]);
      setDraft(''); setConfigured(true);
    } catch (failure) {
      // Keep the draft and accepted history untouched on failure so retry is safe.
      setError(failure.name === 'AbortError' ? 'Request stopped or timed out. Your draft is still here.' : failure.message === 'Failed to fetch' ? 'Cannot reach the Python API. Start it on port 8000 and try again.' : failure.message);
    } finally {
      clearTimeout(timeout); request.current = null; locked.current = false; setBusy(false);
    }
  }

  return <section className="page" id="coach">
    <div className="page-title"><div><p className="eyebrow">A LITTLE PERSPECTIVE HELPS</p><h1>AI Coach<span>.</span></h1><p>Talk through the decision. Understand the reasoning.</p></div><span className="pill outlined">AI feedback · not solver analysis</span></div>
    <div className="coach-layout">
      <section className="panel coach-chat">
        <div className="panel-title"><h2>Your table-side study partner</h2><button type="button" className="button" disabled={busy || !messages.length} onClick={() => { setMessages([]); setError(''); }}>New chat ↻</button></div>
        <div className="coach-transcript" ref={transcript} role="log" aria-live="polite" aria-label="Coaching conversation">
          {!messages.length && <div className="coach-welcome"><span>✦</span><h2>What’s on your mind?</h2><p>Ask about a concept or describe a hand. Include positions, stack sizes, the board, and the action.</p><div className="coach-starters">{starters.map(text => <button key={text} type="button" disabled={busy} onClick={() => setDraft(text)}>{text}<span>↗</span></button>)}</div></div>}
          {messages.map((message, index) => <article className={`coach-message ${message.role}`} key={index}><span>{message.role === 'user' ? 'YOU' : '✦ POKERTOOL COACH'}</span><p>{message.content}</p></article>)}
          {busy && <p className="coach-thinking" role="status">✦ Coach is thinking…</p>}
        </div>
        {error && <p className="coach-error" role="alert">{error}</p>}
        <form className="coach-composer" onSubmit={send}>
          <label className="field">Your question<textarea rows={3} maxLength={6000} value={draft} disabled={busy} onChange={event => setDraft(event.target.value)} placeholder="I was on the button with AKs…" required /></label>
          <div className="coach-compose-footer"><span className="caption">{draft.length.toLocaleString()} / 6,000 · Replies may be inaccurate.</span><div>{busy && <button type="button" className="button" onClick={() => request.current?.abort()}>Stop</button>}<button className="button primary" type="submit" disabled={busy || !draft.trim()}>{busy ? 'Thinking…' : 'Ask the coach ↗'}</button></div></div>
        </form>
      </section>
      <aside className="coach-sidebar"><section className="panel"><p className="eyebrow">FIND YOUR STYLE</p><h2>Helpful, with personality.</h2><label className="field">Coaching style<select value={mode} disabled={busy} onChange={event => setMode(event.target.value)}><option value="constructive">Constructive coach</option><option value="roast">Friendly roast</option></select></label><p className="caption">{mode === 'roast' ? 'A little poker humour followed by useful reasoning. The decision gets roasted, not you.' : 'Supportive explanations focused on improving your next decision.'}</p></section><section className="learning-note"><span>✳</span><h3>Give your coach the context.</h3><p>Position · effective stacks · hole cards · board cards · bet sizes · previous actions.</p><p>The coach cannot see your practice results, notebook, or a solver. Only the conversation is sent to Groq when you submit.</p></section>{configured === false && <p className="caption">Chat needs server setup: add a Groq API key to .env, then restart the Python API.</p>}</aside>
    </div>
  </section>;
}
