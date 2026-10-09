# City state and privacy

Only an existing user city preference is loaded. The repository's example city
is never treated as configured. Valid legacy saved cities migrate in memory to
manual mode; explicit choices persist atomically as version 2. Missing, invalid
or cleared preferences stay unset, with no forecast or map requests.

Right-click the side panel to search and select a city, clear it, or choose
AUTO (OPT-IN). GeoClue is queried only by that action; service/permission/time-out
errors explain why manual selection is needed. The client is stopped after the
request. Closing the dialog invalidates pending search/location results.

Tests: `node tests/location-state.test.js`, `bash tests/location-widget.sh` in a
Wayland session, and `ags bundle --gtk 3 core.ts /tmp/cyberarch-location-check`.
The isolated widget uses temporary preferences and mocked HTTP; it is not a
full desktop/startup qualification. Real GeoClue permission flows remain host-
dependent. The widget harness explicitly selects Wayland because Astal layer
windows are not supported on an X11-selected GTK display.
