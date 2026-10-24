import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'dark');
  const [manual, setManual] = useState(() => {
    try { return ['light', 'dark'].includes(localStorage.getItem('pokerttool.theme')); }
    catch { return false; }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#0b1114' : '#f4f7f5';
  }, [theme]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => { if (!manual) setTheme(media.matches ? 'dark' : 'light'); };
    media.addEventListener('change', update);
    update();
    return () => media.removeEventListener('change', update);
  }, [manual]);
  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setManual(true); setTheme(next);
    try { localStorage.setItem('pokerttool.theme', next); } catch { /* Switching still works for this visit. */ }
  }
  const next = theme === 'dark' ? 'light' : 'dark';
  return <button type="button" className="theme-toggle" onClick={toggle} aria-label={`Switch to ${next} mode`} aria-pressed={theme === 'dark'}><span id="theme-icon" aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span><span id="theme-label">{next === 'light' ? 'Light mode' : 'Dark mode'}</span></button>;
}
