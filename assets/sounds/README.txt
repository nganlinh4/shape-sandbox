# Sound Files for Shape Sandbox

This directory would normally contain audio files for different material impacts.

## Expected Sound Files

The application can use the following MP3 files if they exist:

### Metal Impacts
- metal_impact_1.mp3
- metal_impact_2.mp3
- metal_impact_3.mp3

### Wood Impacts
- wood_impact_1.mp3
- wood_impact_2.mp3

### Glass Impacts
- glass_impact_1.mp3
- glass_impact_2.mp3
- glass_break.mp3

### Soft Impacts
- soft_impact_1.mp3
- soft_impact_2.mp3

### Generic Impacts
- generic_impact_1.mp3
- generic_impact_2.mp3

### Ambient
- ambient.mp3

## Synthesized Sounds

Since no actual audio files are present, the application automatically uses synthesized sounds via the SoundSynthesizer class. This creates procedurally generated audio effects with appropriate characteristics for each material type:

- Metal: High frequencies with resonant decay and metallic timbre
- Wood: Medium frequencies with short decay and warm timbre
- Glass: High frequencies with very short attack and pure tones
- Soft: Low frequencies with gentle attack and longer decay
- Generic: Medium characteristics for versatile use

The synthesized sounds provide realistic audio feedback without requiring external files.
