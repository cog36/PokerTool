import { useCallback, useEffect, useRef, useState } from 'react';

// Small synthesized effects keep the game self-contained: no audio downloads,
// no API calls, and no dependency on a particular sound-file codec.
export default function useArenaSound(active) {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem('pokertool.arena.sound') !== 'off'; } catch { return true; }
  });
  const [error, setError] = useState('');
  const context = useRef(null);
  const master = useRef(null);
  const voices = useRef(new Set());
  const stopVoices = useCallback(() => {
    for (const voice of voices.current) { try { voice.stop(); } catch { /* Already ended. */ } }
    voices.current.clear();
  }, []);
  const setting = useRef(enabled);
  setting.current = enabled;
  const supported = typeof window.AudioContext === 'function' || typeof window.webkitAudioContext === 'function';

  const unlock = useCallback(async () => {
    if (!setting.current || !supported) return;
    try {
      if (!context.current || context.current.state === 'closed') {
        const Audio = window.AudioContext || window.webkitAudioContext;
        context.current = new Audio();
        master.current = context.current.createGain();
        master.current.gain.value = .22;
        master.current.connect(context.current.destination);
      }
      if (context.current.state === 'suspended') await context.current.resume();
      setError('');
    } catch { setError('Audio is unavailable in this browser.'); }
  }, [supported]);

  const play = useCallback(type => {
    const audio = context.current;
    if (!setting.current || !audio || audio.state !== 'running' || document.hidden) return;
    const now = audio.currentTime;
    if (type === 'deal') {
      // A quick filtered paper swish, rather than a loud click.
      const length = Math.floor(audio.sampleRate * .065);
      const buffer = audio.createBuffer(1, length, audio.sampleRate);
      const data = buffer.getChannelData(0);
      // A private noise seed keeps audio from consuming the game's random draws.
      let noise = 1729;
      for (let index = 0; index < length; index++) {
        noise = (Math.imul(noise, 1664525) + 1013904223) >>> 0;
        data[index] = (noise / 4294967296 * 2 - 1) * (1 - index / length);
      }
      const source = audio.createBufferSource();
      const filter = audio.createBiquadFilter();
      const gain = audio.createGain();
      source.buffer = buffer;
      filter.type = 'bandpass'; filter.frequency.value = 2200; filter.Q.value = .7;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(.45, now + .004);
      gain.gain.exponentialRampToValueAtTime(.001, now + .065);
      source.connect(filter); filter.connect(gain); gain.connect(master.current);
      voices.current.add(source);
      source.onended = () => { voices.current.delete(source); source.disconnect(); filter.disconnect(); gain.disconnect(); };
      source.start(now); source.stop(now + .07);
    } else {
      // A two-part bell. Different pitches provide a quiet cue for each action.
      const pitch = { fold: 520, check: 660, call: 780, raise: 920 }[type] || 780;
      [1, 2.01].forEach((harmonic, index) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = 'sine'; oscillator.frequency.value = pitch * harmonic;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(index ? .12 : .35, now + .006);
        gain.gain.exponentialRampToValueAtTime(.001, now + .19);
        oscillator.connect(gain); gain.connect(master.current);
        voices.current.add(oscillator);
        oscillator.onended = () => { voices.current.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(now); oscillator.stop(now + .2);
      });
    }
  }, []);

  async function toggle() {
    const next = !setting.current;
    setting.current = next; setEnabled(next);
    try { localStorage.setItem('pokertool.arena.sound', next ? 'on' : 'off'); } catch { /* Session-only setting when storage is unavailable. */ }
    if (next) { await unlock(); play('call'); }
    else { stopVoices(); if (context.current?.state === 'running') await context.current.suspend().catch(() => {}); }
  }

  useEffect(() => {
    if (!active) {
      stopVoices();
      context.current?.suspend().catch(() => {});
      return;
    }
    // Browsers require a gesture before sound can begin, even for a saved setting.
    const gesture = () => { if (setting.current) unlock(); };
    const visibility = () => {
      if (document.hidden) { stopVoices(); context.current?.suspend().catch(() => {}); }
      else if (setting.current && context.current) unlock();
    };
    window.addEventListener('pointerdown', gesture);
    window.addEventListener('keydown', gesture);
    document.addEventListener('visibilitychange', visibility);
    if (setting.current && context.current) unlock();
    return () => {
      window.removeEventListener('pointerdown', gesture);
      window.removeEventListener('keydown', gesture);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [active, unlock, stopVoices]);

  useEffect(() => () => {
    stopVoices();
    context.current?.close().catch(() => {});
    context.current = null; master.current = null;
  }, [stopVoices]);
  return { enabled, supported, error, toggle, play };
}
