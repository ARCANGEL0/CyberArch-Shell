#version 450

layout(push_constant) uniform Push
{
	vec4 SourceSize;
	vec4 OutputSize;
	uint FrameCount;
	float veil;
	float glow;
} params;

#pragma parameter veil "Fog Density" 1.0 0.0 2.0 0.05
#pragma parameter glow "Blood Glow" 1.0 0.0 2.0 0.05
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
float linemark( float x, float w )
    {
    return 1.0 - smoothstep( w, w + 1.0, abs( x ) );
    }
float hash( vec2 p )
    {
    return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 );
    }
float vnoise( vec2 p )
    {
    vec2 i = floor( p );
    vec2 f = fract( p );
    vec2 u = f * f * ( 3.0 - 2.0 * f );
    return mix( mix( hash( i ), hash( i + vec2( 1.0, 0.0 ) ), u.x ),
                mix( hash( i + vec2( 0.0, 1.0 ) ), hash( i + vec2( 1.0, 1.0 ) ), u.x ), u.y );
    }
float fbm( vec2 p )
    {
    float s = 0.0;
    float a = 0.5;
    for ( int i = 0; i < 4; i++ )
        {
        s += a * vnoise( p );
        p *= 2.03;
        a *= 0.5;
        }
    return s;
    }

#define NIGHT   vec3( 0.026, 0.011, 0.016 )
#define DEEP    vec3( 0.072, 0.017, 0.024 )
#define BLOOD   vec3( 0.820, 0.110, 0.115 )
#define MOON_C  vec3( 0.880, 0.255, 0.180 )
#define MOON_D  vec3( 0.360, 0.075, 0.070 )
#define FOG_C   vec3( 0.185, 0.078, 0.088 )
#define RIM     vec3( 0.560, 0.080, 0.100 )
#define BEZEL   vec3( 0.018, 0.006, 0.010 )

#define EDGE_W   3.0
#define RULE_D   8.0

void main()
{
    float t   = float( params.FrameCount ) * 0.016;
    vec2  uv  = vTexCoord.xy;
    vec2  res = params.OutputSize.xy;
    vec2  px  = uv * res;

    vec3  src  = fetch( backbuffer, uv );
    float slum = luma( src );
    float ink  = smoothstep( 0.085, 0.300, slum );

    vec3  blr = fetch( blurbuffer, uv + vec2( -0.0011, 0.0014 ) );
    float mat = smoothstep( 0.055, 0.340, luma( blr ) );

    float dx = min( px.x, res.x - px.x );
    float dy = min( px.y, res.y - px.y );
    float d  = min( dx, dy );

    float sky  = smoothstep( 0.0, 1.0, uv.y );
    vec3  base = mix( DEEP, NIGHT, sky );

    float unit  = max( min( res.x, res.y ), 1.0 );
    vec2  mp    = ( px - vec2( res.x * 0.815, res.y * 0.790 ) ) / unit;
    float mdist = length( mp );
    float mr    = 0.148;
    float pulse = 0.90 + 0.10 * sin( t * 0.38 );
    float fade  = 1.0 - 0.62 * mat;
    float disc  = ( 1.0 - smoothstep( mr - 0.0035, mr + 0.0035, mdist ) ) * fade;
    float mott  = fbm( mp * 24.0 + 5.0 );
    float limb  = smoothstep( 0.25, 1.05, mdist / mr );
    vec3  moon  = mix( MOON_C, MOON_D, clamp( mott * 0.62 + limb * 0.34, 0.0, 1.0 ) );
    float halo  = ( exp( -mdist * 7.4 ) * 0.60 + exp( -mdist * 2.5 ) * 0.17 ) * pulse * fade;

    vec2  fq  = px / max( res, vec2( 1.0 ) );
    float f1  = fbm( vec2( fq.x * 3.1 + t * 0.021, fq.y * 5.6 ) );
    float f2  = fbm( vec2( fq.x * 1.7 - t * 0.013, fq.y * 3.0 + 11.0 ) );
    float low = 1.0 - smoothstep( 0.0, 0.66, uv.y );
    float mist = clamp( f1 * 0.64 + f2 * 0.46 - 0.28, 0.0, 1.0 )
               * ( 0.34 + 0.92 * low ) * params.veil;

    vec3 col = base + BLOOD * halo * 0.44;
    col = mix( col, moon, disc );
    col += FOG_C * mist * 1.30;

    vec2  vp = ( uv - 0.5 ) * vec2( 1.10, 1.0 );
    float vg = 1.0 - 0.90 * pow( clamp( length( vp ) * 1.36, 0.0, 1.0 ), 2.3 );
    col *= vg;

    float grain = ( hash( floor( px ) + floor( t * 8.0 ) ) - 0.5 ) * 0.017;
    col += vec3( grain );

    col += BLOOD * mat * 0.150 * params.glow;

    float edge = 1.0 - smoothstep( EDGE_W, EDGE_W + 1.0, d );
    float rule = linemark( d - RULE_D, 0.6 );
    float tick = clamp( linemark( dx - 26.0, 0.6 ) * ( 1.0 - smoothstep( 42.0, 44.0, dy ) )
                      + linemark( dy - 26.0, 0.6 ) * ( 1.0 - smoothstep( 42.0, 44.0, dx ) ),
                      0.0, 1.0 );

    col = mix( col, BEZEL, edge );
    col = mix( col, RIM, rule * 0.78 );
    col = mix( col, RIM, tick * 0.88 );

    col = mix( col, src * vec3( 1.020, 0.965, 0.955 ) + blr * BLOOD * 0.38, ink );

    float chrome = clamp( edge + rule * 0.75 + tick * 0.75 + disc, 0.0, 1.0 );

    col = clamp( col, vec3( 0.0 ), vec3( 1.0 ) );

    const float PLATE_ALPHA = 0.88;
    float alpha = PLATE_ALPHA + ( 1.0 - PLATE_ALPHA )
                * clamp( ink * 2.2 + chrome + mat * 0.7 + halo * 0.6, 0.0, 1.0 );
    alpha = clamp( alpha, 0.0, 1.0 );

    FragColor = vec4( col * alpha, alpha );
}
