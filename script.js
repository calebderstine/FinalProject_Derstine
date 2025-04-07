// CHECK OUT tonal.js LIBRARY

import Voice from "./Voice.js";

//Retrieve HTML Elements
let timeSig = document.getElementById("TimeSig");
let tempoInput = document.getElementById("TempoInput");
let transpositionInput = document.getElementById("TranspositionInput");
let delayInput = document.getElementById("DelayInput");
let feedback = document.getElementById("Feedback");
let attackInput = document.getElementById("AttackInput");
let decayInput = document.getElementById("DecayInput");
let releaseInput = document.getElementById("ReleaseInput");
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

/**
 * @constant {DelayNode} delayNode
 * @description Delay
 * @constant {GainNode} feedbackNode
 * @description Feedback
 */
const delayNode = audioCtx.createDelay();
const feedbackNode = audioCtx.createGain();
delayNode.delayTime.value = 0.003; // Set delay time
feedbackNode.gain.value = 0; // Set feedback gain
const updateDelayTime = function (event) {
    delayNode.delayTime.linearRampToValueAtTime(event.target.value/1000, audioCtx.currentTime + 0.4);
};
const updateFeedback = function (event) {
    feedbackNode.gain.linearRampToValueAtTime(event.target.value, audioCtx.currentTime + 0.4);
};
// Maybe add a low pass filter to the delayed signal

/**
 * @function updateTimeSig
 * @description Updates the time signature and number of beats per measure.
 */
const updateTimeSig = function () {
    switch (timeSig.value) {
        case "1":
            numBeats = 4;
            console.log(`${numBeats} beats`);
            break;
        case "2":
            numBeats = 2;
            console.log(`${numBeats} beats`);
            break;
        case "3":
            numBeats = 3;
            console.log(`${numBeats} beats`);
            break;
        case "4":
            numBeats = 5;
            console.log(`${numBeats} beats`);
            break;
        case "5":
            numBeats = 2;
            console.log(`${numBeats} beats`);
            break;
        case "6":
            numBeats = 3;
            console.log(`${numBeats} beats`);
            break;
        case "7":
            numBeats = 4;
            console.log(`${numBeats} beats`);
            break;
    }
};

//------------------------------Connections-----------------------------------
delayNode.connect(feedbackNode);
feedbackNode.connect(delayNode);
feedbackNode.connect(masterGain);
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

//----------------------------Define Variables----------------------------
let numBeats = 4; // This will be determined by Time Signature.
let transposition; // This will be determined by Transposition selection.
let duration; // This will be determined by Time Signature and Tempo selection.
let attack; // This will be determined by Attack selection.
let decay; // This will be determined by Decay selection.
let release; // This will be determined by Release selection.
let sustainTime; // This is determined by the envelope values in order to keep the note duration consistent regardless of ADSR values.

let voice1 = 60;
let voice2 = 64;
let voice3 = 67;
let voice4 = 72;

// const chords = [
//     ["I"], 
//     ["ii", "IV"], 
//     ["V"]
// ]; // chords[0] = tonic; chords[1] = subdominant; chords[2] = dominant
// console.log(`${chords}`);
// //console.log(chords.findIndex()));
// console.log(Object.keys(chords));
// let chordFunction;
// let currentChord;

// const chooseChord = function () {
//     let randomIndex = Math.floor(chords.length * Math.random());
//     let nextChord = chords[randomIndex];
//     console.log(nextChord);
// };

// const tonChords = ["I"];
// const subChords = ["ii", "IV"];
// const domChords = ["V"];


/**
 * const chooseChord () {
 *  switch (currentChord[])
 *      case 0:
 *      let randomIndex = Math.floor(chords.length * Math.random());
            let nextChord = chords[randomIndex];
 *      case 1:
 *      case 2:
 * }
 */



/**
 * @function playNote
 * @description Creates a new oscillator with a specified frequency and other parameters.
 * @param {number} note - The MIDI note number of the frequency to be played.
 */
const playNote = function (note) {
    let someVoice = new Voice(audioCtx, mtof(note + transposition), attack, decay, sustainTime, release, 0.8, masterGain, delayNode);
        someVoice.start();
};

/**
 * @function startTrack
 * @description Will use a for loop to run through the process of choosing a chord, choosing the voicing and assigning notes to each voice, and starting the oscillators before repeating after the specified duration.
 * This function will call other functions for each specific task.
 */
const startTrack = async function () {
    duration = numBeats*(60/tempoInput.value); // Duration value is set related to Time Signature and Tempo
    attack = parseFloat(attackInput.value/1000); // Attack value is set to the value in the corresponding HTML input box, converted to seconds from milliseconds
    decay = parseFloat(decayInput.value/1000); // Decay value is set to the value in the corresponding HTML input box, converted to seconds from milliseconds
    release = parseFloat(releaseInput.value/1000); // Release value is set to the value in the corresponding HTML input box, converted to seconds from milliseconds
    sustainTime = duration - attack - decay - release; // Any time remaining from the duration after the Attack, Decay, and Release is set to the time the note sustains
    transposition = parseInt(transpositionInput.value); // Transposition value is set to the value in the corresponding HTML input box // Might have to use parseInt()
    // By setting these values only when we press play, we ensure the values don't change mid-playback and break the playback loop
    console.log(`${attack}, ${decay}, ${release}, ${sustainTime}, ${duration}`);
    if (sustainTime < 0) {
        console.log(
            "Decrease Attack, Decay, or Release time OR Decrease tempo" // MAKE IT OUTPUT A MESSAGE TO THE USER
        );
        return;
    }; // This prevents the playback loop from starting if the sustain time would be less than 0, which would otherwise break the loop
    const startTime = audioCtx.currentTime;
    playNote(voice1);
    playNote(voice2);
    playNote(voice3);
    playNote(voice4);
    // let i = 0;
    // while (i < 5) { // Maybe set condition to isPlaying. isPlaying should be set to false on stop.
    //     chooseChord();
    //     i++;
    // };
};

//won't need different start and stop functions; just one function to start with defined frequency, duration, attack, decay, sustain, and release, and then to stop after all that concludes

//Add Event Listeners
timeSig.addEventListener("input", updateTimeSig);
delayInput.addEventListener("input", updateDelayTime);
feedback.addEventListener("input", updateFeedback);
button.addEventListener("click", startTrack);
masterGainSlider.addEventListener("input", updateMasterGain);