#version 450

layout(push_constant) uniform Push
{
	vec4 SourceSize;
	vec4 OutputSize;
	uint FrameCount;
	float inset;
	float shadow;
} params;

#pragma parameter inset "Plate Inset" 1.0 0.0 2.0 0.05
#pragma parameter shadow "Text Shadow" 1.0 0.0 2.0 0.05
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
float rand( vec2 co )
    {
    return fract( sin( dot( co.xy, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
    }
float band( float x, float a, float b )
    {
    return smoothstep( a - 0.75, a + 0.75, x ) * ( 1.0 - smoothstep( b - 0.75, b + 0.75, x ) );
    }
float linemark( float x, float w )
    {
    return 1.0 - smoothstep( w, w + 1.0, abs( x ) );
    }
float hexdist( vec2 p )
    {
    p = abs( p );
    return max( p.x * 0.86602540378 + p.y * 0.5, p.y );
    }
float ring( vec2 p, float r, float w )
    {
    return 1.0 - smoothstep( w, w + 1.6, abs( hexdist( p ) - r ) );
    }
float ringc( vec2 p, float r, float w )
    {
    return 1.0 - smoothstep( w, w + 1.6, abs( length( p ) - r ) );
    }

#define PLATE_HI  vec3( 1.000, 1.000, 1.000 )
#define BEVEL_C   vec3( 0.965, 0.980, 1.000 )
#define STEEL     vec3( 0.451, 0.506, 0.557 )
#define IRON      vec3( 0.243, 0.286, 0.333 )
#define GRAPHITE  vec3( 0.086, 0.110, 0.141 )
#define CRIMSON   vec3( 0.588, 0.129, 0.180 )
#define ICE_GLOW  vec3( 0.012, 0.024, 0.038 )
#define GLASS     vec3( 0.043, 0.058, 0.072 )
#define FROST     vec3( 0.858, 0.925, 0.980 )
#define PHOS      vec3( 0.004, 0.707, 0.698 )
#define PHOS_HI   vec3( 0.560, 0.960, 0.950 )

#define SHELL_W     4.0
#define BEVEL_W     7.6
#define RAIL_W     12.0
#define BEZEL_W    14.0
#define CORNER_SZ  24.0
#define BRACE_LEN  84.0
#define BOLT_D      9.8

void main()
{
    float t   = float( params.FrameCount ) * 0.016;
    vec2  uv  = vTexCoord.xy;
    vec2  res = params.OutputSize.xy;
    vec2  px  = uv * res;

    vec3  src  = fetch( backbuffer, uv );
    float slum = luma( src );
    float ink  = smoothstep( 0.105, 0.335, slum );

    float dx = min( px.x, res.x - px.x );
    float dy = min( px.y, res.y - px.y );
    float d  = min( dx, dy );

    float topness = uv.y;
    float depth   = mix( 0.86, 1.16, smoothstep( 0.0, 1.0, topness ) );
    float pane    = 1.0 + 0.06 * sin( 6.28318530718 * uv.y * 1.7 + 0.6 );

    float sunk = ( 1.0 - smoothstep( BEZEL_W, BEZEL_W + 24.0, d ) ) * 0.14 * params.inset;
    float vig  = 1.0 - 0.34 * ( 1.0 - smoothstep( 0.0, 0.36,
                 d * 2.0 / max( min( res.x, res.y ), 1.0 ) ) );

    float diag  = ( px.x * 0.68 + ( res.y - px.y ) * 0.74 ) / max( res.x, 1.0 );
    float sheen = pow( clamp( 0.5 + 0.5 * sin( diag * 4.1 - 0.6 ), 0.0, 1.0 ), 7.0 ) * 0.105
                + pow( clamp( 0.5 + 0.5 * sin( diag * 4.1 + 2.1 ), 0.0, 1.0 ), 9.0 ) * 0.062;

    vec2  lp   = ( px - vec2( res.x * 0.26, res.y * 0.88 ) ) / max( res.y, 1.0 );
    float lamp = exp( -dot( lp, lp ) * 3.2 ) * 0.070;

    float pipe = ( 1.0 - smoothstep( BEZEL_W, BEZEL_W + 66.0, d ) ) * 0.086
               + ( 1.0 - smoothstep( BEZEL_W, BEZEL_W + 9.0, d ) ) * 0.052;

    float sweep = ( 1.0 - topness ) - fract( t * 0.42 );
    float scan  = linemark( sweep * res.y, 0.8 ) * 0.050
                + exp( -max( -sweep, 0.0 ) * 46.0 ) * 0.016;

    float grain  = ( rand( floor( px ) ) - 0.5 ) * 0.019;
    float brush  = ( rand( vec2( 7.0, floor( px.y ) ) ) - 0.5 ) * 0.011
                 + ( rand( vec2( 3.0, floor( px.y * 0.25 ) ) ) - 0.5 ) * 0.008;
    float fleck  = step( 0.9972, rand( floor( px * 0.5 ) ) ) * 0.13;

    vec3  blr = fetch( blurbuffer, uv + vec2( -0.0013, 0.0017 ) );
    float mat = smoothstep( 0.088, 0.420, luma( blr ) );

    // adds a dna helix on the terminal, some clean white corpo facility, umbrella-like typeshi
      vec2  mc   = px - vec2( res.x * 0.820, res.y * 0.50 );
    float mrad = min( res.x, res.y ) * 0.185;
    float helixc = exp( -pow( length( mc / vec2( 1.0, 1.55 ) ) / ( mrad * 0.92 ), 3.0 ) );
    float hy  = mc.y / max( mrad, 1.0 );

    // twists the strands on the vertical axis instead of just sliding em up n down
    float helixPhase = t * 1.55;
      float wob = hy * 4.6;
    float xA  = sin( wob + helixPhase );
    float xB  = sin( wob + helixPhase + 3.14159265 );
    float zA  = cos( wob + helixPhase );
    float zB  = cos( wob + helixPhase + 3.14159265 );
    float strandA = exp( -pow( abs( mc.x - mrad * 0.54 * xA ) / 3.6, 2.0 ) );
    float strandB = exp( -pow( abs( mc.x - mrad * 0.54 * xB ) / 3.6, 2.0 ) );
     float frontA  = 0.20 + 0.80 * ( 0.5 + 0.5 * zA );
    float frontB  = 0.20 + 0.80 * ( 0.5 + 0.5 * zB );
    float rungStep = mrad * 0.20;
    float rungCell = floor( mc.y / rungStep + 0.5 );
    float rungLocalY = mc.y - rungCell * rungStep;
    float rungPhase = rungCell * rungStep / max( mrad, 1.0 ) * 4.6 + helixPhase;
    float rungXA = mrad * 0.54 * sin( rungPhase );
    float rungXB = mrad * 0.54 * sin( rungPhase + 3.14159265 );
    float rungMin = min( rungXA, rungXB );
    float rungMax = max( rungXA, rungXB );
    float rungLine = 1.0 - smoothstep( 1.1, 2.4, abs( rungLocalY ) );
    float rungSpan = smoothstep( rungMin - 2.0, rungMin + 1.0, mc.x )
                   * ( 1.0 - smoothstep( rungMax - 1.0, rungMax + 2.0, mc.x ) );
    float rungDepth = 0.20 + 0.32 * abs( cos( rungPhase ) );
    float rung  = rungLine * rungSpan * rungDepth;
    float helix = ( rung + strandA * frontA + strandB * frontB ) * helixc;
    helix = clamp( helix, 0.0, 1.0 ) * ( 1.0 - step( d, 44.0 ) );

    float bmk = linemark( dx - 46.0, 0.7 ) * step( 46.0, dy ) * ( 1.0 - smoothstep( 78.0, 80.0, dy ) )
              + linemark( dy - 46.0, 0.7 ) * step( 46.0, dx ) * ( 1.0 - smoothstep( 78.0, 80.0, dx ) );
    bmk = clamp( bmk, 0.0, 1.0 );

    vec3  crt = src * vec3( 0.55, 1.05, 1.02 ) + blr * PHOS * 0.55;
    crt += PHOS * mat * 0.48 * params.shadow;
      crt *= 1.0 + 0.14 * mat;
    crt += PHOS_HI * ink * 0.16;
    crt += PHOS * helix * 0.60 + PHOS_HI * helix * 0.32;
    crt += PHOS * bmk * 0.12;

    float holo = 0.94 + 0.06 * sin( uv.y * 8.0 - t * 2.2 );
    crt *= mix( 1.0, holo, 0.12 );

     float aR = luma( fetch( backbuffer, uv + vec2( 0.0020, 0.0 ) ) );
    float aB = luma( fetch( backbuffer, uv - vec2( 0.0020, 0.0 ) ) );
    crt.r += aR * 0.12;
    crt.b += aB * 0.10;

    float flick = 0.92 + 0.08 * rand( vec2( float( params.FrameCount ), 0.0 ) );
    crt *= flick;

    crt += vec3( ( rand( floor( px ) ) - 0.5 ) * 0.010 );

    vec2  vp = ( uv - 0.5 ) * vec2( 1.05, 1.0 );
    crt *= 1.0 - 0.34 * pow( clamp( length( vp ) * 1.30, 0.0, 1.0 ), 2.4 );

    crt += PHOS_HI * pow( clamp( uv.y, 0.0, 1.0 ), 8.0 ) * 0.05;
    crt = clamp( crt, vec3( 0.0 ), vec3( 1.0 ) );

    vec3 col = crt;

    float hz = step( dy, dx );
    float vt = 1.0 - hz;

    float shell = 1.0 - smoothstep( SHELL_W, SHELL_W + 1.0, d );
    float lip   = band( d, SHELL_W, BEVEL_W );
    float rail  = band( d, BEVEL_W, RAIL_W );
    float bezel = band( d, RAIL_W, BEZEL_W );

    float brace  = rail * step( dx, BRACE_LEN ) * step( dy, BRACE_LEN );

    float bhx  = abs( fract( ( px.x - 64.0 ) / 128.0 ) - 0.5 ) * 128.0;
    float bhy  = abs( fract( ( px.y - 52.0 ) / 104.0 ) - 0.5 ) * 104.0;
    float bolt = clamp( hz * ( 1.0 - smoothstep( 1.5, 2.5, length( vec2( bhx, d - BOLT_D ) ) ) )
                      + vt * ( 1.0 - smoothstep( 1.5, 2.5, length( vec2( bhy, d - BOLT_D ) ) ) ),
                      0.0, 1.0 );
    float bhi  = clamp( hz * ( 1.0 - smoothstep( 0.4, 1.3, length( vec2( bhx, d - BOLT_D - 1.1 ) ) ) )
                      + vt * ( 1.0 - smoothstep( 0.4, 1.3, length( vec2( bhy, d - BOLT_D - 1.1 ) ) ) ),
                      0.0, 1.0 );

    float ladder = rail * vt * step( 0.52, fract( px.y / 17.0 ) )
                 * ( 1.0 - brace ) * ( 1.0 - bolt );

    float divs = linemark( px.x - res.x * 0.145, 1.3 )
               + linemark( px.x - res.x * 0.312, 1.3 )
               + linemark( px.x - res.x * 0.523, 1.3 )
               + linemark( px.x - res.x * 0.784, 1.3 );
    divs = clamp( divs, 0.0, 1.0 ) * band( d, SHELL_W, RAIL_W ) * hz;

    float cblock = step( dx, CORNER_SZ ) * step( dy, CORNER_SZ );
    float cnotch = band( dx, 7.0, 13.0 ) * band( dy, 7.0, 13.0 ) * cblock;

    float bot     = step( px.y, res.y * 0.5 );
    float botrail = rail * hz * bot;

    float hazard = botrail * band( px.x, res.x * 0.055, res.x * 0.245 )
                 * step( 0.5, fract( ( px.x + px.y * 1.6 ) / 8.0 ) );

    float stat = botrail * band( px.x, res.x - 58.0, res.x - 38.0 );
    float stt  = clamp( linemark( px.x - ( res.x - 96.0 ), 1.4 )
                      + linemark( px.x - ( res.x - 84.0 ), 1.4 )
                      + linemark( px.x - ( res.x - 72.0 ), 1.4 ), 0.0, 1.0 ) * botrail;

    float gx    = res.x - px.x;
    float scale = linemark( gx - 18.0, 0.6 ) * 0.32
                + band( gx, 13.0, 18.0 )
                  * ( 1.0 - smoothstep( 0.7, 1.7, abs( fract( px.y / 24.0 ) - 0.5 ) * 24.0 ) ) * 0.30
                + band( gx, 18.0, 25.0 )
                  * ( 1.0 - smoothstep( 0.8, 1.8, abs( fract( px.y / 96.0 ) - 0.5 ) * 96.0 ) ) * 0.42;
    scale = clamp( scale, 0.0, 1.0 ) * ( 1.0 - step( dy, 30.0 ) );

    col = mix( col, IRON,     rail * 0.88 );
    col = mix( col, STEEL,    scale );
    col = mix( col, BEVEL_C,  lip );
    col = mix( col, PLATE_HI, brace * 0.92 );
    col = mix( col, GRAPHITE, ladder * 0.80 );
    col = mix( col, GRAPHITE, divs );
    col = mix( col, GRAPHITE, bolt * 0.90 );
    col = mix( col, BEVEL_C,  bhi );
    col = mix( col, IRON,     bezel * 0.90 );
    col = mix( col, GRAPHITE, shell );
    col = mix( col, GRAPHITE, cblock );
    col = mix( col, BEVEL_C,  cnotch );
    col = mix( col, BEVEL_C,  hazard * 0.92 );
    col = mix( col, BEVEL_C,  stt * 0.92 );
    col = mix( col, CRIMSON,  stat );

    float chrome = clamp( shell + lip + rail + bezel + cblock + hazard + stat + stt
                        + bolt + scale * 0.5 + helix * 0.16 + bmk * 0.20, 0.0, 1.0 );

    col = clamp( col, vec3( 0.0 ), vec3( 1.0 ) );

    const float PLATE_ALPHA = 0.40;
    float alpha = PLATE_ALPHA + ( 1.0 - PLATE_ALPHA )
                * clamp( ink * 2.4 + mat * 0.95 + chrome + sunk * 1.6
                       + pipe * 0.9 + fleck * 1.6 + helix * 1.2, 0.0, 1.0 );
    alpha = clamp( alpha, 0.0, 1.0 );

    FragColor = vec4( col * alpha, alpha );
}
