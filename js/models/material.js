/**
 * Material class representing the surface properties of shapes
 * Defines how objects interact with light (PBR properties)
 */
class Material {
    /**
     * Create a new material
     * @param {object} options - Material options
     * @param {number} options.id - Unique material ID
     * @param {array} options.albedo - Base color [r, g, b] (0-1)
     * @param {number} options.metallic - Metallic factor (0-1)
     * @param {number} options.roughness - Surface roughness (0-1)
     * @param {array} options.emissive - Emitted light color [r, g, b] (0-1)
     * @param {number} options.emissiveFactor - Emissive intensity multiplier
     * @param {number} options.ior - Index of refraction (typically 1.0-2.5)
     * @param {boolean} options.transparent - Whether material is transparent
     * @param {string} options.soundType - Type of sound for collisions
     */
    constructor(options = {}) {
        // Basic properties with defaults
        this.id = options.id || 0;
        this.albedo = options.albedo || [0.8, 0.8, 0.8]; // Default light gray
        this.metallic = options.metallic !== undefined ? options.metallic : 0.0;
        this.roughness = options.roughness !== undefined ? options.roughness : 0.5;
        this.emissive = options.emissive || [0.0, 0.0, 0.0];
        this.emissiveFactor = options.emissiveFactor || 0.0;
        this.ior = options.ior || 1.45; // Default for most plastics
        
        // Special properties
        this.transparent = options.transparent || false;
        this.soundType = options.soundType || 'generic';
        this.textureIndex = options.textureIndex || -1; // -1 means no texture
        
        // Calculate bit-packed flags
        this.flags = 0;
        if (this.transparent) this.flags |= 1; // Bit 0: transparency
    }
    
    /**
     * Clone this material with optional overrides
     * @param {object} overrides - Properties to override in the clone
     * @returns {Material} A new Material instance
     */
    clone(overrides = {}) {
        return new Material({
            id: overrides.id !== undefined ? overrides.id : this.id,
            albedo: overrides.albedo || [...this.albedo],
            metallic: overrides.metallic !== undefined ? overrides.metallic : this.metallic,
            roughness: overrides.roughness !== undefined ? overrides.roughness : this.roughness,
            emissive: overrides.emissive || [...this.emissive],
            emissiveFactor: overrides.emissiveFactor !== undefined ? overrides.emissiveFactor : this.emissiveFactor,
            ior: overrides.ior !== undefined ? overrides.ior : this.ior,
            transparent: overrides.transparent !== undefined ? overrides.transparent : this.transparent,
            soundType: overrides.soundType || this.soundType,
            textureIndex: overrides.textureIndex !== undefined ? overrides.textureIndex : this.textureIndex
        });
    }
    
    /**
     * Create a new material from a preset in CONFIG.materials
     * @param {string} presetName - Name of the preset in CONFIG.materials
     * @param {number} id - ID to assign to the new material
     * @returns {Material} The new material instance
     */
    static fromPreset(presetName, id) {
        const preset = CONFIG.materials[presetName];
        if (!preset) {
            console.warn(`Material preset '${presetName}' not found, using default`);
            return new Material({ id });
        }
        
        return new Material({
            id,
            ...preset // Spread all properties from the preset
        });
    }
}

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
            this.addMaterial(Material.fromPreset(presetName, this.nextId++));
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