#version 450

layout(push_constant) uniform Push
{
	vec4 SourceSize;
	vec4 OutputSize;
	uint FrameCount;
	float vignette;
	float ghosting;
} params;

#pragma parameter vignette "Vignette" 1.0 0.0 1.0 0.05
#pragma parameter ghosting "Ghosting" 1.0 0.0 2.0 0.10
#define gl_FragCoord (vTexCoord.xy * params.OutputSize.xy)
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
layout(set = 0, binding = 5) uniform sampler2D kittytex;

vec3 tsample( sampler2D samp, vec2 tc )
    {
    return pow( abs( texture( samp, vec2( tc.x, 1.0 - tc.y ) ).rgb ), vec3( 2.2 ) ) * vec3( 1.25 );
    }

float rand( vec2 co )
    {
    return fract( sin( dot( co.xy, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
    }
float roundBox( vec2 p, vec2 half_size, float radius )
    {
    vec2 q = abs( p ) - ( half_size - vec2( radius ) );
    return length( max( q, vec2( 0.0 ) ) ) + min( max( q.x, q.y ), 0.0 ) - radius;
    }
float star4( vec2 p, float len, float wid )
    {
    float ax = clamp( 1.0 - abs( p.x ) / len, 0.0, 1.0 );
    float ay = clamp( 1.0 - abs( p.y ) / len, 0.0, 1.0 );
    float bx = clamp( 1.0 - abs( p.y ) / wid, 0.0, 1.0 );
    float by = clamp( 1.0 - abs( p.x ) / wid, 0.0, 1.0 );
    float arms = ax * ax * bx + ay * ay * by;
    float core = clamp( 1.0 - length( p ) / ( wid * 2.4 ), 0.0, 1.0 );
    return clamp( arms + core * 0.85, 0.0, 1.0 );
    }

#define PETAL_PINK   vec3( 1.00, 0.85, 0.93 )
#define POWDER_LILAC vec3( 0.94, 0.90, 1.00 )
#define SUGAR_WHITE  vec3( 1.00, 0.98, 0.99 )
#define BUBBLE_PINK  vec3( 1.00, 0.72, 0.87 )

#define STICKER_HEIGHT  126.0
#define STICKER_ASPECT  0.856
#define STICKER_INSET   28.0
#define STICKER_OPACITY 0.94

void main()
{
    float t  = float( params.FrameCount ) * 0.016;
    vec2  uv = vTexCoord.xy;
    vec2  px = vTexCoord.xy * params.OutputSize.xy;

    vec3 col = tsample( backbuffer, uv ) + vec3( 0.002 );
    float _txt = clamp( dot( col, vec3( 0.299, 0.587, 0.114 ) ), 0.0, 1.0 );

    float ghs = 0.09 * params.ghosting;
    vec3  gr  = tsample( blurbuffer, uv + vec2( -0.0016, 0.0011 ) );
    vec3  gb  = tsample( blurbuffer, uv + vec2(  0.0016, -0.0011 ) );
    col += ghs * gr * vec3( 1.00, 0.86, 0.93 );
    col += ghs * gb * vec3( 0.90, 0.88, 1.00 );

    const float BLOOM_AMT    = 1.35;
    const float BLOOM_THRESH = 0.18;
    vec3 _bl = max( tsample( blurbuffer, uv ) - vec3( BLOOM_THRESH ), vec3( 0.0 ) );
    col += _bl * BLOOM_AMT * mix( PETAL_PINK, SUGAR_WHITE, 0.62 );

    col = clamp( col * 1.18 + 0.45 * col * col, vec3( 0.0 ), vec3( 10.0 ) );

    vec3 x = max( vec3( 0.0 ), col - vec3( 0.004 ) );
    col = ( x * ( 6.2 * x + 0.5 ) ) / ( x * ( 6.2 * x + 1.7 ) + 0.06 );

    const float BLACK_FLOOR = 0.15;
    col = max( ( col - vec3( BLACK_FLOOR ) ) / ( 1.0 - BLACK_FLOOR ), vec3( 0.0 ) );

    float _l = dot( col, vec3( 0.299, 0.587, 0.114 ) );
    col = max( vec3( _l ) + ( col - vec3( _l ) ) * 1.02, vec3( 0.0 ) );
    col = mix( col, vec3( _l ) * SUGAR_WHITE, 0.34 );
    col = pow( col, vec3( 1.02 ) );
    col = clamp( col * vec3( 1.07, 1.00, 1.05 ), vec3( 0.0 ), vec3( 1.0 ) );
    const float GLOW_THRESH = 0.10;
    const float GLOW_AMT    = 0.70;
    vec3  _gl  = max( tsample( blurbuffer, uv ) - vec3( GLOW_THRESH ), vec3( 0.0 ) );
    float _gll = clamp( dot( _gl, vec3( 0.299, 0.587, 0.114 ) ), 0.0, 1.0 );
    col = clamp( col + _gl * mix( PETAL_PINK, POWDER_LILAC, 0.35 ) * GLOW_AMT, vec3( 0.0 ), vec3( 1.0 ) );

    float _lumPre = dot( col, vec3( 0.299, 0.587, 0.114 ) );

    const vec3  GLASS_TINT = vec3( 0.92, 0.38, 0.62 );
    const float TINT_AMT   = 0.34;
    float _shade = 1.0 - smoothstep( 0.0, 0.48, _lumPre );
    col = clamp( col + GLASS_TINT * _shade * TINT_AMT, vec3( 0.0 ), vec3( 1.0 ) );
    col = mix( col, BUBBLE_PINK * 0.60, _shade * 0.24 );

    float _wash = clamp( 0.60 * ( 1.0 - uv.x ) + 0.40 * uv.y, 0.0, 1.0 );
    col = clamp( col + mix( PETAL_PINK, POWDER_LILAC, 0.28 ) * _wash * 0.075,
                 vec3( 0.0 ), vec3( 1.0 ) );

    float _sheen = pow( 1.0 - clamp( ( 1.0 - uv.y ) * 1.35, 0.0, 1.0 ), 2.2 );
    float _band  = 0.5 + 0.5 * sin( 6.28318530718 * uv.y * 1.5 - 0.6 );
    float _gloss = 0.070 * _sheen + 0.018 * _band;
    col = clamp( col + mix( SUGAR_WHITE, POWDER_LILAC, 0.4 ) * _gloss, vec3( 0.0 ), vec3( 1.0 ) );

    float vig = ( 1.0 - 0.55 * params.vignette ) + 1.0 * 12.0 * uv.x * uv.y * ( 1.0 - uv.x ) * ( 1.0 - uv.y );
    col *= 1.16 * pow( clamp( vig, 0.0, 2.0 ), 0.40 );

    vec2  scell = floor( px / 6.0 );
    float sseed = rand( scell );
    float stw   = 0.5 + 0.5 * sin( 6.28318530718 * ( sseed * 5.0 + t * 0.55 ) );
    float spark = step( 0.9640, sseed ) * pow( stw, 3.0 );
    vec2  sfrac = fract( px / 6.0 ) - 0.5;
    float sdot  = 1.0 - smoothstep( 0.0, 0.38, length( sfrac ) );

    vec2  fcell = floor( px / 11.0 + vec2( 0.5 ) );
    float fseed = rand( fcell + vec2( 61.3, 27.7 ) );
    float ftw   = 0.5 + 0.5 * sin( 6.28318530718 * ( fseed * 9.0 + t * 0.80 ) );
    vec2  ffrac = fract( px / 11.0 + vec2( 0.5 ) ) - 0.5;
    float fdot  = 1.0 - smoothstep( 0.0, 0.22, length( ffrac ) );
    float fine  = step( 0.9420, fseed ) * pow( ftw, 2.2 ) * fdot;

    float dust  = clamp( spark * sdot + fine * 0.85, 0.0, 1.0 );
    col = clamp( col + mix( SUGAR_WHITE, PETAL_PINK, 0.30 ) * dust * 1.05, vec3( 0.0 ), vec3( 1.0 ) );

    vec2  gcell = floor( px / 22.0 );
    float gseed = rand( gcell + vec2( 3.7, 9.1 ) );
    float ghue  = rand( gcell + vec2( 17.3, 5.9 ) );
    float gjx   = rand( gcell + vec2( 41.2, 23.8 ) );
    float gjy   = rand( gcell + vec2( 11.9, 57.4 ) );
    float gtw   = 0.5 + 0.5 * sin( 6.28318530718 * ( gseed * 7.0 + t * 0.30 ) );
    float gon   = step( 0.9380, gseed ) * pow( gtw, 2.0 );
    vec2  gp    = ( fract( px / 22.0 ) - vec2( 0.22 + 0.56 * gjx, 0.22 + 0.56 * gjy ) ) * 22.0;
    float glint = gon * star4( gp, 6.0 + 4.0 * ghue, 1.30 );
    col = clamp( col + mix( SUGAR_WHITE, BUBBLE_PINK, 0.20 + 0.70 * ghue ) * glint * 1.05,
                 vec3( 0.0 ), vec3( 1.0 ) );

    col -= 0.008 * pow( vec3( rand( px + t ), rand( px + t * 2.0 ), rand( px + t * 3.0 ) ), vec3( 1.5 ) );
    col = clamp( col, vec3( 0.0 ), vec3( 1.0 ) );

    vec2  half_size = params.OutputSize.xy * 0.5;
    float sd = roundBox( px - half_size, half_size, 26.0 );
    float d  = -sd;

    float ring1 = 1.0 - smoothstep( 0.0, 2.1, abs( d - 3.8 ) );
    float ring2 = ( 1.0 - smoothstep( 0.0, 1.6, abs( d - 10.5 ) ) ) * 0.42;
    float glow  = exp( -max( d, 0.0 ) / 18.0 ) * 0.88;
    float outside = 1.0 - step( 0.0, -sd );

    vec2  q = abs( px - half_size ) - ( half_size - vec2( 26.0 ) );
    float corner = ( q.x > 0.0 && q.y > 0.0 ) ? 1.0 : 0.0;

    float bowx = clamp( abs( px.x - half_size.x ) / 30.0, 0.0, 1.0 );
    float bow  = ( 1.0 - bowx ) * ( ( d < 13.0 && px.y > half_size.y ) ? 1.0 : 0.0 );

    float frame = clamp( ring1 * ( 1.0 + 0.55 * corner ) + ring2 + bow * 0.85, 0.0, 1.0 );
    vec3  fcol  = mix( BUBBLE_PINK, SUGAR_WHITE, 0.12 + 0.12 * corner + 0.20 * bow );
    col = clamp( col + mix( BUBBLE_PINK, POWDER_LILAC, 0.26 ) * glow * 0.46, vec3( 0.0 ), vec3( 1.0 ) );
    col = mix( col, fcol, frame * 0.95 );
    col *= 1.0 - outside;

    vec2  ksize = vec2( STICKER_HEIGHT * STICKER_ASPECT, STICKER_HEIGHT );
    vec2  korg  = vec2( params.OutputSize.x - STICKER_INSET - ksize.x,
                        params.OutputSize.y - STICKER_INSET - ksize.y );
    vec2  ktc   = ( px - korg ) / ksize;
    vec4  ksmp  = vec4( 0.0 );
    if ( ktc.x > 0.0 && ktc.x < 1.0 && ktc.y > 0.0 && ktc.y < 1.0 )
        ksmp = texture( kittytex, vec2( ktc.x, 1.0 - ktc.y ) );

    vec2  khtc  = ( px - korg - ksize * 0.5 ) / ( ksize * 1.24 ) + vec2( 0.5 );
    float khalo = 0.0;
    if ( khtc.x > 0.0 && khtc.x < 1.0 && khtc.y > 0.0 && khtc.y < 1.0 )
        khalo = texture( kittytex, vec2( khtc.x, 1.0 - khtc.y ) ).a;

    float ka = clamp( ksmp.a * STICKER_OPACITY, 0.0, 1.0 ) * ( 1.0 - outside );
    khalo = clamp( khalo * 0.34, 0.0, 1.0 ) * ( 1.0 - outside );
    col = clamp( col + mix( PETAL_PINK, SUGAR_WHITE, 0.35 ) * khalo * 0.50, vec3( 0.0 ), vec3( 1.0 ) );
    col = mix( col, ksmp.rgb, ka );

    const float BG_ALPHA         = 0.35;
    const float TEXT_ALPHA_GAIN  = 2.20;
    const float TEXT_ALPHA_FLOOR = 0.070;
    const float GLOSS_ALPHA      = 0.55;

    float _txtc = max( _txt - TEXT_ALPHA_FLOOR, 0.0 ) / ( 1.0 - TEXT_ALPHA_FLOOR );
    float alpha = clamp( BG_ALPHA + _gloss * GLOSS_ALPHA + _txtc * TEXT_ALPHA_GAIN
                         + clamp( _gll * 1.20, 0.0, 0.25 )
                         + clamp( dust * 0.75 + glint * 1.00, 0.0, 1.0 ), 0.0, 1.0 );
    alpha = clamp( max( alpha, max( frame * 0.97, glow * 0.34 ) ), 0.0, 1.0 ) * ( 1.0 - outside );
    alpha = clamp( max( alpha, max( ka, khalo * 0.85 ) ), 0.0, 1.0 );

    FragColor = vec4( col * alpha, alpha );
}
