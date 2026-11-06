# Connectivity snapshots

NetworkManager D-Bus is primary; nmcli is an asynchronous fallback. Snapshots
separate physical link, internet/portal/limited/link-only state, interface,
connection type, real AP SSID and signal. Unknown or VPN-like connections are
labelled Network rather than invented Ethernet. Interface changes/reset counters
produce zero traffic rate for the first sample, not a spike.

Tests: `node tests/network-state.test.js`, `bash tests/network-adapter.sh`, and
`ags bundle --gtk 3 core.ts /tmp/cyberarch-network-check`. The adapter fixture
uses an unavailable D-Bus address and boundary nmcli responses with a colon/UTF-8
SSID. It does not change a real connection or start the desktop shell.
