/**
 * Interaction module for handling user input
 * Manages mouse/touch interactions for object manipulation
 */
class InteractionHandler {
    /**
     * Create a new interaction handler
     * @param {p5} p - The p5 instance
     * @param {ShapeManager} shapeManager - The shape manager instance
     * @param {PhysicsSystem} physics - The physics system instance
     */
    constructor(p, shapeManager, physics) {
        this.p = p;
        this.shapeManager = shapeManager;
        this.physics = physics;
        
        // Mouse state
        this.mousePressed = false;
        this.mousePrevPos = null;
        this.mousePos = null;
        this.mouseVelocity = null;
        this.mouseDragHistory = [];
        this.maxDragHistory = 5; // Number of points to keep for velocity calculation
        
        // Drag state
        this.isDragging = false;
        this.draggedShape = null;
        
        // Selection state
        this.selectedShape = null;
        
        // Time tracking for velocity calculation
        this.lastDragTime = 0;
    }
    
    /**
     * Handle mouse pressed event
     * @param {Object} event - The mouse event
     */
    mousePress(event) {
        // Store mouse position
        this.mousePos = this.p.createVector(this.p.mouseX, this.p.mouseY);
        this.mousePrevPos = this.mousePos.copy();
        this.mousePressed = true;
        this.mouseDragHistory = [];
        this.lastDragTime = performance.now();
        
        // Attempt to start dragging a shape
        if (!event.altKey && !event.ctrlKey) { // Allow normal orbit controls with modifier keys
            this.draggedShape = this.physics.startDrag(this.mousePos, this.p);
            this.isDragging = this.draggedShape !== null;
            
            // If we hit a shape, select it
            if (this.draggedShape) {
                this.selectedShape = this.draggedShape;
                this.shapeManager.selectShape(this.draggedShape.id);
            }
        }
        
        return !this.isDragging; // Return true to prevent default if we're dragging
    }
    
    /**
     * Handle mouse move event
     * @param {Object} event - The mouse event
     */
    mouseMove(event) {
        // Update mouse position
        this.mousePrevPos = this.mousePos ? this.mousePos.copy() : this.p.createVector(this.p.mouseX, this.p.mouseY);
        this.mousePos = this.p.createVector(this.p.mouseX, this.p.mouseY);
        
        // Calculate mouse velocity
        const now = performance.now();
        const dt = (now - this.lastDragTime) / 1000; // Convert to seconds
        this.lastDragTime = now;
        
        if (dt > 0) {
            this.mouseVelocity = p5.Vector.sub(this.mousePos, this.mousePrevPos).div(dt);
            
            // Store drag history for throw velocity calculation
            if (this.mousePressed) {
                this.mouseDragHistory.push({
                    pos: this.mousePos.copy(),
                    time: now,
                    vel: this.mouseVelocity.copy()
                });
                
                // Keep history limited to maxDragHistory points
                if (this.mouseDragHistory.length > this.maxDragHistory) {
                    this.mouseDragHistory.shift();
                }
            }
        }
        
        // Update drag if we're dragging a shape
        if (this.isDragging && this.draggedShape) {
            const mouseDelta = p5.Vector.sub(this.mousePos, this.mousePrevPos);
            this.physics.updateDrag(this.mousePos, mouseDelta, this.p);
            return true; // Prevent default
        }
        
        return false;
    }
    
    /**
     * Handle mouse released event
     * @param {Object} event - The mouse event
     */
    mouseRelease(event) {
        this.mousePressed = false;
        
        // Calculate throw velocity from drag history
        let throwVelocity = null;
        if (this.mouseDragHistory.length >= 2) {
            // Use average of recent velocities for smoother throwing
            throwVelocity = this.p.createVector(0, 0);
            let totalWeight = 0;
            
            // Weight recent points more heavily
            for (let i = 0; i < this.mouseDragHistory.length; i++) {
                const weight = (i + 1); // Linear weighting
                throwVelocity.add(p5.Vector.mult(this.mouseDragHistory[i].vel, weight));
                totalWeight += weight;
            }
            
            if (totalWeight > 0) {
                throwVelocity.div(totalWeight);
            }
        }
        
        // End drag if we were dragging
        if (this.isDragging && this.draggedShape) {
            this.physics.endDrag(throwVelocity);
            this.isDragging = false;
            this.draggedShape = null;
            return true; // Prevent default
        }
        
        return false;
    }
    
    /**
     * Handle keyboard events
     * @param {Object} event - The keyboard event
     */
    keyPress(event) {
        // Delete selected shape with Delete key
        if (event.keyCode === 46 || event.key === 'Delete') {
            if (this.selectedShape) {
                this.physics.removeShape(this.selectedShape);
                this.shapeManager.removeShape(this.selectedShape.id);
                this.selectedShape = null;
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Spawn a new shape at a given position with specified properties
     * @param {number} type - Shape type (0=sphere, 1=box, etc.)
     * @param {p5.Vector} position - Position in world space
     * @param {number} size - Size of the shape
     * @param {number} materialId - Material ID to use
     * @returns {Shape} The created shape
     */
    spawnShape(type, position, size, materialId) {
        // Create a default position if none provided
        let finalPosition = position;
        if (!finalPosition) {
            // Create a position object with the same interface as p5.Vector
            finalPosition = {
                x: 0, y: 5, z: 0,
                copy: function() {
                    return { x: this.x, y: this.y, z: this.z, copy: this.copy };
                }
            };
        }
        
        // Create a new shape
        const shape = new Shape({
            type: type,
            position: finalPosition,
            size: size || CONFIG.shapes.defaultSize,
            materialId: materialId || 0
        }, this.p); // Pass the p5 instance
        
        // Add to shape manager
        this.shapeManager.addShape(shape);
        
        // Add to physics
        this.physics.addShape(shape);
        
        // Select the new shape
        this.selectedShape = shape;
        this.shapeManager.selectShape(shape.id);
        
        return shape;
    }
}