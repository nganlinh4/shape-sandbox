/**
 * Material Flux - p5.js WebGL Shape Sandbox
 * Main entry point that initializes the application and ties all modules together
 */

// Global variables
let shapeManager;
let materialLibrary;
let renderer;
let physics;
let interaction;
let audio;
let ui;
let lastFrameTime = 0;

// p5.js setup function
function setup() {
    // Create canvas with WebGL mode
    const canvas = createCanvas(
        CONFIG.render.width, 
        CONFIG.render.height, 
        WEBGL
    );
    canvas.parent('sketch-holder');
    
    // Set pixel density to 1 for performance
    pixelDensity(1);
    
    // Enable orbit controls for camera
    if (CONFIG.camera.orbitControl) {
        orbitControl();
    }
    
    // Initialize systems
    initializeSystems();
    
    // Create sound assets folder
    createAssetsFolders();
}

/**
 * Initialize all systems and modules
 */
function initializeSystems() {
    // Create material library
    materialLibrary = new MaterialLibrary();
    
    // Create shape manager
    shapeManager = new ShapeManager();
    
    // Create physics system
    physics = new PhysicsSystem(shapeManager);
    
    // Create renderer
    renderer = new Renderer(
        window, 
        shapeManager, 
        materialLibrary
    );
    
    // Create interaction handler - Pass the p5 instance correctly
    const p5Instance = {
        createVector: createVector,
        mouseX: mouseX,
        mouseY: mouseY,
        Vector: p5.Vector
    };
    
    interaction = new InteractionHandler(
        p5Instance, 
        shapeManager,
        physics
    );
    
    // Create audio system
    audio = new AudioSystem(
        window,
        shapeManager,
        materialLibrary,
        physics
    );
    
    // Create UI manager
    ui = new UIManager(
        window,
        shapeManager,
        materialLibrary,
        interaction,
        physics,
        audio,
        renderer
    );
    
    // Create some initial shapes
    createInitialScene();
}

/**
 * Create initial scene with some shapes
 */
function createInitialScene() {
    // Add ground plane shape
    const groundPlane = new Shape({
        type: 6, // Plane
        position: createVector(0, 0, 0),
        materialId: materialLibrary.getMaterial(0).id, // Default material
        mass: 0 // Static
    });
    shapeManager.addShape(groundPlane);
    physics.addShape(groundPlane);
    
    // Add some initial shapes
    // Sphere
    interaction.spawnShape(
        0, // Sphere
        createVector(-3, 5, 0),
        1.0,
        materialLibrary.getMaterial(1).id // Metal
    );
    
    // Box
    interaction.spawnShape(
        1, // Box
        createVector(0, 8, 0),
        1.2,
        materialLibrary.getMaterial(2).id // Glass
    );
    
    // Torus
    interaction.spawnShape(
        2, // Torus
        createVector(3, 3, -2),
        1.5,
        materialLibrary.getMaterial(4).id // Emissive
    );
    
    // Cone
    interaction.spawnShape(
        4, // Cone
        createVector(-2, 7, -3),
        1.3,
        materialLibrary.getMaterial(3).id // Wood
    );
}

/**
 * Create asset folders for sounds if they don't exist
 * In a real project, these would be provided ahead of time
 */
function createAssetsFolders() {
    try {
        // This is a placeholder function
        // In an actual deployment, the assets folder would be created manually
        console.log('Note: In a deployed app, sound assets would be in assets/sounds/');
    } catch (e) {
        console.warn('Could not create assets folders:', e);
    }
}

/**
 * Handle window resizing
 */
function windowResized() {
    // Update canvas size
    resizeCanvas(windowWidth, windowHeight);
    
    // Update config
    CONFIG.render.width = windowWidth;
    CONFIG.render.height = windowHeight;
    
    // Update renderer (which handles post-processing buffers)
    if (renderer) {
        renderer.handleWindowResize();
    }
}

/**
 * p5.js draw function - called every frame
 */
function draw() {
    // Calculate delta time
    const currentTime = millis() / 1000;
    const deltaTime = currentTime - lastFrameTime;
    lastFrameTime = currentTime;
    
    // Clear background
    background(0);
    
    // Update physics
    physics.update(deltaTime);
    
    // Render scene
    renderer.render();
    
    // Update UI
    ui.update();
}

/**
 * Handle mouse pressed event
 */
function mousePressed(event) {
    if (interaction && typeof interaction.mousePress === 'function') {
        return interaction.mousePress(event);
    }
    return true;
}

/**
 * Handle mouse dragged event
 */
function mouseDragged(event) {
    if (interaction && typeof interaction.mouseMove === 'function') {
        return interaction.mouseMove(event);
    }
    return true;
}

/**
 * Handle mouse released event
 */
function mouseReleased(event) {
    if (interaction && typeof interaction.mouseRelease === 'function') {
        return interaction.mouseRelease(event);
    }
    return true;
}

/**
 * Handle key press events
 */
function keyPressed(event) {
    if (interaction && typeof interaction.keyPress === 'function') {
        return interaction.keyPress(event);
    }
    return true;
}