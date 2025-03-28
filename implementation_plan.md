# Project: p5.js WebGL Shape Sandbox - "Material Flux"

**Vision:** An interactive, visually stunning 3D sandbox environment built with p5.js in WebGL mode. Users can spawn, manipulate, and collide various geometric shapes, each rendered with unique, dynamic materials using advanced ray marching techniques for realistic lighting, soft shadows, and effects. The experience should be playful, experimental, and mesmerizing.

**Core Technologies:**

*   **Engine:** p5.js with WebGL mode enabled (`createCanvas(w, h, WEBGL)`).
*   **Language:** JavaScript (ES6+) for logic, interaction, and p5.js setup.
*   **Shaders:** GLSL (OpenGL Shading Language) for custom rendering (ray marching, lighting, materials).
*   **Physics:** `cannon-es` (a maintained fork of cannon.js) for 3D physics simulation (collision detection, rigid body dynamics).
*   **Audio:** `p5.sound` library for interactive sound effects.
*   **UI (Optional but Recommended):** `Tweakpane` or `dat.GUI` for real-time parameter control.

---

## I. Core Rendering Engine (Ray Marching in GLSL)

*   **Approach:** The primary rendering will *not* use p5.js's built-in `box()`, `sphere()`, etc. Instead, we'll draw a single full-screen quad/canvas and perform all scene rendering within a custom fragment shader using Ray Marching.
*   **Ray Marching Fundamentals:**
    *   **Fragment Shader:** The core logic resides here. For each pixel (fragment):
        1.  Calculate the camera ray origin and direction.
        2.  March the ray through the scene using a Signed Distance Function (SDF).
        3.  If a surface is hit:
            *   Determine *which* shape was hit (needs object IDs).
            *   Calculate surface normal (using SDF gradient).
            *   Calculate lighting, shadows, and material properties.
            *   Output the final color.
        4.  If no surface is hit, output background/skybox color.
*   **Scene SDF (`mapScene` function in GLSL):**
    *   **Input:** A 3D point in space.
    *   **Output:** The shortest distance to *any* object in the scene and the ID/material index of the closest object.
    *   **Implementation:**
        *   Define SDF functions for primitive shapes (`sdSphere`, `sdBox`, `sdTorus`, `sdCylinder`, `sdCone`, `sdCapsule`, `sdPlane`, etc.).
        *   Define SDF operations (`opUnion`, `opSmoothUnion`, `opIntersection`, `opSubtraction`) to combine primitives.
        *   The main `mapScene` function will iterate through all active shapes defined in the p5.js sketch, transform the sample point into each shape's local space, calculate the SDF distance for that shape, and find the minimum distance across all shapes. Store the ID of the winning shape.
*   **Data Transfer (p5.js -> GLSL):**
    *   **Challenge:** Need to pass dynamic scene data (shape types, positions, rotations, sizes, material IDs) to the shader efficiently.
    *   **Solution:**
        *   **Uniform Arrays:** Suitable for a *small, fixed* number of shapes. Limited by uniform count/size.
        *   **Data Textures (Recommended):** Encode shape parameters (position vec3, quaternion vec4, size vec3, type enum, material ID) into RGBA values of pixels in a texture. Pass this texture as a `sampler2D` uniform. The shader then fetches data from this texture based on an index. This scales to hundreds or thousands of objects.
        *   **UBOs (Uniform Buffer Objects):** More modern WebGL2 approach, potentially faster, but slightly more complex setup than textures. (p5.js might require accessing the raw WebGL context for this).
*   **Camera:**
    *   Implement standard perspective camera controls (orbit, pan, zoom). p5.js `orbitControl()` can handle user input, but we need to pass the resulting camera matrix (or position/target/up vectors) to the shader as uniforms (`uCameraPos`, `uViewMatrix`, `uProjectionMatrix`).

## II. Advanced Lighting & Shadows (GLSL)

*   **Lighting Model:**
    *   **PBR (Physically Based Rendering) Elements:** Implement components like:
        *   `Albedo`: Base color (from material).
        *   `Metallic`: Metalness factor (0=dielectric, 1=metal).
        *   `Roughness`: Surface smoothness (0=mirror, 1=diffuse).
        *   `AO (Ambient Occlusion)`: Use screen-space AO (SSAO) or derive AO from the ray marching process itself (e.g., sphere tracing in cone).
        *   `Emissive`: Light emitted by the material itself.
    *   **Light Sources:**
        *   Support multiple light types (Directional, Point, Spot) passed as uniforms (position, direction, color, intensity, attenuation).
*   **Shadows:**
    *   **Soft Shadows (Ray Marching Advantage):** Instead of marching a hard shadow ray, march towards the light source from the surface point. The minimum distance encountered during this march, relative to the distance traveled, gives a softness factor (using `k` factor technique).
    *   `float calcSoftShadow(vec3 ro, vec3 rd, float k)` function in GLSL.
*   **Reflections / Refractions (Advanced):**
    *   For reflective/refractive materials (glass, polished metal), cast secondary rays from the hit point.
    *   Limit recursion depth (`#define MAX_BOUNCES`) for performance.
    *   Can use the scene SDF again for these secondary rays. Refraction requires handling `refract()` function and potentially total internal reflection.
*   **Environment Mapping:**
    *   Use a Cube Map (`samplerCube` uniform) or Equirectangular Map (`sampler2D` uniform) for Image-Based Lighting (IBL).
    *   Sample the environment map for ambient light and reflections, especially for smoother surfaces based on roughness.

## III. Shapes & Materials

*   **Shape Definition (p5.js):**
    *   Use JavaScript classes or objects to represent shapes.
    *   `Shape` class attributes: `id`, `type` (enum: SPHERE, BOX, TORUS...), `position` (p5.Vector), `orientation` (Quaternion or Euler angles, synched with physics), `size` (p5.Vector or scalar), `materialId`.
*   **Material Definition (p5.js & GLSL):**
    *   **p5.js:** Define an array of material objects/structs.
        *   `Material { id, albedo (color), metallic (float), roughness (float), emissive (color), textureIndex (optional, int), soundType (enum) }`
    *   **GLSL:**
        *   Pass the material array via uniforms (if small) or packed into another Data Texture (`uMaterialDataTexture`).
        *   In the fragment shader, after hitting an object and getting its `materialId` from the scene SDF result, fetch the corresponding material properties from the uniform/texture.
*   **Material Variety (Ideas):**
    *   **Matte:** High roughness, low metallic.
    *   **Metallic:** High metallic, variable roughness (polished to brushed).
    *   **Glass:** Requires secondary rays for refraction/reflection. Add `ior` (index of refraction) property.
    *   **Emissive:** Non-zero `emissive` color. Glow effect (see Post-Processing).
    *   **Velvet/Subsurface Scattering (Approximate):** Fake SSS using view/normal dot product influencing color.
    *   **Procedural Patterns:** Use `noise()` (Perlin, Simplex), `fract()`, `mod()` within the shader, driven by world-space or object-space coordinates, to generate patterns (wood grain, marble, stripes) directly on the surface. Modulate albedo, roughness etc.
    *   **Textured:** Allow assigning textures (loaded via `loadImage`) to materials. Pass textures as `sampler2D` uniforms. Need UV coordinates (can be generated procedurally for basic shapes like boxes/spheres or using tri-planar mapping).

## IV. Physics & Interaction

*   **Physics Engine Setup (`cannon-es`):**
    *   Create a `CANNON.World` instance. Set gravity.
    *   For each p5.js `Shape` object, create a corresponding `CANNON.Body`.
        *   `CANNON.Body` needs `mass`, `position`, `quaternion`.
        *   Add `CANNON.Shape` (e.g., `CANNON.Sphere`, `CANNON.Box`, `CANNON.Cylinder`) matching the visual shape. Compound shapes might be needed for complex objects.
        *   Add the body to the world.
*   **Synchronization Loop (in `draw()`):**
    1.  `world.step(1 / 60, deltaTime, 3);` // Step the physics simulation.
    2.  Iterate through all p5.js `Shape` objects.
    3.  Copy the `position` (Vector) and `quaternion` (Quaternion) from the corresponding `CANNON.Body` to the p5.js `Shape` object.
    4.  Update the Data Texture containing shape parameters for the shader.
*   **Interaction ("Throwing"):**
    1.  **Picking:** On `mousePressed`:
        *   Perform raycasting from the camera through the mouse position into the `CANNON.World` using `world.raycastClosest()`.
        *   If a body is hit, store a reference to it. Create a `CANNON.PointToPointConstraint` or `CANNON.DistanceConstraint` to "grab" the object relative to the mouse ray.
    2.  **Dragging:** On `mouseDragged`:
        *   Update the constraint's target position based on the mouse movement projected onto a plane in 3D space.
    3.  **Throwing:** On `mouseReleased`:
        *   Remove the constraint.
        *   Calculate the velocity of the grabbed point just before release (based on mouse movement history).
        *   Apply an impulse (`body.applyImpulse()`) or directly set the velocity (`body.velocity.set()`) to the released body.
*   **Collision Handling:**
    *   Attach event listeners to `CANNON.Body` objects for collisions (`'collide'`).
    *   `body.addEventListener('collide', function(event) { ... });`
    *   Inside the event handler:
        *   Get information about the collision (colliding bodies, contact points, impact velocity/normal). `event.contact`.
        *   Trigger sound effects based on impact strength and material types.

## V. Audio (`p5.sound`)

*   **Sound Design:**
    *   Load a variety of short impact sounds (`loadSound`).
    *   Categorize sounds based on conceptual material types (e.g., `wood_impact`, `metal_impact`, `glass_shatter`, `soft_thud`).
    *   Maybe have different sounds for low vs. high velocity impacts.
*   **Collision Sound Triggering:**
    *   In the `cannon-es` collision event handler:
        1.  Determine the `materialId` (and thus `soundType`) of the two colliding p5.js `Shape` objects (look them up based on the `CANNON.Body` involved).
        2.  Calculate the relative velocity magnitude at the contact point (`event.contact.getImpactVelocityAlongNormal()`).
        3.  Select an appropriate sound based on the `soundType`s involved (e.g., metal-on-wood, glass-on-metal).
        4.  Map the impact velocity to the sound's playback rate (`rate()`) and/or volume (`amp()`). Higher velocity = louder/higher pitch.
        5.  Play the sound (`sound.play()`). Use `.setVolume()` instead of `.amp()` for better control if needed.
*   **Ambient Sound:** Consider adding a subtle looping ambient soundscape for atmosphere.

## VI. User Interface (`Tweakpane` / `dat.GUI` / p5.dom)

*   **Controls:**
    *   Add/Remove Shapes: Buttons to spawn selected shape types. Button to clear scene.
    *   Shape Selection: Dropdown or list to choose which shape type to spawn.
    *   Material Editor: Select a shape (or globally edit material defaults) and tweak its `albedo`, `metallic`, `roughness`, `emissive` values using sliders/color pickers.
    *   Lighting Controls: Adjust position/direction, color, intensity of light sources.
    *   Environment Controls: Select environment map, adjust intensity.
    *   Physics Controls: Adjust gravity, toggle physics simulation.
    *   Rendering Controls: Toggle shadows, reflections, AO, post-processing effects. Performance stats (FPS).

## VII. Creative Flair & More Ideas

*   **Post-Processing Effects:**
    *   Render the ray marched scene to a p5 `Framebuffer` / `createGraphics(w, h, WEBGL)`.
    *   Apply additional shader passes to this texture for effects:
        *   **Bloom:** Threshold bright areas, blur them, and additively blend back.
        *   **Depth of Field (DoF):** Use depth information (can be calculated during ray marching and stored in alpha or another buffer) to selectively blur.
        *   **Motion Blur:** Accumulate frames or use velocity buffer (more complex).
        *   **Chromatic Aberration:** Slightly offset R, G, B channel samples based on distance from screen center.
        *   **Vignette:** Darken screen edges.
*   **Dynamic Environments:**
    *   Animated skybox / environment map.
    *   Simple ground plane SDF (`sdPlane`) integrated into `mapScene`.
*   **Shape Morphing:** Animate SDF parameters smoothly between states using `lerp()` or easing functions. Requires careful SDF definition.
*   **Fractal Shapes:** Implement SDFs for Mandelbulb, Menger Sponge, etc. (Performance intensive!).
*   **Forces & Fields:** Add invisible force volumes (wind zones using `body.applyForce()`, attractors/repulsors) affecting physics bodies.
*   **Audio Reactivity:** Modulate material properties, lighting, or shape parameters based on external audio input (`p5.AudioIn`).
*   **Destructible Shapes (Very Advanced):** On high impact, replace one `CANNON.Body` with multiple smaller ones (fragmentation). Requires complex logic for both physics and updating the shader's scene representation.
*   **Saving/Loading Scene:** Serialize the state of all shapes (type, transform, material) to JSON, allow loading back.

## VIII. Technical Challenges & Considerations

*   **Ray Marching Complexity:** Requires strong understanding of vector math, GLSL, and SDF principles. Debugging shaders can be difficult.
*   **Performance:** Ray marching is inherently expensive.
    *   Optimize SDFs (`opSmoothUnion` is costly).
    *   Limit ray marching steps (`#define MAX_STEPS`).
    *   Implement bounding volumes in the shader to skip sections of the scene.
    *   Use lower resolution rendering and upscale, or implement adaptive resolution.
    *   Carefully manage the number of dynamic objects passed to the shader.
*   **p5.js Abstraction vs. Raw WebGL:** For advanced features like UBOs, multi-pass rendering, or fine-grained texture control, you might need to access the underlying WebGL rendering context (`p5.renderer.GL`).
*   **Physics Accuracy vs. Performance:** Tuning `cannon-es` parameters (`solver iterations`, `time step`) is crucial. Complex collisions can slow down the simulation.
*   **Data Texture Management:** Packing/unpacking data correctly into textures requires care. Floating point textures might be needed for precision (`WEBGL_color_buffer_float` extension).

## IX. Phased Development Plan

1.  **Phase 1: Basic Setup & Ray Marching Core**
    *   p5.js WebGL canvas.
    *   Basic full-screen quad shader.
    *   Implement ray marching loop, camera setup (pass uniforms).
    *   Implement SDF for a single sphere (`sdSphere`), basic normal calculation.
    *   Simple diffuse lighting (dot(normal, lightDir)).
2.  **Phase 2: Scene Definition & Multiple Shapes**
    *   Implement SDFs for Box, Torus.
    *   Implement SDF union (`opU`).
    *   Pass multiple shape parameters (position, size, type, ID) via uniforms (initially) or Data Texture.
    *   Modify `mapScene` to find the closest shape.
3.  **Phase 3: Materials & Advanced Lighting**
    *   Implement basic material struct in GLSL (albedo).
    *   Pass material data (Data Texture or uniforms).
    *   Assign material ID in `mapScene`, fetch properties in shader.
    *   Implement PBR lighting terms (Metallic, Roughness).
    *   Implement soft shadows.
4.  **Phase 4: Physics Integration**
    *   Integrate `cannon-es`.
    *   Create physics bodies corresponding to visual shapes.
    *   Implement sync loop (physics -> visual transform).
    *   Update shader data texture each frame.
5.  **Phase 5: Interaction & Audio**
    *   Implement mouse picking/dragging/throwing using `cannon-es` constraints/impulses.
    *   Integrate `p5.sound`.
    *   Implement collision detection listener in `cannon-es`.
    *   Trigger basic sounds on collision, varying volume with impact.
6.  **Phase 6: Polish & Expansion**
    *   Add UI controls (Tweakpane/dat.GUI).
    *   Add more shape types (Cylinder, Cone, Capsule).
    *   Add more material types (Glass, Emissive, Procedural).
    *   Implement environment mapping (IBL).
    *   Refine sound design (material-specific sounds).
7.  **Phase 7: Advanced Effects & Optimization**
    *   Implement post-processing effects (Bloom, DoF).
    *   Optimize shaders and physics.
    *   Explore creative ideas (forces, fractals, etc.).

---

This plan provides a comprehensive roadmap, blending creative goals with technical details. Remember that the ray marching aspect is the most significant technical hurdle, requiring dedicated learning if you're new to it. Good luck!