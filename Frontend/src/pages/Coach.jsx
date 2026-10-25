import { useEffect, useRef, useState } from 'react';
import CoachReply from '../components/CoachReply';
import PlayerPortrait from '../components/PlayerPortrait';
import './Coach.css';

const starters = [
  { icon: '▦', title: 'Find your range', question: 'How should my opening range change from UTG to the button?' },
  { icon: '♧', title: 'Review a decision', question: 'What information should I include when reviewing a hand?' },
  { icon: '◎', title: 'Build the fundamentals', question: 'Explain the difference between a value bet and a bluff.' },
];
const connectionLabels = {
  checking: 'Checking connection', ready: 'Server ready', connected: 'Coach connected',
  offline: 'Server offline', setup: 'Setup needed', issue: 'Connection needs attention',
};

export default function Coach() {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState('constructive');
  const [busy, setBusy] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [error, setError] = useState(null);
  const [connection, setConnection] = useState('checking');
  const [pending, setPending] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const request = useRef(null);
  const healthRequest = useRef(null);
  const locked = useRef(false);
  const transcript = useRef(null);
  const followReply = useRef(true);
  const composer = useRef(null);
  const input = useRef(null);

  async function checkConnection() {
    healthRequest.current?.abort();
    const controller = new AbortController();
    healthRequest.current = controller;
    const timeout = setTimeout(() => controller.abort(), 5000);
    setConnection('checking');
    try {
      const response = await fetch('/api/health', { signal: controller.signal });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (healthRequest.current !== controller) return;
      setConnection(data.configured ? 'ready' : 'setup');
    } catch {
      if (healthRequest.current === controller) setConnection('offline');
    } finally {
      clearTimeout(timeout);
    }
  }

  useEffect(() => {
    checkConnection();
    return () => { healthRequest.current?.abort(); healthRequest.current = null; request.current?.abort(); };
  }, []);

  useEffect(() => {
    const log = transcript.current;
    if (log) log.scrollTop = !messages.length && !pending && !busy ? 0 : log.scrollHeight;
  }, [messages, pending, busy, error]);

  function choosePrompt(text) {
    setDraft(text); setError(null); input.current?.focus();
  }

  async function send(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || locked.current || revealing) return;
    const conversation = [...messages, { role: 'user', content: text }];
    const history = conversation.slice(-19);
    if (history.reduce((total, item) => total + item.content.length, 0) > 24000) {
      setError({ message: 'This conversation is full. Start a new chat to explore another hand.', code: 'history_limit' });
      return;
    }
    locked.current = true;
    followReply.current = true;
    setBusy(true); setError(null); setPending(text); setCopyStatus('');
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, mode }), signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        // Accept legacy text errors as well as the API's actionable error categories.
        const detail = data?.detail;
        const failure = new Error(typeof detail === 'string' ? detail : detail?.message || 'The Python API could not complete this request. Check the server and try again.');
        failure.code = detail?.code || 'request_failed';
        throw failure;
      }
      if (typeof data?.reply !== 'string' || !data.reply.trim()) throw new Error('No reply arrived. Your question is still here; please try again.');
      setMessages([...conversation, { role: 'assistant', content: data.reply }]);
      setDraft(''); setConnection('connected'); setRevealing(true);
    } catch (failure) {
      const stopped = failure.name === 'AbortError';
      const offline = failure instanceof TypeError;
      setError({
        code: stopped ? 'stopped' : failure.code || 'request_failed',
        message: stopped ? 'Request stopped or timed out. Your question is still here.' : offline ? 'The coach server is offline. Run npm start in the project folder, open http://127.0.0.1:5173, then retry.' : failure.message,
      });
      if (!stopped) setConnection(offline ? 'offline' : 'issue');
    } finally {
      clearTimeout(timeout); request.current = null; locked.current = false; setBusy(false); setPending('');
    }
  }

  async function copyReply(text) {
    try { await navigator.clipboard.writeText(text); setCopyStatus('Reply copied.'); }
    catch { setCopyStatus('Copy is unavailable. You can select and copy the reply manually.'); }
  }

  const roast = mode === 'roast';
  return <section className="page coach-page" id="coach">
    <div className="page-title"><div><p className="eyebrow">TALK THROUGH A HAND</p><h1>AI Coach<span>.</span></h1><p>Ask a question or work through a decision with your coach.</p></div><span className="pill outlined">AI guidance · not solver output</span></div>
    <div className="coach-layout">
      <section className="panel coach-chat">
        <header className="coach-chat-header">
          <div className="coach-heading"><span className="coach-mini-avatar" aria-hidden="true">✦</span><div><h2>PokerTool Coach</h2><span className={`coach-connection ${connection}`} role="status"><i />{connectionLabels[connection]}</span></div></div>
          <button type="button" className="button coach-new-chat" disabled={busy || (!messages.length && !draft && !error)} onClick={() => { setRevealing(false); setMessages([]); setDraft(''); setError(null); setCopyStatus(''); input.current?.focus(); }}>New chat ↻</button>
        </header>
        <div className="coach-transcript" ref={transcript} onScroll={event => { const log = event.currentTarget; followReply.current = log.scrollHeight - log.scrollTop - log.clientHeight < 80; }} role="log" aria-live="polite" aria-label="Coaching conversation">
          {!messages.length && !busy && <div className="coach-welcome">
            <div className="coach-orbit" aria-hidden="true"><span>♠</span><i>✦</i></div>
            <span className="coach-intro-label">YOUR STUDY SESSION</span><h2>A clearer view of your next move.</h2><p>Review a hand, explore a concept, or work through a difficult spot. Start with a question below.</p>
            <div className="coach-starters">{starters.map(starter => <button key={starter.title} type="button" onClick={() => choosePrompt(starter.question)}><span className="starter-symbol" aria-hidden="true">{starter.icon}</span><span><strong>{starter.title}</strong><small>{starter.question}</small></span><b aria-hidden="true">↗</b></button>)}</div>
          </div>}
          {messages.map((message, index) => <article className={`coach-message ${message.role}`} key={index}><div className="coach-message-label"><span>{message.role === 'user' ? 'YOU' : 'POKERTOOL COACH'}</span>{message.role === 'assistant' && <button type="button" aria-label={`Copy coach reply ${Math.ceil(index / 2)}`} onClick={() => copyReply(message.content)}>Copy ↗</button>}</div>{message.role === 'assistant' ? <CoachReply text={message.content} animate={revealing && index === messages.length - 1} onComplete={() => setRevealing(false)} onProgress={() => { const log = transcript.current; if (log && followReply.current) log.scrollTop = log.scrollHeight; }} /> : <p>{message.content}</p>}</article>)}
          {pending && <article className="coach-message user pending-message"><div className="coach-message-label"><span>YOU</span></div><p>{pending}</p></article>}
          {revealing && <div className="coach-reveal-controls"><span role="status">Coach is writing…</span><button type="button" onClick={() => setRevealing(false)}>Show full response</button></div>}
          {busy && <div className="coach-thinking" role="status"><span className="coach-mini-avatar" aria-hidden="true">✦</span><span>Thinking it through<span className="coach-typing" aria-hidden="true"><i /><i /><i /></span></span></div>}
        </div>
        {error && <div className={`coach-error${error.code === 'stopped' ? ' stopped' : ''}`} role="alert"><span className="coach-error-icon" aria-hidden="true">{error.code === 'stopped' ? 'Ⅱ' : '!'}</span><div><strong>{error.code === 'model_unavailable' ? 'The coaching model needs an update' : error.code === 'stopped' ? 'Your draft is safe' : 'Let’s reconnect your coach'}</strong><p>{error.message}</p></div><button type="button" disabled={busy || revealing || !draft.trim()} onClick={() => composer.current?.requestSubmit()}>Retry ↗</button></div>}
        <form className="coach-composer" ref={composer} onSubmit={send}>
          <label className="field">Message your coach<textarea ref={input} rows={2} maxLength={6000} value={draft} disabled={busy} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); if (!busy) composer.current?.requestSubmit(); } }} placeholder="What would you like to work on?" required /></label>
          <div className="coach-compose-footer"><span className="caption">{draft.length.toLocaleString()} / 6,000 <span className="composer-shortcut">· Ctrl / ⌘ + Enter to send</span></span><div>{busy && <button type="button" className="button" onClick={() => request.current?.abort()}>Stop</button>}<button className="button primary" type="submit" disabled={busy || revealing || !draft.trim()}>{busy ? 'Thinking…' : 'Send message ↗'}</button></div></div>
          <p className="coach-footer-note">A study partner, not a solver. Always question the reasoning.</p><span className="copy-status" role="status">{copyStatus}</span>
        </form>
      </section>
      <aside className="coach-sidebar">
        <section className="panel coach-personality"><div className={`coach-character${roast ? ' roast' : ''}`} aria-hidden="true"><PlayerPortrait type={roast ? 'lag' : 'gto'} /></div><span className="eyebrow">IN YOUR CORNER</span><h2>{roast ? 'A little spice. Still on your side.' : 'A coach for your next decision.'}</h2><p>{roast ? 'Some friendly poker humour, followed by a useful lesson. We roast the decision, not you.' : 'Patient explanations to help you understand the spot and make your next decision with purpose.'}</p><label className="field">Coaching style<select value={mode} disabled={busy} onChange={event => setMode(event.target.value)}><option value="constructive">Constructive coach</option><option value="roast">Friendly roast</option></select></label></section>
        <section className="panel coach-hand-guide"><span className="eyebrow">GET A BETTER ANSWER</span><h3>Set the scene.</h3><p>The more context you bring, the more useful the conversation.</p><ul>{['Position and effective stacks', 'Your cards and the board', 'Bet sizes and earlier actions', 'The decision you’re unsure about'].map((text, index) => <li key={text}><span>0{index + 1}</span>{text}</li>)}</ul><button type="button" className="button" disabled={busy} onClick={() => choosePrompt('Help me review this hand:\nPosition: \nEffective stacks: \nMy hole cards: \nBoard: \nActions and bet sizes: \nMy question: ')}>Use a hand template <span>↗</span></button></section>
        <div className="coach-service-note"><span>◈</span><p>Only the conversation you submit is sent to Groq. Your notebook is private. Arena decision reviews separately send your visible hand context after each move.</p></div>
        {(connection === 'offline' || connection === 'setup' || connection === 'issue') && <div className="coach-setup-note"><p>{connection === 'setup' ? 'Add your Groq key in backend/.env to connect the coach.' : connection === 'offline' ? 'Run npm start in the project folder, then open http://127.0.0.1:5173.' : 'Check the message beside your question, then retry.'}</p><button type="button" disabled={busy} onClick={checkConnection}>Check connection ↗</button></div>}
      </aside>
    </div>
  </section>;
}
