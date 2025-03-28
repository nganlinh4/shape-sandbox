// filepath: c:\WORK_win\shape-sandbox\js\modules\post-process.js
/**
 * Post-processing module for visual effects
 * Handles bloom, depth of field, and other effects
 */
class PostProcessSystem {
    /**
     * Create a new post-processing system
     * @param {p5} p - The p5 instance
     */
    constructor(p) {
        this.p = p;
        
        // Main render target (where the ray-marched scene is rendered)
        this.mainBuffer = null;
        
        // Bloom effect buffers
        this.bloomBrightPass = null;
        this.bloomBlurH = null;
        this.bloomBlurV = null;
        
        // Shaders
        this.brightPassShader = null;
        this.blurShader = null;
        this.compositeShader = null;
        
        // Settings
        this.enabled = CONFIG.render.postProcess.enabled;
        this.bloomEnabled = CONFIG.render.postProcess.bloom;
        this.bloomThreshold = CONFIG.render.postProcess.bloomThreshold;
        this.bloomIntensity = CONFIG.render.postProcess.bloomIntensity;
        
        // Initialize if enabled
        if (this.enabled) {
            this.init();
        }
    }
    
    /**
     * Initialize post-processing system
     */
    init() {
        // Create main render buffer (full resolution)
        this.mainBuffer = this.p.createGraphics(
            CONFIG.render.width,
            CONFIG.render.height,
            this.p.WEBGL
        );
        
        // For bloom, we use half resolution to improve performance
        const bloomWidth = Math.floor(CONFIG.render.width / 2);
        const bloomHeight = Math.floor(CONFIG.render.height / 2);
        
        // Create bloom buffers
        this.bloomBrightPass = this.p.createGraphics(bloomWidth, bloomHeight, this.p.WEBGL);
        this.bloomBlurH = this.p.createGraphics(bloomWidth, bloomHeight, this.p.WEBGL);
        this.bloomBlurV = this.p.createGraphics(bloomWidth, bloomHeight, this.p.WEBGL);
        
        // Create shaders
        this.createShaders();
    }
    
    /**
     * Create post-processing shaders
     */
    createShaders() {
        // Bright pass shader (extracts bright pixels for bloom)
        this.brightPassShader = this.p.createShader(
            this.getBrightPassVertexShader(),
            this.getBrightPassFragmentShader()
        );
        
        // Gaussian blur shader (horizontal and vertical passes)
        this.blurShader = this.p.createShader(
            this.getBlurVertexShader(),
            this.getBlurFragmentShader()
        );
        
        // Composite shader (combines main scene with bloom)
        this.compositeShader = this.p.createShader(
            this.getCompositeVertexShader(),
            this.getCompositeFragmentShader()
        );
    }
    
    /**
     * Handle window resize
     */
    handleWindowResize() {
        if (!this.enabled) return;
        
        // Recreate main buffer at new resolution
        this.mainBuffer = this.p.createGraphics(
            CONFIG.render.width,
            CONFIG.render.height,
            this.p.WEBGL
        );
        
        // Recreate bloom buffers at half the new resolution
        const bloomWidth = Math.floor(CONFIG.render.width / 2);
        const bloomHeight = Math.floor(CONFIG.render.height / 2);
        
        this.bloomBrightPass = this.p.createGraphics(bloomWidth, bloomHeight, this.p.WEBGL);
        this.bloomBlurH = this.p.createGraphics(bloomWidth, bloomHeight, this.p.WEBGL);
        this.bloomBlurV = this.p.createGraphics(bloomWidth, bloomHeight, this.p.WEBGL);
    }
    
    /**
     * Begin rendering to the main buffer
     * @returns {p5.Graphics} The buffer to render to
     */
    beginRender() {
        if (!this.enabled) return null;
        
        // Return main buffer for rendering the scene
        this.mainBuffer.clear();
        return this.mainBuffer;
    }
    
    /**
     * Apply post-processing effects and render final result to screen
     */
    endRender() {
        if (!this.enabled) return;
        
        // Apply bloom effect if enabled
        if (this.bloomEnabled) {
            this.applyBloom();
        }
        
        // Render final result to screen
        this.renderToScreen();
    }
    
    /**
     * Apply bloom effect
     */
    applyBloom() {
        // Step 1: Extract bright pixels with the bright pass shader
        this.bloomBrightPass.shader(this.brightPassShader);
        this.brightPassShader.setUniform('uTexture', this.mainBuffer);
        this.brightPassShader.setUniform('uThreshold', this.bloomThreshold);
        this.bloomBrightPass.rect(0, 0, this.bloomBrightPass.width, this.bloomBrightPass.height);
        
        // Step 2: Apply horizontal blur
        this.bloomBlurH.shader(this.blurShader);
        this.blurShader.setUniform('uTexture', this.bloomBrightPass);
        this.blurShader.setUniform('uResolution', [this.bloomBlurH.width, this.bloomBlurH.height]);
        this.blurShader.setUniform('uDirection', [1.0, 0.0]);
        this.bloomBlurH.rect(0, 0, this.bloomBlurH.width, this.bloomBlurH.height);
        
        // Step 3: Apply vertical blur
        this.bloomBlurV.shader(this.blurShader);
        this.blurShader.setUniform('uTexture', this.bloomBlurH);
        this.blurShader.setUniform('uResolution', [this.bloomBlurV.width, this.bloomBlurV.height]);
        this.blurShader.setUniform('uDirection', [0.0, 1.0]);
        this.bloomBlurV.rect(0, 0, this.bloomBlurV.width, this.bloomBlurV.height);
    }
    
    /**
     * Render final result to screen
     */
    renderToScreen() {
        // Combine main scene with bloom using the composite shader
        this.p.shader(this.compositeShader);
        this.compositeShader.setUniform('uMainTexture', this.mainBuffer);
        
        if (this.bloomEnabled) {
            this.compositeShader.setUniform('uBloomTexture', this.bloomBlurV);
            this.compositeShader.setUniform('uBloomIntensity', this.bloomIntensity);
        } else {
            // If bloom is disabled, set intensity to 0
            this.compositeShader.setUniform('uBloomTexture', this.mainBuffer); // Just use any texture
            this.compositeShader.setUniform('uBloomIntensity', 0.0);
        }
        
        this.compositeShader.setUniform('uBloomEnabled', this.bloomEnabled);
        
        // Draw fullscreen quad
        this.p.rect(0, 0, this.p.width, this.p.height);
    }
    
    /**
     * Set bloom parameters
     * @param {boolean} enabled - Whether bloom is enabled
     * @param {number} threshold - Brightness threshold
     * @param {number} intensity - Bloom intensity
     */
    setBloomParams(enabled, threshold, intensity) {
        this.bloomEnabled = enabled;
        this.bloomThreshold = threshold;
        this.bloomIntensity = intensity;
    }
    
    /**
     * Enable or disable post-processing
     * @param {boolean} enabled - Whether post-processing is enabled
     */
    setEnabled(enabled) {
        if (this.enabled === enabled) return;
        
        this.enabled = enabled;
        
        // Initialize if enabling for the first time
        if (enabled && !this.mainBuffer) {
            this.init();
        }
    }
    
    // Shader source code
    
    /**
     * Get vertex shader for bright pass
     * @returns {string} Vertex shader source
     */
    getBrightPassVertexShader() {
        return `
        attribute vec3 aPosition;
        attribute vec2 aTexCoord;
        
        varying vec2 vTexCoord;
        
        void main() {
            vTexCoord = aTexCoord;
            vec4 positionVec4 = vec4(aPosition, 1.0);
            positionVec4.xy = positionVec4.xy * 2.0 - 1.0;
            gl_Position = positionVec4;
        }`;
    }
    
    /**
     * Get fragment shader for bright pass
     * @returns {string} Fragment shader source
     */
    getBrightPassFragmentShader() {
        return `
        precision highp float;
        
        uniform sampler2D uTexture;
        uniform float uThreshold;
        
        varying vec2 vTexCoord;
        
        void main() {
            vec4 color = texture2D(uTexture, vTexCoord);
            
            // Calculate brightness
            float brightness = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
            
            // Threshold filter
            if (brightness > uThreshold) {
                gl_FragColor = color;
            } else {
                gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
            }
        }`;
    }
    
    /**
     * Get vertex shader for Gaussian blur
     * @returns {string} Vertex shader source
     */
    getBlurVertexShader() {
        return `
        attribute vec3 aPosition;
        attribute vec2 aTexCoord;
        
        varying vec2 vTexCoord;
        
        void main() {
            vTexCoord = aTexCoord;
            vec4 positionVec4 = vec4(aPosition, 1.0);
            positionVec4.xy = positionVec4.xy * 2.0 - 1.0;
            gl_Position = positionVec4;
        }`;
    }
    
    /**
     * Get fragment shader for Gaussian blur
     * @returns {string} Fragment shader source
     */
    getBlurFragmentShader() {
        return `
        precision highp float;
        
        uniform sampler2D uTexture;
        uniform vec2 uResolution;
        uniform vec2 uDirection;
        
        varying vec2 vTexCoord;
        
        // Gaussian blur - 9 samples per pass
        void main() {
            vec2 texelSize = 1.0 / uResolution;
            float strength = 2.0; // Blur strength
            
            vec3 result = vec3(0.0);
            vec2 hlim = vec2(float(-4) * strength, float(4) * strength);
            
            // Gaussian weights (approximated)
            float weights[9];
            weights[0] = 0.051;
            weights[1] = 0.076;
            weights[2] = 0.126;
            weights[3] = 0.154;
            weights[4] = 0.186;
            weights[5] = 0.154;
            weights[6] = 0.126;
            weights[7] = 0.076;
            weights[8] = 0.051;
            
            // Blur direction (horizontal or vertical)
            for (int i = 0; i < 9; i++) {
                float offset = float(i - 4) * strength;
                vec2 sampleCoord = vTexCoord + texelSize * offset * uDirection;
                result += texture2D(uTexture, sampleCoord).rgb * weights[i];
            }
            
            gl_FragColor = vec4(result, 1.0);
        }`;
    }
    
    /**
     * Get vertex shader for composite
     * @returns {string} Vertex shader source
     */
    getCompositeVertexShader() {
        return `
        attribute vec3 aPosition;
        attribute vec2 aTexCoord;
        
        varying vec2 vTexCoord;
        
        void main() {
            vTexCoord = aTexCoord;
            vec4 positionVec4 = vec4(aPosition, 1.0);
            positionVec4.xy = positionVec4.xy * 2.0 - 1.0;
            gl_Position = positionVec4;
        }`;
    }
    
    /**
     * Get fragment shader for composite
     * @returns {string} Fragment shader source
     */
    getCompositeFragmentShader() {
        return `
        precision highp float;
        
        uniform sampler2D uMainTexture;
        uniform sampler2D uBloomTexture;
        uniform float uBloomIntensity;
        uniform bool uBloomEnabled;
        
        varying vec2 vTexCoord;
        
        void main() {
            // Original scene color
            vec4 mainColor = texture2D(uMainTexture, vTexCoord);
            
            // Add bloom if enabled
            if (uBloomEnabled) {
                vec4 bloomColor = texture2D(uBloomTexture, vTexCoord);
                mainColor.rgb += bloomColor.rgb * uBloomIntensity;
            }
            
            gl_FragColor = mainColor;
        }`;
    }
}