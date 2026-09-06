#include <stdlib.h>
#include <stddef.h>
#include <gio/gio.h>
#include <wpe/webkit.h>

static const char *boot_html =
"<!doctype html>"
"<html><head><meta charset='utf-8'>"
"<style>"
"html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#050900;color:#63ff75;font-family:monospace;font-size:13px}"
"#site{position:absolute;inset:0;width:100%;height:100%;border:0;background:#050900}"
"#boot{position:absolute;inset:0;background:#050900;padding:12px;box-sizing:border-box;z-index:10;white-space:pre;overflow:hidden}"
"#terminal{height:100%;overflow:hidden}"
".bar{font-family:monospace}"
"</style></head>"
"<body>"
"<iframe id='site' src='https://cyberspace.online'></iframe>"
"<div id='boot'><div id='terminal'></div></div>"
"<script>"
"const lines=["
"'CyberOS v3.6.4 (tty1) 2026-09-03 21:50:15 UTC',"
"'Copyright (c) 1987-2026 Unbreakable Garden. All rights reserved.','',"
"'probing machine ...',"
"'hostname     : cyberspace.online',"
"'kernel       : CyberOS 3.6.4',"
"'os           : Linux',"
"'arch         : x86_64',"
"'locale       : en-US.UTF-8',"
"'timezone     : Europe/Lisbon','',"
"'BIOS-provided physical RAM map:',"
"'Memory test : unknown OK',"
"'Memory size : 8 GB reported by usersland',"
"'CPU0        : x86_64 CPU (Firefox 150)',"
"'smpboot     : 4 threads online',"
"'GPU0        : Intel(R) HD Graphics 400, or similar',"
"'display     : 1920x1080 @ 24-bit',"
"'storage     : 1.0 TB virtual disk',"
"'network     : unknown','',"
"'[ OK ] probe universal driver',"
"'[ OK ] detect input: hid0 keyboard, hid1 mouse',"
"'[ OK ] rtc wake 2026-09-03 21:50:15 UTC',"
"'[ OK ] seed csprng from crypto.getRandomValues()','',"
"'fsck: opfs clean, indexeddb clean, localstorage clean',"
"'Mounting opfs on / ........................ ok',"
"'Mounting idb on /var/cache ................ ok',"
"'Mounting tmpfs on /var/run ................ ok','',"
"'Loading kernel modules:',''"
"];"

"const mods=['firestore.ko','tty-vt320.ko','pinia.ko','vuefire.ko','heic2any.ko','three.ko','mespeak.ko'];"
"const term=document.getElementById('terminal');"
"const boot=document.getElementById('boot');"
"const site=document.getElementById('site');"
"let i=0,m=0,p=0,phase=0,siteReady=false,bootFinished=false;"

"function write(s){term.textContent+=s+'\\n';term.scrollTop=term.scrollHeight}"

"function moduleBar(){"
" if(m>=mods.length){"
"   write('');"
"   write('[ OK ] spawn init (pid 1)');"
"   write('[ OK ] starting systemd --user');"
"   write('[ OK ] starting syslog-ng');"
"   write('[ OK ] reached target local-fs.target');"
"   write('[ OK ] reached target basic.target');"
"   write('[ OK ] starting network manager');"
"   write('[ OK ] starting cyberspace display server');"
"   write('[ OK ] initializing web renderer');"
"   write('[ OK ] loading cyberspace.online');"
"   write('');"
"   write('CYBERSPACE NETWORK STACK');"
"   write('----------------------------------------');"
"   bootFinished=true;"
"   finish();"
"   return;"
" }"
" let filled=p,empty=20-filled;"
" let bar='█'.repeat(filled)+'░'.repeat(empty);"
" term.textContent=term.textContent.replace(/\\n?$/,'');"
" let lines=term.textContent.split('\\n');"
" if(lines.length && lines[lines.length-1].startsWith('  '+mods[m])) lines.pop();"
" lines.push('  '+mods[m].padEnd(18,' ')+' ['+bar+'] '+String(p*5).padStart(3,' ')+'%');"
" term.textContent=lines.join('\\n');"
" term.scrollTop=term.scrollHeight;"
" p++;"
" if(p>20){p=0;m++;}"
"}"

"function finish(){"
" if(!siteReady||!bootFinished)return;"
" write('[ OK ] network connection established');"
" write('[ OK ] cyberspace.online is online');"
" write('');"
" write('System ready.');"
" setTimeout(()=>{clearInterval(bootTimer);boot.style.display='none'},250);"
"}"

"site.addEventListener('load',()=>{siteReady=true;finish()});"

"let bootTimer=setInterval(()=>{"
" if(i<lines.length){write(lines[i++]);return;}"
" if(phase===0){phase=1;return;}"
" if(phase===1){moduleBar();if(m>=mods.length)phase=2;}"
"},75);"
"</script>"
"</body></html>";

static void open_external(const char *uri)
{
    g_autoptr(GError) error = NULL;
    if (!g_app_info_launch_default_for_uri(uri, NULL, &error))
        g_printerr("Failed to open %s in the default browser: %s\n", uri,
                   error ? error->message : "unknown error");
}

static gboolean host_is_allowed(const char *host)
{
    static const char *const suffixes[] = {
        "cyberspace.online",
        "firebasedatabase.app",
        "firebaseapp.com",
        "firebaseio.com",
        "googleapis.com",
        "google.com",
        "youtube.com",
        "ytimg.com",
        "fontawesome.com",
        "gstatic.com",
        "cloudflare.com",
    };

    if (!host)
        return FALSE;

    for (size_t i = 0; i < G_N_ELEMENTS(suffixes); i++)
        if (g_str_has_suffix(host, suffixes[i]))
            return TRUE;
    return FALSE;
}

static gboolean uri_stays_in_app(const char *uri)
{
    if (g_str_has_prefix(uri, "about:") ||
        g_str_has_prefix(uri, "data:") ||
        g_str_has_prefix(uri, "blob:") ||
        g_str_has_prefix(uri, "javascript:"))
        return TRUE;

    g_autoptr(GUri) parsed = g_uri_parse(uri, G_URI_FLAGS_NONE, NULL);
    if (!parsed)
        return FALSE;

    return host_is_allowed(g_uri_get_host(parsed));
}

static gboolean on_decide_policy(WebKitWebView *web_view, WebKitPolicyDecision *decision,
                                 WebKitPolicyDecisionType type, gpointer user_data)
{
    (void)web_view;
    (void)user_data;

    if (type != WEBKIT_POLICY_DECISION_TYPE_NAVIGATION_ACTION &&
        type != WEBKIT_POLICY_DECISION_TYPE_NEW_WINDOW_ACTION)
        return FALSE;

    WebKitNavigationAction *action = webkit_navigation_policy_decision_get_navigation_action(
        WEBKIT_NAVIGATION_POLICY_DECISION(decision));
    const gchar *uri = webkit_uri_request_get_uri(webkit_navigation_action_get_request(action));
    if (!uri || uri_stays_in_app(uri))
        return FALSE;

    if (type != WEBKIT_POLICY_DECISION_TYPE_NEW_WINDOW_ACTION &&
        webkit_navigation_action_get_navigation_type(action) != WEBKIT_NAVIGATION_TYPE_LINK_CLICKED)
        return FALSE;

    g_print("Opening in default browser: %s\n", uri);
    open_external(uri);
    webkit_policy_decision_ignore(decision);
    return TRUE;
}

static WebKitWebView *on_create_view(WebKitWebView *web_view, WebKitNavigationAction *action,
                                     gpointer user_data)
{
    (void)web_view;

    const gchar *uri = webkit_uri_request_get_uri(webkit_navigation_action_get_request(action));
    if (uri && !uri_stays_in_app(uri)) {
        g_print("Opening window in default browser: %s\n", uri);
        open_external(uri);
        return NULL;
    }
    return g_object_ref(WEBKIT_WEB_VIEW(user_data));
}

static void apply_settings(WebKitWebView *view)
{
    WebKitSettings *settings = webkit_web_view_get_settings(view);

    webkit_settings_set_enable_javascript(settings, TRUE);
    webkit_settings_set_enable_webgl(settings, TRUE);
    webkit_settings_set_enable_webaudio(settings, TRUE);
    webkit_settings_set_enable_fullscreen(settings, TRUE);
    webkit_settings_set_enable_developer_extras(settings, FALSE);
    webkit_settings_set_enable_smooth_scrolling(settings, FALSE);
    webkit_settings_set_enable_spatial_navigation(settings, FALSE);
    webkit_settings_set_enable_caret_browsing(settings, FALSE);
}

static void load_boot(WebKitWebView *view)
{
    webkit_web_view_load_html(view, boot_html, "https://cyberspace.online/");
}

int main(int argc, char **argv)
{
    const char *uri = argc > 1 ? argv[1] : "https://cyberspace.online";

    GMainLoop *loop = g_main_loop_new(NULL, FALSE);

    WebKitWebView *view = WEBKIT_WEB_VIEW(
        g_object_new(WEBKIT_TYPE_WEB_VIEW, NULL)
    );

    apply_settings(view);

    g_signal_connect(view, "decide-policy", G_CALLBACK(on_decide_policy), NULL);
    g_signal_connect(view, "create", G_CALLBACK(on_create_view), view);

    if (uri != NULL && uri[0] != '\0') {
        char *html = g_strdup_printf(
            "<!doctype html>"
            "<html><body style='margin:0;background:#050900;overflow:hidden'>"
            "<iframe src='%s' "
            "style='position:absolute;inset:0;width:100%%;height:100%%;border:0;background:#050900'>"
            "</iframe>"
            "<script>"
            "const f=document.querySelector('iframe');"
            "f.addEventListener('load',()=>{"
            "document.body.dataset.loaded='1';"
            "});"
            "</script>"
            "</body></html>",
            uri
        );

        webkit_web_view_load_html(view, html, uri);
        g_free(html);
    } else {
        load_boot(view);
    }

    g_main_loop_run(loop);

    g_object_unref(view);
    g_main_loop_unref(loop);

    return EXIT_SUCCESS;
}
