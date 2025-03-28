/**
 * Shape class representing a 3D object in the scene
 * Defines geometric and physical properties of an object
 */
class Shape {
    /**
     * Create a new shape
     * @param {object} options - Shape options
     * @param {number} options.id - Unique shape ID
     * @param {number} options.type - Shape type enum (0=sphere, 1=box, etc.)
     * @param {p5.Vector} options.position - Position in world space
     * @param {array} options.orientation - Quaternion rotation [x, y, z, w]
     * @param {number|array} options.size - Size (scalar for uniform, array for [x,y,z])
     * @param {number} options.materialId - ID of the material to use
     * @param {number} options.mass - Physics mass (0 = static)
     */
    constructor(options = {}) {
        // Core properties
        this.id = options.id || 0;
        this.type = options.type !== undefined ? options.type : 0; // Sphere by default
        this.position = options.position || createVector(0, 0, 0);
        this.orientation = options.orientation || [0, 0, 0, 1]; // Identity quaternion
        this.size = options.size || CONFIG.shapes.defaultSize;
        this.materialId = options.materialId !== undefined ? options.materialId : 0;
        
        // Physics properties
        this.mass = options.mass !== undefined ? options.mass : CONFIG.physics.defaultMass;
        this.friction = options.friction || CONFIG.physics.defaultFriction;
        this.restitution = options.restitution || CONFIG.physics.defaultRestitution;
        this.physicsBody = null; // Will be set when added to physics world
        
        // Utility properties
        this.selected = false;
    }
    
    /**
     * Get the human-readable name of this shape type
     * @returns {string} Shape type name
     */
    get typeName() {
        const types = ['Sphere', 'Box', 'Torus', 'Cylinder', 'Cone', 'Capsule', 'Plane'];
        return types[this.type] || 'Unknown';
    }
    
    /**
     * Update position and orientation from physics body
     */
    updateFromPhysics() {
        if (!this.physicsBody) return;
        
        // Update position from physics
        const pos = this.physicsBody.position;
        this.position.set(pos.x, pos.y, pos.z);
        
        // Update orientation from physics
        const quat = this.physicsBody.quaternion;
        this.orientation = [quat.x, quat.y, quat.z, quat.w];
    }
    
    /**
     * Clone this shape with optional overrides
     * @param {object} overrides - Properties to override in the clone
     * @returns {Shape} A new Shape instance
     */
    clone(overrides = {}) {
        // Create a new instance with copied properties
        const newShape = new Shape({
            id: overrides.id !== undefined ? overrides.id : this.id,
            type: overrides.type !== undefined ? overrides.type : this.type,
            position: overrides.position || this.position.copy(),
            orientation: overrides.orientation || [...this.orientation],
            size: overrides.size || (Array.isArray(this.size) ? [...this.size] : this.size),
            materialId: overrides.materialId !== undefined ? overrides.materialId : this.materialId,
            mass: overrides.mass !== undefined ? overrides.mass : this.mass,
            friction: overrides.friction !== undefined ? overrides.friction : this.friction,
            restitution: overrides.restitution !== undefined ? overrides.restitution : this.restitution
        });
        
        return newShape;
    }
}

/**
 * ShapeManager manages a collection of shapes in the scene
 */
class ShapeManager {
    constructor() {
        this.shapes = [];
        this.nextId = 0;
        this.selectedShape = null;
    }
    
    /**
     * Add a shape to the scene
     * @param {Shape} shape - The shape to add
     * @returns {number} The ID of the added shape
     */
    addShape(shape) {
        // If no ID provided, assign the next available one
        if (shape.id === undefined) {
            shape.id = this.nextId++;
        } else {
            // Update nextId if this shape's ID is higher
            this.nextId = Math.max(this.nextId, shape.id + 1);
        }
        
        this.shapes.push(shape);
        return shape.id;
    }
    
    /**
     * Get a shape by ID
     * @param {number} id - Shape ID to find
     * @returns {Shape} The found shape or null if not found
     */
    getShape(id) {
        return this.shapes.find(s => s.id === id) || null;
    }
    
    /**
     * Remove a shape by ID
     * @param {number} id - Shape ID to remove
     * @returns {boolean} True if shape was found and removed
     */
    removeShape(id) {
        const index = this.shapes.findIndex(s => s.id === id);
        if (index >= 0) {
            const shape = this.shapes[index];
            this.shapes.splice(index, 1);
            
            // If this was the selected shape, clear selection
            if (this.selectedShape === shape) {
                this.selectedShape = null;
            }
            
            return true;
        }
        return false;
    }
    
    /**
     * Get all shapes in the scene
     * @returns {Array<Shape>} Array of all shapes
     */
    getAllShapes() {
        return [...this.shapes];
    }
    
    /**
     * Select a shape by ID
     * @param {number} id - Shape ID to select
     * @returns {Shape} The selected shape or null if not found
     */
    selectShape(id) {
        // Clear current selection
        if (this.selectedShape) {
            this.selectedShape.selected = false;
        }
        
        // Find and select new shape
        const shape = this.getShape(id);
        if (shape) {
            shape.selected = true;
            this.selectedShape = shape;
        } else {
            this.selectedShape = null;
        }
        
        return this.selectedShape;
    }
    
    /**
     * Clear all shapes from the scene
     */
    clearShapes() {
        this.shapes = [];
        this.selectedShape = null;
    }
    
    /**
     * Update all shapes from their physics bodies
     */
    updateFromPhysics() {
        this.shapes.forEach(shape => shape.updateFromPhysics());
    }
}