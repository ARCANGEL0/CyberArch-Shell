#version 450

layout(push_constant) uniform Push
{
	vec4 SourceSize;
	vec4 OutputSize;
	uint FrameCount;
	float use_frame;
	float curvature;
	float wiggle_toggle;
 	float scanroll;
	float vignette;
	float ghosting;
} params;

#pragma parameter use_frame "Use Frame Image" 0.0 0.0 1.0 1.0
#define use_frame params.use_frame
#pragma parameter curvature "Curvature" 2.0 0.0001 4.0 0.25
#pragma parameter wiggle_toggle "Interference" 0.0 0.0 1.0 1.0
#pragma parameter scanroll "Rolling Scanlines" 1.0 0.0 1.0 1.0
#pragma parameter vignette "Vignette" 1.0 0.0 1.0 0.05
#pragma parameter ghosting "Ghosting" 1.0 0.0 2.0 0.10
#define gl_FragCoord (vTexCoord.xy * params.OutputSize.xy)
#define backbuffer accum1
#define blurbuffer blur2
#define frametexture frametexture

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
layout(set = 0, binding = 5) uniform sampler2D frametexture;

vec3 tsample( sampler2D samp, vec2 tc, float offs, vec2 resolution )
    {
    vec3 s = pow( abs( texture( samp, vec2( tc.x, 1.0-tc.y ) ).rgb), vec3( 2.2 ) );
    return s*vec3(1.25);
    }

vec3 filmic( vec3 LinearColor )
    {
    vec3 x = max( vec3(0.0), LinearColor-vec3(0.004));
    return (x*(6.2*x+0.5))/(x*(6.2*x+1.7)+0.06);
    }

vec2 curve( vec2 uv )
    {
    uv = (uv - 0.5);

    uv *= vec2(1.0, 1.0);
   uv *= params.curvature;

    uv /= params.curvature;
    uv  += 0.5;
    return uv;
    }

float rand(vec2 co)
    {
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
    }

#define resolution params.OutputSize.xy

void main()
{

   float time = mod(params.FrameCount, 849.0) *36.;
    vec2 uv = vTexCoord.xy;

    vec2 curved_uv = mix( curve( uv ), uv, 0.4 );
    float scale = 0.0;
    vec2 scuv = curved_uv*(1.0-scale)+scale/2.0;

    uv = scuv;

    vec3 col;
    float x = params.wiggle_toggle* sin(0.1*time+curved_uv.y*13.0)*sin(0.23*time+curved_uv.y*19.0)*sin(0.3+0.11*time+curved_uv.y*23.0)*0.0012;
    float o =sin(gl_FragCoord.y*1.5)/resolution.x;
    x+=o*0.0;

   time = float(mod(params.FrameCount, 640) * 1);
    col.r = tsample(backbuffer,vec2(x+scuv.x,scuv.y),resolution.y/800.0, resolution ).x+0.002;
    col.g = tsample(backbuffer,vec2(x+scuv.x,scuv.y),resolution.y/800.0, resolution ).y+0.002;
    col.b = tsample(backbuffer,vec2(x+scuv.x,scuv.y),resolution.y/800.0, resolution ).z+0.002;
    float i = clamp(col.r*0.299 + col.g*0.587 + col.b*0.114, 0.0, 1.0 );
    float _txt = i;
    i = pow( 1.0 - pow(i,2.0), 1.0 );
    i = (1.0-i) * 0.85 + 0.15;

    float ghs = 0.15 * params.ghosting;
    vec3 r = tsample(blurbuffer, vec2(x-0.014*1.0, -0.027)*0.85+0.007*vec2( 0.35*sin(1.0/7.0 + 15.0*curved_uv.y + 0.9*time),
        0.35*sin( 2.0/7.0 + 10.0*curved_uv.y + 1.37*time) )+vec2(scuv.x+0.001,scuv.y+0.001),
        5.5+1.3*sin( 3.0/9.0 + 31.0*curved_uv.x + 1.70*time),resolution).xyz*vec3(0.5,0.25,0.25);
    vec3 g = tsample(blurbuffer, vec2(x-0.019*1.0, -0.020)*0.85+0.007*vec2( 0.35*cos(1.0/9.0 + 15.0*curved_uv.y + 0.5*time),
        0.35*sin( 2.0/9.0 + 10.0*curved_uv.y + 1.50*time) )+vec2(scuv.x+0.000,scuv.y-0.002),
        5.4+1.3*sin( 3.0/3.0 + 71.0*curved_uv.x + 1.90*time),resolution).xyz*vec3(0.25,0.5,0.25);
    vec3 b = tsample(blurbuffer, vec2(x-0.017*1.0, -0.003)*0.85+0.007*vec2( 0.35*sin(2.0/3.0 + 15.0*curved_uv.y + 0.7*time),
        0.35*cos( 2.0/3.0 + 10.0*curved_uv.y + 1.63*time) )+vec2(scuv.x-0.002,scuv.y+0.000),
        5.3+1.3*sin( 3.0/7.0 + 91.0*curved_uv.x + 1.65*time),resolution).xyz*vec3(0.25,0.25,0.5);

    col += vec3(ghs*(1.0-0.299))*pow(clamp(vec3(3.0)*r,vec3(0.0),vec3(1.0)),vec3(2.0))*vec3(i);
    col += vec3(ghs*(1.0-0.587))*pow(clamp(vec3(3.0)*g,vec3(0.0),vec3(1.0)),vec3(2.0))*vec3(i);
    col += vec3(ghs*(1.0-0.114))*pow(clamp(vec3(3.0)*b,vec3(0.0),vec3(1.0)),vec3(2.0))*vec3(i);

    const float BLOOM_AMT    = 1.85;
    const float BLOOM_THRESH = 0.20;
    const float BLOOM_SPREAD = 4.0;
    vec3 _bl = tsample( blurbuffer, vec2(scuv.x, scuv.y), BLOOM_SPREAD, resolution );
    _bl = max( _bl - vec3(BLOOM_THRESH), vec3(0.0) );
    col += _bl * BLOOM_AMT;

    col *= vec3(0.95,1.05,0.95);
    col = clamp(col*1.3 + 0.75*col*col + 1.25*col*col*col*col*col,vec3(0.0),vec3(10.0));

    float vig = ((1.0-0.99*params.vignette) + 1.0*16.0*curved_uv.x*curved_uv.y*(1.0-curved_uv.x)*(1.0-curved_uv.y));
    vig = 1.3*pow(vig,0.5);
    col *= vig;

    time *= params.scanroll;

    float scans = clamp( 0.93+0.05*sin(6.0*time-curved_uv.y*resolution.y*1.5), 0.0, 1.0);
    float s = pow(scans,0.9);
    col = col * vec3(s);

    col*=1.0-0.08*(clamp((mod(gl_FragCoord.xy.x, 3.0))/2.0,0.0,1.0));

    col = filmic( col );

    const float BLACK_FLOOR = 0.19;
    col = max( ( col - vec3(BLACK_FLOOR) ) / ( 1.0 - BLACK_FLOOR ), vec3(0.0) );

    const float SATURATION = 1.55;
    const float CONTRAST   = 1.20;
    const vec3  COOL_GAIN  = vec3( 0.70, 1.12, 0.86 );
    float _l = dot( col, vec3( 0.299, 0.587, 0.114 ) );
    col = max( vec3(_l) + (col - vec3(_l)) * SATURATION, vec3(0.0) );
    col = pow( col, vec3( CONTRAST ) );
    col = clamp( col * COOL_GAIN, vec3(0.0), vec3(1.0) );

    const float GLOW_THRESH = 0.07;
    const float GLOW_AMT    = 1.15;
    vec3  _gl  = tsample( blurbuffer, vec2(scuv.x, scuv.y), 6.5, resolution );
    _gl = max( _gl - vec3(GLOW_THRESH), vec3(0.0) );
    float _gll = clamp( dot( _gl, vec3(0.299,0.587,0.114) ), 0.0, 1.0 );
    col = clamp( col + _gl * vec3(0.30, 1.20, 0.70) * GLOW_AMT, vec3(0.0), vec3(1.0) );

    float _lumPre = dot( col, vec3( 0.299, 0.587, 0.114 ) );

    const vec3  GLASS_TINT = vec3( 0.02, 0.32, 0.16 );
    const float TINT_AMT   = 0.085;
    const float TINT_FADE  = 0.45;
    float _shade = 1.0 - smoothstep( 0.0, TINT_FADE, _lumPre );
    col = clamp( col + GLASS_TINT * _shade * TINT_AMT, vec3(0.0), vec3(1.0) );

    const float HOLO_PERIOD = 3.0;
    const vec3  HOLO_LINE   = vec3( 0.018, 0.19, 0.100 );
    const float HOLO_AMT    = 0.85;
    float _sl   = 0.5 + 0.5 * cos( 6.28318530718 * gl_FragCoord.y / HOLO_PERIOD );
    float _wash = HOLO_AMT * ( 0.16 + 0.84 * _sl );
    col = clamp( col + HOLO_LINE * _wash, vec3(0.0), vec3(1.0) );

    vec2 seed = curved_uv*resolution.xy;;

    col -= 0.015*pow(vec3(rand( seed +time ), rand( seed +time*2.0 ), rand( seed +time * 3.0 ) ), vec3(1.5) );

    col *= (1.0-0.004*(sin(50.0*time+curved_uv.y*2.0)*0.5+0.5));

    uv = curved_uv;

    vec2 fscale = vec2( 0.026, -0.018);
    uv = vec2(uv.x, 1.-uv.y);
    vec4 f=texture(frametexture,vTexCoord.xy);
    f.xyz = mix( f.xyz, vec3(0.5,0.5,0.5), 0.5 );
    float fvig = clamp( -0.00+512.0*uv.x*uv.y*(1.0-uv.x)*(1.0-uv.y), 0.2, 0.8 );
    col = mix( col, mix( max( col, 0.0), pow( abs( f.xyz ), vec3( 1.4 ) ) * fvig, f.w * f.w), vec3( use_frame ) );

    const float BG_ALPHA        = 0.35;
    const float TEXT_ALPHA_GAIN = 2.10;
    const float HOLO_ALPHA      = 0.13;
    const float TEXT_ALPHA_FLOOR = 0.075;

    float _txtc = max( _txt - TEXT_ALPHA_FLOOR, 0.0 ) / ( 1.0 - TEXT_ALPHA_FLOOR );
    float alpha = clamp( BG_ALPHA + _wash * HOLO_ALPHA + _txtc * TEXT_ALPHA_GAIN
                         + clamp( _gll * 1.20, 0.0, 0.25 ), 0.0, 1.0 );

    const vec3  FRAME_COL = vec3( 0.17, 1.00, 0.55 );
    vec2  _pxy = vTexCoord.xy * params.OutputSize.xy;
    vec2  _dst = min( _pxy, params.OutputSize.xy - _pxy );
    float _e   = min( _dst.x, _dst.y );

    float _l1 = 1.0 - smoothstep( 0.0, 1.3, abs( _e - 3.0 ) );
    float _l2 = ( 1.0 - smoothstep( 0.0, 1.3, abs( _e - 8.0 ) ) ) * 0.30;
    float _bx = ( _dst.x < 4.0 && _dst.y < 30.0 ) ? 1.0 : 0.0;
    float _by = ( _dst.y < 4.0 && _dst.x < 42.0 ) ? 1.0 : 0.0;
    float _frame = clamp( _l1 + _l2 + max( _bx, _by ), 0.0, 1.0 );
    float _glow  = exp( -_e / 10.0 ) * 0.60;

    col   = clamp( col + FRAME_COL * _glow * 0.40, vec3(0.0), vec3(1.0) );
    col   = mix( col, FRAME_COL, _frame * 0.94 );
    alpha = clamp( max( alpha, max( _frame * 0.96, _glow * 0.35 ) ), 0.0, 1.0 );

    FragColor = vec4( col * alpha, alpha );
}
