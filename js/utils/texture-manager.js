/**
 * TextureManager class handles loading, caching, and binding of textures
 * Used for material textures (diffuse, normal, roughness, metallic)
 */
class TextureManager {
    /**
     * Create a new texture manager
     * @param {p5} p - The p5 instance
     */
    constructor(p) {
        this.p = p;
        this.textures = [];
        this.loadingPromises = {};
        this.textureArrayBuffer = null;
        
        // Set up default fallback textures
        this.defaultTextures = {
            white: this.createSolidTexture(255, 255, 255),
            black: this.createSolidTexture(0, 0, 0),
            normal: this.createNormalMapDefault(),
            roughness: this.createSolidTexture(127, 127, 127),
            metallic: this.createSolidTexture(0, 0, 0)
        };
        
        // Add default textures to the manager
        this.textures.push(this.defaultTextures.white);
        this.textures.push(this.defaultTextures.black);
        this.textures.push(this.defaultTextures.normal);
        this.textures.push(this.defaultTextures.roughness);
        this.textures.push(this.defaultTextures.metallic);
    }
    
    /**
     * Create a solid color texture
     * @param {number} r - Red component (0-255)
     * @param {number} g - Green component (0-255)
     * @param {number} b - Blue component (0-255)
     * @returns {p5.Image} The created texture
     */
    createSolidTexture(r, g, b) {
        const size = 4; // Small texture for efficiency
        const img = this.p.createImage(size, size);
        img.loadPixels();
        
        for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
                img.set(x, y, this.p.color(r, g, b));
            }
        }
        
        img.updatePixels();
        return img;
    }
    
    /**
     * Create a default normal map (facing forward/Z direction)
     * @returns {p5.Image} The created normal map
     */
    createNormalMapDefault() {
        const size = 4;
        const img = this.p.createImage(size, size);
        img.loadPixels();
        
        // Normal map color for Z direction (RGB: 128, 128, 255)
        for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
                img.set(x, y, this.p.color(128, 128, 255));
            }
        }
        
        img.updatePixels();
        return img;
    }
    
    /**
     * Load a texture from file
     * @param {string} path - Path to the texture file
     * @returns {Promise<number>} Promise that resolves to the texture index
     */
    loadTexture(path) {
        // Return existing promise if already loading this texture
        if (this.loadingPromises[path]) {
            return this.loadingPromises[path];
        }
        
        // Check if this texture is already loaded
        const existingIndex = this.textures.findIndex(tex => tex.path === path);
        if (existingIndex >= 0) {
            return Promise.resolve(existingIndex);
        }
        
        // Create a new promise for loading this texture
        const promise = new Promise((resolve, reject) => {
            this.p.loadImage(
                path,
                (img) => {
                    // Store path for future reference/deduplication
                    img.path = path;
                    
                    // Add texture to texture array
                    const index = this.textures.length;
                    this.textures.push(img);
                    
                    // Log success
                    console.log(`Loaded texture: ${path} (index: ${index})`);
                    
                    // Resolve with the texture index
                    resolve(index);
                },
                () => {
                    console.warn(`Failed to load texture: ${path}, using fallback`);
                    
                    // Determine fallback texture type based on file extension
                    let fallbackIndex = 0; // white texture as default fallback
                    
                    const ext = path.toLowerCase().split('.').pop();
                    const filename = path.toLowerCase().split('/').pop();
                    
                    if (filename.includes('normal') || ext === 'norm') {
                        fallbackIndex = 2; // normal map
                    } else if (filename.includes('rough') || filename.includes('gloss')) {
                        fallbackIndex = 3; // roughness map
                    } else if (filename.includes('metal') || filename.includes('spec')) {
                        fallbackIndex = 4; // metallic map
                    } else if (filename.includes('black')) {
                        fallbackIndex = 1; // black texture
                    }
                    
                    // Resolve with the fallback texture index
                    resolve(fallbackIndex);
                }
            );
        });
        
        // Store the promise and return it
        this.loadingPromises[path] = promise;
        return promise;
    }
    
    /**
     * Load multiple textures at once
     * @param {Array<string>} paths - Array of texture file paths
     * @returns {Promise<Array<number>>} Promise that resolves to array of texture indices
     */
    loadTextures(paths) {
        const promises = paths.map(path => this.loadTexture(path));
        return Promise.all(promises);
    }
    
    /**
     * Get a texture by index
     * @param {number} index - Index of the texture to get
     * @returns {p5.Image|null} The requested texture or null if not found
     */
    getTexture(index) {
        if (index >= 0 && index < this.textures.length) {
            return this.textures[index];
        }
        return this.defaultTextures.white; // Return default if index is invalid
    }
    
    /**
     * Bind all textures to shader uniform sampler array
     * @param {p5.Shader} shader - The shader to bind textures to
     * @param {number} startUnit - Starting texture unit (usually 3, after shape/material/env data)
     */
    bindTextures(shader, startUnit = 3) {
        if (!shader || this.textures.length === 0) return;
        
        const p = this.p;
        const gl = p._renderer.GL;
        
        // Create texture handles array if needed
        const textureCount = Math.min(16, this.textures.length); // WebGL typically supports 16-32 texture units
        
        // Set texture count uniform
        shader.setUniform('uTextureCount', textureCount);
        
        // Set up uniform sampler array
        const textureHandles = [];
        
        // Bind each texture to a texture unit
        for (let i = 0; i < textureCount; i++) {
            const textureUnit = startUnit + i;
            const glTextureUnit = gl[`TEXTURE${textureUnit}`]; // e.g., gl.TEXTURE3, gl.TEXTURE4, etc.
            const texture = this.textures[i];
            
            // Activate texture unit
            gl.activeTexture(glTextureUnit);
            
            // Bind the texture
            if (texture && texture.width > 0) {
                gl.bindTexture(gl.TEXTURE_2D, texture.getTexture());
            } else {
                // Fallback to white texture if issue with this texture
                gl.bindTexture(gl.TEXTURE_2D, this.defaultTextures.white.getTexture());
            }
            
            // Add the texture unit number to the array
            textureHandles.push(textureUnit);
        }
        
        // Set the texture handles array uniform
        shader.setUniform('uTextureSamplers', textureHandles);
    }
    
    /**
     * Generate a procedural texture
     * @param {string} type - Type of procedural texture ('checker', 'grid', 'noise', etc.)
     * @param {number} size - Size of the texture (power of 2 recommended)
     * @param {Object} options - Options for texture generation
     * @returns {number} Index of the generated texture
     */
    generateProceduralTexture(type, size = 256, options = {}) {
        const p = this.p;
        const img = p.createImage(size, size);
        img.loadPixels();
        
        // Default options with overrides
        const opts = {
            color1: options.color1 || [255, 255, 255],
            color2: options.color2 || [0, 0, 0],
            scale: options.scale || 16,
            ...options
        };
        
        // Generate based on type
        switch (type.toLowerCase()) {
            case 'checker':
                this.generateCheckerTexture(img, opts);
                break;
            case 'grid':
                this.generateGridTexture(img, opts);
                break;
            case 'noise':
                this.generateNoiseTexture(img, opts);
                break;
            default:
                this.generateCheckerTexture(img, opts);
        }
        
        img.updatePixels();
        
        // Add to texture array
        const index = this.textures.length;
        this.textures.push(img);
        
        return index;
    }
    
    /**
     * Generate a checker pattern texture
     * @param {p5.Image} img - Image to draw to
     * @param {Object} options - Pattern options
     * @private
     */
    generateCheckerTexture(img, options) {
        const size = img.width;
        const scale = options.scale;
        const color1 = options.color1;
        const color2 = options.color2;
        
        for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
                const xCell = Math.floor(x / scale);
                const yCell = Math.floor(y / scale);
                const isColor1 = (xCell + yCell) % 2 === 0;
                const color = isColor1 ? color1 : color2;
                
                img.set(x, y, this.p.color(...color));
            }
        }
    }
    
    /**
     * Generate a grid pattern texture
     * @param {p5.Image} img - Image to draw to
     * @param {Object} options - Pattern options
     * @private
     */
    generateGridTexture(img, options) {
        const size = img.width;
        const scale = options.scale;
        const color1 = options.color1;
        const color2 = options.color2;
        const lineWidth = options.lineWidth || 1;
        
        for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
                const xMod = x % scale;
                const yMod = y % scale;
                const isLine = xMod < lineWidth || yMod < lineWidth;
                const color = isLine ? color2 : color1;
                
                img.set(x, y, this.p.color(...color));
            }
        }
    }
    
    /**
     * Generate a noise texture
     * @param {p5.Image} img - Image to draw to
     * @param {Object} options - Pattern options
     * @private
     */
    generateNoiseTexture(img, options) {
        const size = img.width;
        const noiseScale = options.noiseScale || 0.01;
        const noiseOffset = options.noiseOffset || 0;
        
        this.p.noiseSeed(options.seed || Math.random() * 10000);
        
        for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
                const noiseVal = this.p.noise(
                    x * noiseScale + noiseOffset, 
                    y * noiseScale + noiseOffset
                );
                
                const val = Math.floor(noiseVal * 255);
                img.set(x, y, this.p.color(val, val, val));
            }
        }
    }
}