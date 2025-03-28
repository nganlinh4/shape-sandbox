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
        // Create ray marching shader
        this.shader = this.p.createShader(VERTEX_SHADER, FRAGMENT_SHADER);

        // Create data textures
        this.createDataTextures();

        // Create environment map graphics and texture
        this.createEnvironmentMap(); // This now calls the updated createCubemapTexture

        // Initialize post-processing system
        this.postProcess = new PostProcessSystem(this.p);

        // Load default textures
        this.loadDefaultTextures();
    }

    /**
     * Create data textures for shapes and materials
     */
    createDataTextures() {
        // Create shape data texture (4 rows per shape, maximum of CONFIG.shapes.maxCount shapes)
        this.shapeDataTexture = new DataTexture(
            this.p._renderer,
            4, // 4 pixels per shape: [position+id, rotation, size+type, materialId+reserved]
            CONFIG.shapes.maxCount
        );

        // Create material data texture (5 rows per material to accommodate texture mapping parameters)
        this.materialDataTexture = new DataTexture(
            this.p._renderer,
            5, // 5 pixels per material: [albedo+metallic, roughness+emissiveFactor+ior+flags, emissive+reserved, textureIndices, textureScale+Offset]
            32 // Support up to 32 materials
        );
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
    // ==  UPDATED createCubemapTexture Method (Attempt 4)         == //
    // ==  Temporarily skipping texParameteri                      == //
    // ============================================================== //
    /**
     * Create a WebGL cubemap texture from six p5.Graphics objects (Attempt 4: Skipping texParameteri)
     * @param {Array<p5.Graphics>} faces - Array of 6 p5.Graphics for each cube face
     * @returns {WebGLTexture | null} The created cubemap texture or null on failure
     */
    createCubemapTexture(faces) {
        console.log("[createCubemapTexture v4] Starting.");
        const gl = this.p._renderer.GL;
        if (!gl) {
            console.error("[createCubemapTexture v4] WebGL context not available.");
            return null;
        }
        console.log("[createCubemapTexture v4] WebGL Context:", gl);
        console.log("[createCubemapTexture v4] WebGL Version:", gl.getParameter(gl.VERSION));
        console.log("[createCubemapTexture v4] Input faces:", faces);

        const texture = gl.createTexture();
        if (!texture) {
             console.error("[createCubemapTexture v4] Failed to create WebGL texture object.");
             return null;
        }
        console.log("[createCubemapTexture v4] Created WebGL texture:", texture);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

        // Set texture parameters --- TEMPORARILY SKIPPED ---
        console.warn("[createCubemapTexture v4] Skipping gl.texParameteri calls for debugging.");
        /* // <--- Start Skip Block
        console.log("[createCubemapTexture v4] Setting texture parameters...");
        let paramErrorOccurred = false;
        try {
            // Use settings known to be safe for NPOT textures even in WebGL1
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

            const paramError = gl.getError();
            if (paramError !== gl.NO_ERROR) {
                let errorString = paramError;
                for (const key in gl) {
                    if (gl[key] === paramError) {
                        errorString = `${key} (${paramError})`;
                        break;
                    }
                }
                console.error(`[createCubemapTexture v4] WebGL error ${errorString} after texParameteri.`);
                paramErrorOccurred = true;
            } else {
                 console.log("[createCubemapTexture v4] Texture parameters set successfully.");
            }
        } catch (e) {
             console.error("[createCubemapTexture v4] Error setting texture parameters:", e);
             gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
             gl.deleteTexture(texture);
             return null;
        }
        if (paramErrorOccurred) {
            console.warn("[createCubemapTexture v4] Proceeding with face upload despite parameter error.");
        }
        */ // <--- End Skip Block


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
             console.log("[createCubemapTexture v4] Created temporary canvas.");
        } catch (e) {
             console.error("[createCubemapTexture v4] Error creating temporary canvas:", e);
             gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
             gl.deleteTexture(texture);
             return null;
        }

        console.log("[createCubemapTexture v4] Processing faces...");
        let success = true;
        faces.forEach((face, i) => {
            console.log(`[createCubemapTexture v4] Processing face ${i}...`);
            const target = targets[i];
            let faceWidth = 0, faceHeight = 0;

            // --- Validation ---
            if (!face || !face.elt || !(face.elt instanceof HTMLCanvasElement) || face.width <= 0 || face.height <= 0) {
                 console.error(`[createCubemapTexture v4] Face ${i} is invalid or not ready. Skipping.`, face);
                 const size = faces[0]?.width || 256;
                 faceWidth = faceHeight = Math.max(1, size);
                 const placeholderData = new Uint8Array(faceWidth * faceHeight * 4);
                 for (let k = 0; k < placeholderData.length; k += 4) { placeholderData[k] = 255; placeholderData[k + 1] = 0; placeholderData[k + 2] = 255; placeholderData[k + 3] = 255; } // Magenta
                 try {
                     gl.texImage2D(target, 0, gl.RGBA, faceWidth, faceHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, placeholderData);
                     console.warn(`[createCubemapTexture v4] Face ${i} filled with placeholder (Magenta).`);
                 } catch (placeholderError) {
                     console.error(`[createCubemapTexture v4] Failed to fill placeholder for face ${i}:`, placeholderError);
                     success = false;
                 }
                 return;
            }
            // --- End Validation ---

            faceWidth = face.width;
            faceHeight = face.height;

            // --- Dimension Sync ---
             if (tempCanvas.width !== faceWidth || tempCanvas.height !== faceHeight) {
                 tempCanvas.width = faceWidth;
                 tempCanvas.height = faceHeight;
             }
            // --- End Dimension Sync ---

            // --- Upload Logic using ImageData ---
            try {
                tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
                console.log(`[createCubemapTexture v4] Face ${i}: Drawing face.elt (${face.elt.width}x${face.elt.height}) onto temp canvas (${tempCanvas.width}x${tempCanvas.height}).`);
                tempCtx.drawImage(face.elt, 0, 0, faceWidth, faceHeight);
                console.log(`[createCubemapTexture v4] Face ${i}: Getting ImageData...`);
                const imageData = tempCtx.getImageData(0, 0, faceWidth, faceHeight);
                console.log(`[createCubemapTexture v4] Face ${i}: Got ImageData (${imageData.width}x${imageData.height}).`);

                // --- The texImage2D call ---
                console.log(`[createCubemapTexture v4] Face ${i}: Calling texImage2D with ImageData.data...`);
                gl.texImage2D(
                    target, 0, gl.RGBA, faceWidth, faceHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, imageData.data
                );
                // --- End texImage2D call ---
                console.log(`[createCubemapTexture v4] Face ${i}: texImage2D call potentially succeeded.`);

                const texError = gl.getError();
                if (texError !== gl.NO_ERROR) {
                    let errorString = texError;
                    for (const key in gl) { if (gl[key] === texError) { errorString = `${key} (${texError})`; break; } }
                    console.error(`[createCubemapTexture v4] Face ${i}: WebGL error ${errorString} occurred *after* texImage2D call.`);
                    success = false;
                } else {
                     console.log(`[createCubemapTexture v4] Face ${i}: Upload confirmed successful.`);
                }

            } catch (uploadError) {
                // This is where the TypeError would likely be caught if it still happens
                console.error(`[createCubemapTexture v4] Face ${i}: Error during drawImage, getImageData, or texImage2D:`, uploadError);
                console.error(`[createCubemapTexture v4] Face ${i}: Error Name: ${uploadError.name}, Message: ${uploadError.message}`);
                success = false;

                // Attempt placeholder on error
                const placeholderData = new Uint8Array(faceWidth * faceHeight * 4);
                 for (let k = 0; k < placeholderData.length; k += 4) { placeholderData[k] = 255; placeholderData[k + 1] = 0; placeholderData[k + 2] = 0; placeholderData[k + 3] = 255; } // Red
                 try {
                    gl.texImage2D(target, 0, gl.RGBA, faceWidth, faceHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, placeholderData);
                    console.warn(`[createCubemapTexture v4] Face ${i} filled with error placeholder (Red).`);
                 } catch (placeholderError) {
                     console.error(`[createCubemapTexture v4] Failed to fill error placeholder for face ${i}:`, placeholderError);
                 }
            }
            // --- End Upload Logic ---
        });

        console.log("[createCubemapTexture v4] Finished processing faces. Overall success:", success);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
        console.log("[createCubemapTexture v4] Unbound texture.");

        if (!success) {
             console.error("[createCubemapTexture v4] One or more faces failed to upload.");
        }

        console.log("[createCubemapTexture v4] Returning texture object:", texture);
        return texture;
    }
    // ============================================================== //
    // ==  END UPDATED createCubemapTexture Method (Attempt 4)      == //
    // ============================================================== //


    /**
     * Update the data textures with current shape and material data
     */
    updateDataTextures() {
        // Update shape data texture
        this.shapeDataTexture.packShapeData(this.shapeManager.getAllShapes());

        // Update material data texture
        this.materialDataTexture.packMaterialData(this.materialLibrary.getAllMaterials());
    }

    /**
     * Update camera matrices based on current p5 camera state
     */
    updateCameraMatrices() {
        // Get camera info from p5's camera system
        const renderer = this.p._renderer;
        if (!renderer || !renderer.uViewMatrix || !renderer.uProjMatrix) {
            console.error("p5 renderer or matrices not available for updateCameraMatrices.");
            // Use identity matrices as fallback? Might cause issues.
            this.viewMatrix = new p5.Matrix(); // Identity
            this.projectionMatrix = new p5.Matrix(); // Identity
            return;
        }

        // Get view matrix (camera transformation)
        // Use copy() to avoid modifying p5's internal matrix
        this.viewMatrix = renderer.uViewMatrix.copy();

        // Get projection matrix
        this.projectionMatrix = renderer.uProjMatrix.copy();

        // Get camera position
        if (CONFIG.camera.orbitControl && typeof this.p.orbitControl === 'function' && this.viewMatrix) {
            // When using orbitControl, extract camera position from the inverted view matrix
            try {
                const viewInv = this.viewMatrix.copy().invert();
                this.cameraPos = this.p.createVector(
                    viewInv.mat4[12],
                    viewInv.mat4[13],
                    viewInv.mat4[14]
                );
            } catch (e) {
                 console.error("Error inverting view matrix for camera position:", e);
                 // Keep previous position as fallback
            }
        } else if (this.p._renderer && this.p._renderer.camera) {
             // Fallback: Try to get from internal p5 camera if not using orbit control
             // This might be less reliable or change between p5 versions
             const cam = this.p._renderer.camera;
             this.cameraPos = this.p.createVector(cam.eyeX, cam.eyeY, cam.eyeZ);
        } else {
             // Absolute fallback if other methods fail
              console.warn("Could not reliably determine camera position. Using default/last known.");
              // Keep this.cameraPos as it is
        }
    }

    /**
     * Render the scene using ray marching
     */
    render() {
        const p = this.p;

        // Start timing this frame
        const frameStartTime = performance.now();

        // Update camera matrices
        this.updateCameraMatrices();

        // Update data textures with current state
        this.updateDataTextures();

        // Check if post-processing is enabled
        const usePostProcess = this.postProcess && this.postProcess.enabled;

        // Get the render target (post-process buffer or screen)
        const renderTarget = usePostProcess ? this.postProcess.beginRender() : null;

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
        this.shader.setUniform('uFovY', p.radians(CONFIG.camera.fov)); // Pass FOV in radians (vertical fov)
        this.shader.setUniform('uAspect', p.width / p.height);
        this.shader.setUniform('uNear', CONFIG.camera.near);
        this.shader.setUniform('uFar', CONFIG.camera.far);

        // Set scene uniforms
        this.shader.setUniform('uShapeCount', this.shapeManager.shapes.length);
        this.shader.setUniform('uLightDirection', this.lightDirection);
        this.shader.setUniform('uLightColor', this.lightColor.map(c => c * this.lightIntensity));
        this.shader.setUniform('uAmbientColor', this.ambientColor);
        this.shader.setUniform('uShadowSoftness', CONFIG.render.shadowSoftness);
        this.shader.setUniform('uBackgroundColor', CONFIG.render.defaultBackground);

        // Environment mapping
        const envMapEnabled = this.environmentTexture && this.environmentTexture._tex && CONFIG.render.envMapIntensity > 0;
        this.shader.setUniform('uEnvMapEnabled', envMapEnabled);
        this.shader.setUniform('uEnvMapIntensity', CONFIG.render.envMapIntensity);

        // Set time for animations
        this.shader.setUniform('uTime', p.millis() / 1000.0);
        this.shader.setUniform('uResolution', [p.width, p.height]); // Pass resolution


        // Bind data textures
        this.shapeDataTexture.bind('uShapeData', 0, this.shader);
        this.materialDataTexture.bind('uMaterialData', 1, this.shader);

        // Bind environment map (Texture Unit 2)
        if (envMapEnabled) {
            const gl = p._renderer.GL;
            const uniformLocation = gl.getUniformLocation(this.shader._glProgram, 'uEnvironmentMap');

            if (uniformLocation !== null) {
                // Activate texture unit 2 for environment map
                gl.activeTexture(gl.TEXTURE2);
                gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.environmentTexture._tex);
                gl.uniform1i(uniformLocation, 2); // Tell sampler to use texture unit 2
            } else {
                // console.warn("uEnvironmentMap uniform not found in shader.");
            }
        }

        // Bind material textures (starting at texture unit 3)
        this.textureManager.bindTextures(this.shader, 3); // Pass starting texture unit index

        // Draw a full-screen quad to trigger the fragment shader
        // Important: Use coordinates relative to the current render target
        if (renderTarget) {
            // Coordinates for rect() in p5.Graphics are relative to the graphics buffer
             renderTarget.rect(0, 0, renderTarget.width, renderTarget.height);
             renderTarget.pop(); // Restore graphics state if using push/pop
        } else {
            // Coordinates for rect() on main canvas are relative to the canvas origin
            // Ensure it covers the whole screen regardless of matrix transforms
            p.push(); // Save current state
            p.resetMatrix(); // Use identity matrix
            p.rect(0, 0, p.width, p.height); // Draw covering the canvas
            p.pop(); // Restore previous state
        }


        // Important: Unbind textures to prevent conflicts or unintended state
        const gl = p._renderer.GL;
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, null); // Unbind unit 0
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, null); // Unbind unit 1
        if (envMapEnabled) {
             gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_CUBE_MAP, null); // Unbind unit 2 (cubemap)
        }
        // Unbind texture manager units (3 onwards)
        this.textureManager.unbindTextures(3);

        // Apply post-processing if enabled
        if (usePostProcess) {
            this.postProcess.endRender();
        }

        // Reset shader? Maybe not needed if post-process draws over it anyway
        // p.resetShader();

        // Measure frame time
        const frameTime = performance.now() - frameStartTime;
        this.updatePerformanceMetrics(frameTime);
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
}