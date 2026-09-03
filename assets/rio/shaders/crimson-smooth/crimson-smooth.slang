#version 450

layout(push_constant) uniform Push
{
	vec4 SourceSize;
	vec4 OutputSize;
	uint FrameCount;
	float bloom;
	float sheen;
} params;

#pragma parameter bloom "Crimson Bloom" 1.0 0.0 2.0 0.05
#pragma parameter sheen "Panel Sheen" 1.0 0.0 2.0 0.05
#define backbuffer accum1
#define blurbuffer blur2

layout(std140, set = 0, binding = 0) uniform UBO
{
	mat4 MVP;
} global;

#pragma stage vertex
layout(location = 0) in vec4 Position;
layout(location = 1) in vec2 TexCoord;
layout(location = 0) out vec2 vTexCoord;

void main()
{
   gl_Position = global.MVP * Position;
   vTexCoord = vec2(TexCoord.x, 1.0 - TexCoord.y);
}

#pragma stage fragment
layout(location = 0) in vec2 vTexCoord;
layout(location = 0) out vec4 FragColor;
layout(set = 0, binding = 2) uniform sampler2D Source;
layout(set = 0, binding = 3) uniform sampler2D accum1;
layout(set = 0, binding = 4) uniform sampler2D blur2;

vec3 fetch( sampler2D samp, vec2 tc )
    {
    return texture( samp, vec2( tc.x, 1.0 - tc.y ) ).rgb;
    }
float luma( vec3 c )
    {
    return dot( c, vec3( 0.299, 0.587, 0.114 ) );
    }
float hash( vec2 p )
    {
    return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 );
    }

#define VOID     vec3( 0.026, 0.013, 0.017 )
#define SMOKE    vec3( 0.068, 0.052, 0.058 )
#define CRIMSON  vec3( 1.000, 0.078, 0.176 )
#define EMBER    vec3( 0.660, 0.048, 0.100 )
#define SILVER   vec3( 0.900, 0.898, 0.905 )

#define CORNER_R  9.0

void main()
{
    vec2  uv  = vTexCoord.xy;
    vec2  res = params.OutputSize.xy;
    vec2  px  = uv * res;

    vec3  src  = fetch( backbuffer, uv );
    float slum = luma( src );
    float ink  = smoothstep( 0.090, 0.300, slum );

    vec2  q   = abs( px - res * 0.5 ) - ( res * 0.5 - vec2( CORNER_R ) );
    float sdf = length( max( q, vec2( 0.0 ) ) ) + min( max( q.x, q.y ), 0.0 ) - CORNER_R;
    float body = 1.0 - smoothstep( -0.9, 0.9, sdf );
    float rim  = 1.0 - smoothstep( 1.0, 2.2, abs( sdf + 2.2 ) );

    float lift = mix( 1.00, 1.62, smoothstep( 0.0, 1.0, uv.y ) );
    vec2  vp   = ( uv - 0.5 ) * vec2( 1.06, 1.0 );
    float vg   = 1.0 - 0.52 * pow( clamp( length( vp ) * 1.32, 0.0, 1.0 ), 2.0 );

    vec3 col = VOID * lift * vg;

    float emb = pow( clamp( 1.0 - uv.y, 0.0, 1.0 ), 4.5 );
    float halo = pow( clamp( length( vp ) * 1.30, 0.0, 1.0 ), 2.8 );
    col += EMBER * emb * 0.260 * params.sheen;
    col += EMBER * halo * 0.075 * params.sheen;
    col += SILVER * pow( clamp( uv.y, 0.0, 1.0 ), 7.0 ) * 0.020 * params.sheen;
    col += SMOKE * ( 1.0 - smoothstep( 0.0, 0.34, length( vp ) ) ) * 0.24;

    col += vec3( ( hash( floor( px ) ) - 0.5 ) * 0.007 );

    vec3  blr = fetch( blurbuffer, uv + vec2( -0.0009, 0.0012 ) );
    float mat = smoothstep( 0.045, 0.330, luma( blr ) );
    col += CRIMSON * mat * 0.165 * params.bloom;

    col = mix( col, CRIMSON * 0.88, rim * 0.52 );
    col = mix( col, src * vec3( 1.000, 0.988, 0.990 ) + blr * CRIMSON * 0.26, ink );

    col = clamp( col, vec3( 0.0 ), vec3( 1.0 ) );

    const float PLATE_ALPHA = 0.52;
    float alpha = PLATE_ALPHA + ( 1.0 - PLATE_ALPHA )
                * clamp( ink * 2.4 + mat * 0.90 + rim * 0.85 + emb * 0.35, 0.0, 1.0 );
    alpha = clamp( alpha, 0.0, 1.0 ) * body;

    FragColor = vec4( col * alpha, alpha );
}
