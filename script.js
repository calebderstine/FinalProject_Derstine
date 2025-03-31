import Voice from "./Voice.js";

//Retrieve HTML Elements
let button = document.getElementById("StartStop");
let masterGainSlider = document.getElementById("MasterGain");

/**
 * This script will create new voices for each chord change
 * and coordinate the process of choosing chords, choosing the voicing, and timing them right.
 */

/**
 * @constant {AudioContext} audioCtx
 * @description The main WebAudio AudioContext for the backing track.
 */
const audioCtx = new AudioContext();

// /**
//  * @constant {Object} activeVoices
//  * @description Stores currently active voices, indexed by MIDI note number.
//  */
// const activeVoices = {};

/**
 * @constant {GainNode} masterGain
 * @description Master gain control for the backing track.
 */
const masterGain = audioCtx.createGain();
masterGain.gain.value = 0.125; // Set master volume
const updateMasterGain = function (event) {
    masterGain.gain.linearRampToValueAtTime(event.target.value, audioCtx.currentTime + 0.4);
};

// Connect master gain to the audio output
masterGain.connect(audioCtx.destination);

/**
 * @function mtof
 * @description Converts a MIDI note number to its corresponding frequency in Hz.
 * @param {number} midi - The MIDI note number (e.g., 60 for C4).
 * @returns {number} The frequency in Hz.
 */
const mtof = function (midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
};

let duration = 3; // This will be determined by Time Signature and Tempo selection.
let attack = 0.5; // This will be determined by Attack selection.
let decay = 0.5; // This will be determined by Decay selection.
let release = 0.5; // This will be determined by Release selection.
let sustainTime = duration - attack - decay - release; // This is determined by the envelope values in order to keep the note duration consistent regardless of ADSR values.

/**
 * @function playNote
 * @description Creates a new oscillator with a specified frequency and other parameters.
 * @param {number} note - The MIDI note number of the frequency to be played.
 */
const playNote = function (note) {
    let someVoice = new Voice(audioCtx, mtof(note), attack, decay, sustainTime, release, 0.8, masterGain);
        someVoice.start();
};

/**
 * @function startTrack
 * @description Will use a for loop to run through the process of choosing a chord, choosing the voicinig and assigning notes to each voice, and starting the oscillators before repeating after the specified duration.
 * This function will call other functions for each specific task.
 */
const startTrack = async function () {
    playNote(60);
    playNote(64);
    playNote(67);
    playNote(72);
};

//won't need different start and stop functions; just one function to start with defined frequency, duration, attack, decay, sustain, and release, and then to stop after all that concludes

//Add Event Listeners
button.addEventListener("click", startTrack);
masterGainSlider.addEventListener("input", updateMasterGain);