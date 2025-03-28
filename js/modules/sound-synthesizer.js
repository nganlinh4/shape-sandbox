/**
 * Sound Synthesizer class
 * Dynamically generates sound effects for different material types
 * Now uses Web Audio API directly (no p5.sound dependency)
 */
class SoundSynthesizer {
    /**
     * Create a new sound synthesizer
     * @param {p5} p - The p5 instance (kept for backward compatibility)
     */
    constructor(p) {
        this.p = p;  // Keep for backward compatibility
        this.audioContext = null;  // Will be set by AudioSystem
    }
    
    /**
     * Generate all sound files and save them to the library
     * @param {Object} soundLibrary - Reference to the AudioSystem's sounds object
     */
    generateSounds(soundLibrary) {
        // Check if we have a valid audio context
        if (!this.audioContext) {
            console.warn("No AudioContext available for SoundSynthesizer. Cannot generate sounds.");
            return;
        }
        
        console.log("Generating synthesized sound effects with Web Audio API...");
        
        // Create sounds for each material type
        this.generateMetalSounds(soundLibrary.impacts.metal);
        this.generateWoodSounds(soundLibrary.impacts.wood);
        this.generateGlassSounds(soundLibrary.impacts.glass);
        this.generateSoftSounds(soundLibrary.impacts.soft);
        this.generateGenericSounds(soundLibrary.impacts.generic);
        
        // Create ambient sound
        if (CONFIG.audio.ambientEnabled && !soundLibrary.ambient) {
            soundLibrary.ambient = this.generateAmbientSound();
        }
    }
    
    /**
     * Create a basic oscillator sound
     * @param {Object} params - Sound parameters
     * @returns {Object} Sound object with play method
     */
    createBasicSound(params) {
        const sound = {
            params: params,
            
            play: () => {
                if (!this.audioContext) return;
                
                // Create oscillator and gain node
                const osc = this.audioContext.createOscillator();
                const gain = this.audioContext.createGain();
                
                // Configure oscillator
                osc.type = params.type || 'sine';
                osc.frequency.value = params.freq || 440;
                
                // Connect nodes
                osc.connect(gain);
                gain.connect(this.audioContext.destination);
                
                // Set up envelope
                const now = this.audioContext.currentTime;
                const attack = params.attack || 0.01;
                const decay = params.decay || 0.1;
                const sustain = params.sustain || 0;
                const release = params.release || 0.3;
                const sustainLevel = params.sustainLevel || 0.5;
                const volume = params.volume || 0.2;
                
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(volume, now + attack);
                gain.gain.linearRampToValueAtTime(sustainLevel * volume, now + attack + decay);
                gain.gain.linearRampToValueAtTime(0, now + attack + decay + sustain + release);
                
                // Start and stop
                osc.start(now);
                osc.stop(now + attack + decay + sustain + release + 0.1);
                
                // Clean up
                osc.onended = () => {
                    osc.disconnect();
                    gain.disconnect();
                };
                
                return {
                    osc: osc,
                    gain: gain
                };
            },
            
            // Methods to match the sound interface
            rate: (r) => {
                // Adjust the base frequency based on rate
                params.freq = params.baseFreq * r;
            },
            
            setVolume: (v) => {
                params.volume = v;
            }
        };
        
        return sound;
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
            freq: 700,
            type: 'triangle',
            attack: 0.001,
            decay: 0.1,
            sustain: 0.3,
            release: 0.5,
            sustainLevel: 0.2,
            volume: 0.2
        }));
        
        // Metal impact 2 - Lower, more substantial impact
        targetArray.push(this.createResonantSound({
            baseFreq: 400,
            freq: 400,
            type: 'triangle',  
            attack: 0.001,
            decay: 0.15,
            sustain: 0.2,
            release: 0.4,
            sustainLevel: 0.1,
            volume: 0.2
        }));
        
        // Metal impact 3 - Brighter, more tinny sound
        targetArray.push(this.createResonantSound({
            baseFreq: 900,
            freq: 900,
            type: 'square',
            attack: 0.001,
            decay: 0.08,
            sustain: 0.1,
            release: 0.3,
            sustainLevel: 0.15,
            volume: 0.15
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
            freq: 180,
            type: 'triangle',
            attack: 0.001,
            decay: 0.08,
            sustain: 0.05,
            release: 0.2,
            sustainLevel: 0.1,
            volume: 0.15,
            noise: 0.1 // Add a touch of noise for more natural sound
        }));
        
        // Wood impact 2 - Hollow knock
        targetArray.push(this.createResonantSound({
            baseFreq: 220,
            freq: 220,
            type: 'triangle',
            attack: 0.001,
            decay: 0.1,
            sustain: 0.03,
            release: 0.15,
            sustainLevel: 0.08,
            volume: 0.15,
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
            freq: 1200,
            type: 'sine',
            attack: 0.001,
            decay: 0.05,
            sustain: 0.02,
            release: 0.2,
            sustainLevel: 0.05,
            volume: 0.12
        }));
        
        // Glass impact 2 - Sharper tap
        targetArray.push(this.createResonantSound({
            baseFreq: 1500,
            freq: 1500,
            type: 'sine',
            attack: 0.001,
            decay: 0.03,
            sustain: 0.01,
            release: 0.15,
            sustainLevel: 0.03,
            volume: 0.12
        }));
        
        // Glass breaking - Complex sound with noise
        targetArray.push(this.createComplexSound([
            // High-pitched shattering
            {
                type: 'noise',
                attack: 0.001,
                decay: 0.05,
                sustain: 0.2,
                release: 0.3,
                sustainLevel: 0.7,
                volume: 0.15
            },
            // Mid-range glass resonance
            {
                type: 'sine',
                freq: 800,
                attack: 0.001, 
                decay: 0.1,
                sustain: 0.05,
                release: 0.2,
                sustainLevel: 0.2,
                volume: 0.1
            },
            // Lower impact thud
            {
                type: 'triangle',
                freq: 300,
                attack: 0.001,
                decay: 0.08,
                sustain: 0.0,
                release: 0.1,
                sustainLevel: 0.1,
                volume: 0.08
            }
        ]));
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
            freq: 120,
            type: 'sine',
            attack: 0.01,
            decay: 0.15,
            sustain: 0.0,
            release: 0.25,
            sustainLevel: 0.0,
            volume: 0.12,
            noise: 0.2
        }));
        
        // Soft impact 2 - Gentle bump
        targetArray.push(this.createResonantSound({
            baseFreq: 100,
            freq: 100,
            type: 'sine',
            attack: 0.02,
            decay: 0.2,
            sustain: 0.0,
            release: 0.3,
            sustainLevel: 0.0,
            volume: 0.12,
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
            freq: 300, 
            type: 'triangle',
            attack: 0.001,
            decay: 0.1,
            sustain: 0.05,
            release: 0.2,
            sustainLevel: 0.1,
            volume: 0.15,
            noise: 0.15
        }));
        
        // Generic impact 2 - Another variation
        targetArray.push(this.createResonantSound({
            baseFreq: 250,
            freq: 250,
            type: 'triangle',
            attack: 0.001,
            decay: 0.12,
            sustain: 0.03,
            release: 0.25,
            sustainLevel: 0.08,
            volume: 0.15,
            noise: 0.1
        }));
    }
    
    /**
     * Create a sound with resonant harmonics
     * @param {Object} params - Sound parameters
     * @returns {Object} A playable sound object
     */
    createResonantSound(params) {
        const sound = {
            params: params,
            
            play: () => {
                if (!this.audioContext) return;
                
                const now = this.audioContext.currentTime;
                const oscillators = [];
                const gainNodes = [];
                const finalGain = this.audioContext.createGain();
                
                // Set overall volume
                finalGain.gain.value = params.volume || 0.2;
                finalGain.connect(this.audioContext.destination);
                
                // Create harmonics - simpler implementation without p5.sound
                const numHarmonics = 3; // Simple approximation
                
                for (let i = 0; i < numHarmonics; i++) {
                    const osc = this.audioContext.createOscillator();
                    const gain = this.audioContext.createGain();
                    
                    // Calculate harmonic frequency and strength
                    const harmonicFreq = params.freq * (i + 1);
                    const harmonicStrength = 1 / (i + 1);
                    
                    // Configure oscillator
                    osc.type = params.type || 'sine';
                    osc.frequency.value = harmonicFreq;
                    
                    // Set up envelope
                    gain.gain.setValueAtTime(0, now);
                    gain.gain.linearRampToValueAtTime(harmonicStrength, now + (params.attack || 0.01));
                    gain.gain.linearRampToValueAtTime(
                        harmonicStrength * (params.sustainLevel || 0.5), 
                        now + (params.attack || 0.01) + (params.decay || 0.1)
                    );
                    gain.gain.linearRampToValueAtTime(
                        0, 
                        now + (params.attack || 0.01) + (params.decay || 0.1) + 
                        (params.sustain || 0.3) + (params.release || 0.5)
                    );
                    
                    // Connect nodes
                    osc.connect(gain);
                    gain.connect(finalGain);
                    
                    // Start oscillator
                    osc.start(now);
                    osc.stop(now + 
                           (params.attack || 0.01) + 
                           (params.decay || 0.1) + 
                           (params.sustain || 0.3) + 
                           (params.release || 0.5) + 0.1);
                    
                    // Store for cleanup
                    oscillators.push(osc);
                    gainNodes.push(gain);
                }
                
                // Add noise if requested
                if (params.noise && params.noise > 0) {
                    // Create noise buffer
                    const bufferSize = 2 * this.audioContext.sampleRate;
                    const noiseBuffer = this.audioContext.createBuffer(
                        1, bufferSize, this.audioContext.sampleRate);
                    const output = noiseBuffer.getChannelData(0);
                    
                    for (let i = 0; i < bufferSize; i++) {
                        output[i] = Math.random() * 2 - 1;
                    }
                    
                    // Create noise source and gain
                    const noise = this.audioContext.createBufferSource();
                    noise.buffer = noiseBuffer;
                    const noiseGain = this.audioContext.createGain();
                    noiseGain.gain.value = params.noise * params.volume;
                    
                    // Configure envelope
                    noiseGain.gain.setValueAtTime(0, now);
                    noiseGain.gain.linearRampToValueAtTime(params.noise * params.volume, now + (params.attack || 0.01));
                    noiseGain.gain.linearRampToValueAtTime(
                        params.noise * params.volume * (params.sustainLevel || 0.5), 
                        now + (params.attack || 0.01) + (params.decay || 0.1)
                    );
                    noiseGain.gain.linearRampToValueAtTime(
                        0, 
                        now + (params.attack || 0.01) + (params.decay || 0.1) + 
                        (params.sustain || 0.1) + (params.release || 0.5)
                    );
                    
                    // Connect noise
                    noise.connect(noiseGain);
                    noiseGain.connect(finalGain);
                    
                    // Start noise
                    noise.start(now);
                    noise.stop(now + 
                            (params.attack || 0.01) + 
                            (params.decay || 0.1) + 
                            (params.sustain || 0.1) + 
                            (params.release || 0.5) + 0.1);
                            
                    // Add to list for potential cleanup
                    oscillators.push(noise);
                }
                
                // Clean up after sound completes
                setTimeout(() => {
                    finalGain.disconnect();
                    oscillators.forEach(osc => {
                        try {
                            osc.disconnect();
                        } catch (e) {
                            // Ignore any disconnect errors
                        }
                    });
                    gainNodes.forEach(gain => {
                        try {
                            gain.disconnect();
                        } catch (e) {
                            // Ignore any disconnect errors
                        }
                    });
                }, ((params.attack || 0.01) + 
                   (params.decay || 0.1) + 
                   (params.sustain || 0.3) + 
                   (params.release || 0.5) + 0.2) * 1000);
            },
            
            // Interface methods
            rate: (r) => {
                params.freq = params.baseFreq * r;
            },
            
            setVolume: (v) => {
                params.volume = v;
            }
        };
        
        return sound;
    }
    
    /**
     * Create a more complex layered sound
     * @param {Array} layers - Array of layer parameters
     * @returns {Object} A playable sound object 
     */
    createComplexSound(layers) {
        const sound = {
            layers: layers,
            
            play: () => {
                if (!this.audioContext) return;
                
                const now = this.audioContext.currentTime;
                const allNodes = [];
                const finalGain = this.audioContext.createGain();
                finalGain.gain.value = 1.0;
                finalGain.connect(this.audioContext.destination);
                
                // For each layer, create the appropriate sound source
                layers.forEach(layer => {
                    if (layer.type === 'noise') {
                        // Create noise
                        const bufferSize = 2 * this.audioContext.sampleRate;
                        const noiseBuffer = this.audioContext.createBuffer(
                            1, bufferSize, this.audioContext.sampleRate);
                        const output = noiseBuffer.getChannelData(0);
                        
                        for (let i = 0; i < bufferSize; i++) {
                            output[i] = Math.random() * 2 - 1;
                        }
                        
                        // Create noise source
                        const noise = this.audioContext.createBufferSource();
                        noise.buffer = noiseBuffer;
                        
                        // Create gain for envelope
                        const gain = this.audioContext.createGain();
                        
                        // Apply filter if specified
                        let destination = gain;
                        if (layer.filterFreq) {
                            const filter = this.audioContext.createBiquadFilter();
                            filter.type = 'bandpass';
                            filter.frequency.value = layer.filterFreq;
                            filter.Q.value = layer.filterQ || 1;
                            
                            noise.connect(filter);
                            filter.connect(gain);
                            destination = filter;
                            allNodes.push(filter);
                        } else {
                            noise.connect(gain);
                        }
                        
                        // Set up envelope
                        gain.gain.setValueAtTime(0, now);
                        gain.gain.linearRampToValueAtTime(layer.volume || 0.2, now + (layer.attack || 0.01));
                        gain.gain.linearRampToValueAtTime(
                            (layer.sustainLevel || 0.5) * (layer.volume || 0.2), 
                            now + (layer.attack || 0.01) + (layer.decay || 0.1)
                        );
                        gain.gain.linearRampToValueAtTime(
                            0, 
                            now + (layer.attack || 0.01) + (layer.decay || 0.1) + 
                            (layer.sustain || 0.3) + (layer.release || 0.5)
                        );
                        
                        // Connect to main output
                        gain.connect(finalGain);
                        
                        // Start and stop the noise
                        noise.start(now);
                        noise.stop(now + 
                               (layer.attack || 0.01) + 
                               (layer.decay || 0.1) + 
                               (layer.sustain || 0.3) + 
                               (layer.release || 0.5) + 0.1);
                        
                        // Store for cleanup
                        allNodes.push(noise, gain);
                    }
                    else {
                        // Create oscillator
                        const osc = this.audioContext.createOscillator();
                        const gain = this.audioContext.createGain();
                        
                        // Configure oscillator
                        osc.type = layer.type || 'sine';
                        osc.frequency.value = layer.freq || 440;
                        
                        // Apply filter if needed
                        if (layer.filterFreq) {
                            const filter = this.audioContext.createBiquadFilter();
                            filter.type = 'lowpass';
                            filter.frequency.value = layer.filterFreq;
                            filter.Q.value = layer.filterQ || 1;
                            
                            osc.connect(filter);
                            filter.connect(gain);
                            allNodes.push(filter);
                        } else {
                            osc.connect(gain);
                        }
                        
                        // Set up envelope
                        gain.gain.setValueAtTime(0, now);
                        gain.gain.linearRampToValueAtTime(layer.volume || 0.2, now + (layer.attack || 0.01));
                        gain.gain.linearRampToValueAtTime(
                            (layer.sustainLevel || 0.5) * (layer.volume || 0.2), 
                            now + (layer.attack || 0.01) + (layer.decay || 0.1)
                        );
                        gain.gain.linearRampToValueAtTime(
                            0, 
                            now + (layer.attack || 0.01) + (layer.decay || 0.1) + 
                            (layer.sustain || 0.3) + (layer.release || 0.5)
                        );
                        
                        // Connect to main output
                        gain.connect(finalGain);
                        
                        // Start and stop the oscillator
                        osc.start(now);
                        osc.stop(now + 
                               (layer.attack || 0.01) + 
                               (layer.decay || 0.1) + 
                               (layer.sustain || 0.3) + 
                               (layer.release || 0.5) + 0.1);
                        
                        // Store for cleanup
                        allNodes.push(osc, gain);
                    }
                });
                
                // Clean up after the sound is done
                const maxDuration = layers.reduce((max, layer) => {
                    const duration = (layer.attack || 0.01) + 
                                   (layer.decay || 0.1) + 
                                   (layer.sustain || 0.3) + 
                                   (layer.release || 0.5);
                    return Math.max(max, duration);
                }, 0);
                
                setTimeout(() => {
                    finalGain.disconnect();
                    allNodes.forEach(node => {
                        try {
                            node.disconnect();
                        } catch (e) {
                            // Ignore any disconnect errors
                        }
                    });
                }, (maxDuration + 0.2) * 1000);
            },
            
            // Interface methods
            rate: (r) => {
                layers.forEach(layer => {
                    if (layer.freq) layer.freq = layer.baseFreq * r;
                });
            },
            
            setVolume: (v) => {
                layers.forEach(layer => {
                    layer.volume = v;
                });
            }
        };
        
        return sound;
    }
    
    /**
     * Generate ambient background sound
     * @returns {Object} A sound object with loop capability
     */
    generateAmbientSound() {
        // Create a rich ambient sound without using p5.sound
        return {
            play: () => {
                if (!this.audioContext) return;
                
                const oscillators = [];
                const gains = [];
                
                // Base frequencies for ambient sound
                const freqs = [60, 87, 120, 174];
                const types = ['sine', 'sine', 'triangle', 'sine'];
                const vols = [0.1, 0.07, 0.05, 0.03];
                
                // Create multiple oscillators
                for (let i = 0; i < freqs.length; i++) {
                    const osc = this.audioContext.createOscillator();
                    const gain = this.audioContext.createGain();
                    
                    // Configure oscillator
                    osc.type = types[i];
                    osc.frequency.value = freqs[i];
                    
                    // Set gain
                    gain.gain.value = vols[i] * CONFIG.audio.ambientVolume;
                    
                    // Connect nodes
                    osc.connect(gain);
                    gain.connect(this.audioContext.destination);
                    
                    // Start oscillator
                    osc.start();
                    
                    // Store for stop/cleanup
                    oscillators.push(osc);
                    gains.push(gain);
                }
                
                // Return controls
                return {
                    oscillators: oscillators,
                    gains: gains,
                    
                    loop: () => {
                        // Already looping
                    },
                    
                    stop: () => {
                        const now = this.audioContext.currentTime;
                        
                        // Fade out all oscillators
                        oscillators.forEach((osc, i) => {
                            gains[i].gain.linearRampToValueAtTime(0, now + 1);
                            osc.stop(now + 1.1);
                        });
                    },
                    
                    isPlaying: () => true,
                    
                    setVolume: (vol) => {
                        for (let i = 0; i < gains.length; i++) {
                            gains[i].gain.value = vols[i] * vol;
                        }
                    }
                };
            },
            
            loop: function() {
                if (!this._player) {
                    this._player = this.play();
                }
            },
            
            play: function() {
                this.loop();
            },
            
            stop: function() {
                if (this._player) {
                    this._player.stop();
                    this._player = null;
                }
            },
            
            isPlaying: function() {
                return !!this._player;
            },
            
            setVolume: function(vol) {
                if (this._player) {
                    this._player.setVolume(vol);
                }
            },
            
            _player: null
        };
    }
}