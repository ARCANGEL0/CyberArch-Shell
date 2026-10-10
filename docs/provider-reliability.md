# Provider reliability contract

Responses are coordinated by provider and deduplicated per URL. Validated values
and provider retry windows persist beneath XDG_CACHE_HOME/cyberarch/providers.
Panels show provider, freshness, age and errors rather than pretending stale data
is live. Malformed payloads never replace good data. Retry-After seconds/dates and
bounded backoff apply to CoinGecko, Yahoo, RSS hosts and Open-Meteo independently.

Prices refresh every minute; histories use five minutes. News refreshes on opening
and every fifteen minutes while visible. Saved invalid pins remain unavailable;
new pins require asynchronous provider validation. RSS links are deduplicated.
These are delayed provider feeds, not exchange-grade real-time quotes.

Run `node tests/provider-client.test.js`, `bash tests/provider-adapter.sh`, then
`ags bundle --gtk 3 core.ts /tmp/cyberarch-provider-check`. HTTP/filesystem/time are
test boundaries; no desktop ownership or compatibility-manager dependency exists.
The adapter fixture verifies actual GJS parsing, persistence and restart backoff;
it does not claim current third-party API availability.
