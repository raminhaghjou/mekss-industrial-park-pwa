/**
 * Procedural emergency siren via Web Audio API.
 * Alternating two-tone pattern (ISO-style audible warning) without media assets.
 */
export function createEmergencySiren() {
  /** @type {AudioContext | null} */
  let context = null;
  /** @type {OscillatorNode | null} */
  let oscillator = null;
  /** @type {GainNode | null} */
  let gain = null;
  /** @type {number | null} */
  let intervalId = null;
  let unlocked = false;
  let playing = false;
  let toneHigh = true;

  const ensureContext = () => {
    if (context) return context;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    context = new AudioCtx();
    return context;
  };

  const unlock = async () => {
    const ctx = ensureContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return false;
      }
    }
    unlocked = ctx.state === 'running';
    return unlocked;
  };

  const stop = () => {
    playing = false;
    if (intervalId != null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
    try {
      oscillator?.stop();
    } catch {
      // already stopped
    }
    oscillator?.disconnect();
    gain?.disconnect();
    oscillator = null;
    gain = null;
  };

  const start = async () => {
    if (playing) return true;
    const ok = await unlock();
    if (!ok || !context) return false;

    stop();
    playing = true;
    gain = context.createGain();
    gain.gain.value = 0.22;
    gain.connect(context.destination);

    oscillator = context.createOscillator();
    oscillator.type = 'square';
    oscillator.frequency.value = 880;
    oscillator.connect(gain);
    oscillator.start();

    intervalId = window.setInterval(() => {
      if (!oscillator || !context) return;
      toneHigh = !toneHigh;
      const next = toneHigh ? 1040 : 780;
      try {
        oscillator.frequency.setValueAtTime(next, context.currentTime);
      } catch {
        // ignore transient audio graph errors
      }
    }, 420);

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate([400, 200, 400, 200, 600]);
      } catch {
        // vibration is best-effort
      }
    }

    return true;
  };

  return {
    start,
    stop,
    unlock,
    isPlaying: () => playing,
    isUnlocked: () => unlocked,
  };
}
