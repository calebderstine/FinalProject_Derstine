/**
 * A class representing a single voice in a polyphonic synthesizer.
 * Creates a fundamental oscillator and two harmonically related sawtooth oscillators,
 * and applies an ADSR amplitude envelope.
 */
export default class Voice {
  /**
   * @param {AudioContext} ctx - The audio context.
   * @param {number} freq - The base frequency of the oscillator in Hz.
   * @param {number} attack - The attack time of the note in seconds.
   * @param {number} decay - The decay time of the note in seconds.
   * @param {number} sustainTime - The time between the decay phase and release phase of the note in seconds.
   * @param {number} release - The release time of the note in seconds.
   * @param {number} maxAmp - The maximum amplitude (typically between 0.0 and 1.0).
   * @param {AudioNode} out - The destination node to connect the voice to.
   */
  constructor(ctx, freq, attack, decay, sustainTime, release, bass, maxAmp, out1, out2) {
    // Store constructor parameters
    this.context = ctx;
    this.frequency = freq;
    this.attack = attack;
    this.decay = decay;
    this.sustainTime = sustainTime;
    this.release = release;
    this.bass = bass;
    this.maxAmp = maxAmp;
    this.output1 = out1; // Oscillators will be routed to the masterLowpass (which goes to masterGain)
    this.output2 = out2; // Oscillators will be routed to the delayNode (which goes to masterLowpass)
    this.sustain = 0.8;
  };

  /**
   * Starts the voice — creates and starts oscillators, builds signal chain,
   * initiates each phase of the ADSR envelope, and stops the oscillator on completion.
   */
  start () {
    const now = this.context.currentTime;

    // Create main oscillator
    this.oscSaw = this.context.createOscillator(); // Creates a rich tone with lots of harmonics
    this.oscSine = this.context.createOscillator(); // Reinforces the fundamental
    this.oscSub = this.context.createOscillator(); // Reinforces the fundamental
    this.oscSaw.type = "sawtooth";
    this.oscSine.type = "sine";
    this.oscSub.type = "sine";
    this.oscSaw.frequency.setValueAtTime(this.frequency, now);
    this.oscSine.frequency.setValueAtTime(this.frequency, now);
    this.oscSub.frequency.setValueAtTime((this.frequency)/2, now);
    this.oscSaw.onended = this.dispose.bind(this); // Auto-cleanup on stop
    this.oscSine.onended = this.dispose.bind(this); // Auto-cleanup on stop
    this.oscSub.onended = this.dispose.bind(this); // Auto-cleanup on stop

    // Create gain node for amplitude envelope
    this.subGain = this.context.createGain();
    this.ampEnv = this.context.createGain();
    this.subGain.gain.setValueAtTime(this.bass, now);
    this.ampEnv.gain.setValueAtTime(0, now); // Start silent

    // Signal routing
    this.oscSaw.connect(this.ampEnv);
    this.oscSine.connect(this.ampEnv);
    this.oscSub.connect(this.subGain);
    this.subGain.connect(this.ampEnv);
    this.ampEnv.connect(this.output1);
    this.ampEnv.connect(this.output2);

    // Start oscillators
    this.oscSaw.start();
    this.oscSine.start();
    this.oscSub.start();

    // Envelope: Attack → Decay → Sustain → Release
    this.ampEnv.gain.linearRampToValueAtTime(this.maxAmp, now + this.attack); // Attack
    this.ampEnv.gain.linearRampToValueAtTime(
        this.sustain * this.maxAmp, now + this.attack + this.decay
    ); // Decay
    this.ampEnv.gain.linearRampToValueAtTime(
      this.sustain * this.maxAmp, now + this.attack + this.decay + this.sustainTime
    ); // Sustain
    this.ampEnv.gain.linearRampToValueAtTime(
    0., now + this.attack + this.decay + this.sustainTime + this.release
    ); // Release
    this.oscSaw.stop(
      now + this.attack + this.decay + this.sustainTime + this.release + 0.01
    ); // Stop Oscillator
    this.oscSine.stop(
      now + this.attack + this.decay + this.sustainTime + this.release + 0.01
    ); // Stop Oscillator
    this.oscSub.stop(
      now + this.attack + this.decay + this.sustainTime + this.release + 0.01
    ); // Stop Oscillator
  };

  /**
   * Cleans up and disconnects all audio nodes once the sound has ended.
   */
  dispose () {
    // Disconnect everything
    // this.oscSaw.disconnect();
    // this.oscSine.disconnect();
    // this.ampEnv.disconnect();

    // Null references for garbage collection
    this.oscSaw = null;
    this.oscSine = null;
    this.oscSub = null;
    this.ampEnv = null;
  };

};