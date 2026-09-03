#!/usr/bin/env bash
# cache-news.sh — fetches BBC + Google News RSS, writes headlines to /tmp/cyberpunk-news-cache.json
# run via cron: */10 * * * * ~/.config/hypr/themes/cyberpunk/components/login/sddm-theme/cache-news.sh

CACHE="/tmp/cyberpunk-news-cache.json"
CITY_FILE="$HOME/.config/cyberarch/city.json"
[ -r "$CITY_FILE" ] || CITY_FILE="$HOME/.config/hypr/themes/cyberpunk/config/city.json"

strip_tags() { sed 's/<[^>]*>//g'; }

decode_entities() {
  sed -E 's/<!\[CDATA\[([^]]*)\]\]>/\1/g;
          s/&amp;/\&/g; s/&lt;/</g; s/&gt;/>/g;
          s/&quot;/"/g; s/&#39;/'"'"'/g; s/&apos;/'"'"'/g;
          s/&nbsp;/ /g; s/&rsquo;/'"'"'/g; s/&lsquo;/'"'"'/g;
          s/&rdquo;/"/g; s/&ldquo;/"/g;
          s/&ndash;/-/g; s/&mdash;/-/g; s/&hellip;/.../g;
          s/&#x([0-9a-fA-F]+);/printf "\\x\1"/ge;
          s/&#([0-9]+);/printf "\\x\1"/ge'
}

extract_titles() {
  grep -oP '<(item|entry)\b[\s\S]*?</\1>' | \
    grep -oP '<title[^>]*>\K[\s\S]*?(?=</title>)' | \
    strip_tags | decode_entities | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | \
    grep -v '^$' | head -7
}

city="US"
if [ -f "$CITY_FILE" ]; then
  city_full=$(python3 -c "import json,sys; d=json.load(open('$CITY_FILE')); print(d.get('full',''))" 2>/dev/null || echo "")
  city_name=$(python3 -c "import json,sys; d=json.load(open('$CITY_FILE')); print(d.get('name',''))" 2>/dev/null || echo "")
  city="${city_full:-${city_name:-US}}"
fi

global_url="https://feeds.bbci.co.uk/news/world/rss.xml"
local_url="https://news.google.com/rss/search?q=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${city} news when:2d'))")&hl=en-US&gl=US&ceid=US:en"

global_titles=$(curl -sfL --max-time 8 -H "User-Agent: Mozilla/5.0" "$global_url" | extract_titles)
local_titles=$(curl -sfL --max-time 8 -H "User-Agent: Mozilla/5.0" "$local_url" | extract_titles)

headlines="[]"
if [ -n "$global_titles" ] || [ -n "$local_titles" ]; then
  headlines=$(python3 -c "
import json, sys
g = '''$global_titles'''.strip().split('\n') if '''$global_titles'''.strip() else []
l = '''$local_titles'''.strip().split('\n') if '''$local_titles'''.strip() else []
mixed = []
for i in range(max(len(g), len(l))):
    if i < len(g) and g[i].strip(): mixed.append(g[i].strip())
    if i < len(l) and l[i].strip(): mixed.append(l[i].strip())
print(json.dumps(mixed[:14]))
" 2>/dev/null || echo "[]")
fi

echo "$headlines" > "$CACHE"
