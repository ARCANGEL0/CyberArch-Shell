# ToC

- [Core fixes](#bug-fixes--2026-10-08)
- [Daily-use fixes](#daily-use-fixes--2026-10-09)
- [Validation](#validation)
- [Note to ARCANGEL0](#notes-to-dev)

## Notes to Dev

> A short PR would't be appropriate to express my gatitude and the specific fixes hence, I am sending the PR with this notes(don't forget to delete before merge pls OwO) but first things first:

0. Thank you for kindness and allowing me to use your dotfiles

1. If you wouldn't mind, would you be so kind and add a license to repository 

2. I've been using your desktop env for a few months and was patching rough edges personally and thought you'd be more interested to extend the features instead of dealing with bugs so fixed a few rough edges [documented below](#bug-fixes--2026-10-08)

3. Didn't touch anything visual nor removed/added anything

4. Please ,if you consider merging, check the code yourself.My speciality isn't scripting/high-level languages (although I ran tests and used this version for 12+ hours) 

5. There is a dual-login screen (one with username-passwd and one with passwd after first pass) but I thought that might be intentional so I did **not** touch that

6. This is me attempting to pay your kindness back so no need to consider me as a contributer - Neuro

## Bug fixes — 2026-10-08

These changes improve shell reliability, process targeting, update tracking and recording state. The fixes below are implemented in this branch; “deployed fix” describes the code change, not deployment to an installed desktop. Files under `components/apps/` are outside this PR's scope.

### Restart process targeting

**found problem:** `scripts/restart` used `pkill -9 -f '[c]ore.ts'`, which could terminate unrelated processes whose command lines contained `core.ts`

**deployed fix:** Removed the broad process match. Restart requests shutdown of the named `cyberpunk` AGS instance before launching the shell again

### Kill-mode window selection

**found problem:** `scripts/overkill` selected a process by window geomety without checking whether the window belonged to a visible workspace. Overlapping coordinates could select an invisible window on another workspace.

**deployed fix:** Restrict candidates to mapped non-hidden windows on their monitor's active workspace, accounting for special workspaces and focus history

### Compositor socket recovery

**found problem:** `core.ts` continued reading the event socket after EOF or errors, producing repeated callbacks without recovering the connection. It also selected the first socket found rather than the current Hyprland instance.

**deployed fix:** Connect asynchronously to the current instance's socket. Close disconnected streams and schedule a single retry after one second. Decode incoming event bytes explicitly

### Workspace normalization

**found problem:** `scripts/ws` compared numeric client monitor IDs with monitor names. Failed lookups defaulted to monitor index zero, moving windows into the wrong monitor's workspace range.

**deployed fix:** Match numeric monitor IDs when computing the destination workspace.

### Fork-aware update tracking

**found problem:** `updater.sh` checked upstream release metadata while fetching the checkout's `origin`. If a release tag was unavailable, it could fall back to a branch but still mark the advertised release as installed.

**deployed fix:** Derive the GitHub release repository from `origin`, reject cached metadata from another repository, and associate applied versions with the installed commit. Fetch the advertised tag explicitly and abort if it is unavailable. Original-repository checkouts follow original releases; fork checkouts follow fork releases. Manual updates retain branch fallback when release lookup fails.

### Recording lifecycle

**found problem:** `components/modules/region.ts` started the recorder in the background, discarded its errors and immediately enabled the recording indicator. A failed or exited recorder could leave the UI reporting an active recording.

**deployed fix:** Track the recorder subprocess, delay the indicator briefly to catch immediate failures, clear recording state on exit and report failures. The region handler signals the tracked subprocess when stopping a recording

## Daily-use fixes — 2026-10-09

### Unbounded dock polling

**found problem:** `components/modules/dock.ts` launched state queries every six seconds per monitor without a timeout or overlap guard. In the affected session, 328 unfinished Bluetooth queries contributed to 1,017 open descriptors against a 1,024 soft limit. The shell repeatedly reported `Too many open files` providing a likely explanation for shortcuts failing after extended uptime

**deployed fix:** Bound dock state queries with a four-second timeout and a one-second forced-kill grace period. Share pending queries across monitor widgets and cache completed results for one secnd This prevents repeated executions of the same Bluetooth, network audio or player state query from accumulating while an earlier query is pending

### Monitor disconnect and reconnect handling

**found problem:** `core.ts` created monitor widgets only at startup. It had no lifecycle handling to rebind them after monitor disconnection, reconnection or layout changes, leaving map/clock widgets vulnerable to disappearing after monitor power cycling

**deployed fix:** Retain HUD groups by connector, hide disconnected groups and rebind/remap them when their monitor returns. Handle GTK monitor/layout changes and Hyprland monitor events; existing monitor polling also tracks DPMS state. Reuse groups to avoid duplicating widget timers on repeated reconnects. Recording cleanup in `components/modules/anim.ts` keeps disconnected or sleeping monitor groups hidden

### Launcher and region-screenshot request failures

**found problem:** Launcher and screenshot scripts suppressed socket errors. The screenshot cue played before the shell accepted the request, so a failed request could produce sound without opening the picker. Raw socket responses also require Astal protocol framing

**deployed fix:** Use the native Astal client with a bounded request timeout in `scripts/launcher` and `scripts/screenshot`. Normalize incoming request whitespace in `core.ts`, acknowledge successful handling and return an error when opening the menu or picker throws. Notify the user when a request fails or goes unanswered. Play the region-screenshot cue only after a successful acknowledgement.

### Full-screen screenshot error reporting

**found problem:** `scripts/screenshot` could play a success cue and show a success notification after capture or clipboard copying failed

**deployed fix:** Check screenshot-directory creation, capture and clipboard operations separately. Stop and report the failing step, including the saved file path when capture succeeded but copying failed.

### Screenshot monitor geometry

**found problem:** `scripts/active-monitor` supplied physical monitor dimensions to a picker using logical coordinates and did not reject missing monitor data. Scaling or rotation could therefore produce an incorrectly sized selection surface

**deployed fix:** Reject missing/offline monitor data and convert dimensions to logical coordinates using monitor scale and rotation. Screenshot requests stop with an error when monitor lookup fails

## Validation

- The initial six temporary regression tests passed for the core fixes

- Seven additional temporary regression groups passed. Coverage included 100 concurrent polling requests, real timeout termination, cache expiry/retry, failed commands, 100 simulated monitor reconnect cycles, changed monitor objects/order, new monitors, DPMS transitions, HUD layer preservation, recording visibility and debounced recovery.

- Shortcut cases covered successful, rejected empty failed and hung responses for both launcher and screenshot requests. Additional cases covered capture/clipboard failures, absent/malformed monitor data, fractional scaling, rotation, negative monitor coordinates and request-handler exceptions.

- An isolated GJS/Astal server verified actual native-client success/error responses and the launcher script. A read-only GTK probe confirmed monitor connector names match Hyprland outputs.

- All 35 existing installer-harness checks passed. Syntax checks passed for 25 shell scripts and 34 TypeScript files outside `components/apps/`. `git diff --check` passed. Syntax checks do not constitute a full type check

- Temporary test scripts and fixtures were removed after testing. The pre-existing installer harness remains unchanged

Physical monitor power cycling and an hours-long graphical-session soak remain untested. The monitor fix addresses missing lifecycle handling; the observed compositor zero-opacity state has not been conclusively diagnosed. The reason Bluetooth queries stall on the affected machine also remains unconfirmed. These changes have not been deployed to the separate installed desktop checkout
