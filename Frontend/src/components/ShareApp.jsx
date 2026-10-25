import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

function shareAddress(value) {
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url;
  } catch { return null; }
}

export default function ShareApp() {
  const [address, setAddress] = useState(() => new URL('./', location.href).href);
  const [image, setImage] = useState('');
  const [status, setStatus] = useState('');
  const [networkLinks, setNetworkLinks] = useState([]);
  const url = shareAddress(address);
  const local = url && /^(localhost|.*\.localhost|127(?:\.\d+){3}|\[::1\]|0\.0\.0\.0)$/i.test(url.hostname);
  const valid = url && !local;

  useEffect(() => {
    if (!import.meta.env.DEV || !local) return;
    let cancelled = false;
    // Resolve the actual Wi-Fi address and chosen port, even when opened on localhost.
    fetch(`${import.meta.env.BASE_URL}__phone-links`)
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        const links = Array.isArray(data?.links) ? data.links.filter(link => shareAddress(link)) : [];
        if (!cancelled && links.length) {
          setNetworkLinks(links);
          setAddress(current => current === new URL('./', location.href).href ? links[0] : current);
        }
      }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setImage('');
    setStatus('');
    if (valid) {
      // Generate on this device; the demo address never goes to a QR service.
      QRCode.toDataURL(url.href, { width: 640, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#121816', light: '#ffffff' } })
        .then(data => { if (!cancelled) setImage(data); })
        .catch(() => { if (!cancelled) setStatus('This link is too long for a QR code. Try a shorter address.'); });
    }
    return () => { cancelled = true; };
  }, [address]);

  async function copyLink() {
    try { await navigator.clipboard.writeText(url.href); setStatus('Link copied.'); }
    catch { setStatus('Select and copy the address above.'); }
  }

  return <main className="share-page">
    <a className="share-brand" href="./">♠ PokerTool</a>
    <section className="share-app-dialog" aria-labelledby="share-app-title">
      <header><div><h1 id="share-app-title">Share PokerTool</h1></div></header>
      <p>Scan with your camera to open the app. Download the code for your presentation or demo table.</p>
      <label className="field">Website or demo address<input type="url" value={address} onChange={event => setAddress(event.target.value)} spellCheck="false" autoCapitalize="none" autoComplete="off" /></label>
      {networkLinks.length > 1 && <label className="field">Wi-Fi address<select value={networkLinks.includes(address) ? address : ''} onChange={event => { if (event.target.value) setAddress(event.target.value); }}><option value="" disabled>Choose a network</option>{networkLinks.map(link => <option key={link} value={link}>{link}</option>)}</select></label>}
      {!url && <p className="share-address-note">Enter a full http:// or https:// address.</p>}
      {local && <p className="share-address-note">This is a computer-only address. Run npm run dev:mobile, then reload this page to detect your Wi-Fi address automatically. You can also paste the Network URL into the field above. Or open this page at that Network address followed by /share.html to generate the code automatically.</p>}
      {valid && <>
        {!image && !status && <p role="status">Generating your QR code…</p>}
        {image && <img className="share-qr-image" src={image} width="256" height="256" alt="QR code to open PokerTool at the address above" />}
        <p className="caption">For a Wi-Fi address, keep your Mac running and use the same network. Home-screen installation and offline support need HTTPS. Test this link on a phone before presenting.</p>
        <div className="share-app-actions"><button className="button primary" onClick={copyLink} type="button">Copy link</button>{image && <a className="button" href={image} download="PokerTool-QR.png">Download QR</a>}</div>
      </>}
      <p className="caption" role="status">{status}</p>
    </section>
  </main>;
}
