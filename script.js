// CHECK OUT tonal.js LIBRARY

import Voice from "./Voice.js";

//--------------------------Retrieve HTML Elements--------------------------
let tempoInput = document.getElementById("TempoInput");
let transpositionInput = document.getElementById("TranspositionInput");
let attackInput = document.getElementById("AttackInput");
let decayInput = document.getElementById("DecayInput");
let releaseInput = document.getElementById("ReleaseInput");

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
document.getElementById("MasterGain").addEventListener("input", (event)=>{
    masterGain.gain.linearRampToValueAtTime(event.target.value, audioCtx.currentTime + 0.4);
}); // Master Gain control

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
document.getElementById("DelayInput").addEventListener("input", (event)=>{
    delayNode.delayTime.linearRampToValueAtTime(event.target.value/1000, audioCtx.currentTime + 0.4);
}); // Delay Time control
document.getElementById("Feedback").addEventListener("input", (event)=>{
    feedbackNode.gain.linearRampToValueAtTime(event.target.value, audioCtx.currentTime + 0.4);
}); // Delay Feedback control
// Maybe add a low pass filter to the delayed signal

// Metronome
const pulseGain = audioCtx.createGain();
const subdivisionGain = audioCtx.createGain();
pulseGain.gain.value = 1;
subdivisionGain.gain.value = 0;
// Define an asynchronous function to load and play the audio
let source;
const loadPlayMetronome = async (out)=> {
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
    //connect the audio source to the output
    source.connect(out);
    //start playing the audio immediately
    source.start();
};
document.getElementById("PulseGain").addEventListener("input", (event)=>{
    pulseGain.gain.linearRampToValueAtTime(event.target.value, audioCtx.currentTime + 0.4);
}); // Pulse Gain control
document.getElementById("SubdivisionGain").addEventListener("input", (event)=>{
    subdivisionGain.gain.linearRampToValueAtTime(event.target.value, audioCtx.currentTime + 0.4);
}); // Subdivision Gain control

//------------------------------Connections-----------------------------------
delayNode.connect(feedbackNode);
feedbackNode.connect(delayNode);
feedbackNode.connect(masterGain);
pulseGain.connect(masterGain);
subdivisionGain.connect(masterGain);
masterGain.connect(audioCtx.destination);

//----------------------------Define Variables----------------------------
let numBeats = 4; // This will be determined by Time Signature.
let subdivision = 2; // This will be determined by Time Signature.
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
    'i': [0, 3, 7],
    'I': [0, 4, 7],
    'bII': [1, 5, 8],
    'ii*': [2, 5, 8],
    'ii': [2, 5, 9],
    'II': [2, 6, 9],
    'III': [3, 7, 10],
    'III+': [3, 7, 11],
    'iii': [4, 7, 11],
    'iv': [5, 8, 0],
    'IV': [5, 9, 0],
    'v': [7, 10, 2],
    'V': [7, 11, 2],
    'VI': [8, 0, 3],
    'vi': [9, 0, 4],
    'VII': [10, 2, 5],
    'vii*': [11, 2, 5],
  };

let currentChord;
let randomIndex1;
let randomIndex2;

let currentVoicing = [];

/**
 * @function updateTimeSig
 * @description Updates the time signature and number of beats per measure based on the selection from the HTML dropdown menu.
 */
document.getElementById("TimeSig").addEventListener("input", ()=>{
    switch (document.getElementById("TimeSig").value) {
        case "1":   // 4/4
            numBeats = 4;
            subdivision = 2;
            console.log(`${numBeats} beats`);
            break;
        case "2":   // 2/4
            numBeats = 2;
            subdivision = 2;
            console.log(`${numBeats} beats`);
            break;
        case "3":   // 3/4
            numBeats = 3;
            subdivision = 2;
            console.log(`${numBeats} beats`);
            break;
        case "4":   // 5/4
            numBeats = 5;
            subdivision = 2;
            console.log(`${numBeats} beats`);
            break;
        case "5":   // 6/8
            numBeats = 2;
            subdivision = 3;
            console.log(`${numBeats} beats`);
            break;
        case "6":   // 9/8
            numBeats = 3;
            subdivision = 3;
            console.log(`${numBeats} beats`);
            break;
        case "7":   // 12/8
            numBeats = 4;
            subdivision = 3;
            console.log(`${numBeats} beats`);
            break;
    }
});

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

const voiceOrders = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 2, 0],
    [1, 0, 2],
    [2, 0, 1],
    [2, 1, 0],
]; // Represents all possible orders of three voices

const voicings = [
    { voicing: [], totalDistance: undefined },
    { voicing: [], totalDistance: undefined },
    { voicing: [], totalDistance: undefined },
    { voicing: [], totalDistance: undefined },
    { voicing: [], totalDistance: undefined },
    { voicing: [], totalDistance: undefined },
]; // Maybe initialize this with a loop

const chooseVoicing5 = ()=>{
    // For each order of voices, make each voice move to the closest unrepresented target tone,
    // calculating and storing in the voicings array the total difference in semitones between 
    // each current voice and its target tone. Then, find which voicing has the least totalDistance,
    // and set each current tone to the corresponding tone of the voicing.
    for (let o = 0; o < 6; o++) { // Choose which nested voiceOrders array
        for (let i = 0; i < 3; i++) { // Iterate through the voices in the nested voiceOrders array

        }
    }
};

const chooseVoicing4 = ()=>{
    let newVoicing = [];
    //let newVoicingPcs = [];
    let totalDistance = 0;
    currentVoicing.forEach((currentTone)=>{
        let closestTones = [];
        let difference;
        // Find the chord tones in their closest octave
        chordMap[currentChord].forEach((targetTone)=>{
            for (let n = 0; n < 10; n++) {
                difference = currentTone - (targetTone + (12*n));
                //console.log(`difference of ${difference}`);
                if (difference > -7 && difference < 7) {
                    closestTones.push(targetTone + (12*n));
                    break; // Maybe remove break so that if a targetTone is 6 semitones away from the currentTone, both the lower and higher versions will be added to the closestTones array rather than just the lowest.
                };
            };
        });
        console.log(`closestTones are ${closestTones}`);
        // Find the closest of the chord tones
        for (let d = 0, c = false; c == false; d++) {
            closestTones.forEach((closestTone)=>{ // Maybe use find() // Or make it a for loop; maybe for... of
                if (((currentTone - closestTone) == d || (currentTone - closestTone)*-1 == d) && !newVoicing.includes(closestTone)) { // Array.from(newVoicing, (x) => x % 12).includes(closestTone % 12)
                    newVoicing.push(currentTone - (currentTone - closestTone));
                    //newVoicingPcs.push((currentTone - (currentTone - closestTone)) % 12);
                    totalDistance = totalDistance + d;
                    c = true; // Sometimes this doesn't work perfectly, and multiple closestTones are added from one currentTone
                };
            });
        };
    });
    console.log(`newVoicing Array: ${newVoicing}`);
    console.log(`totalDistance: ${totalDistance}`);
    for (let i = 0; i < 3; i++) {
        currentVoicing[i] = newVoicing[i];
    };
};

const chooseVoicing3 = ()=>{
    let newVoicing = [];
    currentVoicing.forEach((currentTone)=>{
        let closestTones = [];
        let difference;
        // Find the chord tones in their closest octave
        chordMap[currentChord].forEach((targetTone)=>{
            for (let n = 0; n < 10; n++) {
                difference = currentTone - (targetTone + (12*n));
                console.log(`difference of ${difference}`);
                if (difference > -7 && difference < 7) {
                    closestTones.push(targetTone + (12*n));
                    console.log(`closestTones are ${closestTones}`);
                    break; // Maybe remove break so that if a targetTone is 6 semitones away from the currentTone, both the lower and higher versions will be added to the closestTones array rather than just the lowest.
                };
            };
        });
        // Find the closest of the chord tones
        for (let d = 0, c = false; c == false; d++) {
            closestTones.forEach((closestTone)=>{ // Maybe use find() // Or make it a for loop; maybe for... of
                if (((currentTone - closestTone) == d || (currentTone - closestTone)*-1 == d) && !newVoicing.includes(closestTone)) { // Doesn't account for octaves
                    newVoicing.push(currentTone - (currentTone - closestTone)); // After a tone is selected, the for loop must stop, otherwise, every possible chord tone will be added; only four tones should be chosen
                    c = true; // Sometimes this doesn't work perfectly, and multiple closestTones are added from one currentTone
                };
            });
        };
    });
    console.log(`newVoicing Array: ${newVoicing}`);
    for (let i = 0; i < 4; i++) {
        currentVoicing[i] = newVoicing[i];
    };
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
document.getElementById("StartStop").addEventListener("click", ()=>{
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
    if (sustainTime < 0) {
        console.log(
            "Decrease Attack, Decay, or Release time OR Decrease tempo" // MAKE IT OUTPUT A MESSAGE TO THE USER
        );
        return;
    }; // This prevents the playback loop from starting if the sustain time would be less than 0, which would otherwise break the loop
    currentChord = selectedChords[0][0];
    currentVoicing[0] = chordMap[currentChord][0] + 60;
    currentVoicing[1] = chordMap[currentChord][1] + 60;
    currentVoicing[2] = chordMap[currentChord][2] + 60;
    isPlaying = true;
        for (let i = 0; i < numBeats; i++) {
            timeout = setTimeout(()=>{
                loadPlayMetronome(pulseGain);
              }, (duration/numBeats) * i * 1000)
        };
        console.log(currentChord);
        playback();
});

const playback = function () {
    timeout = setTimeout(()=>{
        playback();
        for (let i = 0; i < numBeats; i++) {
            timeout = setTimeout(()=>{
                loadPlayMetronome(pulseGain);
              }, (duration/numBeats) * i * 1000)
        };
        for (let i = 0; i < (numBeats*subdivision); i++) {
            timeout = setTimeout(()=>{
                loadPlayMetronome(subdivisionGain);
              }, (duration/numBeats)/subdivision * i * 1000)
        };
        for (let i = 0; i < 3; i++) {
            playNote(currentVoicing[i]);
        };
        chooseChord();
        console.log(`Next Chord: ${currentChord}`);
        chooseVoicing4();
        console.log(`Voices: ${currentVoicing[0]}, ${currentVoicing[1]}, ${currentVoicing[2]}`);
    }, duration * 1000);
};

//User Chord Selection Functionality
document.getElementById("ChordSelection").addEventListener("click", (event)=>{
    let functIndex;
    if (allChords.includes(`${event.target.innerHTML}`)) {
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
        if (selectedChords[functIndex].includes(`${event.target.innerHTML}`)) {
            selectedChords[functIndex].splice(selectedChords[functIndex].indexOf(event.target.innerHTML), 1);
            event.target.style.backgroundColor = "#FFFAF0";
        } else {
            selectedChords[functIndex].push(event.target.innerHTML);
            event.target.style.backgroundColor = "#696969";
        }
    };
});