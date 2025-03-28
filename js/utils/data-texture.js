/**
 * DataTexture handles packing scene data into textures for efficient transfer to shaders
 * Used to pass shape, material, and texture mapping data to the GPU
 */
class DataTexture {
    /**
     * Create a new data texture manager
     * @param {p5} p - The p5 instance
     */
    constructor(p) {
        this.p = p;
        
        // Create textures for different data types
        this.materialTexture = null;
        this.shapeTexture = null;
        
        // Maximum counts (power of 2 recommended)
        this.maxMaterials = 64;
        this.maxShapes = 64;
    }
    
    /**
     * Initialize data textures
     */
    init() {
        const p = this.p;
        const gl = p._renderer.GL;
        
        // Create material data texture
        this.materialTexture = p.createImage(8, this.maxMaterials);
        
        // Create shape data texture
        this.shapeTexture = p.createImage(8, this.maxShapes);
        
        // Set filtering mode to NEAREST for precise data retrieval
        this.materialTexture.setParameters = function(tex, renderer) {
            renderer.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            renderer.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        };
        
        this.shapeTexture.setParameters = function(tex, renderer) {
            renderer.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            renderer.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        };
    }
    
    /**
     * Update material data texture from material library
     * @param {Array<Material>} materials - Array of materials
     */
    updateMaterialTexture(materials) {
        if (!this.materialTexture) this.init();
        
        const maxMaterials = Math.min(materials.length, this.maxMaterials);
        this.materialTexture.loadPixels();
        
        // Pack material data into texture
        for (let i = 0; i < maxMaterials; i++) {
            const material = materials[i];
            
            if (!material) continue;
            
            // Pixel 0: albedo (RGB) + flags (A) 
            this.setRGBAPixel(this.materialTexture, 0, i, 
                material.albedo[0] * 255,
                material.albedo[1] * 255,
                material.albedo[2] * 255,
                this.encodeMaterialFlags(material.flags)
            );
            
            // Pixel 1: roughness (R), metallic (G), ior (B), emissiveFactor (A)
            this.setRGBAPixel(this.materialTexture, 1, i,
                material.roughness * 255,
                material.metallic * 255,
                (material.ior - 1.0) * 255, // Map IOR range [1.0-2.0] to [0-255]
                material.emissiveFactor * 63.75 // Map [0-4.0] to [0-255]
            );
            
            // Pixel 2: emissive color (RGB) + unused (A)
            this.setRGBAPixel(this.materialTexture, 2, i,
                material.emissive[0] * 255,
                material.emissive[1] * 255,
                material.emissive[2] * 255,
                0 // Reserved for future use
            );
            
            // Pixel 3: diffuse texture (R), normal texture (G), 
            // roughness texture (B), metallic texture (A)
            this.setRGBAPixel(this.materialTexture, 3, i,
                material.textures.diffuse > 0 ? material.textures.diffuse : 255, 
                material.textures.normal > 0 ? material.textures.normal : 255,
                material.textures.roughness > 0 ? material.textures.roughness : 255,
                material.textures.metallic > 0 ? material.textures.metallic : 255
            );
            
            // Pixel 4: texture scale (RG) + offset (BA)
            this.setRGBAPixel(this.materialTexture, 4, i,
                this.encodeFloat(material.textureScale[0], 0, 10), // Map [0-10] range to [0-255]
                this.encodeFloat(material.textureScale[1], 0, 10),
                this.encodeFloat(material.textureOffset[0], -1, 1), // Map [-1,1] range to [0-255]
                this.encodeFloat(material.textureOffset[1], -1, 1)
            );
            
            // Pixel 5: texture rotation (R) + reserved (GBA)
            this.setRGBAPixel(this.materialTexture, 5, i,
                this.encodeFloat(material.textureRotation, 0, Math.PI * 2), // Map [0-2π] to [0-255]
                0, // Reserved
                0, // Reserved
                0  // Reserved
            );
            
            // Pixels 6-7: Reserved for future use (e.g., additional texture properties)
            this.setRGBAPixel(this.materialTexture, 6, i, 0, 0, 0, 0);
            this.setRGBAPixel(this.materialTexture, 7, i, 0, 0, 0, 0);
        }
        
        this.materialTexture.updatePixels();
    }
    
    /**
     * Update shape data texture from shape array
     * @param {Array<Shape>} shapes - Array of shapes
     */
    updateShapeTexture(shapes) {
        if (!this.shapeTexture) this.init();
        
        const maxShapes = Math.min(shapes.length, this.maxShapes);
        this.shapeTexture.loadPixels();
        
        // Pack shape data into texture
        for (let i = 0; i < maxShapes; i++) {
            const shape = shapes[i];
            
            if (!shape || !shape.isActive) {
                // For inactive shapes, set type to 0 (NONE)
                this.setRGBAPixel(this.shapeTexture, 0, i, 0, 0, 0, 0);
                continue;
            }
            
            // Pixel 0: position (XYZ) + shape type (A)
            this.setRGBAPixel(this.shapeTexture, 0, i,
                this.encodeFloat(shape.position.x, -50, 50),
                this.encodeFloat(shape.position.y, -50, 50),
                this.encodeFloat(shape.position.z, -50, 50),
                shape.type // Shape type enum
            );
            
            // Pixel 1: rotation quaternion (XYZW)
            this.setRGBAPixel(this.shapeTexture, 1, i,
                this.encodeFloat(shape.quaternion.x, -1, 1),
                this.encodeFloat(shape.quaternion.y, -1, 1),
                this.encodeFloat(shape.quaternion.z, -1, 1),
                this.encodeFloat(shape.quaternion.w, -1, 1)
            );
            
            // Pixel 2: scale (XYZ) + material ID (A)
            this.setRGBAPixel(this.shapeTexture, 2, i,
                this.encodeFloat(shape.scale.x, 0, 20),
                this.encodeFloat(shape.scale.y, 0, 20),
                this.encodeFloat(shape.scale.z, 0, 20),
                shape.materialId
            );
            
            // Pixel 3: blend factor (R) + blend shape ID (G) + shape flags (BA)
            this.setRGBAPixel(this.shapeTexture, 3, i,
                shape.blendFactor * 255,
                shape.blendShapeId || 0,
                this.encodeShapeFlags(shape.flags),
                0 // Reserved
            );
            
            // Pixel 4-7: Reserved for shape-specific parameters
            // Different shape types can use these differently
            
            // For example, SDF parameters for specific shape types
            if (shape.parameters) {
                // Box roundness, cone tapering, etc.
                this.setRGBAPixel(this.shapeTexture, 4, i,
                    shape.parameters.param1 ? shape.parameters.param1 * 255 : 0,
                    shape.parameters.param2 ? shape.parameters.param2 * 255 : 0,
                    shape.parameters.param3 ? shape.parameters.param3 * 255 : 0,
                    shape.parameters.param4 ? shape.parameters.param4 * 255 : 0
                );
            } else {
                this.setRGBAPixel(this.shapeTexture, 4, i, 0, 0, 0, 0);
            }
            
            // Pixels 5-7: Reserved for future use
            this.setRGBAPixel(this.shapeTexture, 5, i, 0, 0, 0, 0);
            this.setRGBAPixel(this.shapeTexture, 6, i, 0, 0, 0, 0);
            this.setRGBAPixel(this.shapeTexture, 7, i, 0, 0, 0, 0);
        }
        
        this.shapeTexture.updatePixels();
    }
    
    /**
     * Set pixel RGBA values in data texture
     * @param {p5.Image} texture - The data texture to modify
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} r - Red component [0-255]
     * @param {number} g - Green component [0-255]
     * @param {number} b - Blue component [0-255]
     * @param {number} a - Alpha component [0-255]
     */
    setRGBAPixel(texture, x, y, r, g, b, a) {
        const index = 4 * (y * texture.width + x);
        texture.pixels[index] = r;
        texture.pixels[index + 1] = g;
        texture.pixels[index + 2] = b;
        texture.pixels[index + 3] = a;
    }
    
    /**
     * Encode a float value to the [0-255] range
     * @param {number} value - Value to encode
     * @param {number} min - Minimum possible value
     * @param {number} max - Maximum possible value
     * @returns {number} Encoded value in [0-255] range
     */
    encodeFloat(value, min, max) {
        // Clamp to range
        value = Math.max(min, Math.min(max, value));
        
        // Map to [0-1] range
        const normalized = (value - min) / (max - min);
        
        // Map to [0-255] range
        return Math.floor(normalized * 255);
    }
    
    /**
     * Encode material flags into a single byte
     * @param {Object} flags - Material flag object
     * @returns {number} Encoded flags byte
     */
    encodeMaterialFlags(flags) {
        let result = 0;
        if (flags.isTransparent) result |= 1;     // Bit 0
        if (flags.isRefractive) result |= 2;      // Bit 1
        if (flags.invertRoughness) result |= 4;   // Bit 2
        if (flags.useNormalMap) result |= 8;      // Bit 3
        if (flags.useVertexColors) result |= 16;  // Bit 4
        if (flags.useDiffuseMap) result |= 32;    // Bit 5
        if (flags.useMetallicMap) result |= 64;   // Bit 6
        if (flags.useEmissiveMap) result |= 128;  // Bit 7
        return result;
    }
    
    /**
     * Encode shape flags into a single byte
     * @param {Object} flags - Shape flag object
     * @returns {number} Encoded flags byte
     */
    encodeShapeFlags(flags) {
        if (!flags) return 0;
        
        let result = 0;
        if (flags.inverted) result |= 1;        // Bit 0: SDF inversion
        if (flags.useSmoothing) result |= 2;    // Bit 1: Soft/smooth SDF blend
        if (flags.infiniteRepeat) result |= 4;  // Bit 2: Infinite repetition
        if (flags.wireframe) result |= 8;       // Bit 3: Wireframe rendering
        if (flags.castsShadow) result |= 16;    // Bit 4: Casts shadows
        if (flags.receivesShadow) result |= 32; // Bit 5: Receives shadows
        return result;
    }
    
    /**
     * Bind data textures to shader uniforms
     * @param {p5.Shader} shader - The shader to bind textures to
     */
    bind(shader) {
        if (!shader || !this.materialTexture || !this.shapeTexture) return;
        
        // Bind shape data texture to texture unit 0
        shader.setUniform('uShapeData', this.shapeTexture);
        
        // Bind material data texture to texture unit 1
        shader.setUniform('uMaterialData', this.materialTexture);
        
        // Set count uniforms
        shader.setUniform('uShapeCount', this.maxShapes);
        shader.setUniform('uMaterialCount', this.maxMaterials);
    }
}