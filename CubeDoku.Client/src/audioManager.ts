// Shared audio instances — use this everywhere instead of creating new Audio() objects.
// This ensures the volume slider in Settings controls ALL sound effects globally.
import pressSfx from './assets/press.mp3';
import errorSfx from './assets/error.mp3';

export const pressAudio = new Audio(pressSfx);
export const errorAudio = new Audio(errorSfx);

// Restore persisted volume on load
const stored = localStorage.getItem('sfx_volume');
const initialVolume = stored !== null ? parseFloat(stored) : 1;
pressAudio.volume = initialVolume;
errorAudio.volume = initialVolume;
