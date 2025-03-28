/**
 * Physics system for 3D simulation using cannon-es
 * Handles rigid body physics, collisions, and constraints
 */
class PhysicsSystem {
    /**
     * Create a new physics system
     * @param {ShapeManager} shapeManager - The shape manager instance
     */
    constructor(shapeManager) {
        this.shapeManager = shapeManager;
        this.world = null;
        this.bodies = new Map(); // Map shape IDs to physics bodies
        
        // Dragging constraints
        this.draggedBody = null;
        this.dragConstraint = null;
        this.dragPlane = null;
        this.dragPoint = null;
        this.dragDistance = 5;
        
        // Mouse ray for picking
        this.mouseRay = {
            origin: new CANNON.Vec3(),
            direction: new CANNON.Vec3()
        };
        
        // Initialize physics
        this.init();
    }
    
    /**
     * Initialize the physics world
     */
    init() {
        // Create a new physics world
        this.world = new CANNON.World({
            gravity: new CANNON.Vec3(...CONFIG.physics.gravity)
        });
        
        // Set solver iterations
        this.world.solver.iterations = CONFIG.physics.iterations;
        
        // Add a ground plane
        this.addGroundPlane();
    }
    
    /**
     * Add a static ground plane to the world
     */
    addGroundPlane() {
        // Create a static ground plane
        const groundShape = new CANNON.Plane();
        const groundBody = new CANNON.Body({
            mass: 0, // Static body
            position: new CANNON.Vec3(0, 0, 0),
            shape: groundShape,
            material: new CANNON.Material({
                friction: 0.3,
                restitution: 0.3
            })
        });
        
        // Rotate the plane so it's facing up (normal along Y-axis)
        groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        
        // Add to world
        this.world.addBody(groundBody);
    }
    
    /**
     * Step the physics simulation
     * @param {number} deltaTime - Time since last frame (seconds)
     */
    update(deltaTime) {
        // Cap delta time to avoid large jumps
        const dt = Math.min(deltaTime, 1/30);
        
        // Step the physics simulation
        this.world.step(CONFIG.physics.timeStep, dt, 3);
        
        // Update shape positions and orientations from physics bodies
        this.shapeManager.updateFromPhysics();
    }
    
    /**
     * Add a shape to the physics world
     * @param {Shape} shape - The shape to add physics for
     */
    addShape(shape) {
        // Skip if shape already has a physics body
        if (shape.physicsBody || this.bodies.has(shape.id)) return;
        
        // Create physics body
        const body = this.createPhysicsBody(shape);
        
        // Store reference to body
        shape.physicsBody = body;
        this.bodies.set(shape.id, body);
        
        // Add to world
        this.world.addBody(body);
    }
    
    /**
     * Create a physics body for a shape
     * @param {Shape} shape - The shape to create a body for
     * @returns {CANNON.Body} The created physics body
     */
    createPhysicsBody(shape) {
        // Create appropriate physics shape based on shape type
        let physicsShape;
        
        // Get size (convert from scalar to array if needed)
        const size = Array.isArray(shape.size) ? shape.size : [shape.size, shape.size, shape.size];
        
        // Create shape based on type
        switch (shape.type) {
            // Sphere
            case 0:
                physicsShape = new CANNON.Sphere(size[0] / 2); // Radius is half the diameter
                break;
            
            // Box
            case 1:
                physicsShape = new CANNON.Box(new CANNON.Vec3(
                    size[0] / 2, size[1] / 2, size[2] / 2
                )); // Half-extents
                break;
            
            // Torus (approximate with cylinder for physics)
            case 2:
                const torusRadius = size[0] / 2;
                const torusThickness = size[0] * 0.2; // Approximation
                physicsShape = new CANNON.Cylinder(
                    torusRadius + torusThickness, // radiusTop
                    torusRadius + torusThickness, // radiusBottom
                    torusThickness * 2, // height
                    16 // segments
                );
                break;
            
            // Cylinder
            case 3:
                physicsShape = new CANNON.Cylinder(
                    size[0] / 2, // radiusTop
                    size[0] / 2, // radiusBottom
                    size[1], // height
                    16 // segments
                );
                break;
            
            // Cone (approximated with cylinder)
            case 4:
                physicsShape = new CANNON.Cylinder(
                    0.1, // radiusTop (small, not zero for stability)
                    size[0] / 2, // radiusBottom
                    size[1], // height
                    16 // segments
                );
                break;
            
            // Capsule (cylinder with spherical ends)
            case 5:
                // Approximated as cylinder for now (capsule would be better but needs custom setup)
                physicsShape = new CANNON.Cylinder(
                    size[0] / 2, // radiusTop
                    size[0] / 2, // radiusBottom
                    size[1], // height
                    16 // segments
                );
                break;
            
            // Plane (static ground)
            case 6:
                physicsShape = new CANNON.Plane();
                break;
            
            // Default to box if unknown type
            default:
                physicsShape = new CANNON.Box(new CANNON.Vec3(
                    size[0] / 2, size[1] / 2, size[2] / 2
                ));
                break;
        }
        
        // Create physics body with the shape
        const body = new CANNON.Body({
            mass: shape.mass, // 0 means static
            position: new CANNON.Vec3(
                shape.position.x,
                shape.position.y,
                shape.position.z
            ),
            shape: physicsShape,
            material: new CANNON.Material({
                friction: shape.friction,
                restitution: shape.restitution
            })
        });
        
        // Apply initial orientation if not identity
        if (shape.orientation[0] !== 0 || 
            shape.orientation[1] !== 0 || 
            shape.orientation[2] !== 0 || 
            shape.orientation[3] !== 1) {
            body.quaternion.set(
                shape.orientation[0],
                shape.orientation[1],
                shape.orientation[2],
                shape.orientation[3]
            );
        }
        
        return body;
    }
    
    /**
     * Remove a shape from the physics world
     * @param {Shape} shape - The shape to remove
     */
    removeShape(shape) {
        const body = this.bodies.get(shape.id);
        if (body) {
            this.world.removeBody(body);
            this.bodies.delete(shape.id);
            
            // Clear dragging if this was the dragged body
            if (body === this.draggedBody) {
                this.endDrag();
            }
        }
    }
    
    /**
     * Calculate a ray from screen coordinates
     * @param {p5.Vector} screenPos - Screen coordinates in pixels
     * @param {p5} p5instance - The p5 instance
     * @returns {Object} Ray with origin and direction
     */
    calculateRayFromScreen(screenPos, p5instance) {
        const p = p5instance;
        
        try {
            // SIMPLE APPROACH: Use a basic raycasting technique that doesn't depend on p5's view matrix
            
            // Create an alternate camera setup that matches our expected configuration
            const fov = CONFIG.camera.fov * Math.PI / 180; // Convert to radians
            const aspect = p.width / p.height;
            
            // Normalized device coordinates (-1 to 1)
            const ndcX = (screenPos.x / p.width) * 2 - 1;
            const ndcY = ((p.height - screenPos.y) / p.height) * 2 - 1; // Flip Y
            
            // Determine camera position based on CONFIG or use a reasonable default
            // Most typical setup is a camera positioned back on Z axis looking at origin
            const camPos = p.createVector(0, 2, 10); // Simple default
            
            // Generate ray direction
            const rayDir = p.createVector(
                ndcX * Math.tan(fov / 2) * aspect,
                ndcY * Math.tan(fov / 2),
                -1  // Forward along -Z axis
            ).normalize();
            
            return {
                origin: new CANNON.Vec3(camPos.x, camPos.y, camPos.z),
                direction: new CANNON.Vec3(rayDir.x, rayDir.y, rayDir.z)
            };
        } catch (err) {
            // If anything fails, return a simple default ray pointing forward
            console.warn('Error in ray calculation:', err);
            return {
                origin: new CANNON.Vec3(0, 2, 10),
                direction: new CANNON.Vec3(0, 0, -1)
            };
        }
    }
    
    /**
     * Start dragging a shape at the given screen coordinates
     * @param {p5.Vector} screenPos - Screen coordinates in pixels
     * @param {p5} p5instance - The p5 instance
     * @returns {Shape} The dragged shape or null if none
     */
    startDrag(screenPos, p5instance) {
        try {
            // Calculate ray from screen coordinates
            this.mouseRay = this.calculateRayFromScreen(screenPos, p5instance);
            
            // Safety check - make sure we have valid ray data
            if (!this.mouseRay || !this.mouseRay.origin || !this.mouseRay.direction) {
                console.warn("Invalid ray data - using default ray");
                this.mouseRay = {
                    origin: new CANNON.Vec3(0, 2, 10),
                    direction: new CANNON.Vec3(0, 0, -1)
                };
            }
            
            // Perform ray intersection test
            const result = new CANNON.RaycastResult();
            const rayEnd = new CANNON.Vec3().copy(this.mouseRay.origin).addScaledVector(
                this.dragDistance * 10,
                this.mouseRay.direction
            );
            
            this.world.raycastClosest(
                this.mouseRay.origin,
                rayEnd,
                {
                    collisionFilterGroup: 1,
                    collisionFilterMask: 1
                },
                result
            );
            
            // If no hit or hit a static body, return null
            if (!result.hasHit || result.body.mass === 0) return null;
            
            // Get the hit body
            this.draggedBody = result.body;
            
            // Store hit point in body coordinates
            const hitPointWorld = new CANNON.Vec3().copy(result.hitPointWorld);
            const hitPointLocal = new CANNON.Vec3();
            this.draggedBody.pointToLocalFrame(hitPointWorld, hitPointLocal);
            this.dragPoint = hitPointLocal;
            
            // Store hit distance
            this.dragDistance = result.distance;
            
            // Create a constraint to drag the body
            this.dragConstraint = new CANNON.PointToPointConstraint(
                this.draggedBody,
                this.dragPoint,
                new CANNON.Body({ mass: 0 }), // Dummy body
                new CANNON.Vec3(0, 0, 0)
            );
            
            // Add constraint to world
            this.world.addConstraint(this.dragConstraint);
            
            // Find and return the shape associated with this body
            for (const shape of this.shapeManager.getAllShapes()) {
                if (shape.physicsBody === this.draggedBody) {
                    return shape;
                }
            }
            
            return null;
        } catch (err) {
            console.error("Error in startDrag:", err);
            return null;
        }
    }
    
    /**
     * Update the drag constraint with new screen coordinates
     * @param {p5.Vector} screenPos - Screen coordinates in pixels
     * @param {p5.Vector} screenDelta - Screen coordinate change since last update
     * @param {p5} p5instance - The p5 instance
     */
    updateDrag(screenPos, screenDelta, p5instance) {
        try {
            if (!this.draggedBody || !this.dragConstraint) return;
            
            // Calculate new ray from screen coordinates
            const ray = this.calculateRayFromScreen(screenPos, p5instance);
            
            // Safety check - make sure we have valid ray data
            if (!ray || !ray.origin || !ray.direction) {
                console.warn("Invalid ray data in updateDrag - aborting update");
                return;
            }
            
            // Calculate point on a plane at drag distance along the ray
            const targetPos = new CANNON.Vec3().copy(ray.origin).addScaledVector(
                this.dragDistance, 
                ray.direction
            );
            
            // Update constraint target position
            this.dragConstraint.pivotA.copy(this.dragPoint);
            this.dragConstraint.bodyB.position.copy(targetPos);
        } catch (err) {
            console.error("Error in updateDrag:", err);
        }
    }
    
    /**
     * End a drag operation, optionally applying an impulse for throwing
     * @param {p5.Vector} screenVelocity - Screen velocity for throwing impulse
     */
    endDrag(screenVelocity) {
        if (!this.draggedBody || !this.dragConstraint) return;
        
        // Remove constraint from world
        this.world.removeConstraint(this.dragConstraint);
        
        // If we have velocity data, apply an impulse for throwing
        if (screenVelocity && (screenVelocity.x !== 0 || screenVelocity.y !== 0)) {
            // Scale the screen velocity to a reasonable impulse
            const impulseStrength = 0.05;
            const scaledVel = new CANNON.Vec3(
                -screenVelocity.x * impulseStrength,
                screenVelocity.y * impulseStrength,
                0
            );
            
            // Apply the impulse at the drag point
            this.draggedBody.applyImpulse(
                scaledVel,
                this.draggedBody.pointToWorldFrame(new CANNON.Vec3().copy(this.dragPoint))
            );
        }
        
        // Clear dragging state
        this.draggedBody = null;
        this.dragConstraint = null;
        this.dragPoint = null;
    }
}