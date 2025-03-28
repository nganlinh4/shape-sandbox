/**
 * Sound Synthesizer class
 * Dynamically generates sound effects for different material types
 */
class SoundSynthesizer {
    /**
     * Create a new sound synthesizer
     * @param {p5} p - The p5 instance
     */
    constructor(p) {
        this.p = p;
    }
    
    /**
     * Generate all sound files and save them to the library
     * @param {Object} soundLibrary - Reference to the AudioSystem's sounds object
     */
    generateSounds(soundLibrary) {
        if (!this.p.p5 || !this.p.SoundFile) {
            console.warn("p5.sound not available. Cannot generate sounds.");
            return;
        }
        
        console.log("Generating synthesized sound effects...");
        
        // Create sounds for each material type
        this.generateMetalSounds(soundLibrary.impacts.metal);
        this.generateWoodSounds(soundLibrary.impacts.wood);
        this.generateGlassSounds(soundLibrary.impacts.glass);
        this.generateSoftSounds(soundLibrary.impacts.soft);
        this.generateGenericSounds(soundLibrary.impacts.generic);
        
        // Create ambient sound
        if (CONFIG.audio.ambientEnabled) {
            soundLibrary.ambient = this.generateAmbientSound();
        }
    }
    
    /**
     * Generate metal impact sounds
     * @param {Array} targetArray - Array to populate with generated sounds
     */
    generateMetalSounds(targetArray) {
        // Metal sounds are characterized by:
        // - High frequencies
        // - Resonant decay
        // - Metallic timbre (rich in harmonics)
        
        // Metal impact 1 - Higher resonant ping
        targetArray.push(this.createResonantSound({
            baseFreq: 700,
            harmonics: [1.0, 0.5, 0.33, 0.25, 0.2],
            attack: 0.001,
            decay: 0.1,
            sustain: 0.3,
            release: 0.5,
            sustainLevel: 0.2,
            filterFreq: 2000,
            resonance: 5
        }));
        
        // Metal impact 2 - Lower, more substantial impact
        targetArray.push(this.createResonantSound({
            baseFreq: 400,
            harmonics: [1.0, 0.7, 0.5, 0.4],
            attack: 0.001,
            decay: 0.15,
            sustain: 0.2,
            release: 0.4,
            sustainLevel: 0.1,
            filterFreq: 1500,
            resonance: 4
        }));
        
        // Metal impact 3 - Brighter, more tinny sound
        targetArray.push(this.createResonantSound({
            baseFreq: 900,
            harmonics: [1.0, 0.6, 0.3, 0.15],
            attack: 0.001,
            decay: 0.08,
            sustain: 0.1,
            release: 0.3,
            sustainLevel: 0.15,
            filterFreq: 3000,
            resonance: 7
        }));
    }
    
    /**
     * Generate wood impact sounds
     * @param {Array} targetArray - Array to populate with generated sounds
     */
    generateWoodSounds(targetArray) {
        // Wood sounds are characterized by:
        // - Medium frequencies
        // - Short decay
        // - Warm timbre with fewer harmonics than metal
        
        // Wood impact 1 - Solid knock
        targetArray.push(this.createResonantSound({
            baseFreq: 180,
            harmonics: [1.0, 0.5, 0.25],
            attack: 0.001,
            decay: 0.08,
            sustain: 0.05,
            release: 0.2,
            sustainLevel: 0.1,
            filterFreq: 800,
            resonance: 2,
            noise: 0.1 // Add a touch of noise for more natural sound
        }));
        
        // Wood impact 2 - Hollow knock
        targetArray.push(this.createResonantSound({
            baseFreq: 220,
            harmonics: [1.0, 0.4, 0.2],
            attack: 0.001,
            decay: 0.1,
            sustain: 0.03,
            release: 0.15,
            sustainLevel: 0.08,
            filterFreq: 600,
            resonance: 3,
            noise: 0.15
        }));
    }
    
    /**
     * Generate glass impact sounds
     * @param {Array} targetArray - Array to populate with generated sounds
     */
    generateGlassSounds(targetArray) {
        // Glass sounds are characterized by:
        // - High frequencies
        // - Very short attack
        // - Pure tones with some noise for breaking
        
        // Glass impact 1 - Light tap
        targetArray.push(this.createResonantSound({
            baseFreq: 1200,
            harmonics: [1.0, 0.3, 0.1],
            attack: 0.001,
            decay: 0.05,
            sustain: 0.02,
            release: 0.2,
            sustainLevel: 0.05,
            filterFreq: 3000,
            resonance: 8
        }));
        
        // Glass impact 2 - Sharper tap
        targetArray.push(this.createResonantSound({
            baseFreq: 1500,
            harmonics: [1.0, 0.2],
            attack: 0.001,
            decay: 0.03,
            sustain: 0.01,
            release: 0.15,
            sustainLevel: 0.03,
            filterFreq: 4000,
            resonance: 10
        }));
        
        // Glass breaking - Complex sound with noise
        targetArray.push(this.createComplexSound({
            layers: [
                // High-pitched shattering
                {
                    type: 'noise',
                    filterFreq: 3000,
                    filterQ: 5,
                    attack: 0.001,
                    decay: 0.05,
                    sustain: 0.2,
                    release: 0.3,
                    sustainLevel: 0.7
                },
                // Mid-range glass resonance
                {
                    type: 'sine',
                    freq: 800,
                    attack: 0.001,
                    decay: 0.1,
                    sustain: 0.05,
                    release: 0.2,
                    sustainLevel: 0.2
                },
                // Lower impact thud
                {
                    type: 'triangle',
                    freq: 300,
                    attack: 0.001,
                    decay: 0.08,
                    sustain: 0.0,
                    release: 0.1,
                    sustainLevel: 0.1
                }
            ]
        }));
    }
    
    /**
     * Generate soft impact sounds
     * @param {Array} targetArray - Array to populate with generated sounds
     */
    generateSoftSounds(targetArray) {
        // Soft sounds are characterized by:
        // - Low frequencies
        // - Gentle attack and longer decay
        // - Muffled quality (low pass filtered)
        
        // Soft impact 1 - Muffled thud
        targetArray.push(this.createResonantSound({
            baseFreq: 120,
            harmonics: [1.0, 0.3],
            attack: 0.01,
            decay: 0.15,
            sustain: 0.0,
            release: 0.25,
            sustainLevel: 0.0,
            filterFreq: 500,
            resonance: 1,
            noise: 0.2
        }));
        
        // Soft impact 2 - Gentle bump
        targetArray.push(this.createResonantSound({
            baseFreq: 100,
            harmonics: [1.0, 0.2],
            attack: 0.02,
            decay: 0.2,
            sustain: 0.0,
            release: 0.3,
            sustainLevel: 0.0,
            filterFreq: 400,
            resonance: 1,
            noise: 0.25
        }));
    }
    
    /**
     * Generate generic impact sounds
     * @param {Array} targetArray - Array to populate with generated sounds
     */
    generateGenericSounds(targetArray) {
        // Generic sounds - medium characteristics, versatile
        
        // Generic impact 1 - Medium impact
        targetArray.push(this.createResonantSound({
            baseFreq: 300,
            harmonics: [1.0, 0.5, 0.25],
            attack: 0.001,
            decay: 0.1,
            sustain: 0.05,
            release: 0.2,
            sustainLevel: 0.1,
            filterFreq: 1000,
            resonance: 2,
            noise: 0.15
        }));
        
        // Generic impact 2 - Another variation
        targetArray.push(this.createResonantSound({
            baseFreq: 250,
            harmonics: [1.0, 0.6, 0.3],
            attack: 0.001,
            decay: 0.12,
            sustain: 0.03,
            release: 0.25,
            sustainLevel: 0.08,
            filterFreq: 800,
            resonance: 2,
            noise: 0.1
        }));
    }
    
    /**
     * Generate ambient background sound
     * @returns {Object} A sound object with loop capability
     */
    generateAmbientSound() {
        // Create a rich ambient sound with multiple layers
        const duration = 10.0; // 10 second loop
        const sampleRate = 44100;
        const channels = 1; // Mono for simplicity
        const numSamples = Math.floor(duration * sampleRate);
        
        // Create an audio buffer for the ambient sound
        // Use p5's managed AudioContext
        const audioContext = this.p.getAudioContext();
        if (!audioContext) {
            console.warn("p5 AudioContext not available for synthesizer.");
            return null; // Cannot generate sound without context
        }
        const buffer = audioContext.createBuffer(channels, numSamples, sampleRate);
        const data = buffer.getChannelData(0); // Get data for first channel
        
        // Generate ambient sound layers
        
        // Layer 1: Low drone
        const droneFreq = 60; // 60 Hz base
        const droneAmp = 0.1;
        this.fillBufferWithWaveform(data, droneFreq, droneAmp, 'sine', sampleRate);
        
        // Layer 2: Gentle pad
        const padFreq = 90; // 90 Hz, harmonically related
        const padAmp = 0.05;
        this.addToBufferWithWaveform(data, padFreq, padAmp, 'triangle', sampleRate);
        
        // Layer 3: High shimmer
        const shimmerFreq = 180; // 180 Hz 
        const shimmerAmp = 0.03;
        this.addToBufferWithWaveform(data, shimmerFreq, shimmerAmp, 'sine', sampleRate);
        
        // Layer 4: Slow modulation
        this.addModulation(data, 0.1, 0.3, sampleRate);
        
        // Layer 5: Very gentle noise background
        this.addNoiseToBuffer(data, 0.02);
        
        // Apply fade in and fade out
        const fadeTime = Math.floor(sampleRate * 0.5); // 0.5 second fade
        this.applyFadeInOut(data, fadeTime);
        
        // Create p5.sound compatible object
        const ambientSound = {
            buffer: buffer,
            sourceNode: null,
            gainNode: null,
            isPlaying: false,
            
            // Methods to match p5.sound API
            // Use arrow function to retain 'this' context of SoundSynthesizer
            play: () => { 
                if (this.isPlaying) this.stop();
                
                // Access the audioContext captured from the outer scope
                this.sourceNode = audioContext.createBufferSource();
                this.sourceNode.buffer = this.buffer;
                
                this.gainNode = audioContext.createGain();
                this.gainNode.gain.value = 0.2; // Initial volume
                
                this.sourceNode.connect(this.gainNode);
                this.gainNode.connect(audioContext.destination);
                
                this.sourceNode.loop = false; // We handle looping manually
                this.sourceNode.start();
                this.isPlaying = true;
                
                // Schedule next loop
                setTimeout(() => {
                    // Inside setTimeout, 'this' refers to the ambientSound object itself
                    if (ambientSound.isPlaying) ambientSound.play() ;
                }, duration * 900); // Slightly less than duration to avoid gaps
            },
            
            loop: () => { // Arrow function
                this.play();
            },
            
            stop: () => { // Arrow function
                if (this.sourceNode && this.isPlaying) {
                    this.sourceNode.stop();
                    this.isPlaying = false;
                }
            },
            
            setVolume: (vol) => { // Arrow function
                if (this.gainNode) {
                    this.gainNode.gain.value = vol;
                }
            },
            // Removed getAudioContext
        };
        
        return ambientSound;
    }
    
    /**
     * Create a sound with resonant harmonics
     * @param {Object} params - Sound parameters
     * @returns {Object} A playable sound object
     */
    createResonantSound(params) {
        // Create a p5.MonoSynth-like object
        const sound = {
            // Sound parameters
            params: params,
            
            // Methods to match p5.sound API
            play: () => {
                const p = this.p;
                
                // Create oscillators for each harmonic
                const oscillators = [];
                const env = new p.Envelope();
                
                // Set envelope based on parameters
                env.setADSR(
                    params.attack || 0.001,
                    params.decay || 0.1,
                    params.sustain || 0.2,
                    params.release || 0.5
                );
                env.setRange(1, 0);
                
                // Create filter if needed
                let filter = null;
                if (params.filterFreq) {
                    filter = new p.Filter();
                    filter.setType('lowpass');
                    filter.freq(params.filterFreq);
                    filter.res(params.resonance || 1);
                }
                
                // Create noise component if needed
                let noise = null;
                if (params.noise && params.noise > 0) {
                    noise = new p.Noise('white');
                    noise.amp(params.noise);
                    if (filter) {
                        noise.connect(filter);
                    }
                    noise.start();
                    
                    // Stop noise after the sound duration
                    setTimeout(() => {
                        noise.amp(0, params.release);
                        setTimeout(() => noise.stop(), params.release * 1000);
                    }, (params.attack + params.decay + params.sustain) * 1000);
                }
                
                // Create oscillators for harmonics
                params.harmonics.forEach((strength, i) => {
                    const osc = new p.Oscillator();
                    const harmFreq = params.baseFreq * (i + 1);
                    osc.setType('sine');
                    osc.freq(harmFreq);
                    osc.amp(strength * 0.2); // Scale total amplitude
                    
                    if (filter) {
                        osc.connect(filter);
                    }
                    
                    oscillators.push(osc);
                    osc.start();
                    
                    // Apply envelope
                    env.play(osc);
                });
                
                // Stop oscillators after envelope completes
                const totalDuration = (params.attack + params.decay + 
                                      params.sustain + params.release) * 1000;
                
                setTimeout(() => {
                    oscillators.forEach(osc => {
                        osc.stop();
                    });
                }, totalDuration);
            },
            
            // Dummy methods to match expected sound interface
            rate: function(r) {},
            setVolume: function(v) {},
            stop: function() {}
        };
        
        return sound;
    }
    
    /**
     * Create a more complex layered sound
     * @param {Object} params - Parameters defining the sound layers
     * @returns {Object} A playable sound object 
     */
    createComplexSound(params) {
        // Create a sound comprised of multiple layers
        const sound = {
            // Sound parameters
            params: params,
            
            // Methods to match p5.sound API
            play: () => {
                const p = this.p;
                
                // For each layer, create the appropriate sound source
                params.layers.forEach(layer => {
                    // Create envelope for this layer
                    const env = new p.Envelope();
                    env.setADSR(
                        layer.attack || 0.01,
                        layer.decay || 0.1,
                        layer.sustain || 0.3,
                        layer.release || 0.5
                    );
                    env.setRange(layer.sustainLevel || 0.5, 0);
                    
                    // Create sound generator based on type
                    if (layer.type === 'noise') {
                        // Create noise source
                        const noise = new p.Noise('white');
                        
                        // Apply filter if specified
                        if (layer.filterFreq) {
                            const filter = new p.Filter();
                            filter.setType('bandpass');
                            filter.freq(layer.filterFreq);
                            filter.res(layer.filterQ || 1);
                            noise.connect(filter);
                        }
                        
                        noise.start();
                        env.play(noise);
                        
                        // Stop noise after envelope
                        const duration = (layer.attack + layer.decay + 
                                         layer.sustain + layer.release) * 1000;
                        setTimeout(() => {
                            noise.stop();
                        }, duration);
                    }
                    else {
                        // Create oscillator source
                        const osc = new p.Oscillator(layer.type);
                        osc.freq(layer.freq || 440);
                        
                        // Apply filter if needed
                        if (layer.filterFreq) {
                            const filter = new p.Filter();
                            filter.setType('lowpass');
                            filter.freq(layer.filterFreq);
                            filter.res(layer.filterQ || 1);
                            osc.connect(filter);
                        }
                        
                        osc.start();
                        env.play(osc);
                        
                        // Stop oscillator after envelope
                        const duration = (layer.attack + layer.decay + 
                                         layer.sustain + layer.release) * 1000;
                        setTimeout(() => {
                            osc.stop();
                        }, duration);
                    }
                });
            },
            
            // Dummy methods to match expected sound interface
            rate: function(r) {},
            setVolume: function(v) {},
            stop: function() {}
        };
        
        return sound;
    }
    
    // Buffer manipulation helper methods
    
    /**
     * Fill a buffer with a waveform
     * @param {Float32Array} buffer - The audio buffer to fill
     * @param {number} freq - Frequency in Hz
     * @param {number} amp - Amplitude (0-1)
     * @param {string} type - Waveform type (sine, triangle, etc)
     * @param {number} sampleRate - Audio sample rate
     */
    fillBufferWithWaveform(buffer, freq, amp, type, sampleRate) {
        const period = sampleRate / freq;
        
        for (let i = 0; i < buffer.length; i++) {
            const phase = (i % period) / period;
            
            if (type === 'sine') {
                buffer[i] = amp * Math.sin(phase * Math.PI * 2);
            }
            else if (type === 'triangle') {
                buffer[i] = amp * (phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase);
            }
            else if (type === 'sawtooth') {
                buffer[i] = amp * (2 * phase - 1);
            }
            else if (type === 'square') {
                buffer[i] = amp * (phase < 0.5 ? 1 : -1);
            }
        }
    }
    
    /**
     * Add a waveform to an existing buffer
     * @param {Float32Array} buffer - The audio buffer to modify
     * @param {number} freq - Frequency in Hz
     * @param {number} amp - Amplitude (0-1)
     * @param {string} type - Waveform type (sine, triangle, etc)
     * @param {number} sampleRate - Audio sample rate
     */
    addToBufferWithWaveform(buffer, freq, amp, type, sampleRate) {
        const period = sampleRate / freq;
        
        for (let i = 0; i < buffer.length; i++) {
            const phase = (i % period) / period;
            
            if (type === 'sine') {
                buffer[i] += amp * Math.sin(phase * Math.PI * 2);
            }
            else if (type === 'triangle') {
                buffer[i] += amp * (phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase);
            }
            else if (type === 'sawtooth') {
                buffer[i] += amp * (2 * phase - 1);
            }
            else if (type === 'square') {
                buffer[i] += amp * (phase < 0.5 ? 1 : -1);
            }
        }
    }
    
    /**
     * Add gentle noise to a buffer
     * @param {Float32Array} buffer - The audio buffer to modify
     * @param {number} amount - Noise amplitude (0-1)
     */
    addNoiseToBuffer(buffer, amount) {
        for (let i = 0; i < buffer.length; i++) {
            buffer[i] += (Math.random() * 2 - 1) * amount;
        }
    }
    
    /**
     * Add slow modulation to a buffer
     * @param {Float32Array} buffer - The audio buffer to modify
     * @param {number} depth - Modulation depth (0-1)
     * @param {number} rate - Modulation rate in Hz
     * @param {number} sampleRate - Audio sample rate
     */
    addModulation(buffer, depth, rate, sampleRate) {
        const period = sampleRate / rate;
        
        for (let i = 0; i < buffer.length; i++) {
            const phase = (i % period) / period;
            const mod = depth * Math.sin(phase * Math.PI * 2);
            
            buffer[i] *= (1 + mod);
        }
    }
    
    /**
     * Apply fade in and fade out to avoid clicks
     * @param {Float32Array} buffer - The audio buffer to modify
     * @param {number} fadeLength - Length of fade in samples
     */
    applyFadeInOut(buffer, fadeLength) {
        // Fade in
        for (let i = 0; i < fadeLength; i++) {
            const factor = i / fadeLength;
            buffer[i] *= factor;
        }
        
        // Fade out
        for (let i = 0; i < fadeLength; i++) {
            const factor = i / fadeLength;
            buffer[buffer.length - 1 - i] *= factor;
        }
    }
}