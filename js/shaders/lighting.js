/**
 * Lighting calculations for PBR (Physically Based Rendering)
 * These functions will be included in the fragment shader
 */

const LIGHTING_FUNCTIONS = `
// PBR Functions

// Calculate distribution of microfacet normals (GGX/Trowbridge-Reitz)
float distributionGGX(vec3 N, vec3 H, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH = max(dot(N, H), 0.0);
    float NdotH2 = NdotH * NdotH;
    
    float nom   = a2;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;
    
    return nom / max(denom, 0.0001);
}

// Calculate geometric attenuation (Smith's method with GGX)
float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggx1 = geometrySchlickGGX(NdotV, roughness);
    float ggx2 = geometrySchlickGGX(NdotL, roughness);
    
    return ggx1 * ggx2;
}

// Helper for geometric attenuation calculation
float geometrySchlickGGX(float NdotV, float roughness) {
    float r = (roughness + 1.0);
    float k = (r * r) / 8.0;
    
    float nom   = NdotV;
    float denom = NdotV * (1.0 - k) + k;
    
    return nom / max(denom, 0.0001);
}

// Calculate Fresnel effect (Schlick approximation)
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(max(1.0 - cosTheta, 0.0), 5.0);
}

// Extended Fresnel-Schlick with roughness
vec3 fresnelSchlickRoughness(float cosTheta, vec3 F0, float roughness) {
    return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(max(1.0 - cosTheta, 0.0), 5.0);
}

// Calculate PBR lighting
vec3 calculatePBRLighting(
    vec3 worldPos, 
    vec3 N, 
    vec3 V,
    vec3 albedo,
    float metallic,
    float roughness,
    vec3 emissive,
    sampler2D shapeData,
    int shapeCount,
    vec3 lightDir,
    vec3 lightColor,
    vec3 ambientColor,
    float shadowSoftness
) {
    // Calculate base reflectivity
    vec3 F0 = vec3(0.04);
    F0 = mix(F0, albedo, metallic);
    
    // Initialize lighting components
    vec3 Lo = vec3(0.0);
    
    // Calculate directional light
    vec3 L = normalize(-lightDir); // Light direction (pointing towards the fragment)
    vec3 H = normalize(V + L);     // Halfway vector
    
    // Calculate shadow
    float shadow = calcSoftShadow(worldPos, L, 0.1, 20.0, shadowSoftness, shapeData, shapeCount);
    
    // Calculate radiance
    vec3 radiance = lightColor;
    
    // Cook-Torrance BRDF
    float NDF = distributionGGX(N, H, roughness);
    float G = geometrySmith(N, V, L, roughness);
    vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);
    
    vec3 kS = F;
    vec3 kD = vec3(1.0) - kS;
    kD *= 1.0 - metallic;
    
    vec3 numerator = NDF * G * F;
    float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0);
    vec3 specular = numerator / max(denominator, 0.001);
    
    // Add contribution
    float NdotL = max(dot(N, L), 0.0);
    Lo += (kD * albedo / PI + specular) * radiance * NdotL * shadow;
    
    // Calculate ambient lighting (with ambient occlusion)
    float ao = calcAO(worldPos, N, shapeData, shapeCount);
    vec3 ambient = ambientColor * albedo * ao;
    
    // Combine lighting components
    vec3 color = ambient + Lo + emissive;
    
    // HDR tone mapping (simple Reinhard)
    color = color / (color + vec3(1.0));
    
    // Gamma correction
    color = pow(color, vec3(1.0/2.2));
    
    return color;
}
`;