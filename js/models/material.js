/**
 * Material class represents surface properties for rendering
 * Defines how light interacts with a surface
 */
class Material {
    /**
     * Create a new material
     * @param {Object} properties - Material properties
     * @param {Array<number>} properties.albedo - Base color [r,g,b] in range [0-1]
     * @param {number} properties.metallic - Metalness factor [0-1]
     * @param {number} properties.roughness - Surface roughness [0-1]
     * @param {Array<number>} properties.emissive - Emissive color [r,g,b] in range [0-1]
     * @param {number} properties.emissiveFactor - Emissive intensity multiplier
     * @param {number} properties.ior - Index of refraction (1.0=no refraction, 1.45=glass)
     * @param {Object} properties.flags - Boolean material flags
     */
    constructor(properties = {}) {
        // Generate unique ID for this material
        this.id = properties.id || Material.nextId++;
        
        // Basic PBR properties
        this.albedo = properties.albedo || [1.0, 1.0, 1.0];
        this.metallic = typeof properties.metallic === 'number' ? properties.metallic : 0.0;
        this.roughness = typeof properties.roughness === 'number' ? properties.roughness : 0.5;
        
        // Additional properties
        this.emissive = properties.emissive || [0.0, 0.0, 0.0];
        this.emissiveFactor = typeof properties.emissiveFactor === 'number' ? properties.emissiveFactor : 0.0;
        this.ior = typeof properties.ior === 'number' ? properties.ior : 1.0; // Index of refraction
        
        // Material flags (bitfield encoded in shader)
        this.flags = {
            isTransparent: !!properties.flags?.isTransparent || false,
            isRefractive: !!properties.flags?.isRefractive || false,
            invertRoughness: !!properties.flags?.invertRoughness || false,
            ...properties.flags
        };
        
        // Texture mapping properties
        this.textures = {
            diffuse: typeof properties.textures?.diffuse === 'number' ? properties.textures.diffuse : -1,
            normal: typeof properties.textures?.normal === 'number' ? properties.textures.normal : -1,
            roughness: typeof properties.textures?.roughness === 'number' ? properties.textures.roughness : -1,
            metallic: typeof properties.textures?.metallic === 'number' ? properties.textures.metallic : -1
        };
        
        // Texture mapping settings
        this.textureScale = properties.textureScale || [1.0, 1.0];
        this.textureOffset = properties.textureOffset || [0.0, 0.0];
        this.textureRotation = typeof properties.textureRotation === 'number' ? properties.textureRotation : 0.0; // In radians
        
        // User-friendly display name
        this.name = properties.name || `Material_${this.id}`;
    }
    
    /**
     * Set a texture for this material
     * @param {number} textureIndex - Index of texture in TextureManager
     * @param {string} type - Type of texture ('diffuse', 'normal', 'roughness', 'metallic')
     */
    setTexture(textureIndex, type = 'diffuse') {
        if (textureIndex < 0 || !type || !this.textures.hasOwnProperty(type)) {
            console.warn(`Invalid texture index ${textureIndex} or type ${type}`);
            return;
        }
        
        this.textures[type] = textureIndex;
    }
    
    /**
     * Remove a texture from this material
     * @param {string} type - Type of texture to remove ('diffuse', 'normal', 'roughness', 'metallic')
     */
    removeTexture(type) {
        if (!type || !this.textures.hasOwnProperty(type)) {
            console.warn(`Invalid texture type ${type}`);
            return;
        }
        
        this.textures[type] = -1;
    }
    
    /**
     * Set texture transform (scale, offset, rotation)
     * @param {Array<number>} scale - Scale factors [x, y]
     * @param {Array<number>} offset - Offset values [x, y]
     * @param {number} rotation - Rotation in radians
     */
    setTextureTransform(scale, offset, rotation) {
        if (scale && Array.isArray(scale) && scale.length >= 2) {
            this.textureScale = [scale[0], scale[1]];
        }
        
        if (offset && Array.isArray(offset) && offset.length >= 2) {
            this.textureOffset = [offset[0], offset[1]];
        }
        
        if (typeof rotation === 'number') {
            this.textureRotation = rotation;
        }
    }
    
    /**
     * Clone this material
     * @param {Object} overrides - Properties to override in the clone
     * @returns {Material} New material instance
     */
    clone(overrides = {}) {
        return new Material({
            // Basic properties
            albedo: [...this.albedo],
            metallic: this.metallic,
            roughness: this.roughness,
            emissive: [...this.emissive],
            emissiveFactor: this.emissiveFactor,
            ior: this.ior,
            
            // Texture properties
            textures: { ...this.textures },
            textureScale: [...this.textureScale],
            textureOffset: [...this.textureOffset],
            textureRotation: this.textureRotation,
            
            // Flags
            flags: { ...this.flags },
            
            // Overrides
            ...overrides,
            
            // Name handling
            name: overrides.name || `${this.name}_Copy`
        });
    }
    
    /**
     * Create a basic material preset
     * @param {string} type - Type of material preset
     * @returns {Material} New material instance
     */
    static createPreset(type) {
        switch (type.toLowerCase()) {
            case 'metal':
                return new Material({
                    albedo: [0.95, 0.95, 0.95],
                    metallic: 1.0,
                    roughness: 0.1,
                    name: 'Metal'
                });
                
            case 'plastic':
                return new Material({
                    albedo: [1.0, 1.0, 1.0],
                    metallic: 0.0,
                    roughness: 0.3,
                    name: 'Plastic'
                });
                
            case 'rubber':
                return new Material({
                    albedo: [0.2, 0.2, 0.2],
                    metallic: 0.0,
                    roughness: 0.9,
                    name: 'Rubber'
                });
                
            case 'glass':
                return new Material({
                    albedo: [0.95, 0.95, 1.0],
                    metallic: 0.0,
                    roughness: 0.05,
                    ior: 1.45,
                    flags: {
                        isTransparent: true,
                        isRefractive: true
                    },
                    name: 'Glass'
                });
                
            case 'emissive':
                return new Material({
                    albedo: [1.0, 0.7, 0.3],
                    metallic: 0.0,
                    roughness: 0.5,
                    emissive: [1.0, 0.7, 0.3],
                    emissiveFactor: 2.0,
                    name: 'Emissive'
                });
                
            case 'wood':
                return new Material({
                    albedo: [0.65, 0.45, 0.25],
                    metallic: 0.0,
                    roughness: 0.75,
                    name: 'Wood'
                });
                
            case 'chrome':
                return new Material({
                    albedo: [0.8, 0.8, 0.8],
                    metallic: 1.0,
                    roughness: 0.05,
                    name: 'Chrome'
                });
                
            case 'ceramic':
                return new Material({
                    albedo: [0.9, 0.9, 0.9],
                    metallic: 0.0,
                    roughness: 0.1,
                    name: 'Ceramic'
                });
                
            case 'default':
            default:
                return new Material({
                    name: 'Default'
                });
        }
    }
    
    /**
     * Serialize this material to JSON
     * @returns {Object} JSON representation of material
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            albedo: [...this.albedo],
            metallic: this.metallic,
            roughness: this.roughness,
            emissive: [...this.emissive],
            emissiveFactor: this.emissiveFactor,
            ior: this.ior,
            textures: { ...this.textures },
            textureScale: [...this.textureScale],
            textureOffset: [...this.textureOffset],
            textureRotation: this.textureRotation,
            flags: { ...this.flags }
        };
    }
    
    /**
     * Create a material from serialized JSON
     * @param {Object} json - JSON representation of material
     * @returns {Material} New material instance
     */
    static fromJSON(json) {
        return new Material(json);
    }
}

// Static ID counter
Material.nextId = 0;

/**
 * MaterialLibrary manages a collection of materials
 */
class MaterialLibrary {
    constructor() {
        this.materials = [];
        this.nextId = 0;
        
        // Initialize with default materials
        this.createDefaultMaterials();
    }
    
    /**
     * Create standard set of materials
     */
    createDefaultMaterials() {
        // Clear existing materials
        this.materials = [];
        this.nextId = 0;
        
        // Add materials for each preset in CONFIG
        Object.keys(CONFIG.materials).forEach(presetName => {
            this.addMaterial(Material.createPreset(presetName));
        });
    }
    
    /**
     * Add a material to the library
     * @param {Material} material - The material to add
     * @returns {number} The ID of the added material
     */
    addMaterial(material) {
        // If no ID provided, assign the next available one
        if (material.id === undefined) {
            material.id = this.nextId++;
        } else {
            // Update nextId if this material's ID is higher
            this.nextId = Math.max(this.nextId, material.id + 1);
        }
        
        this.materials.push(material);
        return material.id;
    }
    
    /**
     * Get a material by ID
     * @param {number} id - Material ID to find
     * @returns {Material} The found material or null if not found
     */
    getMaterial(id) {
        return this.materials.find(m => m.id === id) || null;
    }
    
    /**
     * Remove a material by ID
     * @param {number} id - Material ID to remove
     * @returns {boolean} True if material was found and removed
     */
    removeMaterial(id) {
        const index = this.materials.findIndex(m => m.id === id);
        if (index >= 0) {
            this.materials.splice(index, 1);
            return true;
        }
        return false;
    }
    
    /**
     * Get all materials in the library
     * @returns {Array<Material>} Array of all materials
     */
    getAllMaterials() {
        return [...this.materials];
    }
}