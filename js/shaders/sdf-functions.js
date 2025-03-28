/**
 * SDF (Signed Distance Function) implementations for ray marching
 * These functions will be included in the fragment shader
 */

// Store the SDF functions as strings to be included in the shader
const SDF_FUNCTIONS = `
// SDF utilities
// Constants
#define MAX_STEPS 100
#define MAX_DIST 100.0
#define SURF_DIST 0.001
#define EPSILON 0.0001

// Shape type enumeration
#define SHAPE_SPHERE 0
#define SHAPE_BOX 1
#define SHAPE_TORUS 2
#define SHAPE_CYLINDER 3
#define SHAPE_CONE 4
#define SHAPE_CAPSULE 5
#define SHAPE_PLANE 6

// Basic shape SDFs

// Sphere SDF
float sdSphere(vec3 p, float radius) {
    return length(p) - radius;
}

// Box SDF
float sdBox(vec3 p, vec3 size) {
    vec3 d = abs(p) - size * 0.5;
    return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0));
}

// Torus SDF
float sdTorus(vec3 p, float radius, float thickness) {
    vec2 q = vec2(length(p.xz) - radius, p.y);
    return length(q) - thickness;
}

// Cylinder SDF
float sdCylinder(vec3 p, float radius, float height) {
    // Distance from cylinder axis and height
    vec2 d = vec2(length(p.xz) - radius, abs(p.y) - height * 0.5);
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

// Cone SDF
float sdCone(vec3 p, float radius, float height) {
    // Move apex to the origin
    vec3 q = p;
    q.y += height * 0.5;
    
    // Calculate distance from cone surface
    float d1 = length(q.xz);
    float d2 = -q.y;
    float scale = radius / height;
    vec2 dist = vec2(d1 - q.y * scale, d2);
    
    float sigDist = length(max(dist, 0.0)) + min(max(dist.x, dist.y), 0.0);
    return sigDist;
}

// Capsule SDF
float sdCapsule(vec3 p, float radius, float height) {
    // Line segment from -h/2 to h/2 on y-axis
    vec3 a = vec3(0.0, -height * 0.5, 0.0);
    vec3 b = vec3(0.0, height * 0.5, 0.0);
    
    // Project point onto line segment
    vec3 pa = p - a;
    vec3 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    
    // Distance to closest point on line segment
    return length(pa - ba * h) - radius;
}

// Plane SDF
float sdPlane(vec3 p, vec3 normal, float distance) {
    return dot(p, normalize(normal)) - distance;
}

// Signed distance function operations

// Union
float opUnion(float d1, float d2) {
    return min(d1, d2);
}

// Subtraction
float opSubtraction(float d1, float d2) {
    return max(-d1, d2);
}

// Intersection
float opIntersection(float d1, float d2) {
    return max(d1, d2);
}

// Smooth union
float opSmoothUnion(float d1, float d2, float k) {
    float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) - k * h * (1.0 - h);
}

// Transform point by translation, rotation and scale
vec3 transformPoint(vec3 p, vec3 translation, vec4 quaternion, vec3 scale) {
    // Apply inverse translation
    vec3 q = p - translation;
    
    // Apply inverse quaternion rotation
    // q' = q * r^-1
    vec4 quat = quaternion;
    
    // Conjugate of quaternion (inverse for unit quaternion)
    quat.xyz = -quat.xyz;
    
    // q' = q * r^-1
    vec3 u = quat.xyz;
    float s = quat.w;
    vec3 result = q + 2.0 * cross(u, cross(u, q) + s * q);
    
    // Apply inverse scale
    result /= scale;
    
    return result;
}

// ----------------
// Scene evaluation
// ----------------

// Maps a scene point to the closest SDF
// Returns vec2(distance, objectId)
vec2 mapScene(vec3 p, sampler2D shapeData, int shapeCount) {
    float minDist = MAX_DIST;
    float objectId = -1.0;
    
    // Iterate through all shapes
    for (int i = 0; i < MAX_STEPS; i++) {
        if (i >= shapeCount) break;
        
        // Get shape data from texture
        vec4 posData = texelFetch(shapeData, ivec2(0, i), 0);
        vec4 quatData = texelFetch(shapeData, ivec2(1, i), 0);
        vec4 sizeTypeData = texelFetch(shapeData, ivec2(2, i), 0);
        vec4 matData = texelFetch(shapeData, ivec2(3, i), 0);
        
        // Extract data
        vec3 position = posData.xyz;
        float id = posData.w;
        vec4 quaternion = quatData;
        vec3 size = sizeTypeData.xyz;
        float shapeType = sizeTypeData.w;
        float materialId = matData.x;
        
        // Transform point to object space
        vec3 objSpace = transformPoint(p, position, quaternion, size);
        
        // Calculate SDF based on shape type
        float dist = MAX_DIST;
        
        // Sphere
        if (shapeType == SHAPE_SPHERE) {
            dist = sdSphere(objSpace, 1.0); // Unit sphere (scaled by size)
        } 
        // Box
        else if (shapeType == SHAPE_BOX) {
            dist = sdBox(objSpace, vec3(1.0)); // Unit box (scaled by size)
        } 
        // Torus
        else if (shapeType == SHAPE_TORUS) {
            dist = sdTorus(objSpace, 0.5, 0.2); // Torus with major radius 0.5 and thickness 0.2
        } 
        // Cylinder
        else if (shapeType == SHAPE_CYLINDER) {
            dist = sdCylinder(objSpace, 0.5, 1.0); // Cylinder with radius 0.5 and height 1.0
        } 
        // Cone
        else if (shapeType == SHAPE_CONE) {
            dist = sdCone(objSpace, 0.5, 1.0); // Cone with base radius 0.5 and height 1.0
        } 
        // Capsule
        else if (shapeType == SHAPE_CAPSULE) {
            dist = sdCapsule(objSpace, 0.5, 1.0); // Capsule with radius 0.5 and height 1.0
        } 
        // Plane (ground)
        else if (shapeType == SHAPE_PLANE) {
            dist = sdPlane(objSpace, vec3(0.0, 1.0, 0.0), 0.0); // Ground plane
        }
        
        // Check if this shape is closer than previous ones
        if (dist < minDist) {
            minDist = dist;
            objectId = id;
        }
    }
    
    return vec2(minDist, objectId);
}

// Calculate normal using the SDF gradient
vec3 calcNormal(vec3 p, sampler2D shapeData, int shapeCount) {
    vec2 e = vec2(EPSILON, 0.0);
    
    return normalize(vec3(
        mapScene(p + e.xyy, shapeData, shapeCount).x - mapScene(p - e.xyy, shapeData, shapeCount).x,
        mapScene(p + e.yxy, shapeData, shapeCount).x - mapScene(p - e.yxy, shapeData, shapeCount).x,
        mapScene(p + e.yyx, shapeData, shapeCount).x - mapScene(p - e.yyx, shapeData, shapeCount).x
    ));
}

// Ray marching algorithm
vec2 rayMarch(vec3 ro, vec3 rd, sampler2D shapeData, int shapeCount) {
    float dist = 0.0;
    float objectId = -1.0;
    
    for (int i = 0; i < MAX_STEPS; i++) {
        vec3 p = ro + rd * dist;
        vec2 result = mapScene(p, shapeData, shapeCount);
        float dS = result.x;
        objectId = result.y;
        
        dist += dS;
        if (dS < SURF_DIST || dist > MAX_DIST) break;
    }
    
    if (dist > MAX_DIST) objectId = -1.0;
    
    return vec2(dist, objectId);
}

// Calculate soft shadows
float calcSoftShadow(vec3 ro, vec3 rd, float mint, float maxt, float k, sampler2D shapeData, int shapeCount) {
    float res = 1.0;
    float t = mint;
    
    for(int i = 0; i < 16; i++) {
        if (t >= maxt) break;
        float h = mapScene(ro + rd * t, shapeData, shapeCount).x;
        if (h < SURF_DIST) return 0.0;
        res = min(res, k * h / t);
        t += h;
    }
    
    return res;
}

// Calculate ambient occlusion
float calcAO(vec3 pos, vec3 nor, sampler2D shapeData, int shapeCount) {
    float occ = 0.0;
    float scale = 1.0;
    
    for (int i = 0; i < 5; i++) {
        float h = 0.01 + 0.12 * float(i) / 4.0;
        float d = mapScene(pos + h * nor, shapeData, shapeCount).x;
        occ += (h - d) * scale;
        scale *= 0.95;
    }
    
    return clamp(1.0 - 3.0 * occ, 0.0, 1.0);
}
`;