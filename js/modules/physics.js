/**
 * Physics system for 3D simulation using cannon-es
 * Handles rigid body physics, collisions, and constraints
 */
class PhysicsSystem {
    /**
     * Create a new physics system
     * @param {ShapeManager} shapeManager - The shape manager instance
     * @param {Renderer} renderer - The renderer instance
     */
    constructor(shapeManager, renderer) {
        this.shapeManager = shapeManager;
        this.renderer = renderer; // Store renderer instance
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
            // console.log(`Calculating ray for screenPos: (${screenPos.x.toFixed(2)}, ${screenPos.y.toFixed(2)})`); // DEBUG
            // --- CRITICAL FIX: Use p5's built-in method if available ---
            // p5.js provides a better ray calculation in 3D mode
            if (p._renderer && typeof p._renderer.unproject === 'function') {
                // console.log("Using p._renderer.unproject method."); // DEBUG
                // Get near and far points on the ray using p5's unproject
                const nearPoint = p._renderer.unproject(screenPos.x, p.height - screenPos.y, 0.1);
                const farPoint = p._renderer.unproject(screenPos.x, p.height - screenPos.y, 1.0);
                // console.log(`Near: (${nearPoint.x.toFixed(2)}, ${nearPoint.y.toFixed(2)}, ${nearPoint.z.toFixed(2)}), Far: (${farPoint.x.toFixed(2)}, ${farPoint.y.toFixed(2)}, ${farPoint.z.toFixed(2)})`); // DEBUG
                
                // Calculate the ray direction from near to far
                const rayDir = p5.Vector.sub(farPoint, nearPoint).normalize();
                
                return {
                    origin: new CANNON.Vec3(nearPoint.x, nearPoint.y, nearPoint.z),
                    direction: new CANNON.Vec3(rayDir.x, rayDir.y, rayDir.z)
                };
            }
            
            // Otherwise use our custom calculation
            // console.log("Using custom ray calculation fallback."); // DEBUG
            let camPos;
            if (this.renderer && this.renderer.cameraPos) {
 // Use this.renderer
                camPos = this.renderer.cameraPos;
            } else {
                // Fallback to default camera position if renderer is not available
                camPos = p.createVector(
                    CONFIG.camera.defaultPosition[0],
                    CONFIG.camera.defaultPosition[1], 
                    CONFIG.camera.defaultPosition[2]
                );
            }

            // Create an alternate camera setup that matches our expected configuration
            const fov = CONFIG.camera.fov * Math.PI / 180; // Convert to radians
            const aspect = p.width / p.height;
            
            // Normalized device coordinates (-1 to 1)
            const ndcX = (screenPos.x / p.width) * 2 - 1;
            const ndcY = ((p.height - screenPos.y) / p.height) * 2 - 1; // Flip Y
            
            // Generate ray direction
            const rayDir = p.createVector(
                ndcX * Math.tan(fov / 2) * aspect,
                ndcY * Math.tan(fov / 2),
                -1  // Forward along -Z axis
            ).normalize();
            
            // Transform the ray direction by the camera's orientation
            let finalOrigin = new CANNON.Vec3(camPos.x, camPos.y, camPos.z);
            let finalDirection = new CANNON.Vec3(rayDir.x, rayDir.y, rayDir.z); // Default if transform fails

            if (this.renderer && this.renderer.viewMatrix) {
 // Use this.renderer
                try {
                    // Create a direction vector in view space
                    const viewInv = this.renderer.viewMatrix.copy().invert(); // Use this.renderer
                    
                    // Extract rotation from view matrix (upper 3x3 part)
                    // and apply it to the ray direction
                    const m = viewInv.mat4;
                    const rotatedRayDir = p.createVector(
                        rayDir.x * m[0] + rayDir.y * m[4] + rayDir.z * m[8],
                        rayDir.x * m[1] + rayDir.y * m[5] + rayDir.z * m[9],
                        rayDir.x * m[2] + rayDir.y * m[6] + rayDir.z * m[10]
                    ).normalize();
                    
                    finalDirection.set(rotatedRayDir.x, rotatedRayDir.y, rotatedRayDir.z)
;
                    // console.log("Successfully transformed ray direction using view matrix."); // DEBUG

                } catch (err) {
                    console.warn("Error transforming ray with view matrix:", err);
                }
            }
            
            // Simplified fallback if we can't use the view matrix
            // console.log(`Final Ray - Origin: (${finalOrigin.x.toFixed(2)}, ${finalOrigin.y.toFixed(2)}, ${finalOrigin.z.toFixed(2)}), Direction: (${finalDirection.x.toFixed(2)}, ${finalDirection.y.toFixed(2)}, ${finalDirection.z.toFixed(2)})`); // DEBUG
            return {
                origin: finalOrigin,
                direction: finalDirection
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
                1000, // Use a large distance for the ray end
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
            
            // console.log(`Raycast from (${this.mouseRay.origin.x.toFixed(2)}, ${this.mouseRay.origin.y.toFixed(2)}, ${this.mouseRay.origin.z.toFixed(2)}) dir (${this.mouseRay.direction.x.toFixed(2)}, ${this.mouseRay.direction.y.toFixed(2)}, ${this.mouseRay.direction.z.toFixed(2)})`); // DEBUG

            // If no hit or hit a static body, return null
            if (!result.hasHit || result.body.mass === 0) {
                // console.log("Raycast did not hit a dynamic body."); // DEBUG
                return null;
            }

            // console.log(`Raycast hit body ID: ${result.body.id}, mass: ${result.body.mass}, distance: ${result.distance.toFixed(2)}`); // DEBUG
            
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
            this.dragConstraint.bodyB.position.copy(targetPos);
            this.dragConstraint.update(); // Explicitly update constraint
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