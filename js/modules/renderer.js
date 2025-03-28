/**
 * Renderer class handles WebGL ray marching rendering
 * Sets up shaders, data textures, and render loop
 */
class Renderer {
    /**
     * Create a new renderer
     * @param {p5} p - The p5 instance
     * @param {ShapeManager} shapeManager - The shape manager instance
     * @param {MaterialLibrary} materialLibrary - The material library instance
     */
    constructor(p, shapeManager, materialLibrary) {
        this.p = p;
        this.shapeManager = shapeManager;
        this.materialLibrary = materialLibrary;

        this.shader = null;
        this.shapeDataTexture = null;
        this.materialDataTexture = null;
        this.environmentMap = null;
        this.environmentTexture = null; // Hold the WebGL texture object

        // Add initialization state tracking
        this.initialized = false;
        this.initializationAttempts = 0;
        this.maxInitAttempts = 5;
        this.lastInitAttempt = 0;
        this.initRetryDelay = 500; // ms between initialization attempts
        this.shaderCompiled = false;

        // Texture manager for handling material textures
        this.textureManager = new TextureManager(p);

        // Post-processing system
        this.postProcess = null;

        // Camera properties
        this.cameraPos = p.createVector(
            CONFIG.camera.defaultPosition[0],
            CONFIG.camera.defaultPosition[1],
            CONFIG.camera.defaultPosition[2]
        );

        this.viewMatrix = null;
        this.projectionMatrix = null;

        // Lighting properties
        this.lightDirection = CONFIG.lights.directional.direction;
        this.lightColor = CONFIG.lights.directional.color;
        this.lightIntensity = CONFIG.lights.directional.intensity;
        this.ambientColor = CONFIG.lights.ambient.color.map(c => c * CONFIG.lights.ambient.intensity);

        // Performance tracking
        this.lastFrameTime = 0;
        this.frameTimeAvg = 0;
        this.fps = 0;

        // Initialize
        this.init();
    }

    /**
     * Initialize the renderer
     */
    init() {
        try {
            // Create ray marching shader
            console.log("Creating shader...");
            this.shader = this.p.createShader(VERTEX_SHADER, FRAGMENT_SHADER);
            
            // Check if shader was created properly
            if (!this.shader) {
                throw new Error("Failed to create shader - p5.createShader returned null/undefined");
            }

            // Create data textures
            this.createDataTextures();

            // Create environment map graphics and texture
            this.createEnvironmentMap();

            // Initialize post-processing system
            this.postProcess = new PostProcessSystem(this.p);

            // Load default textures
            this.loadDefaultTextures();
            
            // Schedule shader initialization verification
            setTimeout(() => this.checkShaderInitialization(), 100);
            
        } catch (err) {
            console.error("Error during renderer initialization:", err);
            // We'll retry initialization later
            this.initializationAttempts++;
            if (this.initializationAttempts < this.maxInitAttempts) {
                console.log(`Will retry initialization (attempt ${this.initializationAttempts + 1} of ${this.maxInitAttempts}) in ${this.initRetryDelay}ms`);
                setTimeout(() => this.init(), this.initRetryDelay);
            } else {
                console.error("Failed to initialize renderer after multiple attempts");
            }
        }
    }
    
    /**
     * Check if shader is properly initialized and compiled
     * This helps prevent the "not yet fully initialized" error messages
     */
    checkShaderInitialization() {
        if (this.initialized) return true; // Already verified
        
        try {
            const p = this.p;
            if (!p || !p._renderer || !p._renderer.GL) {
                throw new Error("WebGL context not available");
            }
            
            const gl = p._renderer.GL;
            
            // Check if shader program exists
            if (!this.shader || !this.shader._glProgram) {
                throw new Error("Shader program not created");
            }
            
            // Check if shader is linked
            const status = gl.getProgramParameter(this.shader._glProgram, gl.LINK_STATUS);
            if (!status) {
                const info = gl.getProgramInfoLog(this.shader._glProgram);
                throw new Error(`Could not link shader program: ${info}`);
            }
            
            // Check if required uniforms are available
            this.shader.setUniform('uCameraPosition', [0, 0, 0]); // Test setting a uniform
            
            console.log("✓ Shader initialized and linked successfully");
            this.initialized = true;
            this.shaderCompiled = true;
            this.usesFallback = false;
            return true;
            
        } catch (err) {
            console.warn("Shader initialization check failed:", err);
            
            // Schedule another check if we haven't exceeded max attempts
            this.initializationAttempts++;
            if (this.initializationAttempts < this.maxInitAttempts) {
                console.log(`Will retry shader initialization check (attempt ${this.initializationAttempts + 1} of ${this.maxInitAttempts}) in ${this.initRetryDelay}ms`);
                setTimeout(() => this.checkShaderInitialization(), this.initRetryDelay);
            } else {
                console.error("Failed to initialize shader after multiple attempts, switching to fallback rendering");
                // Switch to fallback rendering mode
                return this.setupFallbackMode();
            }
            
            return false;
        }
    }

    /**
     * Create data textures for shapes and materials
     */
    createDataTextures() {
        // Create shape data texture manager
        this.shapeDataTexture = new DataTexture(this.p);
        // Initialize right away
        this.shapeDataTexture.init();
        
        // Create material data texture manager - using the same texture manager
        this.materialDataTexture = this.shapeDataTexture;
    }

    /**
     * Load default textures used in the application
     */
    loadDefaultTextures() {
        // Define array of default texture paths
        const defaultTextures = [
            'assets/textures/checker.png',
            'assets/textures/noise.png',
            'assets/textures/grid.png',
            'assets/textures/scratched_metal.jpg',
            'assets/textures/wood.jpg'
        ];

        // Dynamic loading based on CONFIG if available
        const configTextures = CONFIG.textures?.default || [];

        // Combine default textures with config textures
        const allTextures = [...defaultTextures, ...configTextures];

        // Load all default textures
        if (allTextures.length > 0) {
            // Create assets/textures folder if it doesn't exist
            this.ensureTextureFolder();

            // Load textures asynchronously (will fall back to default if loading fails)
            this.textureManager.loadTextures(allTextures)
                .then(indices => {
                    console.log('Loaded default textures:', indices);
                })
                .catch(err => {
                    console.warn('Error loading some textures:', err);
                });
        }
    }

    /**
     * Ensure the textures folder exists
     */
    ensureTextureFolder() {
        try {
            // Create textures folder if it doesn't exist
            const texturesPath = 'assets/textures';
            // Using feature detection for directory operations as p5 web editor lacks these
            if (typeof this.p.createFileIsDirectory === 'function' && typeof this.p.createFileDirectory === 'function') {
                 if (!this.p.createFileIsDirectory(texturesPath)) {
                    console.log('Creating textures directory:', texturesPath);
                    this.p.createFileDirectory(texturesPath);
                 }
            } else {
                 console.log('Skipping directory check/creation (not supported or needed in this environment).');
            }
        } catch (e) {
            console.warn('Directory check/creation failed:', e);
        }
    }

    /**
     * Load a texture and assign it to a material
     * @param {string} path - Path to texture file
     * @param {number} materialId - ID of material to assign texture to
     * @param {string} textureType - Type of texture: 'diffuse', 'normal', 'roughness', or 'metallic'
     * @returns {Promise<number>} Promise resolving to the texture index
     */
    loadMaterialTexture(path, materialId, textureType = 'diffuse') {
        return this.textureManager.loadTexture(path)
            .then(textureIndex => {
                const material = this.materialLibrary.getMaterial(materialId);
                if (material) {
                    material.setTexture(textureIndex, textureType);
                    return textureIndex;
                } else {
                    console.warn(`Material with ID ${materialId} not found`);
                    return -1;
                }
            });
    }

    /**
     * Create a more sophisticated environment map for reflections and IBL
     */
    createEnvironmentMap() {
        const p = this.p;
        const size = 256; // Increased size for better quality

        // Create p5.Graphics objects for the faces
        this.environmentMap = {
            faces: Array(6).fill().map(() => p.createGraphics(size, size))
        };

        // Generate the content for the faces
        this.generateEnvironmentMapFaces();

        // Create the WebGL cubemap texture using the generated faces
        const glTexture = this.createCubemapTexture(this.environmentMap.faces); // Calls the updated method

        if (glTexture) {
             // Store the WebGL texture object in a way p5 doesn't overwrite
            this.environmentTexture = {
                _renderer: p._renderer, // Reference renderer
                _tex: glTexture,        // The actual WebGLTexture object
                isCube: true           // Flag for potential future use
            };
            console.log("Environment cubemap texture created successfully.");
        } else {
             console.error("Failed to create environment cubemap texture.");
             this.environmentTexture = null;
        }
    }

    /**
     * Generate the six faces of the environment cubemap
     */
    generateEnvironmentMapFaces() {
        // Generate a richer environment with sky, ground, and directional lighting
        const faces = this.environmentMap.faces;
        const p = this.p;

        // Define colors for the environment
        const skyColors = {
            top: [0.4, 0.65, 1.0],      // Sky blue
            horizon: [0.8, 0.9, 1.0],    // Horizon light blue
            ground: [0.3, 0.25, 0.2],    // Ground/earth brown
            sunDirection: [-0.5, 0.5, -0.7], // Direction of the sun
            sunColor: [1.0, 0.9, 0.7],   // Warm sun color
            sunIntensity: 2.0,           // Sun brightness
            sunSize: 0.03                // Angular size of the sun
        };

        // Helper function to normalize a vector
        const normalize = (v) => {
            const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
            return len > 0 ? [v[0]/len, v[1]/len, v[2]/len] : [0,0,0];
        };

        // Helper function to add vectors
        const add = (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];

        // Helper function to scale a vector
        const scale = (v, s) => [v[0]*s, v[1]*s, v[2]*s];

        // Helper function to calculate dot product
        const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];

        // Helper to convert from cube face direction + UV to 3D direction vector
        const faceDirToVector = (faceIdx, u, v) => {
            // Map u,v from [0,1] to [-1,1]
            const nx = u * 2 - 1;
            const ny = v * 2 - 1;

            // Calculate direction based on face index
            // Order: +X, -X, +Y, -Y, +Z, -Z
            switch(faceIdx) {
                case 0: return normalize([1, -ny, -nx]);  // +X face
                case 1: return normalize([-1, -ny, nx]);  // -X face
                case 2: return normalize([nx, 1, ny]);    // +Y face (up)
                case 3: return normalize([nx, -1, -ny]);  // -Y face (down)
                case 4: return normalize([nx, -ny, 1]);   // +Z face
                case 5: return normalize([-nx, -ny, -1]); // -Z face
            }
            return [0, 0, 0];
        };

        // Helper function to blend colors based on direction
        const getEnvironmentColor = (dir) => {
            // Normalize direction
            dir = normalize(dir);

            // Calculate sky gradient based on y component (up direction)
            const skyFactor = Math.max(0, dir[1]); // 0 at horizon, 1 at zenith
            const groundFactor = Math.max(0, -dir[1]); // 0 at horizon, 1 at nadir

            // Get basic sky/ground gradient
            let color;
            if (dir[1] >= 0) {
                // Sky gradient from horizon to top
                color = [
                    skyColors.horizon[0] * (1-skyFactor) + skyColors.top[0] * skyFactor,
                    skyColors.horizon[1] * (1-skyFactor) + skyColors.top[1] * skyFactor,
                    skyColors.horizon[2] * (1-skyFactor) + skyColors.top[2] * skyFactor
                ];
            } else {
                // Ground gradient from horizon to bottom
                color = [
                    skyColors.horizon[0] * (1-groundFactor) + skyColors.ground[0] * groundFactor,
                    skyColors.horizon[1] * (1-groundFactor) + skyColors.ground[1] * groundFactor,
                    skyColors.horizon[2] * (1-groundFactor) + skyColors.ground[2] * groundFactor
                ];
            }

            // Add a bright sun
            const sunDirNorm = normalize(skyColors.sunDirection);
            const sunAngle = dot(dir, sunDirNorm);
            const sunPower = 1 / Math.max(0.001, skyColors.sunSize); // Avoid division by zero, make smaller size sharper
            // Use smoothstep for a slightly softer edge, or pow for sharper
            // let sunFactor = Math.pow(Math.max(0.0, sunAngle), sunPower);
            const sunThreshold = Math.cos(skyColors.sunSize * Math.PI * 0.5); // Angle to radius approximation
            let sunFactor = Math.max(0.0, (sunAngle - sunThreshold) / (1.0 - sunThreshold));
            sunFactor = Math.pow(sunFactor, 2); // Make it fade faster

            if (sunFactor > 0) {
                 color = add(color, scale(skyColors.sunColor, sunFactor * skyColors.sunIntensity));
            }

            // Clamp and convert to 0-255 range for p5 color
            return [
                Math.min(255, Math.max(0, color[0] * 255)),
                Math.min(255, Math.max(0, color[1] * 255)),
                Math.min(255, Math.max(0, color[2] * 255))
            ];
        };

        // Draw each face using standard 2D drawing functions
        faces.forEach((face, i) => {
            face.loadPixels(); // Ensure pixel array is ready if using direct pixel manipulation later

            // Use beginShape/endShape for potentially faster drawing than rects
            face.noStroke();
            const resolution = 16; // Draw grid cells
            const cellSize = face.width / resolution;

            for (let y = 0; y < resolution; y++) {
                for (let x = 0; x < resolution; x++) {
                    const u = (x + 0.5) / resolution;
                    const v = (y + 0.5) / resolution;
                    const dir = faceDirToVector(i, u, v);
                    const col = getEnvironmentColor(dir);

                    face.fill(col[0], col[1], col[2]);
                    face.rect(x * cellSize, y * cellSize, cellSize, cellSize);
                }
            }
             face.updatePixels(); // Update the canvas if pixels were manipulated directly
        });
         console.log("Generated environment map faces.");
    }


    // ============================================================== //
    // ==  UPDATED createCubemapTexture Method                      == //
    // ==  Re-enabling texture parameters                           == //
    // ============================================================== //
    /**
     * Create a WebGL cubemap texture from six p5.Graphics objects
     * @param {Array<p5.Graphics>} faces - Array of 6 p5.Graphics for each cube face
     * @returns {WebGLTexture | null} The created cubemap texture or null on failure
     */
    createCubemapTexture(faces) {
        console.log("[createCubemapTexture] Starting cubemap creation.");
        const gl = this.p._renderer.GL;
        if (!gl) {
            console.error("[createCubemapTexture] WebGL context not available.");
            return null;
        }
        
        const texture = gl.createTexture();
        if (!texture) {
             console.error("[createCubemapTexture] Failed to create WebGL texture object.");
             return null;
        }
        
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

        // Set texture parameters - RE-ENABLED
        try {
            // Use settings known to be safe for NPOT textures even in WebGL1
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            
            // Add R coordinate wrapping for cubemaps
            if (gl.getExtension('EXT_texture_filter_anisotropic')) {
                gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
            }
            
            console.log("[createCubemapTexture] Texture parameters set successfully.");
        } catch (e) {
            console.warn("[createCubemapTexture] Error setting texture parameters:", e);
            // Continue anyway - some platforms might still work without these
        }

        const targets = [
            gl.TEXTURE_CUBE_MAP_POSITIVE_X, gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
            gl.TEXTURE_CUBE_MAP_POSITIVE_Y, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
            gl.TEXTURE_CUBE_MAP_POSITIVE_Z, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z
        ];

        let tempCanvas, tempCtx;
        try {
             tempCanvas = document.createElement('canvas');
             tempCtx = tempCanvas.getContext('2d');
             if (!tempCanvas || !tempCtx) throw new Error("Failed to create temporary canvas/context.");
        } catch (e) {
             console.error("[createCubemapTexture] Error creating temporary canvas:", e);
             gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
             gl.deleteTexture(texture);
             return null;
        }

        console.log("[createCubemapTexture] Processing faces...");
        let success = true;
        
        for (let i = 0; i < faces.length; i++) {
            const face = faces[i];
            const target = targets[i];
            
            // Skip invalid faces but continue processing
            if (!face || !face.elt || !(face.elt instanceof HTMLCanvasElement) || face.width <= 0 || face.height <= 0) {
                console.warn(`[createCubemapTexture] Face ${i} is invalid - using placeholder.`);
                const size = 64;
                const placeholderData = new Uint8Array(size * size * 4);
                for (let k = 0; k < placeholderData.length; k += 4) { 
                    placeholderData[k] = 255; placeholderData[k + 1] = 0; 
                    placeholderData[k + 2] = 255; placeholderData[k + 3] = 255; 
                } 
                
                try {
                    gl.texImage2D(target, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, placeholderData);
                } catch (err) {
                    console.error(`[createCubemapTexture] Failed to create placeholder for face ${i}:`, err);
                    success = false;
                }
                continue;
            }
            
            // Use a simpler, more direct approach to upload the texture
            try {
                gl.texImage2D(target, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, face.elt);
                console.log(`[createCubemapTexture] Face ${i} uploaded successfully.`);
            } catch (uploadError) {
                console.error(`[createCubemapTexture] Error uploading face ${i}:`, uploadError);
                success = false;
                
                // Create a red placeholder texture for failed uploads
                const size = 64;
                const placeholderData = new Uint8Array(size * size * 4);
                for (let k = 0; k < placeholderData.length; k += 4) { 
                    placeholderData[k] = 255; placeholderData[k + 1] = 0; 
                    placeholderData[k + 2] = 0; placeholderData[k + 3] = 255; 
                } 
                
                try {
                    gl.texImage2D(target, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, placeholderData);
                } catch (err) {
                    console.error(`[createCubemapTexture] Failed to create error placeholder for face ${i}`);
                }
            }
        }

        gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);

        if (!success) {
            console.warn("[createCubemapTexture] One or more faces had issues, but texture may still work partially.");
        } else {
            console.log("[createCubemapTexture] Cubemap texture created successfully.");
        }

        return texture;
    }

    /**
     * Update the data textures with current shape and material data
     */
    updateDataTextures() {
        // Update shape data texture
        this.shapeDataTexture.updateShapeTexture(this.shapeManager.getAllShapes());
        
        // Update material data texture
        this.shapeDataTexture.updateMaterialTexture(this.materialLibrary.getAllMaterials());
    }

    /**
     * Update camera matrices based on current p5 camera state
     */
    updateCameraMatrices() {
        const p = this.p;
        
        // Special handling for fallback mode - don't rely on WebGL matrices
        if (this.usesFallback) {
            // In fallback mode, ensure we have base matrices even if p5's renderer isn't ready
            if (!this.viewMatrix) {
                this.viewMatrix = new p5.Matrix();
            }
            if (!this.projectionMatrix) {
                this.projectionMatrix = new p5.Matrix();
            }
            
            // Always ensure we have a valid camera position
            this.cameraPos = p.createVector(
                CONFIG.camera.defaultPosition[0],
                CONFIG.camera.defaultPosition[1], 
                CONFIG.camera.defaultPosition[2]
            );
            
            return; // Skip the rest of the method in fallback mode
        }
        
        // DO NOT apply orbit controls here - they are now handled in main.js
        // This prevents the duplicate application of orbit controls
        
        // Standard path for non-fallback mode
        // Get camera info from p5's camera system
        const renderer = this.p._renderer;
        
        // Check if renderer and matrices are initialized
        if (!renderer) {
            console.warn("p5 renderer not available for updateCameraMatrices.");
            return; // Keep existing camera matrices and position
        }
        
        // Check specifically for matrices availability
        const matricesAvailable = renderer.uViewMatrix && renderer.uProjMatrix;
        if (!matricesAvailable) {
            console.warn("Camera matrices not available yet");
            return; // Keep existing camera matrices and position
        }

        // Get view matrix (camera transformation)
        // Use copy() to avoid modifying p5's internal matrix
        this.viewMatrix = renderer.uViewMatrix.copy();

        // Get projection matrix
        this.projectionMatrix = renderer.uProjMatrix.copy();

        // Get camera position from the inverted view matrix
        try {
            const viewInv = this.viewMatrix.copy().invert();
            this.cameraPos = p.createVector(
                viewInv.mat4[12],
                viewInv.mat4[13],
                viewInv.mat4[14]
            );
        } catch (e) {
            console.warn("Error inverting view matrix for camera position");
            // Fall back to the default camera position
            this.cameraPos = p.createVector(
                CONFIG.camera.defaultPosition[0],
                CONFIG.camera.defaultPosition[1], 
                CONFIG.camera.defaultPosition[2]
            );
        }
    }

    /**
     * Render the scene using ray marching
     */
    render() {
        const p = this.p;

        // Check if shader is initialized and attempt initialization if needed
        if (!this.initialized) {
            // Try to check shader initialization
            if (!this.checkShaderInitialization()) {
                // If still not initialized, display a more specific message and use the system background
                const now = performance.now();
                if (now - this.lastInitAttempt > this.initRetryDelay) {
                    this.lastInitAttempt = now;
                    console.log(`Waiting for shader initialization... (attempt ${this.initializationAttempts + 1}/${this.maxInitAttempts})`);
                    
                    // Display a message on screen if shader still isn't ready
                    p.background(20, 20, 30); // Dark blue background
                    p.fill(255);
                    p.textSize(16);
                    p.textAlign(p.CENTER);
                    p.text("Initializing shader...", p.width/2, p.height/2);
                }
                return; // Skip this frame
            }
        }

        // Start timing this frame
        const frameStartTime = performance.now();

        // Update camera matrices

        this.updateCameraMatrices();

        // Check if post-processing is enabled (only for advanced rendering)
        const usePostProcess = this.postProcess && this.postProcess.enabled && !this.usesFallback;

        // Check if we're using fallback rendering
        if (this.usesFallback && this.fallbackShader) {
            // FALLBACK RENDERING PATH
            this.renderFallback();
        } else {
            // NORMAL ADVANCED RENDERING PATH
            // Update data textures with current state
            if (this.shapeManager && this.shapeManager.getAllShapes && this.shapeManager.getAllShapes().length > 0) {
                this.updateDataTextures();
            }
            
            // Get the render target (post-process buffer or screen)
            const renderTarget = usePostProcess ? this.postProcess.beginRender() : null;

            try {
                // If using post-processing, set the render target
                if (renderTarget) {
                    renderTarget.push();
                    renderTarget.shader(this.shader);
                } else {
                    // Ensure we reset graphics state before applying shader to main canvas
                    p.resetMatrix();
                    p.noStroke();
                    p.shader(this.shader);
                }

                // Set camera uniforms
                this.shader.setUniform('uCameraPosition', [this.cameraPos.x, this.cameraPos.y, this.cameraPos.z]);
                if (this.viewMatrix) this.shader.setUniform('uViewMatrix', this.viewMatrix.mat4);
                if (this.projectionMatrix) this.shader.setUniform('uProjectionMatrix', this.projectionMatrix.mat4);
                this.shader.setUniform('uFov', CONFIG.camera.fov);
                this.shader.setUniform('uAspect', p.width / p.height);
                this.shader.setUniform('uNear', CONFIG.camera.near);
                this.shader.setUniform('uFar', CONFIG.camera.far);

                // Set scene uniforms
                const shapeCount = this.shapeManager ? this.shapeManager.shapes.length : 0;
                this.shader.setUniform('uShapeCount', shapeCount);
                this.shader.setUniform('uLightDirection', this.lightDirection);
                this.shader.setUniform('uLightColor', this.lightColor.map(c => c * this.lightIntensity));
                this.shader.setUniform('uAmbientColor', this.ambientColor);
                this.shader.setUniform('uShadowSoftness', CONFIG.render.shadowSoftness);
                this.shader.setUniform('uBackgroundColor', CONFIG.render.defaultBackground);

                // Environment mapping
                let envMapEnabled = false;
                if (this.environmentTexture && this.environmentTexture._tex) {
                    try {
                        // Verify the texture is valid
                        const gl = p._renderer.GL;
                        gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.environmentTexture._tex);
                        gl.bindTexture(gl.TEXTURE_CUBE_MAP, null); // Unbind to test
                        envMapEnabled = CONFIG.render.envMapIntensity > 0;
                    } catch (e) {
                        envMapEnabled = false;
                    }
                }
                
                this.shader.setUniform('uEnvMapEnabled', envMapEnabled);
                this.shader.setUniform('uEnvMapIntensity', CONFIG.render.envMapIntensity);

                // Set time for animations
                this.shader.setUniform('uTime', p.millis() / 1000.0);

                // Bind data textures
                if (shapeCount > 0 && this.shapeDataTexture) {
                    this.shapeDataTexture.bind(this.shader);
                }

                // Bind environment map 
                if (envMapEnabled) {
                    try {
                        const gl = p._renderer.GL;
                        if (gl && this.shader._glProgram) {
                            const uniformLocation = gl.getUniformLocation(this.shader._glProgram, 'uEnvironmentMap');
                            if (uniformLocation !== null) {
                                // Activate texture unit 2 for environment map
                                gl.activeTexture(gl.TEXTURE2);
                                gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.environmentTexture._tex);
                                gl.uniform1i(uniformLocation, 2);
                            }
                        }
                    } catch (e) {
                        console.warn("Error binding environment map:", e);
                    }
                }

                // Bind material textures
                if (this.textureManager) {
                    this.textureManager.bindTextures(this.shader, 3);
                }

                // Draw a full-screen quad
                if (renderTarget) {
                    renderTarget.rect(0, 0, renderTarget.width, renderTarget.height);
                    renderTarget.pop();
                } else {
                    p.push();
                    p.resetMatrix();
                    p.rect(0, 0, p.width, p.height);
                    p.pop();
                }

                // Unbind textures
                if (p._renderer && p._renderer.GL) {
                    const gl = p._renderer.GL;
                    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, null);
                    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, null);
                    if (envMapEnabled) {
                        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
                    }
                    // Unbind texture manager units
                    if (this.textureManager) {
                        this.textureManager.unbindTextures(3);
                    }
                }

                // Apply post-processing
                if (usePostProcess && this.postProcess) {
                    this.postProcess.endRender();
                }
            } catch (err) {
                console.error("Error during render:", err);
                
                // If we encounter an error during render, try to switch to fallback rendering
                if (!this.usesFallback) {
                    console.warn("Switching to fallback rendering due to error");
                    this.setupFallbackMode();
                    
                    // Try fallback rendering immediately
                    p.resetShader();
                    this.renderFallback();
                } else {
                    // We're already in fallback mode and still having issues
                    p.resetShader();
                    p.background(20, 20, 30);
                    p.fill(255, 0, 0);
                    p.textSize(16);
                    p.textAlign(p.CENTER);
                    p.text("Rendering Error - Cannot display scene", p.width/2, p.height/2);
                }
            }
        }

        // Measure frame time
        const frameTime = performance.now() - frameStartTime;
        this.updatePerformanceMetrics(frameTime);
    }
    
    /**
     * Render the scene using the simple fallback mode
     * This mode uses p5.js built-in 3D rendering instead of ray marching
     */
    renderFallback() {
        const p = this.p;
        
        // Clear the background
        p.background(20, 20, 30); // Dark blue background
        
        // Reset the shader
        p.resetShader();
        
        // Set up camera - critical for stable rendering
        p.perspective(
            p.radians(CONFIG.camera.fov), 
            p.width / p.height, 
            CONFIG.camera.near, 
            CONFIG.camera.far
        );
        
        // Set up basic 3D camera position - use our stored camera position
        const camPos = this.cameraPos;
        const camLookAt = p.createVector(0, 0, 0); // Look at origin by default
        const camUp = p.createVector(0, 1, 0);     // Y-up orientation
        
        p.camera(
            camPos.x, camPos.y, camPos.z,   // Camera position
            camLookAt.x, camLookAt.y, camLookAt.z, // Look at point
            camUp.x, camUp.y, camUp.z      // Up direction
        );
        
        // Apply p5.js orbit controls if enabled
        if (CONFIG.camera.orbitControl && typeof p.orbitControl === 'function') {
            p.orbitControl();
        }
        
        // Set up basic lights
        p.ambientLight(
            this.ambientColor[0] * 255,
            this.ambientColor[1] * 255,
            this.ambientColor[2] * 255
        );
        
        // Add directional light
        const dirX = -this.lightDirection[0];
        const dirY = -this.lightDirection[1];
        const dirZ = -this.lightDirection[2];
        p.directionalLight(
            this.lightColor[0] * 255 * this.lightIntensity,
            this.lightColor[1] * 255 * this.lightIntensity,
            this.lightColor[2] * 255 * this.lightIntensity,
            dirX, dirY, dirZ
        );
        
        // Draw a grid for reference
        p.push();
        p.noStroke();
        p.fill(50);
        p.translate(0, 0, 0);
        p.rotateX(Math.PI/2);
        p.plane(100, 100);
        p.pop();
        
        // Render all shapes using p5's built-in 3D primitives
        if (this.shapeManager && this.shapeManager.shapes) {
            const shapes = this.shapeManager.shapes;
            for (const shape of shapes) {
                this.renderFallbackShape(shape);
            }
        }
        
        // Show "Fallback Mode" indicator (use HUD style rendering)
        p.push();
        p.resetMatrix(); // Reset to screen coordinates
        p.ortho(0, p.width, 0, p.height, -1, 1);
        p.noLights();
        p.fill(255, 255, 0);
        p.textSize(16);
        p.textAlign(p.LEFT, p.TOP);
        p.text("FALLBACK RENDERING MODE", 10, 10);
        
        // Add a message to help users understand
        p.fill(200);
        p.textSize(14);
        p.text("WebGL ray marching shader failed to initialize.", 10, 30);
        p.text("Using basic 3D rendering instead.", 10, 48);
        p.pop();
    }
    
    /**
     * Render a single shape in fallback mode using p5's built-in 3D primitives
     * @param {Shape} shape - The shape to render
     */
    renderFallbackShape(shape) {
        const p = this.p;
        
        // Skip invalid shapes
        if (!shape || shape.type === undefined) return;
        
        // Get material for this shape
        const material = this.materialLibrary.getMaterial(shape.materialId);
        
        p.push(); // Save state
        
        // Apply position and rotation
        p.translate(shape.position.x, shape.position.y, shape.position.z);
        
        // Apply rotation if present
        if (shape.orientation && shape.orientation.length === 4) {
            const q = shape.orientation;
            // Convert quaternion to axis-angle
            const angle = 2 * Math.acos(q[3]);
            let axis = [q[0], q[1], q[2]];
            const sinHalfAngle = Math.sin(angle/2);
            
            if (sinHalfAngle !== 0) {
                axis = axis.map(v => v / sinHalfAngle);
            }
            
            // Apply rotation
            if (angle !== 0) {
                p.rotate(angle, axis[0], axis[1], axis[2]);
            }
        }
        
        // Set material properties
        if (material) {
            const albedo = material.albedo || [0.8, 0.8, 0.8];
            const emissive = material.emissive || [0, 0, 0];
            
            // Set fill color based on albedo and emissive
            p.fill(
                (albedo[0] * 255) + (emissive[0] * 255),
                (albedo[1] * 255) + (emissive[1] * 255),
                (albedo[2] * 255) + (emissive[2] * 255)
            );
            
            // Set specular based on roughness
            if (material.roughness !== undefined) {
                p.specularMaterial(255 * (1 - material.roughness));
            }
            
            // Set shininess based on metallic
            if (material.metallic !== undefined) {
                p.shininess(material.metallic * 100);
            }
        } else {
            // Default material
            p.fill(200);
        }
        
        // Apply slight stroke to see shape edges
        p.stroke(0);
        p.strokeWeight(0.5);
        
        // Get size (handle both scalar and vector sizes)
        let sizeX = shape.size;
        let sizeY = shape.size;
        let sizeZ = shape.size;
        
        if (Array.isArray(shape.size)) {
            sizeX = shape.size[0] || 1;
            sizeY = shape.size[1] || 1;
            sizeZ = shape.size[2] || 1;
        }
        
        // Draw appropriate shape based on type
        switch (shape.type) {
            case 0: // Sphere
                p.sphere(sizeX);
                break;
                
            case 1: // Box
                p.box(sizeX * 2, sizeY * 2, sizeZ * 2);
                break;
                
            case 2: // Torus
                p.torus(sizeX * 1.5, sizeX * 0.5);
                break;
                
            case 3: // Cylinder
                p.cylinder(sizeX, sizeZ * 2);
                break;
                
            case 4: // Cone
                p.cone(sizeX, sizeZ * 2);
                break;
                
            case 5: // Capsule (approximated as cylinder with spheres)
                // Draw cylinder body
                p.cylinder(sizeX, sizeZ * 2);
                
                // Draw end caps as spheres
                p.push();
                p.translate(0, sizeZ, 0);
                p.sphere(sizeX);
                p.pop();
                
                p.push();
                p.translate(0, -sizeZ, 0);
                p.sphere(sizeX);
                p.pop();
                break;
                
            case 6: // Plane
                p.rotateX(Math.PI/2);
                p.plane(sizeX * 100, sizeZ * 100);
                break;
                
            default:
                // Unknown shape type
                p.sphere(sizeX); // Default to sphere
                break;
        }
        
        p.pop(); // Restore state
    }

    /**
     * Handle window resize
     */
    handleWindowResize() {
        // Update post-processing buffers if enabled
        if (this.postProcess) {
            this.postProcess.handleWindowResize();
        }
        // Aspect ratio uniform will be updated in the next render() call
    }

    /**
     * Update performance metrics
     * @param {number} frameTime - Time taken to render this frame (ms)
     */
    updatePerformanceMetrics(frameTime) {
        // Exponential moving average for frame time
        const alpha = 0.05; // Smoothing factor
        this.frameTimeAvg = this.frameTimeAvg * (1 - alpha) + frameTime * alpha;

        // Update FPS calculation periodically
        const now = performance.now();
        if (now - this.lastFrameTime > CONFIG.ui.fps.updateInterval) {
            // Avoid division by zero or very small numbers giving huge FPS
            this.fps = this.frameTimeAvg > 1 ? Math.round(1000 / this.frameTimeAvg) : 999;
            this.lastFrameTime = now;
        }
    }

    /**
     * Get current FPS
     * @returns {number} Current frames per second
     */
    getFPS() {
        return this.fps;
    }

    /**
     * Configure post-processing settings
     * @param {boolean} enabled - Whether post-processing is enabled
     * @param {boolean} bloomEnabled - Whether bloom effect is enabled
     * @param {number} bloomThreshold - Brightness threshold for bloom
     * @param {number} bloomIntensity - Intensity of bloom effect
     */
    setPostProcessingParams(enabled, bloomEnabled, bloomThreshold, bloomIntensity) {
        if (this.postProcess) {
            this.postProcess.setEnabled(enabled);
            this.postProcess.setBloomParams(bloomEnabled, bloomThreshold, bloomIntensity);
        }
    }

    // Utility to clean up WebGL resources (call when stopping the sketch)
    cleanup() {
        console.log("Cleaning up Renderer resources...");
        if (this.environmentTexture && this.environmentTexture._tex) {
            this.p._renderer.GL.deleteTexture(this.environmentTexture._tex);
            this.environmentTexture = null;
        }
        if (this.shapeDataTexture) {
            this.shapeDataTexture.cleanup();
            this.shapeDataTexture = null;
        }
         if (this.materialDataTexture) {
            this.materialDataTexture.cleanup();
            this.materialDataTexture = null;
        }
        if (this.textureManager) {
             this.textureManager.cleanup();
             this.textureManager = null;
        }
         if (this.postProcess) {
             this.postProcess.cleanup();
             this.postProcess = null;
        }
         // Shaders are managed by p5, might not need explicit deletion unless created raw
    }

    /**
     * Create a simple fallback shader when the main shader fails to compile
     */
    createFallbackShader() {
        console.log("Creating fallback shader for basic rendering...");
        try {
            // Simple vertex shader
            const fallbackVS = `
                attribute vec3 aPosition;
                attribute vec4 aVertexColor;
                
                uniform mat4 uModelViewMatrix;
                uniform mat4 uProjectionMatrix;
                
                varying vec4 vColor;
                
                void main() {
                    vColor = aVertexColor;
                    gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
                }
            `;
            
            // Simple fragment shader
            const fallbackFS = `
                #ifdef GL_ES
                precision mediump float;
                #endif
                
                varying vec4 vColor;
                
                void main() {
                    gl_FragColor = vColor;
                }
            `;
            
            // Create fallback shader
            const fallbackShader = this.p.createShader(fallbackVS, fallbackFS);
            console.log("✓ Fallback shader created successfully");
            return fallbackShader;
        } catch (err) {
            console.error("Failed to create even the fallback shader:", err);
            return null;
        }
    }
    
    /**
     * Set up fallback rendering mode
     */
    setupFallbackMode() {
        console.log("Setting up fallback rendering mode...");
        this.usesFallback = true;
        
        // Create a basic fallback shader
        this.fallbackShader = this.createFallbackShader();
        
        // Flag that initialization is "complete" (with fallback)
        this.initializationAttempts = this.maxInitAttempts;
        this.initialized = true;
        
        console.log("Fallback rendering mode is now active");
        return true;
    }
}