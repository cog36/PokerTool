import { useState } from 'react';
export default function LibraryUpload({ kind, onImported }) {
  const [file, setFile] = useState(null), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState(false);
  async function upload(event) {
    event.preventDefault(); if (!file || busy) return;
    setBusy(true); setMessage(''); setError(false);
    try {
      const body = new FormData(); body.append('file', file);
      const response = await fetch(`/api/library/${kind}`, { method: 'POST', body });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Import failed. Check the Python API.');
      if (data.already_imported) {
        setMessage(`Duplicate not imported; this file already exists at ${kind === 'hands' ? 'hand_histories' : 'tournament_summaries'}/${data.file}.`);
      } else {
        setMessage(`Saved to ${kind === 'hands' ? 'hand_histories' : 'tournament_summaries'}/${data.file}`);
        onImported?.();
      }
    } catch (failure) { setError(true); setMessage(failure.message); }
    finally { setBusy(false); }
  }
  return <details className="panel library-upload"><summary>Add {kind === 'hands' ? 'hand histories' : 'tournament summaries'}</summary><form onSubmit={upload}><label className="field">New .txt export<input type="file" accept=".txt,text/plain" onChange={event => setFile(event.target.files?.[0] || null)} /></label><button className="button" disabled={!file || busy}>{busy ? 'Importing…' : 'Import into folder'}</button></form><p className={`caption${error ? ' import-error' : ''}`} role={error ? 'alert' : 'status'}>{message}</p><p className="caption">Validated before saving. Existing files are not overwritten.</p></details>;
}
