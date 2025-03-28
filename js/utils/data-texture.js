/**
 * DataTexture class manages packed data textures for efficient data transfer to shaders
 * Used to store shape properties (position, rotation, size, etc.) and material properties
 */

class DataTexture {
    /**
     * Create a new data texture
     * @param {p5.Graphics} graphics - The WebGL canvas/graphics to create the texture on
     * @param {number} width - Texture width in pixels
     * @param {number} height - Texture height in pixels
     */
    constructor(graphics, width, height) {
        this.graphics = graphics;
        this.width = width;
        this.height = height;
        this.pixels = new Float32Array(width * height * 4); // RGBA components
        this.texture = null;
        this.isDirty = true;
        
        this.createTexture();
    }
    
    /**
     * Create the WebGL texture
     * @private
     */
    createTexture() {
        // Get the underlying WebGL context from p5
        const gl = this.graphics._renderer.GL;
        
        // Create the texture
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        
        // Set parameters for the texture
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        
        // Allocate texture with empty data
        gl.texImage2D(
            gl.TEXTURE_2D,          // Target
            0,                      // Level
            gl.RGBA32F,             // Internal format (high precision floats)
            this.width,             // Width
            this.height,            // Height
            0,                      // Border
            gl.RGBA,                // Format
            gl.FLOAT,               // Type
            this.pixels             // Data
        );
        
        gl.bindTexture(gl.TEXTURE_2D, null); // Unbind
    }
    
    /**
     * Set data value at specific pixel coordinates
     * @param {number} x - X coordinate in texture
     * @param {number} y - Y coordinate in texture
     * @param {array} value - Array of 4 values to store [r, g, b, a]
     */
    setPixel(x, y, value) {
        const index = (y * this.width + x) * 4;
        this.pixels[index] = value[0];
        this.pixels[index + 1] = value[1];
        this.pixels[index + 2] = value[2];
        this.pixels[index + 3] = value[3];
        this.isDirty = true;
    }
    
    /**
     * Get data values at specific pixel coordinates
     * @param {number} x - X coordinate in texture
     * @param {number} y - Y coordinate in texture
     * @returns {array} Array of 4 values [r, g, b, a]
     */
    getPixel(x, y) {
        const index = (y * this.width + x) * 4;
        return [
            this.pixels[index],
            this.pixels[index + 1],
            this.pixels[index + 2],
            this.pixels[index + 3]
        ];
    }
    
    /**
     * Update the GPU texture with the current pixel data
     * Only uploads if the texture is marked as dirty
     */
    update() {
        if (!this.isDirty) return;
        
        const gl = this.graphics._renderer.GL;
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texSubImage2D(
            gl.TEXTURE_2D,   // Target
            0,               // Level
            0,               // X offset
            0,               // Y offset
            this.width,      // Width
            this.height,     // Height
            gl.RGBA,         // Format
            gl.FLOAT,        // Type
            this.pixels      // Data
        );
        gl.bindTexture(gl.TEXTURE_2D, null); // Unbind
        
        this.isDirty = false;
    }
    
    /**
     * Pack shape data into the texture
     * @param {array} shapes - Array of shape objects to pack
     */
    packShapeData(shapes) {
        shapes.forEach((shape, index) => {
            // Pack position into first pixel (xyz -> rgb)
            const position = MathUtils.vecToArray(shape.position);
            this.setPixel(0, index, [...position, shape.id]);
            
            // Pack quaternion into second pixel (xyzw -> rgba)
            this.setPixel(1, index, shape.orientation);
            
            // Pack size, type and material ID into third pixel
            // Size (xyz) into RGB, type index into A
            const size = Array.isArray(shape.size) ? shape.size : [shape.size, shape.size, shape.size];
            this.setPixel(2, index, [...size, shape.type]);
            
            // Additional properties in the fourth pixel
            // materialId, reserved, reserved, reserved 
            this.setPixel(3, index, [shape.materialId, 0.0, 0.0, 0.0]);
        });
    }
    
    /**
     * Pack material data into the texture
     * @param {array} materials - Array of material objects to pack
     */
    packMaterialData(materials) {
        materials.forEach((material, index) => {
            // Pack albedo color (rgb) and metallic (a)
            this.setPixel(0, index, [...material.albedo, material.metallic]);
            
            // Pack roughness, emissive factor, ior, flags
            this.setPixel(1, index, [
                material.roughness,
                material.emissiveFactor || 0.0,
                material.ior || 1.45,
                material.flags || 0.0  // Bit-packed flags (transparent, etc.)
            ]);
            
            // Pack emissive color (rgb) and reserved value 
            this.setPixel(2, index, [...material.emissive, 0.0]);
            
            // Additional properties (texture indices, etc.)
            this.setPixel(3, index, [
                material.textureIndex || -1.0, // -1 means no texture
                0.0,
                0.0,
                0.0
            ]);
        });
    }
    
    /**
     * Bind this texture to a specific texture unit for use in a shader
     * @param {string} uniformName - Name of the uniform sampler2D in the shader
     * @param {number} textureUnit - Texture unit to bind to (0, 1, 2, etc.)
     * @param {p5.Shader} shader - The p5.Shader to set the uniform on
     */
    bind(uniformName, textureUnit, shader) {
        this.update(); // Ensure texture is up to date
        
        // p5 will handle binding the texture to the appropriate unit
        shader.setUniform(uniformName, {
            _renderer: this.graphics._renderer,
            _tex: this.texture,
            _glTex: this.texture
        });
    }
}