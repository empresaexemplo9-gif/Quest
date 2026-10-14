#version 300 es
precision highp float;

in vec2 vTextureCoord;
out vec4 fragColor;
uniform sampler2D uDiffuse;
uniform sampler2D uPalette;
uniform bool uUsePal;
uniform vec4 uSpriteRendererColor;
uniform bool uFogUse;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uFogColor;
uniform float uShadow;
uniform vec2 uTextSize;
uniform bool uIsRGBA;

vec4 palettePixel(ivec2 pixel, ivec2 dimensions) {
    pixel = clamp(pixel, ivec2(0), dimensions - ivec2(1));
    int index = int(round(texelFetch(uDiffuse, pixel, 0).r * 255.0));
    if (index == 0) return vec4(0.0);
    // An index is an integer, not a normalized palette UV. In particular,
    // index 255 must never wrap to transparent index zero.
    return vec4(texelFetch(uPalette, ivec2(index, 0), 0).rgb, 1.0);
}

vec4 indexedSample(vec2 uv) {
    ivec2 dimensions = textureSize(uDiffuse, 0);
    vec2 position = uv * vec2(dimensions) - vec2(0.5);
    ivec2 pixel = ivec2(floor(position));
    vec2 fraction = fract(position);
    vec4 top = mix(palettePixel(pixel, dimensions),
                   palettePixel(pixel + ivec2(1, 0), dimensions), fraction.x);
    vec4 bottom = mix(palettePixel(pixel + ivec2(0, 1), dimensions),
                      palettePixel(pixel + ivec2(1, 1), dimensions), fraction.x);
    vec4 color = mix(top, bottom, fraction.y);
    // The four samples are premultiplied (transparent RGB is zero).
    // Return straight RGB for the renderer's SRC_ALPHA blending.
    if (color.a > 0.0) color.rgb /= color.a;
    return color;
}

void main(void) {
    if (uSpriteRendererColor.a == 0.0) discard;
    vec4 color = uUsePal ? indexedSample(vTextureCoord) : texture(uDiffuse, vTextureCoord);
    if (color.a == 0.0) discard;
    color.rgb *= uShadow;
    fragColor = color * uSpriteRendererColor;
    if (uFogUse) {
        float depth = gl_FragCoord.z / gl_FragCoord.w;
        float fog = smoothstep(uFogNear, uFogFar, depth);
        fragColor = mix(fragColor, vec4(uFogColor, fragColor.a), fog);
    }
}
