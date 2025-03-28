/**
 * AudioSystem for handling sound effects based on physics interactions
 * Uses p5.sound library for playing sounds
 */
class AudioSystem {
    /**
     * Create a new audio system
     * @param {p5} p - The p5 instance
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
        
        // Initialize if enabled
        if (this.isEnabled) {
            this.init();
        }
    }
    
    /**
     * Initialize the audio system
     */
    init() {
        // Check if p5.sound is available
        if (!this.p.loadSound) {
            console.warn("p5.sound not available. Audio disabled.");
            this.isEnabled = false;
            return;
        }
        
        // Load sound effects
        this.loadSounds();
        
        // If no sounds were loaded successfully, generate synthetic sounds
        const hasAnySounds = Object.values(this.sounds.impacts).some(arr => arr.length > 0);
        if (!hasAnySounds) {
            console.log("No sound files loaded. Generating synthetic sounds...");
            // Create a sound synthesizer to generate procedural sounds
            const synth = new SoundSynthesizer(this.p);
            synth.generateSounds(this.sounds);
        }
        
        // Add collision listeners to physics bodies
        this.setupCollisionListeners();
        
        this.isInitialized = true;
    }
    
    /**
     * Load sound effects
     */
    loadSounds() {
        // Define the sound files to load
        const soundFiles = {
            metal: ['metal_impact_1.mp3', 'metal_impact_2.mp3', 'metal_impact_3.mp3'],
            wood: ['wood_impact_1.mp3', 'wood_impact_2.mp3'],
            glass: ['glass_impact_1.mp3', 'glass_impact_2.mp3', 'glass_break.mp3'],
            soft: ['soft_impact_1.mp3', 'soft_impact_2.mp3'],
            generic: ['generic_impact_1.mp3', 'generic_impact_2.mp3'],
            ambient: ['ambient.mp3']
        };
        
        // Create placeholder sounds first - they'll be replaced by loaded sounds if available
        this.createPlaceholderSounds();
        
        // Track load failures to report once at the end rather than spamming console
        let loadFailures = 0;
        
        // Helper to safely load a sound file with fallback
        const safeLoadSound = (path) => {
            try {
                return this.p.loadSound(
                    path,
                    // Success callback - nothing needed
                    () => {},
                    // Error callback
                    (err) => {
                        loadFailures++;
                        // Individual errors are not logged to avoid console spam
                    }
                );
            } catch (err) {
                loadFailures++;
                return null;
            }
        };
        
        // Try to load sound files for each material type
        for (const [materialType, fileNames] of Object.entries(soundFiles)) {
            if (materialType === 'ambient') {
                // Handle ambient separately
                if (CONFIG.audio.ambientEnabled) {
                    const ambientSound = safeLoadSound('assets/sounds/' + fileNames[0]);
                    if (ambientSound) this.sounds.ambient = ambientSound;
                }
                continue;
            }
            
            // Try to load each sound file for this material
            for (const fileName of fileNames) {
                const sound = safeLoadSound('assets/sounds/' + fileName);
                if (sound) {
                    this.sounds.impacts[materialType].push(sound);
                }
            }
        }
        
        // Log summary of results
        if (loadFailures > 0) {
            console.warn(`Failed to load ${loadFailures} sound file(s). Using placeholder sounds.`);
        }
    }
    
    /**
     * Create placeholder oscillator sounds for testing when audio files are not available
     */
    createPlaceholderSounds() {
        // Create simple placeholder sounds with oscillators
        const createOscillator = (baseFreq, type = 'sine', duration = 0.3, variationAmount = 0.1) => {
            return {
                play: () => {
                    // Frequency variation to make repeated sounds more natural
                    const freqVariation = baseFreq * variationAmount * (Math.random() * 2 - 1);
                    const freq = baseFreq + freqVariation;
                    
                    const osc = new this.p.Oscillator(type);
                    osc.freq(freq);
                    osc.amp(0);
                    osc.start();
                    osc.amp(0.2, 0.01); // Quick fade in
                    osc.amp(0, duration); // Fade out
                    
                    // Create a simple envelope for more realistic sound
                    const env = new this.p.Envelope();
                    env.setADSR(0.01, 0.1, 0.1, duration);
                    env.setRange(0.2, 0);
                    env.play();
                    
                    // Stop oscillator after sound completes
                    setTimeout(() => osc.stop(), duration * 1000);
                    
                    return osc;
                },
                rate: (r) => {}, // Dummy method for compatibility
                setVolume: (v) => {}, // Dummy method for compatibility
                isPlaying: () => false // Dummy method for compatibility
            };
        };
        
        // Create more realistic placeholder sounds for each material
        
        // Metal: Higher pitch, metallic timbre
        this.sounds.impacts.metal = [
            createOscillator(600, 'square', 0.4, 0.05),  // Higher, cleaner sound
            createOscillator(500, 'triangle', 0.5, 0.05) // Slightly lower variation
        ];
        
        // Wood: Medium pitch, woody timbre
        this.sounds.impacts.wood = [
            createOscillator(300, 'triangle', 0.3, 0.1),
            createOscillator(250, 'triangle', 0.35, 0.1)
        ];
        
        // Glass: Very high pitch, pure tones
        this.sounds.impacts.glass = [
            createOscillator(800, 'sine', 0.3, 0.2), // Pure tone for gentle impact
            createOscillator(1200, 'sawtooth', 0.2, 0.3) // Harsher tone for breaking
        ];
        
        // Soft: Low pitch, gentle sound
        this.sounds.impacts.soft = [
            createOscillator(150, 'sine', 0.5, 0.1),
            createOscillator(180, 'sine', 0.6, 0.1)
        ];
        
        // Generic: Medium pitch, basic sound
        this.sounds.impacts.generic = [
            createOscillator(400, 'triangle', 0.3, 0.1),
            createOscillator(350, 'triangle', 0.4, 0.1)
        ];
        
        // Create ambient sound if needed
        if (!this.sounds.ambient && CONFIG.audio.ambientEnabled) {
            // Create a more complex ambient sound using multiple oscillators
            this.sounds.ambient = {
                oscillators: [],
                play: () => {
                    // Clear any previous oscillators
                    this.stopAmbient();
                    this.sounds.ambient.oscillators = [];
                    
                    // Create 3 oscillators with different frequencies for a richer ambient sound
                    const createAmbientOsc = (freq, type, amp) => {
                        const osc = new this.p.Oscillator(type);
                        osc.freq(freq);
                        osc.amp(amp * CONFIG.audio.ambientVolume);
                        osc.start();
                        return osc;
                    };
                    
                    // Add some oscillators for ambient sound
                    this.sounds.ambient.oscillators.push(
                        createAmbientOsc(60, 'sine', 0.1),   // Low drone
                        createAmbientOsc(67, 'sine', 0.07),  // Harmonic
                        createAmbientOsc(120, 'sine', 0.05)  // Higher harmonic
                    );
                },
                loop: function() { this.play(); },
                stop: function() {
                    if (this.oscillators) {
                        this.oscillators.forEach(osc => {
                            osc.amp(0, 1); // Fade out
                            setTimeout(() => osc.stop(), 1100);
                        });
                    }
                },
                isPlaying: function() {
                    return this.oscillators && this.oscillators.length > 0;
                },
                setVolume: function(vol) {
                    if (this.oscillators) {
                        this.oscillators.forEach(osc => {
                            osc.amp(vol, 0.5); // Smooth transition
                        });
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
        sound.rate(rate);
        sound.setVolume(volume);
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
        
        // Handle ambient sound
        if (enabled && CONFIG.audio.ambientEnabled) {
            this.playAmbient();
        } else {
            this.stopAmbient();
        }
    }
}