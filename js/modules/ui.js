/**
 * UI module for parameter controls
 * Uses Tweakpane for the control interface
 */
class UIManager {
    /**
     * Create a new UI manager
     * @param {p5} p - The p5 instance
     * @param {ShapeManager} shapeManager - The shape manager instance
     * @param {MaterialLibrary} materialLibrary - The material library instance
     * @param {InteractionHandler} interaction - The interaction handler instance
     * @param {PhysicsSystem} physics - The physics system instance
     * @param {AudioSystem} audio - The audio system instance
     * @param {Renderer} renderer - The renderer instance
     */
    constructor(p, shapeManager, materialLibrary, interaction, physics, audio, renderer) {
        this.p = p;
        this.shapeManager = shapeManager;
        this.materialLibrary = materialLibrary;
        this.interaction = interaction;
        this.physics = physics;
        this.audio = audio;
        this.renderer = renderer;
        
        // UI objects
        this.pane = null;
        this.fpsElement = null;
        
        // UI state
        this.params = {
            // Shape creation
            shape: {
                type: 0,
                size: CONFIG.shapes.defaultSize,
                material: 0
            },
            
            // Physics
            physics: {
                gravity: CONFIG.physics.gravity[1], // Y component
                enabled: true
            },
            
            // Rendering
            render: {
                shadows: true,
                shadowSoftness: CONFIG.render.shadowSoftness,
                background: [
                    CONFIG.render.defaultBackground[0] * 255,
                    CONFIG.render.defaultBackground[1] * 255,
                    CONFIG.render.defaultBackground[2] * 255
                ],
                showFPS: CONFIG.ui.fps.show,
                // Fix: Use boolean for post-processing controls instead of the object
                postProcessEnabled: CONFIG.render.postProcess.enabled,
                bloomEnabled: CONFIG.render.postProcess.bloom,
                bloomThreshold: CONFIG.render.postProcess.bloomThreshold,
                bloomIntensity: CONFIG.render.postProcess.bloomIntensity,
                envMapEnabled: CONFIG.render.envMapIntensity > 0,
                envMapIntensity: CONFIG.render.envMapIntensity,
                reflectionQuality: CONFIG.render.reflectionQuality
            },
            
            // Lighting
            lighting: {
                intensity: CONFIG.lights.directional.intensity,
                color: [
                    CONFIG.lights.directional.color[0] * 255,
                    CONFIG.lights.directional.color[1] * 255,
                    CONFIG.lights.directional.color[2] * 255
                ],
                ambient: CONFIG.lights.ambient.intensity
            },
            
            // Audio
            audio: {
                enabled: CONFIG.audio.enabled,
                volume: CONFIG.audio.masterVolume,
                ambientEnabled: CONFIG.audio.ambientEnabled
            }
        };
        
        // Initialize UI if enabled
        if (CONFIG.ui.enabled) {
            this.init();
        }
    }
    
    /**
     * Initialize the UI
     */
    init() {
        // Create main pane
        this.pane = new Tweakpane.Pane({
            title: 'Material Flux Controls',
            container: document.getElementById('ui-container')
        });
        
        // Create tabs
        const tabs = this.pane.addTab({
            pages: [
                {title: 'Shapes'},
                {title: 'Physics'},
                {title: 'Rendering'},
                {title: 'Audio'}
            ]
        });
        
        // Setup shape controls
        this.setupShapeControls(tabs.pages[0]);
        
        // Setup physics controls
        this.setupPhysicsControls(tabs.pages[1]);
        
        // Setup rendering controls
        this.setupRenderingControls(tabs.pages[2]);
        
        // Setup audio controls
        this.setupAudioControls(tabs.pages[3]);
        
        // Setup FPS display if enabled
        if (CONFIG.ui.fps.show) {
            this.setupFPSDisplay();
        }
    }
    
    /**
     * Setup shape creation controls
     * @param {TweakpaneTab} tab - The tab to add controls to
     */
    setupShapeControls(tab) {
        // Store 'this' reference for use in closures
        const self = this;
        
        // Shape type dropdown
        tab.addInput(this.params.shape, 'type', {
            label: 'Type',
            options: {
                Sphere: 0,
                Box: 1,
                Torus: 2,
                Cylinder: 3,
                Cone: 4,
                Capsule: 5
            }
        });
        
        // Shape size slider
        tab.addInput(this.params.shape, 'size', {
            label: 'Size',
            min: 0.2,
            max: 5.0,
            step: 0.1
        });
        
        // Material dropdown
        const materialOptions = {};
        
        // FIXED: Direct material access without using getAllMaterials
        if (this.materialLibrary && this.materialLibrary.materials) {
            // Use direct array access instead of the problematic getAllMaterials method
            const materials = this.materialLibrary.materials;
            for (let i = 0; i < materials.length; i++) {
                const material = materials[i];
                if (material && material.name) {
                    materialOptions[material.name] = material.id;
                }
            }
        } else {
            // Fallback material options
            materialOptions["Default"] = 0;
            materialOptions["Metal"] = 1;
            materialOptions["Glass"] = 2;
            materialOptions["Wood"] = 3;
            materialOptions["Emissive"] = 4;
        }
        
        tab.addInput(this.params.shape, 'material', {
            label: 'Material',
            options: materialOptions
        });
        
        // Add shape button
        tab.addButton({
            title: 'Add Shape',
            label: 'Create'
        }).on('click', () => { // Use arrow function to preserve 'this' context
            try {
                // Create shape at a random position above the ground
                const x = (Math.random() - 0.5) * 10;
                const y = 5 + Math.random() * 5;
                const z = (Math.random() - 0.5) * 10;
                
                console.log("Creating shape at position:", x, y, z);
                
                // Create a simple position object with ONLY the properties needed
                // Completely avoid any p5.Vector approach
                const position = {
                    x: x,
                    y: y,
                    z: z,
                    // Add copy method that all code expects
                    copy: function() { 
                        return { 
                            x: this.x, 
                            y: this.y, 
                            z: this.z,
                            copy: this.copy 
                        };
                    }
                };
                
                console.log("Using position object:", position);
                
                // --- DEBUG LOGGING ---
                console.log("Inside click handler, 'this':", this);
                console.log("Inside click handler, 'this.p':", this.p);
                console.log("Inside click handler, typeof this.p?.createVector:", typeof this.p?.createVector);
                // --- END DEBUG LOGGING ---
                // Call interaction handler to create shape
                this.interaction.spawnShape(
 // Use 'this' directly
                    this.params.shape.type,
                    position,
                    this.params.shape.size,
                    this.params.shape.material
                );
                console.log("Shape spawned successfully");
            } catch (err) {
                console.error("Error creating shape:", err, err.stack);
            }
        });
        
        // Clear all button
        tab.addButton({
            title: 'Clear All Shapes',
            label: 'Clear'
        }).on('click', () => {
            try {
                // Use a simple direct approach to clear shapes
                console.log("Clearing all shapes");
                
                if (self.shapeManager && typeof self.shapeManager.clearShapes === 'function') {
                    // Use built-in clear method if available
                    self.shapeManager.clearShapes();
                } else if (self.shapeManager && Array.isArray(self.shapeManager.shapes)) {
                    // Manually clear shapes if needed
                    const shapes = [...self.shapeManager.shapes];
                    for (let i = 0; i < shapes.length; i++) {
                        const shape = shapes[i];
                        if (shape && shape.id !== undefined) {
                            if (self.physics) self.physics.removeShape(shape);
                            self.shapeManager.removeShape(shape.id);
                        }
                    }
                } else {
                    console.warn("ShapeManager doesn't have expected methods or properties");
                }
            } catch (err) {
                console.error("Error clearing shapes:", err);
            }
        });
        
        // Add help text
        tab.addSeparator();
        
        // Help text parameter on the UI params object
        if (!this.params.helpText) {
            this.params.helpText = 'Click+drag to move objects\nDelete key to remove selected';
        }
        
        // Add the text using a proper parameter binding
        tab.addInput(this.params, 'helpText', {
            label: 'Controls',
            multiline: true,
            readonly: true,
            rows: 2
        });
    }
    
    /**
     * Setup physics controls
     * @param {TweakpaneTab} tab - The tab to add controls to
     */
    setupPhysicsControls(tab) {
        // Gravity control
        tab.addInput(this.params.physics, 'gravity', {
            label: 'Gravity',
            min: -20.0,
            max: 20.0,
            step: 0.1
        }).on('change', (ev) => {
            // Update gravity in physics world
            this.physics.world.gravity.set(0, ev.value, 0);
        });
        
        // Physics enabled toggle
        tab.addInput(this.params.physics, 'enabled', {
            label: 'Enabled'
        }).on('change', (ev) => {
            if (!ev.value) {
                // Zero gravity to "pause" physics
                this.physics.world.gravity.set(0, 0, 0);
            } else {
                // Restore gravity
                this.physics.world.gravity.set(0, this.params.physics.gravity, 0);
            }
        });
        
        // Preset buttons
        tab.addSeparator();
        
        // Zero gravity preset
        tab.addButton({
            title: 'Zero Gravity',
            label: 'Zero-G'
        }).on('click', () => {
            this.params.physics.gravity = 0;
            this.physics.world.gravity.set(0, 0, 0);
            this.pane.refresh();
        });
        
        // Moon gravity preset
        tab.addButton({
            title: 'Moon Gravity (1/6 Earth)',
            label: 'Moon'
        }).on('click', () => {
            this.params.physics.gravity = -1.62;
            this.physics.world.gravity.set(0, -1.62, 0);
            this.pane.refresh();
        });
        
        // Earth gravity preset
        tab.addButton({
            title: 'Earth Gravity',
            label: 'Earth'
        }).on('click', () => {
            this.params.physics.gravity = -9.82;
            this.physics.world.gravity.set(0, -9.82, 0);
            this.pane.refresh();
        });
        
        // Add explosion button
        tab.addSeparator();
        tab.addButton({
            title: 'Create Explosion Force',
            label: 'Explode!'
        }).on('click', () => {
            this.createExplosion();
        });
    }
    
    /**
     * Setup rendering controls
     * @param {TweakpaneTab} tab - The tab to add controls to
     */
    setupRenderingControls(tab) {
        // Post-processing section
        tab.addSeparator();
        
        // Fix postProcess control - use boolean type explicitly
        tab.addInput(this.params.render, 'postProcessEnabled', {
            label: 'Post-Processing'
        }).on('change', (ev) => {
            if (this.renderer && typeof this.renderer.setPostProcessingParams === 'function') {
                this.renderer.setPostProcessingParams(
                    ev.value,
                    this.params.render.bloomEnabled,
                    this.params.render.bloomThreshold,
                    this.params.render.bloomIntensity
                );
            }
        });
        
        // Bloom controls folder
        const bloomFolder = tab.addFolder({ title: 'Bloom Effect' });
        
        bloomFolder.addInput(this.params.render, 'bloomEnabled', {
            label: 'Enabled'
        }).on('change', (ev) => {
            if (this.renderer && typeof this.renderer.setPostProcessingParams === 'function') {
                this.renderer.setPostProcessingParams(
                    this.params.render.postProcessEnabled,
                    ev.value,
                    this.params.render.bloomThreshold,
                    this.params.render.bloomIntensity
                );
            }
        });
        
        bloomFolder.addInput(this.params.render, 'bloomThreshold', {
            label: 'Threshold',
            min: 0.1,
            max: 1.0,
            step: 0.05
        }).on('change', (ev) => {
            if (this.renderer && typeof this.renderer.setPostProcessingParams === 'function') {
                this.renderer.setPostProcessingParams(
                    this.params.render.postProcessEnabled,
                    this.params.render.bloomEnabled,
                    ev.value,
                    this.params.render.bloomIntensity
                );
            }
        });
        
        bloomFolder.addInput(this.params.render, 'bloomIntensity', {
            label: 'Intensity',
            min: 0.1,
            max: 2.0,
            step: 0.05
        }).on('change', (ev) => {
            if (this.renderer && typeof this.renderer.setPostProcessingParams === 'function') {
                this.renderer.setPostProcessingParams(
                    this.params.render.postProcessEnabled,
                    this.params.render.bloomEnabled,
                    this.params.render.bloomThreshold,
                    ev.value
                );
            }
        });
        
        // Environment mapping controls
        tab.addSeparator();
        const envMapFolder = tab.addFolder({ title: 'Environment Map' });
        
        envMapFolder.addInput(this.params.render, 'envMapEnabled', {
            label: 'Enabled'
        }).on('change', (ev) => {
            CONFIG.render.envMapEnabled = ev.value;
        });
        
        envMapFolder.addInput(this.params.render, 'envMapIntensity', {
            label: 'Intensity',
            min: 0.0,
            max: 2.0,
            step: 0.1
        }).on('change', (ev) => {
            CONFIG.render.envMapIntensity = ev.value;
        });
        
        // Reflections quality
        envMapFolder.addInput(this.params.render, 'reflectionQuality', {
            label: 'Reflection Quality',
            min: 0.0,
            max: 1.0,
            step: 0.1
        }).on('change', (ev) => {
            CONFIG.render.reflectionQuality = ev.value;
        });
        
        // Shadows enabled toggle
        tab.addSeparator();
        tab.addInput(this.params.render, 'shadows', {
            label: 'Shadows'
        });
        
        // Shadow softness slider
        tab.addInput(this.params.render, 'shadowSoftness', {
            label: 'Shadow Softness',
            min: 1.0,
            max: 64.0,
            step: 1.0
        }).on('change', (ev) => {
            // Update in renderer
            CONFIG.render.shadowSoftness = ev.value;
        });
        
        // FIX: Background color control using RGB object instead of array
        // First convert array to RGB object for TweakPane
        const bgColorObj = {
            r: this.params.render.background[0], 
            g: this.params.render.background[1], 
            b: this.params.render.background[2]
        };
        
        // Create a binding for the color object
        tab.addBinding(bgColorObj, { label: 'Background' })
            .on('change', (ev) => {
                // Update the params array from the color object
                this.params.render.background = [ev.value.r, ev.value.g, ev.value.b];
                
                // Update the config background (scale down to 0-1)
                CONFIG.render.defaultBackground = [
                    ev.value.r / 255, 
                    ev.value.g / 255, 
                    ev.value.b / 255
                ];
        });
        
        // Light settings
        tab.addSeparator();
        tab.addInput(this.params.lighting, 'intensity', {
            label: 'Light Intensity',
            min: 0.0,
            max: 2.0,
            step: 0.05
        }).on('change', (ev) => {
            this.renderer.lightIntensity = ev.value;
        });
        
        // Light color
        tab.addInput(this.params.lighting, 'color', {
            label: 'Light Color',
            color: {type: 'rgb', format: 'rgb'}
        }).on('change', (ev) => {
            this.renderer.lightColor = [
                ev.value[0] / 255,
                ev.value[1] / 255,
                ev.value[2] / 255
            ];
        });
        
        // Ambient light
        tab.addInput(this.params.lighting, 'ambient', {
            label: 'Ambient Light',
            min: 0.0,
            max: 1.0,
            step: 0.05
        }).on('change', (ev) => {
            this.renderer.ambientColor = CONFIG.lights.ambient.color.map(c => c * ev.value);
        });
        
        // FPS display toggle
        tab.addSeparator();
        tab.addInput(this.params.render, 'showFPS', {
            label: 'Show FPS'
        }).on('change', (ev) => {
            if (ev.value) {
                this.setupFPSDisplay();
            } else if (this.fpsElement) {
                this.fpsElement.style.display = 'none';
            }
        });
    }
    
    /**
     * Setup audio controls
     * @param {TweakpaneTab} tab - The tab to add controls to
     */
    setupAudioControls(tab) {
        // Audio enabled toggle
        tab.addInput(this.params.audio, 'enabled', {
            label: 'Sound Enabled'
        }).on('change', (ev) => {
            this.audio.setEnabled(ev.value);
        });
        
        // Master volume slider
        tab.addInput(this.params.audio, 'volume', {
            label: 'Master Volume',
            min: 0.0,
            max: 1.0,
            step: 0.05
        }).on('change', (ev) => {
            CONFIG.audio.masterVolume = ev.value;
        });
        
        // Ambient sound toggle
        tab.addInput(this.params.audio, 'ambientEnabled', {
            label: 'Ambient Sound'
        }).on('change', (ev) => {
            CONFIG.audio.ambientEnabled = ev.value;
            if (ev.value && this.params.audio.enabled) {
                this.audio.playAmbient();
            } else {
                this.audio.stopAmbient();
            }
        });
    }
    
    /**
     * Setup FPS display
     */
    setupFPSDisplay() {
        // Create FPS element if it doesn't exist
        if (!this.fpsElement) {
            this.fpsElement = document.createElement('div');
            this.fpsElement.style.position = 'absolute';
            this.fpsElement.style.bottom = '10px';
            this.fpsElement.style.left = '10px';
            this.fpsElement.style.color = 'white';
            this.fpsElement.style.fontFamily = 'monospace';
            this.fpsElement.style.fontSize = '14px';
            this.fpsElement.style.padding = '5px';
            this.fpsElement.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            this.fpsElement.style.borderRadius = '3px';
            document.body.appendChild(this.fpsElement);
        } else {
            this.fpsElement.style.display = 'block';
        }
    }
    
    /**
     * Update UI (called every frame)
     */
    update() {
        // Update FPS display if enabled
        if (this.params.render.showFPS && this.fpsElement) {
            this.fpsElement.textContent = `FPS: ${this.renderer.getFPS()}`;
        }
    }
    
    /**
     * Create an explosion force at the center of the scene
     */
    createExplosion() {
        const explosionCenter = new CANNON.Vec3(0, 2, 0);
        const explosionRadius = 10;
        const explosionForce = 20;
        
        // Apply force to all dynamic bodies
        this.shapeManager.getAllShapes().forEach(shape => {
            if (shape.physicsBody && shape.mass > 0) {
                // Get body position
                const bodyPos = shape.physicsBody.position;
                
                // Calculate distance from explosion
                const distance = new CANNON.Vec3(
                    bodyPos.x - explosionCenter.x,
                    bodyPos.y - explosionCenter.y,
                    bodyPos.z - explosionCenter.z
                );
                const length = distance.length();
                
                // Skip if too far away
                if (length > explosionRadius) return;
                
                // Calculate force based on distance
                const strength = explosionForce * (1 - length / explosionRadius);
                
                // Normalize direction and scale by strength
                distance.normalize();
                distance.scale(strength, distance);
                
                // Apply impulse
                shape.physicsBody.applyImpulse(distance, bodyPos);
            }
        });
    }
}