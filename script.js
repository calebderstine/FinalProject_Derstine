// CHECK OUT tonal.js LIBRARY

import Voice from "./Voice.js";

//--------------------------Retrieve HTML Elements--------------------------
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

//------------------------Create Web Audio Objects------------------------
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

// Define an asynchronous function to load and play the audio
let source;
const loadPlayMetronome = async ()=> {
    //fetch the audio file - returns a promise (response) so we await its completion
    const file = await fetch("metronome.mp3");
    //convert the fetched file into an arraybuffer (raw binary data)
    //await because this operation takes time
    const arrayBuffer = await file.arrayBuffer();
    //decode the arrayBuffer into an audio buffer that Web Audio can use
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    //create an audio buffer source node - this will play the sound
    source = audioCtx.createBufferSource();
    //attach the decoded audio data to the source node
    source.buffer = audioBuffer;
    //connect the audio source to the master gain (volume control)
    source.connect(masterGain);
    //start playing the audio immediately
    source.start();
};

//------------------------------Connections-----------------------------------
delayNode.connect(feedbackNode);
feedbackNode.connect(delayNode);
feedbackNode.connect(masterGain);
masterGain.connect(audioCtx.destination);

//----------------------------Define Variables----------------------------
let numBeats = 4; // This will be determined by Time Signature.
let meterType = "simple"; // This will be determined by Time Signature.
let transposition; // This will be determined by Transposition selection.
let duration; // This will be determined by Time Signature and Tempo selection.
let attack; // This will be determined by Attack selection.
let decay; // This will be determined by Decay selection.
let release; // This will be determined by Release selection.
let sustainTime; // This is determined by the envelope values in order to keep the note duration consistent regardless of ADSR values.

let isPlaying = false;
let timeout;

const allChords = [
    "i", "I", "bII", "ii*", "ii", "II", "III", "III+", "iii", "iv", "IV", "v", "V", "VI", "vi", "VII", "vii*"
];

const selectedChords = [
    [], 
    [], 
    []
]; // selectedChords[0] = tonic; selectedChords[1] = subdominant; selectedChords[2] = dominant

/**
 * @constant {Object} chordMap
 * @description Maps chord names to chord tones.
 */
const chordMap = {
    'i': [60, 63, 67],
    'I': [60, 64, 67],
    'bII': [61, 65, 68],
    'ii*': [62, 65, 68],
    'ii': [62, 65, 69],
    'II': [62, 66, 69],
    'III': [63, 67, 70],
    'III+': [63, 67, 71],
    'iii': [64, 67, 71],
    'iv': [65, 68, 72],
    'IV': [65, 69, 72],
    'v': [67, 70, 74],
    'V': [67, 71, 74],
    'VI': [68, 72, 75],
    'vi': [69, 72, 76],
    'VII': [70, 74, 77],
    'vii*': [71, 74, 77],
  };

let currentChord;
let randomIndex1;
let randomIndex2;

let voice1;
let voice2;
let voice3;
let voice4;

/**
 * @function updateTimeSig
 * @description Updates the time signature and number of beats per measure based on the selection from the HTML dropdown menu.
 */
const updateTimeSig = function () {
    switch (timeSig.value) {
        case "1":   // 4/4
            numBeats = 4;
            meterType = "simple";
            console.log(`${numBeats} beats`);
            break;
        case "2":   // 2/4
            numBeats = 2;
            meterType = "simple";
            console.log(`${numBeats} beats`);
            break;
        case "3":   // 3/4
            numBeats = 3;
            meterType = "simple";
            console.log(`${numBeats} beats`);
            break;
        case "4":   // 5/4
            numBeats = 5;
            meterType = "simple";
            console.log(`${numBeats} beats`);
            break;
        case "5":   // 6/8
            numBeats = 2;
            meterType = "compound";
            console.log(`${numBeats} beats`);
            break;
        case "6":   // 9/8
            numBeats = 3;
            meterType = "compound";
            console.log(`${numBeats} beats`);
            break;
        case "7":   // 12/8
            numBeats = 4;
            meterType = "compound";
            console.log(`${numBeats} beats`);
            break;
    }
};

/**
 * @function mtof
 * @description Converts a MIDI note number to its corresponding frequency in Hz.
 * @param {number} midi - The MIDI note number (e.g., 60 for C4).
 * @returns {number} The frequency in Hz.
 */
const mtof = function (midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
};

const chooseChord = ()=> {
    if (selectedChords[0].includes(currentChord)) {
        randomIndex1 = Math.floor(Math.random() * 3); // Assigns a random integer from 0 to 2; decides if the chord will be tonic, subdominant, or dominant
        randomIndex2 = Math.floor(selectedChords[randomIndex1].length * Math.random()); // Assigns a random integer from 0 to 1 less than the length of the array corresponding to randomIndex1; chooses a chord from within either the tonic, subdominant, or dominant array
        currentChord = selectedChords[randomIndex1][randomIndex2]; // currentChord is assigned to the new chord decided by randomIndex1 and randomIndex2
    } else if (selectedChords[1].includes(currentChord)) {
        randomIndex1 = Math.floor(Math.random() * 2 + 1); // Assigns a random integer from 1 to 2; decides if the chord will be subdominant or dominant
        randomIndex2 = Math.floor(selectedChords[randomIndex1].length * Math.random()); // Assigns a random integer from 0 to 1 less than the length of the array corresponding to randomIndex1; chooses a chord from within either the subdominant or dominant array
        currentChord = selectedChords[randomIndex1][randomIndex2];
    } else if (selectedChords[2].includes(currentChord)) {
        randomIndex1 = Math.floor(Math.random() * 2) * 2; // Assigns either a 0 or a 2; decides if the chord will be dominant or tonic
        randomIndex2 = Math.floor(selectedChords[randomIndex1].length * Math.random()); // Assigns a random integer from 0 to 1 less than the length of the array corresponding to randomIndex1; chooses a chord from within either the tonic or dominant array
        currentChord = selectedChords[randomIndex1][randomIndex2];
    }
    document.getElementById("currentChord").innerText = document.getElementById("upcomingChord").innerText;
    document.getElementById("upcomingChord").innerText = currentChord;
};

const chooseVoicing = ()=> {
    voice1 = chordMap[currentChord][0];
    voice2 = chordMap[currentChord][1];
    voice3 = chordMap[currentChord][2];
    voice4 = chordMap[currentChord][0] + 12;
};


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
const startTrack = function () {
    if (isPlaying) {
        clearTimeout(timeout); // Clears all timeouts because all timeouts share this same ID
        isPlaying = false;
        return;
    }; // If track is playing, stops track and prevents the rest of the function from executing.
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
    currentChord = selectedChords[0][0];
    chooseVoicing();
    isPlaying = true;
    const startTime = audioCtx.currentTime;
        // iterate through numBeats
        for (let i = 0; i < numBeats; i++) {
            timeout = setTimeout(()=>{
                loadPlayMetronome();
                //console.log("click");
              }, (duration/numBeats) * i * 1000)
        };
        console.log(currentChord);
        playback();
};

const playback = function () {
    timeout = setTimeout(()=>{
        playback();
        for (let i = 0; i < numBeats; i++) {
            timeout = setTimeout(()=>{
                loadPlayMetronome();
                //console.log("click");
              }, (duration/numBeats) * i * 1000)
        };
        playNote(voice1);
        playNote(voice2);
        playNote(voice3);
        playNote(voice4);
        chooseChord();
        console.log(currentChord);
        chooseVoicing();
        console.log(voice1, voice2, voice3, voice4);
    }, duration * 1000);
};


//Add Event Listeners
timeSig.addEventListener("input", updateTimeSig);
delayInput.addEventListener("input", updateDelayTime);
feedback.addEventListener("input", updateFeedback);
button.addEventListener("click", startTrack);
masterGainSlider.addEventListener("input", updateMasterGain);

//User Chord Selection Functionality
document.getElementById("ChordSelection").addEventListener("click", (event)=>{
    let functIndex;
    if (allChords.includes(`${event.target.innerHTML}`)) {
        console.log(event.target.innerHTML);
        switch (event.target.innerHTML) {
            case 'i': functIndex = 0; break;
            case 'I': functIndex = 0; break;
            case 'bII': functIndex = 1; break;
            case 'ii*': functIndex = 1; break;
            case 'ii': functIndex = 1; break;
            case 'II': functIndex = 1; break;
            case 'III': functIndex = 0; break;
            case 'III+': functIndex = 2; break;
            case 'iii': functIndex = 0; break;
            case 'iv': functIndex = 1; break;
            case 'IV': functIndex = 1; break;
            case 'v': functIndex = 2; break;
            case 'V': functIndex = 2; break;
            case 'VI': functIndex = 0; break;
            case 'vi': functIndex = 0; break;
            case 'VII': functIndex = 2; break;
            case 'vii*': functIndex = 2; break;
        }
        console.log(functIndex);
        if (selectedChords[functIndex].includes(`${event.target.innerHTML}`)) {
            console.log("includes");
            selectedChords[functIndex].splice(selectedChords[functIndex].indexOf(event.target.innerHTML), 1);
            event.target.style.backgroundColor = "#FFFAF0";
        } else {
            console.log("doesn't include");
            selectedChords[functIndex].push(event.target.innerHTML);
            event.target.style.backgroundColor = "#696969";
        }
        console.log(selectedChords);
    };
});