import Voice from "./Voice.js";

//--------------------------Retrieve HTML Elements--------------------------
let tempoInput = document.getElementById("TempoInput");
let transpositionInput = document.getElementById("TranspositionInput");
let attackInput = document.getElementById("AttackInput");
let decayInput = document.getElementById("DecayInput");
let releaseInput = document.getElementById("ReleaseInput");
let opennessFactor = document.getElementById("Openness");

//------------------------Create Web Audio Objects------------------------
/**
 * This script will create new voices for each chord change and
 * coordinate the process of choosing chords, choosing voicings,
 * and timing chord changes and metronome clicks.
 */

/**
 * @constant {AudioContext} audioCtx
 * @description The main WebAudio AudioContext for the backing track.
 */
const audioCtx = new AudioContext();

/**
 * @constant {GainNode} masterGain
 * @description Master Gain control for the backing track.
 * @constant {BiquadFilterNode} masterLowpass
 * @description Master Low-pass control for the backing track.
 */
const masterGain = audioCtx.createGain();
masterGain.gain.value = 0.125; // Set master volume
document.getElementById("MasterGain").addEventListener("input", (event)=>{
    masterGain.gain.linearRampToValueAtTime(event.target.value, audioCtx.currentTime + 0.4);
}); // Master Gain Control
const masterLowpass = audioCtx.createBiquadFilter();
masterLowpass.type = "lowpass";
masterLowpass.frequency.value = 4200;
masterLowpass.Q.value = -3.4;
document.getElementById("MasterLowpassFreq").addEventListener("input", (event)=>{
    masterLowpass.frequency.linearRampToValueAtTime(event.target.value, audioCtx.currentTime + 0.4);
}); // Master Low-Pass Cutoff Frequency Control
document.getElementById("MasterLowpassQ").addEventListener("input", (event)=>{
    masterLowpass.Q.linearRampToValueAtTime(event.target.value, audioCtx.currentTime + 0.4);
}); // Master Low-Pass Q Control
let bass = 0.3;
document.getElementById("BassInput").addEventListener("input", (event)=>{
    bass = event.target.value;
}); // Bass Control (controls the gain of a sine wave 1 octave lower than a voice's fundamental)

/**
 * @constant {DelayNode} delayNode
 * @description Delay Time control
 * @constant {GainNode} feedbackNode
 * @description Feedback Gain of delay line
 * @constant {BiquadFilterNode} delayLowpass
 * @description Delay Lowpass control
 */
const delayNode = audioCtx.createDelay();
const feedbackNode = audioCtx.createGain();
delayNode.delayTime.value = 0.250; // Set delay time
feedbackNode.gain.value = 0; // Set feedback gain
document.getElementById("DelayInput").addEventListener("input", (event)=>{
    delayNode.delayTime.linearRampToValueAtTime(event.target.value/1000, audioCtx.currentTime + 0.4);
}); // Delay Time control
document.getElementById("Feedback").addEventListener("input", (event)=>{
    feedbackNode.gain.linearRampToValueAtTime(event.target.value, audioCtx.currentTime + 0.4);
}); // Delay Feedback control
const delayLowpass = audioCtx.createBiquadFilter();
delayLowpass.type = "lowpass";
delayLowpass.frequency.value = 3000;
document.getElementById("DelayLowpass").addEventListener("input", (event)=>{
    delayLowpass.frequency.linearRampToValueAtTime(event.target.value, audioCtx.currentTime + 0.4);
}); // Delay Lowpass control


//------------------------------Metronome-----------------------------------
const pulseGain = audioCtx.createGain();
const subdivisionGain = audioCtx.createGain();
pulseGain.gain.value = 2; // Master Gain later attenuates this
subdivisionGain.gain.value = 0;

// Metronome Play Function
const playMetronome = function(out){
    let source = audioCtx.createBufferSource();
    source.onended = ()=>{
        source.disconnect();
        source = null;
    };

    // Attach the decoded audio data to the source node
    source.buffer = metronomeAudioBuffer;

    // Connect the audio source to its respective gain node (either pulseGain or subdivisionGain)
    source.connect(out);

    // Start playing the audio immediately
    source.start();
};

// Load Metronome Audio File
const loadMetronome = async function () {
    // Fetch the audio file — returns a Promise, so we await its completion
    const file = await fetch("metronome.mp3");

    // Convert the fetched file into an ArrayBuffer (raw binary data)
    // Await because this operation takes time
    const arrayBuffer = await file.arrayBuffer();

    // Decode the ArrayBuffer into an audio buffer that Web Audio can use
    // Await because decoding also takes time
    return await audioCtx.decodeAudioData(arrayBuffer);
};
const metronomeAudioBuffer = await loadMetronome();

// User control over metronome gains
document.getElementById("PulseGain").addEventListener("input", (event)=>{
    pulseGain.gain.linearRampToValueAtTime(event.target.value, audioCtx.currentTime + 0.4);
}); // Pulse Gain control
document.getElementById("SubdivisionGain").addEventListener("input", (event)=>{
    subdivisionGain.gain.linearRampToValueAtTime(event.target.value, audioCtx.currentTime + 0.4);
}); // Subdivision Gain control

//------------------------------Connections-----------------------------------
delayNode.connect(feedbackNode);
feedbackNode.connect(delayNode);
feedbackNode.connect(delayLowpass);
delayLowpass.connect(masterLowpass);
pulseGain.connect(masterGain);
subdivisionGain.connect(masterGain);
masterLowpass.connect(masterGain);
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

let isPlaying = false; // Whether the backing track is currently playing
let playbackTimer; // ID for playback timeout
let pulseTimer; // ID for pulse timeout
let subdTimer; // ID for subdivision timeout

//----------------------------Chord Progression Functionality----------------------------
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

// Determine Next Chord In Progression
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

// User Chord Selection
document.getElementById("ChordSelection").addEventListener("click", (event)=>{
    let functIndex; // Determines which of the three arrays inside of selectedChords the chord will go to
    if (allChords.includes(`${event.target.innerHTML}`) && isPlaying == false) {
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
            event.target.style.color = "#000000";
        } else {
            selectedChords[functIndex].push(event.target.innerHTML);
            event.target.style.backgroundColor = "#696969";
            event.target.style.color = "#FFFFFF";
        }
    };
});

/**
 * @function updateTimeSig
 * @description Updates the time signature, number of beats per measure, and subdivision of beats based on the selection from the HTML dropdown menu.
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

//---------------------------------Play Note---------------------------------
/**
 * @function mtof
 * @description Converts a MIDI note number to its corresponding frequency in Hz.
 * @param {number} midi - The MIDI note number (e.g., 60 for C4).
 * @returns {number} The frequency in Hz.
 */
const mtof = function (midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
};

/**
 * @function playNote
 * @description Creates a new oscillator with a specified frequency and other parameters.
 * @param {number} note - The MIDI note number of the frequency to be played.
 */
const playNote = function (note) {
    let someVoice = new Voice(audioCtx, mtof(note + transposition), attack, decay, sustainTime, release, bass, 0.8, masterLowpass, delayNode);
        someVoice.start();
};

//--------------------------------Voice Leading--------------------------------

let currentVoicing = [];

const voiceOrders = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 2, 0],
    [1, 0, 2],
    [2, 0, 1],
    [2, 1, 0],
]; // Represents all unique orders of three voices. Each element of each nested array represents an index for/of currentChord

const voicings = [
    { voicing: [], totalDistance: undefined },
    { voicing: [], totalDistance: undefined },
    { voicing: [], totalDistance: undefined },
    { voicing: [], totalDistance: undefined },
    { voicing: [], totalDistance: undefined },
    { voicing: [], totalDistance: undefined },
]; // This is where each possible voicing and its total distance (between each current tone and its target tone) will be stored

const chooseVoicing = ()=>{
    /* In each unique order of voices, each voice moves to the closest unrepresented target tone,
    then the total distance moved in semitones between all three voices is calculated and stored
    in the voicings array. Then the current voicing is set to the voicing with the least totalDistance. */
    for (let o = 0; o < 6; o++) { // Determines which nested voiceOrders array is used (which order of voices)
        let newVoicing = [];
        newVoicing.length = 0;
        let totalDistance = 0;
        for (let i = 0; i < 3; i++) { // Iterate through the elements (voice indexes) in the nested voiceOrders array
            let currentTone = currentVoicing[voiceOrders[o][i]];
            let closestTones = [];
            let difference;

            // Find the chord tones in their closest octave
            chordMap[currentChord].forEach((targetTone)=>{ // For each tone of the chord we're moving to
                for (let n = 0; n < 10; n++) {
                    difference = currentTone - (targetTone + (12*n)); // Starting from the lowest MIDI octave, iterates through the first ten octaves
                    if (difference > -7 && difference < 7) { // Checks if the target tone in the current octave is within a tritone of the current tone; The closest version of a given pitch class is never more than 6 semitones away
                        closestTones.push(targetTone + (12*n));
                    }; 
                };
            }); // Compiles an array of the target chord tones in the octaves closest to the current tone; Will typically be 3, but may be 4 in the case that the distance is 6 semitones to a target chord tone
            
            // Find the closest of the chord tones
            for (let d = 0, c = false; c == false; d++) { // Starting from a distance of 0 semitones and increasing by 1 each time, checks if each target tone is that number of semitones away from the current tone, adding it to the newVoicing array if so and skipping the rest of the for loop
                for (let i = 0; i < closestTones.length; i++) {
                    if (((currentTone - closestTones[i]) == d || (currentTone - closestTones[i])*-1 == d) && !Array.from(newVoicing, (x) => x % 12).includes(closestTones[i] % 12)) {
                        newVoicing.push(currentTone - (currentTone - closestTones[i]));
                        totalDistance = totalDistance + d;
                        c = true;
                        break;
                    };
                };
            };
        };
        // Store voicing and its totalDistance in voicings array; from newVoicing and totalDistance
        voicings[o].voicing = newVoicing;
        voicings[o].totalDistance = totalDistance;
    };
    // Find array (voicing) with least totalDistance and set currentVoicing to it
    let smallestDistance = Math.min(
        voicings[0].totalDistance,
        voicings[1].totalDistance,
        voicings[2].totalDistance,
        voicings[3].totalDistance,
        voicings[4].totalDistance,
        voicings[5].totalDistance
    );
    const hasSmallestDistance = (element) => element.totalDistance == smallestDistance;
    let bestVoicingIndex = voicings.findIndex(hasSmallestDistance);
    currentVoicing = voicings[bestVoicingIndex].voicing;
};

//---------------------------------Track Playback---------------------------------
/**
 * @function
 * @description Starts or stops playback
 * On start, ensures all requirements are met before defining parameters and beginning the playback loop.
 * On stop, clears all timeouts and resets chord display.
 */
document.getElementById("StartStop").addEventListener("click", (event)=>{
    if (isPlaying) {
        clearTimeout(playbackTimer);
        clearTimeout(pulseTimer);
        clearTimeout(subdTimer); // Stops and clears the timeouts for the metronome and chord playback
        event.target.style.border = "0.1rem solid #04AA6D";
        event.target.innerHTML = "Start";
        document.getElementById("currentChord").innerText = "x";
        document.getElementById("upcomingChord").innerText = "x";
        isPlaying = false; // isPlaying is set to false so that parameters can be changed and the playback restarted
        return;
    }; // If track is playing, stops track and prevents the rest of the function from executing.
    duration = numBeats*(60/tempoInput.value); // Duration value is set related to Time Signature and Tempo
    attack = parseFloat(attackInput.value/1000); // Attack value is set to the value in the corresponding HTML input box, converted to seconds from milliseconds
    decay = parseFloat(decayInput.value/1000); // Decay value is set to the value in the corresponding HTML input box, converted to seconds from milliseconds
    release = parseFloat(releaseInput.value/1000); // Release value is set to the value in the corresponding HTML input box, converted to seconds from milliseconds
    sustainTime = duration - attack - decay - release; // Any time remaining from the duration after the Attack, Decay, and Release is set to the time the note sustains
    transposition = parseInt(transpositionInput.value); // Transposition value is set to the value in the corresponding HTML input box // Might have to use parseInt()
    // By setting these values only when we press play, we ensure the values don't change mid-playback and break the playback loop
    if (selectedChords[0].length == 0 || selectedChords[1].length == 0 || selectedChords[2].length == 0) {
        document.getElementById("ErrorMessage").innerText = "Please choose at least one tonic chord, one subdominant chord, and one dominant chord";
        setTimeout(()=>{document.getElementById("ErrorMessage").innerText = ""}, 3000);
        return;
    }; // This prevents the playback loop from starting and outputs a message to the user if at least one of every category of chord isn't selected, which would otherwise break the loop
    if (sustainTime < 0) {
        document.getElementById("ErrorMessage").innerText = "Decrease Attack, Decay, or Release time OR Decrease tempo";
        setTimeout(()=>{document.getElementById("ErrorMessage").innerText = ""}, 3000);
        return;
    }; // This prevents the playback loop from starting and outputs a message to the user if the sustain time would be less than 0, which would otherwise break the loop
    event.target.style.border = "0.1rem solid #ff0000";
    event.target.innerHTML = "Stop";
    isPlaying = true;
    currentChord = selectedChords[0][0];
    document.getElementById("upcomingChord").innerText = currentChord;
    for (let i = 0; i < 3; i++) {
        currentVoicing[i] = (chordMap[currentChord][i] + 60) + (Math.round(Math.random() * opennessFactor.value) - (opennessFactor.value/2)) * 12; // Add user control of voicing width/openness
    };
        for (let i = 0; i < numBeats; i++) {
            pulseTimer = setTimeout(()=>{
                playMetronome(pulseGain);
              }, (duration/numBeats) * i * 1000)
        };
        console.log(`Next Chord: ${currentChord}`);
        console.log(`Voices: ${currentVoicing[0]}, ${currentVoicing[1]}, ${currentVoicing[2]}`)
        playback();
});

/**
 * @function playback
 * @description Utilizes timeouts to schedule metronome clicks, chord change decisions,
 * voicing decisions, and the playing of notes in time and on beat.
 */
const playback = function () {
    playbackTimer = setTimeout(()=>{
        playback();
        for (let i = 0; i < numBeats; i++) {
            pulseTimer = setTimeout(()=>{
                playMetronome(pulseGain);
              }, (duration/numBeats) * i * 1000)
        };
        for (let i = 0; i < (numBeats*subdivision); i++) {
            subdTimer = setTimeout(()=>{
                playMetronome(subdivisionGain);
              }, (duration/numBeats)/subdivision * i * 1000)
        };
        for (let i = 0; i < 3; i++) {
            playNote(currentVoicing[i]);
        };
        chooseChord();
        console.log(`Next Chord: ${currentChord}`);
        chooseVoicing();
        setTimeout(()=>{console.log(`Voices: ${currentVoicing[0]}, ${currentVoicing[1]}, ${currentVoicing[2]}`)}, 50);
    }, duration * 1000);
};