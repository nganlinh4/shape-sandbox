/**
 * Math utilities for vector operations, transformations, and more
 */

class MathUtils {
    /**
     * Creates a quaternion from Euler angles (in radians)
     * @param {number} x - Rotation around X-axis (radians)
     * @param {number} y - Rotation around Y-axis (radians)
     * @param {number} z - Rotation around Z-axis (radians)
     * @returns {array} Quaternion as [x, y, z, w]
     */
    static eulerToQuaternion(x, y, z) {
        // Abbreviations for the various angular functions
        const cx = Math.cos(x * 0.5);
        const cy = Math.cos(y * 0.5);
        const cz = Math.cos(z * 0.5);
        const sx = Math.sin(x * 0.5);
        const sy = Math.sin(y * 0.5);
        const sz = Math.sin(z * 0.5);
        
        return [
            sx * cy * cz - cx * sy * sz,  // x
            cx * sy * cz + sx * cy * sz,  // y
            cx * cy * sz - sx * sy * cz,  // z
            cx * cy * cz + sx * sy * sz   // w
        ];
    }
    
    /**
     * Converts degrees to radians
     * @param {number} degrees - Angle in degrees
     * @returns {number} Angle in radians
     */
    static degToRad(degrees) {
        return degrees * Math.PI / 180;
    }
    
    /**
     * Converts radians to degrees
     * @param {number} radians - Angle in radians
     * @returns {number} Angle in degrees
     */
    static radToDeg(radians) {
        return radians * 180 / Math.PI;
    }
    
    /**
     * Linear interpolation between two values
     * @param {number} a - Start value
     * @param {number} b - End value
     * @param {number} t - Interpolation factor (0-1)
     * @returns {number} Interpolated value
     */
    static lerp(a, b, t) {
        return a + (b - a) * t;
    }
    
    /**
     * Linear interpolation between two vectors
     * @param {array} a - Start vector
     * @param {array} b - End vector
     * @param {number} t - Interpolation factor (0-1)
     * @returns {array} Interpolated vector
     */
    static lerpVec(a, b, t) {
        return a.map((v, i) => MathUtils.lerp(v, b[i], t));
    }
    
    /**
     * Converts a p5.Vector to an array
     * @param {p5.Vector} vec - The p5.Vector to convert
     * @returns {array} Array representation [x, y, z]
     */
    static vecToArray(vec) {
        return [vec.x, vec.y, vec.z];
    }
    
    /**
     * Creates a p5.Vector from an array
     * @param {array} arr - Array with [x, y, z] components
     * @returns {p5.Vector} The created p5.Vector
     */
    static arrayToVec(arr) {
        return createVector(arr[0], arr[1], arr[2]);
    }
    
    /**
     * Calculate the dot product of two vectors
     * @param {array} a - First vector
     * @param {array} b - Second vector
     * @returns {number} Dot product
     */
    static dot(a, b) {
        return a.reduce((sum, val, i) => sum + val * b[i], 0);
    }
    
    /**
     * Calculate the cross product of two 3D vectors
     * @param {array} a - First vector [x, y, z]
     * @param {array} b - Second vector [x, y, z]
     * @returns {array} Cross product [x, y, z]
     */
    static cross(a, b) {
        return [
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0]
        ];
    }
    
    /**
     * Calculate the length of a vector
     * @param {array} v - Vector
     * @returns {number} Length
     */
    static length(v) {
        return Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
    }
    
    /**
     * Normalize a vector to unit length
     * @param {array} v - Vector to normalize
     * @returns {array} Normalized vector
     */
    static normalize(v) {
        const len = this.length(v);
        if (len === 0) return v.map(() => 0);
        return v.map(val => val / len);
    }
    
    /**
     * Convert from HSL to RGB color space
     * @param {number} h - Hue (0-1)
     * @param {number} s - Saturation (0-1)
     * @param {number} l - Lightness (0-1)
     * @returns {array} RGB color array [r, g, b] (0-1)
     */
    static hslToRgb(h, s, l) {
        let r, g, b;

        if (s === 0) {
            r = g = b = l; // achromatic
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }

        return [r, g, b];
    }
}