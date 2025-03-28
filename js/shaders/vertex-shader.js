/**
 * Vertex shader for the full-screen quad
 * This is a simple pass-through shader that sets up texture coordinates
 */

const VERTEX_SHADER = `
attribute vec3 aPosition;
attribute vec2 aTexCoord;

varying vec2 vTexCoord;

void main() {
    // Copy texture coordinates
    vTexCoord = aTexCoord;
    
    // Convert texture coordinates from 0-1 to -1 to 1
    vec4 positionVec4 = vec4(aPosition, 1.0);
    positionVec4.xy = positionVec4.xy * 2.0 - 1.0;
    
    // Send position to clip space
    gl_Position = positionVec4;
}
`;