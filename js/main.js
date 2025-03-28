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
    
    // Create shape manager
    shapeManager = new ShapeManager();
    
    // Create physics system
    physics = new PhysicsSystem(shapeManager);
    
    // Create renderer
    // Pass p instance to renderer if needed, assuming it uses p5 functions
    renderer = new Renderer(p, shapeManager, 
 materialLibrary
);
    
    // Create interaction handler - Pass the p5 instance correctly
    
    interaction = new InteractionHandler(
p, shapeManager,
 physics );
    
    // Create audio system
    // Create audio system
    // Pass p instance to AudioSystem if needed
    audio = new AudioSystem(
        p, // Assuming AudioSystem might need p5 instance
        shapeManager,
        materialLibrary,
        physics
    );

    // Create UI manager
    ui = new UIManager(
        window,
        p, // Pass p instance if UI needs it
        shapeManager,
        materialLibrary,
        interaction,
        physics,
        audio,
       renderer
    );
    
    // Create some initial shapes
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

// Start p5.js in instance mode, attaching to the 'sketch-holder' div
new p5(sketch, 'sketch-holder');
