/**
 * Fragment shader for ray marching rendering
 * This handles all the rendering of shapes, materials, and lighting
 */

const FRAGMENT_SHADER = `
#ifdef GL_ES
precision highp float;
#endif

// Constants
#define PI 3.14159265359

// Varying inputs from vertex shader
varying vec2 vTexCoord;

// Texture samplers
uniform sampler2D uShapeData;  // Texture containing shape data
uniform sampler2D uMaterialData;  // Texture containing material data
uniform samplerCube uEnvironmentMap; // Environment map (optional)

// Camera uniforms
uniform vec3 uCameraPosition;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;
uniform float uFov;
uniform float uAspect;
uniform float uNear;
uniform float uFar;

// Scene uniforms
uniform int uShapeCount;
uniform vec3 uLightDirection;
uniform vec3 uLightColor;
uniform vec3 uAmbientColor;
uniform float uShadowSoftness;
uniform vec3 uBackgroundColor;

// Time uniform for animations
uniform float uTime;

// Import SDF and lighting functions 
${SDF_FUNCTIONS}
${LIGHTING_FUNCTIONS}

// Calculate camera ray based on UV coordinates
vec3 getCameraRay(vec2 uv) {
    // Convert UV from (0,1) to (-1,1) range
    uv = 2.0 * uv - 1.0;
    
    // Adjust for aspect ratio
    uv.x *= uAspect;
    
    // Calculate field of view
    float fovScale = tan(uFov * 0.5 * PI / 180.0);
    
    // Get view-space ray direction
    vec3 rayDir = normalize(vec3(uv * fovScale, -1.0));
    
    // Transform into world space using view matrix
    vec3 worldRayDir = (inverse(uViewMatrix) * vec4(rayDir, 0.0)).xyz;
    
    return normalize(worldRayDir);
}

// Fetch material properties from the material data texture
void getMaterialProperties(
    float materialId, 
    out vec3 albedo, 
    out float metallic, 
    out float roughness, 
    out vec3 emissive,
    out float ior
) {
    int matIndex = int(materialId);
    
    // Default material values (in case material data is invalid)
    albedo = vec3(0.8, 0.8, 0.8);
    metallic = 0.0;
    roughness = 0.5;
    emissive = vec3(0.0);
    ior = 1.45;
    
    // Read material data from texture
    vec4 albedoMetal = texelFetch(uMaterialData, ivec2(0, matIndex), 0);
    vec4 roughIorData = texelFetch(uMaterialData, ivec2(1, matIndex), 0);
    vec4 emissiveData = texelFetch(uMaterialData, ivec2(2, matIndex), 0);
    
    // Extract properties
    albedo = albedoMetal.rgb;
    metallic = albedoMetal.a;
    roughness = roughIorData.x;
    emissive = emissiveData.rgb;
    ior = roughIorData.z;
}

void main() {
    // Flip Y coordinate to match p5.js texture coordinates
    vec2 uv = vec2(vTexCoord.x, 1.0 - vTexCoord.y);
    
    // Calculate ray origin and direction
    vec3 ro = uCameraPosition;
    vec3 rd = getCameraRay(uv);
    
    // Ray march the scene
    vec2 result = rayMarch(ro, rd, uShapeData, uShapeCount);
    float dist = result.x;
    float objectId = result.y;
    
    // Initialize with background color
    vec3 color = uBackgroundColor;
    
    // If we hit something
    if (objectId > -0.5) {
        // Calculate world position of hit point
        vec3 worldPos = ro + rd * dist;
        
        // Calculate surface normal
        vec3 normal = calcNormal(worldPos, uShapeData, uShapeCount);
        
        // Get material ID for this object
        float materialId = -1.0;
        
        // Find the shape with matching ID to get its material
        for (int i = 0; i < MAX_STEPS; i++) {
            if (i >= uShapeCount) break;
            
            vec4 posData = texelFetch(uShapeData, ivec2(0, i), 0);
            vec4 matData = texelFetch(uShapeData, ivec2(3, i), 0);
            
            if (abs(posData.w - objectId) < 0.1) { // Compare IDs with a small epsilon
                materialId = matData.x;
                break;
            }
        }
        
        // Get material properties
        vec3 albedo;
        float metallic;
        float roughness;
        vec3 emissive;
        float ior;
        
        getMaterialProperties(materialId, albedo, metallic, roughness, emissive, ior);
        
        // Calculate view direction
        vec3 viewDir = normalize(uCameraPosition - worldPos);
        
        // Apply PBR lighting
        color = calculatePBRLighting(
            worldPos, 
            normal, 
            viewDir, 
            albedo, 
            metallic, 
            roughness, 
            emissive,
            uShapeData,
            uShapeCount,
            uLightDirection,
            uLightColor,
            uAmbientColor,
            uShadowSoftness
        );
    }
    
    // Output final color
    gl_FragColor = vec4(color, 1.0);
}
`;