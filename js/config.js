/**
 * Material Flux - Global Configuration
 * Contains settings for rendering, physics, and UI
 */

const CONFIG = {
    // Rendering settings
    render: {
        width: window.innerWidth,
        height: window.innerHeight,
        maxRaySteps: 100,        // Maximum steps for ray marching
        maxDistance: 100,        // Maximum ray distance
        epsilon: 0.0001,         // Surface distance threshold
        shadowSoftness: 16.0,    // Soft shadow parameter
        maxBounces: 3,           // Maximum reflection/refraction bounces
        defaultBackground: [0.1, 0.12, 0.15], // Default background color (dark blue-gray)
        envMapIntensity: 1.0,    // Environment map contribution intensity
        reflectionQuality: 0.5,  // Quality of reflections (0-1)
        postProcess: {
            enabled: true,
            bloom: true,
            bloomThreshold: 0.7,
            bloomIntensity: 0.5,
            dof: false,
            dofFocalDistance: 5.0,
            dofFocalRange: 2.0
        }
    },
    
    // Physics settings
    physics: {
        gravity: [0, -9.82, 0],  // Earth gravity (m/s²)
        timeStep: 1/60,          // Physics update rate (seconds)
        iterations: 10,          // Physics solver iterations
        defaultMass: 1,          // Default mass for new objects (kg)
        defaultFriction: 0.3,    // Default friction for new objects
        defaultRestitution: 0.7, // Default restitution (bounciness)
    },
    
    // Camera settings
    camera: {
        fov: 60,                 // Field of view (degrees)
        near: 0.1,               // Near clipping plane
        far: 1000,               // Far clipping plane
        defaultPosition: [0, 3, 10], // Default camera position
        defaultTarget: [0, 0, 0],    // Default look target
        orbitControl: true,          // Enable orbit controls
        movementSpeed: 5.0           // Camera movement speed when not using orbit controls
    },
    
    // Light settings
    lights: {
        directional: {
            direction: [-0.5, -0.7, -0.5], // Default directional light direction
            color: [1.0, 0.95, 0.9],       // Default directional light color (warm white)
            intensity: 1.0                  // Default directional light intensity
        },
        ambient: {
            color: [0.4, 0.4, 0.5],         // Default ambient light color (cool)
            intensity: 0.2                  // Default ambient light intensity
        }
    },
    
    // Material presets
    materials: {
        default: {
            albedo: [0.8, 0.8, 0.8],
            metallic: 0.0,
            roughness: 0.5,
            emissive: [0, 0, 0],
            ior: 1.45,
            soundType: 'generic'
        },
        metal: {
            albedo: [0.95, 0.95, 0.95],
            metallic: 1.0,
            roughness: 0.2,
            emissive: [0, 0, 0],
            ior: 2.5,
            soundType: 'metal'
        },
        glass: {
            albedo: [0.95, 0.95, 1.0],
            metallic: 0.0,
            roughness: 0.0,
            emissive: [0, 0, 0],
            ior: 1.5,
            soundType: 'glass',
            transparent: true
        },
        wood: {
            albedo: [0.6, 0.4, 0.2],
            metallic: 0.0,
            roughness: 0.6,
            emissive: [0, 0, 0],
            ior: 1.3,
            soundType: 'wood'
        },
        emissive: {
            albedo: [1.0, 0.3, 0.1], 
            metallic: 0.2,
            roughness: 0.5,
            emissive: [5.0, 1.5, 0.5],
            ior: 1.45,
            soundType: 'generic'
        },
        soft: {
            albedo: [0.3, 0.5, 0.6],
            metallic: 0.0,
            roughness: 0.9,
            emissive: [0, 0, 0],
            ior: 1.2,
            soundType: 'soft'
        }
    },
    
    // Shape presets
    shapes: {
        maxCount: 50,  // Maximum number of shapes allowed in the scene
        defaultSize: 1.0,
        types: ['sphere', 'box', 'torus', 'cylinder', 'cone', 'capsule']
    },
    
    // Audio settings
    audio: {
        enabled: true,
        maxSounds: 10,           // Maximum simultaneous sounds
        masterVolume: 0.5,
        impactThreshold: 1.0,    // Minimum impact velocity to trigger sound
        impactVolumeScale: 0.1,  // Impact velocity to volume scaling factor
        ambientEnabled: true,
        ambientVolume: 0.2
    },
    
    // UI settings
    ui: {
        enabled: true,
        theme: 'dark',
        fps: {
            show: true,
            updateInterval: 500  // ms
        }
    }
};

// Make the config immutable to prevent accidental changes
Object.freeze(CONFIG);