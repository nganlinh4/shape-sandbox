/**
 * Material Flux - p5.js WebGL Shape Sandbox
 * Main entry point that initializes the application and ties all modules together
 */

// Sketch scope variables (previously global)
let shapeManager;
let materialLibrary;
let renderer;
let physics;
let interaction;
let audio;
let ui;
let lastFrameTime = 0;

/**
 * Initialize all systems and modules
 * @param {p5} p - The p5 instance
 */
function initializeSystems(p) {
    // Create material library
    materialLibrary = new MaterialLibrary();
    
    // Ensure the materialLibrary has the getAllMaterials method
    if (materialLibrary && !materialLibrary.getAllMaterials) {
        console.log("Adding missing getAllMaterials method to materialLibrary instance");
        materialLibrary.getAllMaterials = function() {
            return this.materials ? [...this.materials] : [];
        };
    }
    
    // Create shape manager
    shapeManager = new ShapeManager();
    
    // Create physics system
    physics = new PhysicsSystem(shapeManager);
    
    // Create renderer
    renderer = new Renderer(p, shapeManager, materialLibrary);
    
    // Create interaction handler
    interaction = new InteractionHandler(p, shapeManager, physics);
    
    // Create audio system with safe initialization
    try {
        audio = new AudioSystem(p, shapeManager, materialLibrary, physics);
        
        // Attempt to initialize audio context - might be suspended until user interaction
        if (typeof audio.init === 'function') {
            audio.init();
        }
    } catch (err) {
        console.warn("Failed to create AudioSystem:", err);
        // Create a fallback/dummy audio system that won't break when methods are called
        audio = {
            isEnabled: false,
            isInitialized: false,
            init: function() { this.isInitialized = true; },
            update: function() {},
            playSound: function() {},
            setEnabled: function() {},
            stopAmbient: function() {},
            playAmbient: function() {},
            createPlaceholderSounds: function() {
                console.warn("Using synthesized sounds as fallback.");
            }
        };
    }

    // Create UI manager
    ui = new UIManager(window, p, shapeManager, materialLibrary, interaction, physics, audio, renderer);
    
    // Create initial scene
    createInitialScene(p);
}

/**
 * Create initial scene with some shapes
 * @param {p5} p - The p5 instance
 */
function createInitialScene(p) {
    // Add ground plane shape
    const groundPlane = new Shape({
        type: 6, // Plane
        position: p.createVector(0, 0, 0),
        materialId: materialLibrary.getMaterial(0).id, // Default material
        mass: 0 // Static
    });
    shapeManager.addShape(groundPlane);
    physics.addShape(groundPlane);
    
    // Add some initial shapes
    // Sphere
    interaction.spawnShape(
        0, // Sphere
        p.createVector(-3, 5, 0),
        1.0,
        materialLibrary.getMaterial(1).id // Metal
    );
    
    // Box
    interaction.spawnShape(
        1, // Box
        p.createVector(0, 8, 0),
        1.2,
        materialLibrary.getMaterial(2).id // Glass
    );
    
    // Torus
    interaction.spawnShape(
        2, // Torus
        p.createVector(3, 3, -2),
        1.5,
        materialLibrary.getMaterial(4).id // Emissive
    );
    
    // Cone
    interaction.spawnShape(
        4, // Cone
        p.createVector(-2, 7, -3),
        1.3,
        materialLibrary.getMaterial(3).id // Wood
    );
}

/**
 * Create asset folders for sounds if they don't exist
 * In a real project, these would be provided ahead of time
 */
function createAssetsFolders() {
    // This function likely doesn't need p5 instance
    try {
        // This is a placeholder function
        // In an actual deployment, the assets folder would be created manually
        console.log('Note: In a deployed app, sound assets would be in assets/sounds/');
    } catch (e) {
        console.warn('Could not create assets folders:', e);
    }
}


// p5.js instance mode wrapper
const sketch = (p) => {

    // p5.js setup function
    p.setup = () => {
        // Create canvas with WebGL mode
        const canvas = p.createCanvas(
            CONFIG.render.width,
            CONFIG.render.height,
            p.WEBGL // Use p.WEBGL
        );
        canvas.parent('sketch-holder');

        // Set pixel density to 1 for performance
        p.pixelDensity(1);

        // Enable orbit controls for camera - Note: orbitControl might need adjustment for instance mode
        // If orbitControl() is a global function added by a library, it might still work.
        // If it's part of p5, it might be p.orbitControl() or require a different setup.
        // For now, assuming it's handled globally or via a library.
        if (CONFIG.camera.orbitControl) {
             // Check if orbitControl is available globally or on p
            if (typeof orbitControl === 'function') {
                orbitControl(); // Try global first
            } else if (typeof p.orbitControl === 'function') {
                 p.orbitControl(); // Try instance method
            } else {
                console.warn("orbitControl function not found. Camera controls may not work.");
            }
        }

        // Initialize systems, passing the p5 instance
        initializeSystems(p);

        // Create sound assets folder (doesn't need p)
        createAssetsFolders();

        lastFrameTime = p.millis() / 1000; // Initialize lastFrameTime
    };

    /**
     * Handle window resizing
     */
    p.windowResized = () => {
        // Update canvas size
        p.resizeCanvas(p.windowWidth, p.windowHeight);
    
        // Update config
        // (assuming CONFIG is global or accessible)
        CONFIG.render.width = p.windowWidth;
        CONFIG.render.height = p.windowHeight;
    
        // Update renderer (which handles post-processing buffers)
        if (renderer && typeof renderer.handleWindowResize === 'function') {
            renderer.handleWindowResize();
        }
    };

    /**
     * p5.js draw function - called every frame
     */
    p.draw = () => {
        // Calculate delta time
        const currentTime = p.millis() / 1000;
        const deltaTime = currentTime - lastFrameTime;
        lastFrameTime = currentTime;
        
    // Clear background
        p.background(0);
    
        // Update physics
        // (doesn't need p)
        if (physics) physics.update(deltaTime);
    
        // Render scene
        // (assuming renderer uses p internally if needed)
        if (renderer) renderer.render();
    
        // Update UI

        // (doesn't need p)
        if (ui) ui.update();
    };

    /**
     * Handle mouse pressed event
     */
    p.mousePressed = (event) => {
    // Attempt to initialize audio on first user interaction
    if (audio && typeof audio.init === 'function' && !audio.isInitialized) {
        try {
            // p5 implicitly handles userStartAudio on interaction if context is suspended
            audio.init(); 
        } catch (err) {
            console.error("Failed to initialize AudioSystem:", err);
            if (audio) audio.isEnabled = false; // Ensure audio is marked as disabled
        }
    }

        // Pass event and potentially p instance if needed by interaction handler
        if (interaction && typeof interaction.mousePress === 'function') {
            // interaction.mousePress might need adjustment to accept p if it uses p5 functions directly
            return interaction.mousePress(event);
       } 
        return true;
        // Prevent default browser behavior
    };

    /**    
 * Handle mouse dragged event
     */
    p.mouseDragged = (event) => {
        if (interaction && typeof interaction.mouseMove === 'function') {
            // interaction.mouseMove might need adjustment
            return interaction.mouseMove(event);
        }
        return true;
    };

    /**
     * Handle mouse released event
     */
    p.mouseReleased = (event) => {
        if (interaction && typeof interaction.mouseRelease === 'function') {
            // interaction.mouseRelease might need adjustment
            return interaction.mouseRelease(event);
        }
        return true;
    };

    /**    
 * Handle key press events
     */
    p.keyPressed = (event) => {
        if (interaction && typeof interaction.keyPress === 'function') {
            // interaction.keyPress might need adjustment
            return interaction.keyPress(event);
       } 
        return true;
    };

}; // End of sketch function wrapper

// Fix for MaterialLibrary.getAllMaterials not found error
function ensureMaterialLibraryFunctions() {
    // Wait for MaterialLibrary to be defined
    if (typeof MaterialLibrary !== 'undefined') {
        // Check if getAllMaterials function is missing and add it if needed
        if (!MaterialLibrary.prototype.getAllMaterials) {
            console.log("Adding missing getAllMaterials function to MaterialLibrary prototype");
            MaterialLibrary.prototype.getAllMaterials = function() {
                // Return a copy of the materials array
                return this.materials ? [...this.materials] : [];
            };
        }
        console.log("MaterialLibrary functions check complete");
    } else {
        // Try again in a moment
        console.warn("MaterialLibrary not defined yet, retrying...");
        setTimeout(ensureMaterialLibraryFunctions, 100);
    }
}

// Call immediately
ensureMaterialLibraryFunctions();
// Also call after a delay to ensure it runs after all scripts are loaded
setTimeout(ensureMaterialLibraryFunctions, 500);

// Start p5.js in instance mode, attaching to the 'sketch-holder' div
const app = new p5(sketch, 'sketch-holder');

// Fix for p5.sound initialization error
(function() {
    // This function patches p5.sound to prevent the addModule error
    function fixP5Sound() {
        // Try to check if p5 is loaded
        if (!window.p5) {
            console.warn('p5 is not available yet, will retry fixing p5.sound');
            setTimeout(fixP5Sound, 100);
            return;
        }

        // Check if p5.prototype has the sound property that might be undefined
        const p5Proto = window.p5.prototype;
        if (!p5Proto) return;

        // Create a safe patched version of getAudioContext that won't throw errors
        const originalGetAudioContext = p5Proto.getAudioContext;
        if (originalGetAudioContext) {
            p5Proto.getAudioContext = function() {
                try {
                    const context = originalGetAudioContext.apply(this);
                    return context;
                } catch (err) {
                    console.warn('Error in getAudioContext, creating fallback context', err);
                    
                    // If audioContext fails, create a safe dummy audio context
                    if (!this._safeAudioContext) {
                        try {
                            const AudioContext = window.AudioContext || window.webkitAudioContext;
                            if (AudioContext) {
                                this._safeAudioContext = new AudioContext();
                            }
                        } catch (e) {
                            console.warn('Could not create fallback AudioContext');
                            // Return null so code can handle this gracefully
                            return null;
                        }
                    }
                    return this._safeAudioContext;
                }
            };
        }
        
        // Add safety check for p5.sound's 'addModule' error by ensuring the required object exists
        if (p5Proto.registerMethod && typeof p5Proto.registerMethod === 'function') {
            const originalRegisterMethod = p5Proto.registerMethod;
            p5Proto.registerMethod = function(name, method) {
                try {
                    // This is where the error occurs - when something tries to call addModule
                    // on something that's undefined in the p5.sound code
                    return originalRegisterMethod.call(this, name, method);
                } catch (err) {
                    console.warn('Error in registerMethod, using safe version', err);
                    
                    // Create a safe version that won't throw the addModule error
                    if (name === 'init') {
                        // Add a wrapper that will catch errors in initialization methods
                        const safeMethod = function() {
                            try {
                                return method.apply(this, arguments);
                            } catch (e) {
                                console.warn('Caught error in init method:', e);
                                return null;
                            }
                        };
                        return originalRegisterMethod.call(this, name, safeMethod);
                    }
                    return null;
                }
            };
        }
        
        console.log('Successfully patched p5.sound to prevent addModule error');
    }

    // Run our fix immediately to patch p5.sound before it's used
    fixP5Sound();
    
    // Also run it again after a timeout in case p5 loads after this code runs
    setTimeout(fixP5Sound, 500);
})();

// Global handler for the specific p5.sound unhandled promise rejection
window.addEventListener('unhandledrejection', function(event) {
    const reason = event.reason;
    // Check specifically for the p5.sound 'addModule' TypeError
    if (reason instanceof TypeError && 
        reason.message.includes('Cannot read properties of undefined') && 
        reason.message.includes('addModule') &&
        reason.stack && reason.stack.includes('p5.sound')) 
    {
        console.warn("p5.sound initialization failed asynchronously (addModule error). Audio system will use synthesized sounds.");
        
        // Prevent the default browser handling for this specific error
        // to avoid flooding the console
        event.preventDefault(); 
        
        // Ensure audio system uses fallback sounds if available
        if (window.audio && typeof audio.createPlaceholderSounds === 'function') {
            audio.createPlaceholderSounds();
        }
    }
});
