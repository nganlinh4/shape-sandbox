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
        
        // Create environment map (placeholder - actual cubemap would be loaded from images)
        this.createEnvironmentMap();
        
        // Initialize post-processing system
        this.postProcess = new PostProcessSystem(this.p);
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
        
        // Create material data texture (4 rows per material)
        this.materialDataTexture = new DataTexture(
            this.p._renderer,
            4, // 4 pixels per material: [albedo+metallic, roughness+emissiveFactor+ior+flags, emissive+reserved, textureIndex+reserved]
            32 // Support up to 32 materials
        );
    }
    
    /**
     * Create a more sophisticated environment map for reflections and IBL
     */
    createEnvironmentMap() {
        const p = this.p;
        const size = 256; // Increased size for better quality
        
        // Create cubemap texture for environment mapping
        this.environmentMap = {
            // Create 6 faces of the cube map with better quality
            faces: Array(6).fill().map(() => p.createGraphics(size, size, p.WEBGL))
        };
        
        // Generate a richer environment with gradients, "sky", and "ground"
        this.generateEnvironmentMapFaces();
        
        // Create the actual texture
        this.environmentTexture = {
            _renderer: p._renderer,
            _tex: this.createCubemapTexture(this.environmentMap.faces),
            isCube: true
        };
    }
    
    /**
     * Generate the six faces of the environment cubemap
     */
    generateEnvironmentMapFaces() {
        // Generate a richer environment with sky, ground, and directional lighting
        const faces = this.environmentMap.faces;
        
        // Define colors for the environment
        const skyColors = {
            top: [0.4, 0.65, 1.0],      // Sky blue
            horizon: [0.8, 0.9, 1.0],    // Horizon light blue
            ground: [0.3, 0.25, 0.2],    // Ground/earth brown
            sunDirection: [-0.5, 0.5, -0.7], // Direction of the sun (should match main light)
            sunColor: [1.0, 0.9, 0.7],   // Warm sun color
            sunIntensity: 2.0,           // Sun brightness
            sunSize: 0.03                // Angular size of the sun
        };
        
        // Helper function to normalize a vector
        const normalize = (v) => {
            const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
            return [v[0]/len, v[1]/len, v[2]/len];
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
            const sunAngle = dot(dir, normalize(skyColors.sunDirection));
            const sunFactor = Math.max(0, Math.pow(sunAngle, 1/skyColors.sunSize) - (1 - skyColors.sunSize*10));
            
            if (sunFactor > 0) {
                color = add(color, scale(skyColors.sunColor, sunFactor * skyColors.sunIntensity));
            }
            
            return color;
        };
        
        // Draw each face
        faces.forEach((face, i) => {
            face.noStroke();
            
            // Draw the environment map with high-quality gradients
            face.loadPixels();
            const d = face.pixelDensity();
            const faceSize = face.width * d;
            
            for (let x = 0; x < faceSize; x++) {
                for (let y = 0; y < faceSize; y++) {
                    // Convert pixel coordinates to UV [0,1]
                    const u = x / faceSize;
                    const v = y / faceSize;
                    
                    // Convert UV to direction vector based on cube face
                    const dir = faceDirToVector(i, u, v);
                    
                    // Get color for this direction
                    const color = getEnvironmentColor(dir);
                    
                    // Set pixel color
                    const idx = 4 * (y * faceSize + x);
                    face.pixels[idx] = color[0] * 255;
                    face.pixels[idx+1] = color[1] * 255;
                    face.pixels[idx+2] = color[2] * 255;
                    face.pixels[idx+3] = 255;
                }
            }
            
            face.updatePixels();
        });
    }
    
    /**
     * Create a WebGL cubemap texture from six p5.Graphics objects
     * @param {Array<p5.Graphics>} faces - Array of 6 p5.Graphics for each cube face
     * @returns {WebGLTexture} The created cubemap texture
     */
    createCubemapTexture(faces) {
        // Get WebGL context
        const gl = this.p._renderer.GL;
        
        // Create texture
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
        
        // Set texture parameters
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
        
        // Upload each face
        const targets = [
            gl.TEXTURE_CUBE_MAP_POSITIVE_X,
            gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
            gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
            gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
            gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
            gl.TEXTURE_CUBE_MAP_NEGATIVE_Z
        ];
        
        faces.forEach((face, i) => {
            const target = targets[i];
            gl.texImage2D(
                target, 0, gl.RGBA, 
                face.width, face.height, 0,
                gl.RGBA, gl.UNSIGNED_BYTE, face.canvas
            );
        });
        
        // Generate mipmaps
        gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
        
        return texture;
    }
    
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
        // This requires accessing some internal properties of p5's renderer
        // In a real implementation, we might want to handle camera ourselves
        const renderer = this.p._renderer;
        
        // Get view matrix (camera transformation)
        this.viewMatrix = renderer.uViewMatrix.copy();
        
        // Get projection matrix
        this.projectionMatrix = renderer.uProjMatrix.copy();
        
        // Get camera position
        if (CONFIG.camera.orbitControl) {
            // When using orbitControl, we need to extract camera position from view matrix
            // This is an approximate position extraction from the view matrix
            const viewInv = this.viewMatrix.copy().invert();
            this.cameraPos = this.p.createVector(
                viewInv.mat4[12],
                viewInv.mat4[13],
                viewInv.mat4[14]
            );
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
            p.shader(this.shader);
        }
        
        // Set camera uniforms
        this.shader.setUniform('uCameraPosition', [this.cameraPos.x, this.cameraPos.y, this.cameraPos.z]);
        this.shader.setUniform('uViewMatrix', this.viewMatrix.mat4);
        this.shader.setUniform('uProjectionMatrix', this.projectionMatrix.mat4);
        this.shader.setUniform('uFov', CONFIG.camera.fov);
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
        this.shader.setUniform('uEnvMapEnabled', true);
        this.shader.setUniform('uEnvMapIntensity', CONFIG.render.envMapIntensity);
        
        // Set time for animations
        this.shader.setUniform('uTime', p.millis() / 1000.0);
        
        // Bind data textures
        this.shapeDataTexture.bind('uShapeData', 0, this.shader);
        this.materialDataTexture.bind('uMaterialData', 1, this.shader);
        
        // Bind environment map
        if (this.environmentTexture) {
            // Need to set the environment map as a uniform
            // p5.js doesn't have built-in support for cubemaps, so we handle it differently
            const gl = p._renderer.GL;
            const uniformLocation = gl.getUniformLocation(this.shader._glProgram, 'uEnvironmentMap');
            
            // Activate texture unit 2 for environment map
            gl.activeTexture(gl.TEXTURE2);
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.environmentTexture._tex);
            gl.uniform1i(uniformLocation, 2);
        }
        
        // Draw a full-screen quad to trigger the fragment shader
        if (renderTarget) {
            renderTarget.rect(0, 0, renderTarget.width, renderTarget.height);
            renderTarget.pop();
        } else {
            p.rect(0, 0, p.width, p.height);
        }
        
        // Apply post-processing if enabled
        if (usePostProcess) {
            this.postProcess.endRender();
        }
        
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
    }
    
    /**
     * Update performance metrics
     * @param {number} frameTime - Time taken to render this frame (ms)
     */
    updatePerformanceMetrics(frameTime) {
        // Exponential moving average for frame time
        const alpha = 0.05; // Smoothing factor
        this.frameTimeAvg = this.frameTimeAvg * (1 - alpha) + frameTime * alpha;
        
        // Update FPS calculation every 500ms
        const now = performance.now();
        if (now - this.lastFrameTime > CONFIG.ui.fps.updateInterval) {
            this.fps = Math.round(1000 / this.frameTimeAvg);
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
}