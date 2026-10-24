import { useRef, useState } from 'react';
import { readStored, validNotes, writeStored } from '../model';

export default function Notebook() {
  // Keep the original key so notes written before the React migration remain available.
  const [notes, setNotes] = useState(() => validNotes(readStored('river.notes', [])));
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('Preflop');
  const [status, setStatus] = useState('');
  const titleInput = useRef(null);
  function save(event) {
    event.preventDefault();
    if (!title.trim() || !body.trim()) { setStatus('Add a title and a takeaway before saving.'); return; }
    const note = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, title: title.trim(), body: body.trim(), category, date: Date.now() };
    const next = [note, ...notes];
    if (!writeStored('river.notes', next)) { setStatus('Storage is unavailable or full. Your draft is still here; copy it somewhere safe.'); return; }
    setNotes(next); setTitle(''); setBody(''); setCategory('Preflop'); setStatus('Takeaway saved on this device.');
  }
  function remove(id) {
    const next = notes.filter(note => note.id !== id);
    if (!writeStored('river.notes', next)) { setStatus('Could not save the deletion. Your note has been kept.'); return; }
    setNotes(next); setStatus('Note deleted.');
  }
  return <section className="page" id="notebook">
    <div className="page-title"><div><p className="eyebrow">YOUR STUDY NOTES</p><h1>Study Notebook<span>.</span></h1><p>Save a hand, an observation, or a question for your next session.</p></div><button className="button primary" type="button" onClick={() => titleInput.current.focus()}>New note <span>＋</span></button></div>
    <div className="notebook-layout"><section className="panel"><div className="panel-title"><h2>Write your takeaway</h2><span className="tag">SAVED ON THIS DEVICE</span></div>
      <form onSubmit={save}><label className="field">Title<input ref={titleInput} value={title} onChange={event => setTitle(event.target.value)} maxLength={80} placeholder="One thing I learned today…" required /></label><label className="field">Focus<select value={category} onChange={event => setCategory(event.target.value)}>{['Preflop', 'Position', 'Bet sizing', 'Mindset', 'General'].map(value => <option key={value}>{value}</option>)}</select></label><label className="field">Your notes<textarea value={body} onChange={event => setBody(event.target.value)} rows={8} maxLength={5000} placeholder="What happened? What would you think about next time?" required /></label><button className="button primary" type="submit">Save takeaway <span>↗</span></button><p className="caption save-status" role="status">{status}</p></form>
    </section><section><div className="section-heading compact"><h2>Your takeaways</h2><span className="muted">{notes.length} {notes.length === 1 ? 'note' : 'notes'}</span></div><div className="note-list">
      {!notes.length && <div className="empty-notes"><span>▤</span><h3>Your next insight goes here.</h3><p>Write a takeaway and make it part of your game.</p></div>}
      {notes.map(note => <article className="saved-note" key={note.id}><header><span className="tag">{note.category}</span><button type="button" aria-label={`Delete note: ${note.title}`} onClick={() => remove(note.id)}>Delete</button></header><h3>{note.title}</h3><p>{note.body}</p><time dateTime={new Date(note.date).toISOString()}>{new Date(note.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</time></article>)}
    </div></section></div>
  </section>;
}
