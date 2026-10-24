import { useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Model text becomes React elements, never raw HTML. Remote images are omitted
// so a reply cannot fetch arbitrary assets just by being displayed.
export default function CoachReply({ text, animate = false, onComplete, onProgress }) {
  const [visible, setVisible] = useState(animate ? '' : text);
  const completed = useRef(onComplete);
  completed.current = onComplete;
  const progress = useRef(onProgress);
  progress.current = onProgress;
  useEffect(() => { progress.current?.(); }, [visible]);
  useEffect(() => {
    if (!animate) { setVisible(text); return; }
    const words = text.match(/\S+\s*|\s+/g) || [];
    // Reveal at a steady word cadence, with a bounded duration for long replies.
    const batch = Math.max(1, Math.ceil(words.length / 350));
    let count = 0;
    setVisible('');
    const timer = setInterval(() => {
      count = Math.min(words.length, count + batch);
      setVisible(words.slice(0, count).join(''));
      if (count === words.length) { clearInterval(timer); completed.current?.(); }
    }, 45);
    return () => clearInterval(timer);
  }, [text, animate]);
  return <div className="coach-reply" aria-busy={animate && visible !== text}><Markdown remarkPlugins={[remarkGfm]} skipHtml
    allowedElements={['p', 'strong', 'em', 'del', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'hr', 'br', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'sup']}
    components={{
      a: ({ children, href }) => href ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
      table: ({ children }) => <div className="coach-table-scroll" tabIndex={0} role="region" aria-label="Coach comparison table"><table>{children}</table></div>,
      h1: ({ children }) => <h3>{children}</h3>, h2: ({ children }) => <h3>{children}</h3>,
    }}>{visible}</Markdown>{animate && visible !== text && <span className="coach-writing-caret" aria-hidden="true" />}</div>;
}
