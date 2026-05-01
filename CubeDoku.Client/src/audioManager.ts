// audioManager.ts
// Shared audio instances for game sound effects
//
// The problem with creating a new Audio() object every time a sound plays is that
// each instance has its own volume. When the player changes the volume slider in settings,
// we'd have to track down every Audio instance and update them individually.
//
// By using module-level singletons (created once when the module loads), there's
// one set of audio objects that everything references. Updating volume on these
// objects affects all future and current playback.
//
// Currently only two sounds:
//   press: plays when a number is placed successfully
//   error: plays when an invalid number is placed
//
// The volume is initialized from localStorage so it persists between sessions.
// If nothing is stored, defaults to 1 (max volume).
//
// TODO: might want to add a "completion" sound and maybe a "hint" sound

import pressSfx from './assets/press.mp3';
import errorSfx from './assets/error.mp3';

export const pressAudio = new Audio(pressSfx);
export const errorAudio = new Audio(errorSfx);

// restore volume setting from last session
const stored = localStorage.getItem('sfx_volume');
const initialVolume = stored !== null ? parseFloat(stored) : 1;
pressAudio.volume = initialVolume;
errorAudio.volume = initialVolume;

