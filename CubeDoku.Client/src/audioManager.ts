
import pressSfx from './assets/press.mp3';
import errorSfx from './assets/error.mp3';

export const pressAudio = new Audio(pressSfx);
export const errorAudio = new Audio(errorSfx);

// restore volume setting from last session
const stored = localStorage.getItem('sfx_volume');
const initialVolume = stored !== null ? parseFloat(stored) : 1;
pressAudio.volume = initialVolume;
errorAudio.volume = initialVolume;

