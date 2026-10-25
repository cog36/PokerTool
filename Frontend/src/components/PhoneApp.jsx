import { useEffect, useState } from 'react';

export default function PhoneApp() {
  const [online, setOnline] = useState(navigator.onLine);
  const [install, setInstall] = useState(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const connection = () => setOnline(navigator.onLine);
    const offerInstall = event => { event.preventDefault(); setInstall(event); };
    const installed = () => setInstall(null);
    window.addEventListener('online', connection);
    window.addEventListener('offline', connection);
    window.addEventListener('beforeinstallprompt', offerInstall);
    window.addEventListener('appinstalled', installed);
    if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then(registration => {
        const waiting = () => { if (registration.waiting && navigator.serviceWorker.controller) setReady(true); };
        waiting();
        registration.addEventListener('updatefound', () => {
          registration.installing?.addEventListener('statechange', waiting);
        });
      }).catch(error => console.warn('Offline setup unavailable:', error.message));
    }
    return () => {
      window.removeEventListener('online', connection);
      window.removeEventListener('offline', connection);
      window.removeEventListener('beforeinstallprompt', offerInstall);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);
  async function installApp() {
    await install.prompt();
    await install.userChoice;
    setInstall(null);
  }
  if (online && !install && !ready) return null;
  return <div className="phone-app-notice" role="status">
    {!online && <span>Offline · Arena, charts and saved notes are available after the app has downloaded. AI chat, uploads and analysis need a connection.</span>}
    {ready && <span>An update is ready. Close all PokerTool windows and reopen when you finish your hand.</span>}
    {install && <button className="button" onClick={installApp}>Install PokerTool</button>}
  </div>;
}
