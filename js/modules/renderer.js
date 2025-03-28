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
     * Create a simple procedural environment map
     */
    createEnvironmentMap() {
        // In a full implementation, we'd load cubemap images
        // For now, we'll just create a placeholder
        this.environmentMap = null;
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
        
        // Set shader and uniforms
        p.shader(this.shader);
        
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
        
        // Set time for animations
        this.shader.setUniform('uTime', p.millis() / 1000.0);
        
        // Bind data textures
        this.shapeDataTexture.bind('uShapeData', 0, this.shader);
        this.materialDataTexture.bind('uMaterialData', 1, this.shader);
        
        // Draw a full-screen quad to trigger the fragment shader
        p.rect(0, 0, p.width, p.height);
        
        // Measure frame time
        const frameTime = performance.now() - frameStartTime;
        this.updatePerformanceMetrics(frameTime);
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
}