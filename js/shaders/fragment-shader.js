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
#define MAX_BOUNCES 2

// Varying inputs from vertex shader
varying vec2 vTexCoord;

// Texture samplers
uniform sampler2D uShapeData;  // Texture containing shape data
uniform sampler2D uMaterialData;  // Texture containing material data
uniform samplerCube uEnvironmentMap; // Environment map for reflections

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
uniform bool uEnvMapEnabled;
uniform float uEnvMapIntensity;

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
    out float ior,
    out float transparent
) {
    int matIndex = int(materialId);
    
    // Default material values (in case material data is invalid)
    albedo = vec3(0.8, 0.8, 0.8);
    metallic = 0.0;
    roughness = 0.5;
    emissive = vec3(0.0);
    ior = 1.45;
    transparent = 0.0;
    
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
    
    // Extract transparency flag from flags
    float flags = roughIorData.w;
    transparent = step(0.5, mod(flags, 2.0)); // Check bit 0 for transparency
}

// Sample environment map with roughness
vec3 sampleEnvironmentMap(vec3 direction, float roughness) {
    if (uEnvMapEnabled) {
        // Adjust roughness for better visual results
        float adjustedRoughness = roughness * roughness * 8.0;
        
        // For simple env map sampling without importance sampling, 
        // just use a high mipmap level for rough surfaces
        // Note: this is just an approximation, real engines use importance sampling
        return textureLod(uEnvironmentMap, direction, adjustedRoughness).rgb * uEnvMapIntensity;
    }
    
    // Default sky color if no environment map is available
    vec3 skyColor = vec3(0.2, 0.3, 0.5);
    vec3 groundColor = vec3(0.1, 0.1, 0.1);
    float blend = 0.5 + 0.5 * direction.y;
    return mix(groundColor, skyColor, blend);
}

// Trace a ray through the scene
vec4 traceRay(vec3 ro, vec3 rd, float maxDist, int bounces) {
    // Ray march the scene
    vec2 result = rayMarch(ro, rd, uShapeData, uShapeCount);
    float dist = result.x;
    float objectId = result.y;
    
    // If we hit something
    if (objectId > -0.5 && dist < maxDist) {
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
        float transparent;
        
        getMaterialProperties(materialId, albedo, metallic, roughness, emissive, ior, transparent);
        
        // Calculate view direction
        vec3 viewDir = normalize(uCameraPosition - worldPos);
        
        // Initialize color with direct lighting
        vec3 directColor = calculatePBRLighting(
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
        
        // Add reflection contribution if material is reflective (metallic or smooth)
        if ((metallic > 0.0 || roughness < 0.5) && bounces > 0) {
            // Calculate reflection direction
            vec3 reflectDir = reflect(-viewDir, normal);
            
            // Calculate reflection contribution based on Fresnel
            vec3 F0 = vec3(0.04);
            F0 = mix(F0, albedo, metallic);
            vec3 F = fresnelSchlickRoughness(max(dot(normal, viewDir), 0.0), F0, roughness);
            
            // Use environment map for reflection or trace another ray
            vec3 reflectionColor;
            
            if (roughness < 0.1 && bounces > 0) {
                // For very smooth surfaces, trace a reflection ray
                vec4 reflectionResult = traceRay(
                    worldPos + normal * 0.01, // Slight offset to avoid self-intersection
                    reflectDir, 
                    maxDist, 
                    bounces - 1
                );
                reflectionColor = reflectionResult.rgb;
            } else {
                // For rougher surfaces, use environment map directly
                reflectionColor = sampleEnvironmentMap(reflectDir, roughness);
            }
            
            // Add reflection contribution
            directColor = mix(directColor, reflectionColor, F * (1.0 - roughness));
        }
        
        // For transparent materials, add refraction
        if (transparent > 0.5 && bounces > 0) {
            // Calculate refraction direction
            float eta = 1.0 / ior; // Assuming ray goes from air to material
            vec3 refractDir = refract(-viewDir, normal, eta);
            
            if (length(refractDir) > 0.0) { // Check for total internal reflection
                vec4 refractResult = traceRay(
                    worldPos - normal * 0.01, // Offset against the normal
                    refractDir, 
                    maxDist, 
                    bounces - 1
                );
                
                // Blend refraction with direct lighting
                directColor = mix(directColor, refractResult.rgb, 0.8);
            }
        }
        
        return vec4(directColor, 1.0);
    }
    
    // Return environment/skybox color when no object is hit
    return vec4(sampleEnvironmentMap(rd, 0.0), 1.0);
}

void main() {
    // Flip Y coordinate to match p5.js texture coordinates
    vec2 uv = vec2(vTexCoord.x, 1.0 - vTexCoord.y);
    
    // Calculate ray origin and direction
    vec3 ro = uCameraPosition;
    vec3 rd = getCameraRay(uv);
    
    // Trace primary ray
    vec4 colorResult = traceRay(ro, rd, 1000.0, MAX_BOUNCES);
    vec3 color = colorResult.rgb;
    
    // HDR tone mapping (simple Reinhard)
    color = color / (color + vec3(1.0));
    
    // Gamma correction
    color = pow(color, vec3(1.0/2.2));
    
    // Output final color
    gl_FragColor = vec4(color, 1.0);
}
`;