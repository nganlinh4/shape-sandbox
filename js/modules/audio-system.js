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
        
        // Add collision listeners to physics bodies
        this.setupCollisionListeners();
        
        this.isInitialized = true;
    }
    
    /**
     * Load sound effects
     */
    loadSounds() {
        try {
            // Load metal impact sounds
            this.sounds.impacts.metal = [
                this.p.loadSound('assets/sounds/metal_impact_1.mp3'),
                this.p.loadSound('assets/sounds/metal_impact_2.mp3')
            ];
            
            // Load wood impact sounds
            this.sounds.impacts.wood = [
                this.p.loadSound('assets/sounds/wood_impact_1.mp3'),
                this.p.loadSound('assets/sounds/wood_impact_2.mp3')
            ];
            
            // Load glass impact sounds
            this.sounds.impacts.glass = [
                this.p.loadSound('assets/sounds/glass_impact_1.mp3'),
                this.p.loadSound('assets/sounds/glass_impact_2.mp3')
            ];
            
            // Load soft impact sounds
            this.sounds.impacts.soft = [
                this.p.loadSound('assets/sounds/soft_impact_1.mp3'),
                this.p.loadSound('assets/sounds/soft_impact_2.mp3')
            ];
            
            // Load generic impact sounds (fallback)
            this.sounds.impacts.generic = [
                this.p.loadSound('assets/sounds/generic_impact_1.mp3'),
                this.p.loadSound('assets/sounds/generic_impact_2.mp3')
            ];
            
            // Load ambient sound (optional)
            if (CONFIG.audio.ambientEnabled) {
                this.sounds.ambient = this.p.loadSound('assets/sounds/ambient.mp3');
            }
        } catch (error) {
            console.error("Error loading sounds:", error);
            
            // Create placeholder sounds for development when assets might be missing
            this.createPlaceholderSounds();
        }
    }
    
    /**
     * Create placeholder oscillator sounds for testing when audio files are not available
     */
    createPlaceholderSounds() {
        // Create simple placeholder sounds with oscillators
        const createOscillator = (freq, type = 'sine') => {
            return {
                play: () => {
                    const osc = new p5.Oscillator(type);
                    osc.freq(freq);
                    osc.amp(0.2);
                    osc.start();
                    osc.amp(0, 0.2); // Fade out over 0.2 seconds
                    setTimeout(() => osc.stop(), 300);
                },
                rate: (r) => {},
                setVolume: (v) => {}
            };
        };
        
        // Populate placeholder sounds
        this.sounds.impacts.metal = [createOscillator(600, 'square')];
        this.sounds.impacts.wood = [createOscillator(300, 'triangle')];
        this.sounds.impacts.glass = [createOscillator(900, 'sine')];
        this.sounds.impacts.soft = [createOscillator(200, 'sine')];
        this.sounds.impacts.generic = [createOscillator(400, 'triangle')];
        
        console.warn("Created placeholder sounds. Replace with actual audio files.");
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