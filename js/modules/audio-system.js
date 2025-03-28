/**
 * AudioSystem for handling sound effects based on physics interactions
 * Uses Web Audio API directly without relying on p5.sound
 */
class AudioSystem {
    /**
     * Create a new audio system
     * @param {p5} p - The p5 instance (just for consistency, we won't use p5.sound)
     * @param {ShapeManager} shapeManager - The shape manager instance
     * @param {MaterialLibrary} materialLibrary - The material library instance
     * @param {PhysicsSystem} physics - The physics system instance
     */
    constructor(p, shapeManager, materialLibrary, physics) {
        this.p = p;
        this.shapeManager = shapeManager;
        this.materialLibrary = materialLibrary;
        this.physics = physics;
        
        // Sound library
        this.sounds = {
            // Impact sounds for different material types
            impacts: {
                metal: [], // Array of metal impact sounds
                wood: [],  // Array of wood impact sounds
                glass: [], // Array of glass impact sounds
                soft: [],  // Array of soft impact sounds
                generic: [] // Array of generic impact sounds
            },
            // Ambient sound (if used)
            ambient: null
        };
        
        // Currently playing sounds
        this.activeSounds = [];
        this.activeCount = 0;
        
        // Whether audio is enabled and initialized
        this.isEnabled = CONFIG.audio.enabled;
        this.isInitialized = false;
        
        // Create our own audio context directly - no p5.sound dependency
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this._audioContext = new AudioContext();
                // Create master gain node
                this._masterGain = this._audioContext.createGain();
                this._masterGain.connect(this._audioContext.destination);
                this._masterGain.gain.value = CONFIG.audio.masterVolume;
            }
        } catch (e) {
            console.warn("Failed to create AudioContext:", e);
            this._audioContext = null;
        }
        
        // Initialize synthesis modules
        this.synthesizer = new SoundSynthesizer(p);
        
        // Initialization will be triggered by user interaction
    }
    
    /**
     * Initialize the audio system - must be called from a user interaction event
     */
    init() {
        if (this.isInitialized || !this.isEnabled) return; // Prevent multiple initializations or if disabled
        
        console.log("Initializing AudioSystem...");
        
        try {
            // Resume audio context if it exists and is suspended
            if (this._audioContext && this._audioContext.state === 'suspended') {
                this._audioContext.resume().then(() => {
                    console.log(`AudioContext resumed: ${this._audioContext.state}`);
                }).catch(err => {
                    console.warn("Failed to resume AudioContext:", err);
                });
            }
            
            // Create synthesized sounds (no p5.sound dependency)
            this.createPlaceholderSounds();
            
            // Add collision listeners to physics bodies
            this.setupCollisionListeners();
            
            this.isInitialized = true;
            console.log("AudioSystem initialized with native Web Audio API (no p5.sound)");
            
        } catch (err) {
            console.error("Error during AudioSystem initialization:", err);
            this.isEnabled = false;
        }
    }
    
    /**
     * Create synthesized sounds using our synthesizer
     */
    createPlaceholderSounds() {
        console.log("Creating synthesized sounds...");
        
        // Basic audio context validation
        if (!this._audioContext) {
            console.warn("AudioContext not available. Audio disabled.");
            this.isEnabled = false;
            return;
        }
        
        // Synthesize sounds using simpler native Web Audio API methods
        if (this.synthesizer) {
            try {
                // Use the synthesizer to create sounds directly
                this.synthesizer.audioContext = this._audioContext; // Pass our audio context to the synthesizer
                this.synthesizer.generateSounds(this.sounds);
                return;
            } catch (err) {
                console.warn("Error using SoundSynthesizer:", err);
                // Create basic sounds as fallback
            }
        }
        
        // Fallback: Create basic oscillator sounds with Web Audio API
        this.createBasicSounds();
    }
    
    /**
     * Create very basic sounds using only Web Audio API
     * This is a fallback if the synthesizer fails
     */
    createBasicSounds() {
        const createSound = (params) => {
            return {
                params: params,
                play: () => {
                    if (!this._audioContext || !this.isEnabled) return;
                    
                    // Create oscillator
                    const osc = this._audioContext.createOscillator();
                    const gainNode = this._audioContext.createGain();
                    
                    // Set frequency and type
                    osc.frequency.value = params.freq;
                    osc.type = params.type || 'sine';
                    
                    // Connect nodes
                    osc.connect(gainNode);
                    gainNode.connect(this._masterGain);
                    
                    // Set up envelope
                    const now = this._audioContext.currentTime;
                    gainNode.gain.value = 0;
                    gainNode.gain.setValueAtTime(0, now);
                    gainNode.gain.linearRampToValueAtTime(params.volume || 0.2, now + 0.01);
                    gainNode.gain.exponentialRampToValueAtTime(0.001, now + (params.duration || 0.5));
                    
                    // Start and stop
                    osc.start(now);
                    osc.stop(now + (params.duration || 0.5) + 0.1);
                    
                    // Clean up
                    osc.onended = () => {
                        osc.disconnect();
                        gainNode.disconnect();
                    };
                },
                rate: (r) => {}, // Adjust pitch if needed
                setVolume: (v) => {}, // Adjust volume if needed
                isPlaying: () => false // Dummy check
            };
        };
        
        // Create material sounds
        this.sounds.impacts.metal = [
            createSound({ freq: 600, type: 'square', duration: 0.4, volume: 0.2 }),
            createSound({ freq: 500, type: 'triangle', duration: 0.5, volume: 0.2 })
        ];
        
        this.sounds.impacts.wood = [
            createSound({ freq: 300, type: 'triangle', duration: 0.3, volume: 0.15 }),
            createSound({ freq: 250, type: 'triangle', duration: 0.35, volume: 0.15 })
        ];
        
        this.sounds.impacts.glass = [
            createSound({ freq: 800, type: 'sine', duration: 0.3, volume: 0.15 }),
            createSound({ freq: 1200, type: 'sawtooth', duration: 0.2, volume: 0.12 })
        ];
        
        this.sounds.impacts.soft = [
            createSound({ freq: 150, type: 'sine', duration: 0.5, volume: 0.1 }),
            createSound({ freq: 180, type: 'sine', duration: 0.6, volume: 0.1 })
        ];
        
        this.sounds.impacts.generic = [
            createSound({ freq: 400, type: 'triangle', duration: 0.3, volume: 0.15 }),
            createSound({ freq: 350, type: 'triangle', duration: 0.4, volume: 0.15 })
        ];
        
        // Create ambient sound
        if (CONFIG.audio.ambientEnabled) {
            const createAmbientSound = () => {
                if (!this._audioContext || !this.isEnabled) return;
                
                const oscillators = [];
                const gainNodes = [];
                
                // Create three oscillators for a richer sound
                const freqs = [60, 67, 120];
                const volumes = [0.05, 0.03, 0.02];
                const types = ['sine', 'sine', 'sine'];
                
                for (let i = 0; i < 3; i++) {
                    const osc = this._audioContext.createOscillator();
                    const gain = this._audioContext.createGain();
                    
                    osc.frequency.value = freqs[i];
                    osc.type = types[i];
                    
                    gain.gain.value = volumes[i] * CONFIG.audio.ambientVolume;
                    
                    osc.connect(gain);
                    gain.connect(this._masterGain);
                    
                    oscillators.push(osc);
                    gainNodes.push(gain);
                    
                    osc.start();
                }
                
                return {
                    oscillators: oscillators,
                    gainNodes: gainNodes,
                    loop: function() { 
                        // Already looping - nothing to do 
                    },
                    play: function() {
                        // Already playing - nothing to do
                    },
                    stop: function() {
                        const now = this._audioContext ? this._audioContext.currentTime : 0;
                        
                        this.oscillators.forEach((osc, i) => {
                            this.gainNodes[i].gain.linearRampToValueAtTime(0, now + 1);
                            osc.stop(now + 1.1);
                        });
                        
                        this.oscillators = [];
                        this.gainNodes = [];
                    },
                    isPlaying: function() {
                        return this.oscillators.length > 0;
                    },
                    setVolume: function(volume) {
                        this.gainNodes.forEach((gain, i) => {
                            gain.gain.value = volumes[i] * volume;
                        });
                    }
                };
            };
            
            this.sounds.ambient = {
                _player: null,
                loop: function() {
                    if (!this._player) {
                        this._player = createAmbientSound();
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
                    return this._player && this._player.isPlaying();
                },
                setVolume: function(vol) {
                    if (this._player) {
                        this._player.setVolume(vol);
                    }
                }
            };
        }
    }
    
    /**
     * Set up collision event listeners on physics bodies
     */
    setupCollisionListeners() {
        const world = this.physics.world;
        
        // Add global collision event listener
        world.addEventListener('collide', (event) => {
            if (!this.isEnabled) return;
            
            // Get the two colliding bodies
            const bodyA = event.bodyA;
            const bodyB = event.bodyB;
            
            // Find corresponding shapes
            const shapeA = this.findShapeForBody(bodyA);
            const shapeB = this.findShapeForBody(bodyB);
            
            // If either shape is not found, skip sound
            if (!shapeA || !shapeB) return;
            
            // Get material types
            const materialA = this.materialLibrary.getMaterial(shapeA.materialId);
            const materialB = this.materialLibrary.getMaterial(shapeB.materialId);
            
            // If either material is not found, skip sound
            if (!materialA || !materialB) return;
            
            // Calculate impact velocity (normal component)
            const impactVelocity = Math.abs(event.contact.getImpactVelocityAlongNormal());
            
            // Skip if impact is below threshold
            if (impactVelocity < CONFIG.audio.impactThreshold) return;
            
            // Determine dominant material for sound selection
            // Strategy: Use "harder" material (metal > glass > wood > soft)
            const materialPriority = {
                'metal': 4,
                'glass': 3,
                'wood': 2,
                'soft': 1,
                'generic': 0
            };
            
            const soundTypeA = materialA.soundType;
            const soundTypeB = materialB.soundType;
            
            const dominantSoundType = (materialPriority[soundTypeA] >= materialPriority[soundTypeB]) 
                ? soundTypeA : soundTypeB;
            
            // Play collision sound
            this.playCollisionSound(dominantSoundType, impactVelocity);
        });
    }
    
    /**
     * Find a shape associated with a physics body
     * @param {CANNON.Body} body - The physics body to find a shape for
     * @returns {Shape} The found shape or null
     */
    findShapeForBody(body) {
        // Iterate through all shapes to find a matching physics body
        for (const shape of this.shapeManager.getAllShapes()) {
            if (shape.physicsBody === body) {
                return shape;
            }
        }
        return null;
    }
    
    /**
     * Play a collision sound based on material type and impact velocity
     * @param {string} materialType - The material sound type
     * @param {number} impactVelocity - The impact velocity magnitude
     */
    playCollisionSound(materialType, impactVelocity) {
        // Limit concurrent sounds
        if (this.activeCount >= CONFIG.audio.maxSounds) {
            return;
        }
        
        // Get sound collection for material type, fallback to generic
        const soundCollection = this.sounds.impacts[materialType] || this.sounds.impacts.generic;
        
        // Skip if no sounds available
        if (!soundCollection || soundCollection.length === 0) return;
        
        // Choose a random sound from the collection
        const soundIndex = Math.floor(Math.random() * soundCollection.length);
        const sound = soundCollection[soundIndex];
        
        // Calculate volume based on impact velocity
        const volume = Math.min(
            1.0, 
            CONFIG.audio.impactVolumeScale * impactVelocity
        ) * CONFIG.audio.masterVolume;
        
        // Calculate rate (pitch) variation based on impact and some randomness
        const basePitch = 1.0;
        const velocityPitchFactor = 0.05;
        const randomPitchFactor = 0.1;
        const rate = basePitch + 
                     velocityPitchFactor * Math.min(impactVelocity, 10) + 
                     randomPitchFactor * (Math.random() * 2 - 1);
        
        // Play sound with calculated parameters
        if (sound.setVolume) {
            sound.setVolume(volume);
        }
        if (sound.rate) {
            sound.rate(rate);
        }
        sound.play();
        
        // Track active sound
        this.activeCount++;
        
        // Decrease active count after sound duration (approximately)
        setTimeout(() => {
            this.activeCount = Math.max(0, this.activeCount - 1);
        }, 500); // Typical impact sound duration
    }
    
    /**
     * Play ambient sound (looping)
     */
    playAmbient() {
        if (!this.isEnabled || !this.sounds.ambient) return;
        
        this.sounds.ambient.setVolume(CONFIG.audio.ambientVolume * CONFIG.audio.masterVolume);
        this.sounds.ambient.loop();
    }
    
    /**
     * Stop ambient sound
     */
    stopAmbient() {
        if (this.sounds.ambient && this.sounds.ambient.isPlaying()) {
            this.sounds.ambient.stop();
        }
    }
    
    /**
     * Enable or disable audio
     * @param {boolean} enabled - Whether audio should be enabled
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        
        // Initialize if enabling for the first time
        if (enabled && !this.isInitialized) {
            this.init();
        }
        
        // Update master volume
        if (this._masterGain) {
            this._masterGain.gain.value = enabled ? CONFIG.audio.masterVolume : 0;
        }
        
        // Handle ambient sound
        if (enabled && CONFIG.audio.ambientEnabled) {
            this.playAmbient();
        } else {
            this.stopAmbient();
        }
    }
}