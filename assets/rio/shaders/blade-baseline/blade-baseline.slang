#version 450

layout(push_constant) uniform Push
{
	vec4 SourceSize;
	vec4 OutputSize;
	uint FrameCount;
	float bloom;
	float sheen;
} params;

#pragma parameter bloom "Deck Bloom" 1.0 0.0 2.0 0.05
#pragma parameter sheen "Deck Sheen" 1.0 0.0 2.0 0.05
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

#define BODY_DARK vec3( 0.055, 0.055, 0.060 )
#define BODY_LITE vec3( 0.180, 0.170, 0.155 )
#define BEVEL     vec3( 0.340, 0.310, 0.270 )
#define PHOS      vec3( 0.004, 0.707, 0.698 )
#define PHOS_HI   vec3( 0.560, 0.960, 0.950 )
#define LED       vec3( 0.792, 0.325, 0.667 )
#define STEEL    vec3( 0.500, 0.480, 0.440 )

#define FRAME_X  26.0
#define FRAME_Y  24.0
#define CORNER_R 1.0

float sdfBox( vec2 p, vec2 b, float r )
    {
    vec2 q = abs( p ) - b + r;
    return length( max( q, vec2( 0.0 ) ) ) + min( max( q.x, q.y ), 0.0 ) - r;
    }

void main()
{
    vec2  uv  = vTexCoord.xy;
    vec2  res = params.OutputSize.xy;
    vec2  px  = uv * res;
    vec2  pc  = px - res * 0.5;

    float outer  = sdfBox( pc, res * 0.5, CORNER_R );
    float screen = sdfBox( pc, res * 0.5 - vec2( FRAME_X, FRAME_Y ), max( CORNER_R - 1.0, 0.0 ) );

    float bodyA  = 1.0 - smoothstep( -0.9, 0.9, outer );
    float scrA   = 1.0 - smoothstep( -0.9, 0.9, screen );

    float bezel  = 1.0 - smoothstep( 1.0, 3.0, abs( screen + 2.0 ) );
    float edge   = 1.0 - smoothstep( 1.0, 3.0, abs( outer + 2.0 ) );

    float grain  = hash( floor( px * 0.5 ) ) * 0.5 + hash( floor( px * 0.25 ) ) * 0.5;
    vec3  body   = mix( BODY_DARK, BODY_LITE, 0.35 + grain * 0.30 );
    body += BEVEL * pow( clamp( 1.0 - abs( uv.y - 0.5 ) * 2.0, 0.0, 1.0 ), 3.0 ) * 0.35;
    body = mix( body, BEVEL, bezel * 0.85 );
    body = mix( body, BEVEL * 1.4, edge * 0.6 );

    vec2  screwUV[4];
    screwUV[0] = vec2( FRAME_X * 0.5, FRAME_Y * 0.5 );
    screwUV[1] = vec2( res.x - FRAME_X * 0.5, FRAME_Y * 0.5 );
    screwUV[2] = vec2( FRAME_X * 0.5, res.y - FRAME_Y * 0.5 );
    screwUV[3] = vec2( res.x - FRAME_X * 0.5, res.y - FRAME_Y * 0.5 );
    for ( int i = 0; i < 4; i++ )
        {
        float sd = length( pc - ( screwUV[i] - res * 0.5 ) );
        body = mix( body, STEEL * ( 0.7 + 0.3 * grain ), 1.0 - smoothstep( 2.4, 4.2, sd ) );
        body = mix( body, vec3( 0.10 ), 1.0 - smoothstep( 0.0, 1.1, sd ) );
        }
    float led = length( pc - ( vec2( res.x - FRAME_X * 0.55, FRAME_Y * 0.5 ) - res * 0.5 ) );
    float ledPulse = 0.75 + 0.25 * sin( float( params.FrameCount ) * 0.08 );
    body = mix( body, LED * ledPulse, 1.0 - smoothstep( 2.5, 6.5, led ) );

    vec2  suv  = ( px - vec2( FRAME_X, FRAME_Y ) ) / ( res - vec2( FRAME_X * 2.0, FRAME_Y * 2.0 ) );
    vec3  src  = fetch( backbuffer, uv );
    vec3  blr  = fetch( blurbuffer, uv + vec2( -0.0009, 0.0012 ) );
    float slum = luma( src );
    float ink  = smoothstep( 0.060, 0.280, slum );
    float mat  = smoothstep( 0.040, 0.320, luma( blr ) );

    vec3  crt  = src * vec3( 0.55, 1.05, 1.02 ) + blr * PHOS * 0.55;
    crt += PHOS * mat * 0.48 * params.bloom;
    crt *= 1.0 + 0.14 * mat;
    crt += PHOS_HI * ink * 0.16;

    float scan = 0.80 + 0.20 * sin( px.y * 3.14159265 );
    crt *= mix( 1.0, scan, 0.60 );

    float vscr = 0.94 + 0.06 * sin( px.x * 1.047 );
    crt *= mix( 1.0, vscr, 0.25 );

    float flick = 0.96 + 0.04 * hash( vec2( float( params.FrameCount ), 0.0 ) );
    crt *= flick;

    crt += vec3( ( hash( floor( px ) ) - 0.5 ) * 0.012 );

    vec2  vp = ( suv - 0.5 ) * vec2( 1.05, 1.0 );
    crt *= 1.0 - 0.34 * pow( clamp( length( vp ) * 1.30, 0.0, 1.0 ), 2.4 );

    crt = mix( crt, PHOS * 0.35, bezel * 0.9 );
    crt += PHOS_HI * pow( clamp( suv.y, 0.0, 1.0 ), 8.0 ) * 0.05 * params.sheen;
    crt = clamp( crt, vec3( 0.0 ), vec3( 1.0 ) );

    vec3  col = mix( crt, body, 1.0 - scrA );
    float alpha = max( bodyA, scrA * 0.35 );

    FragColor = vec4( col * alpha, alpha );
}
