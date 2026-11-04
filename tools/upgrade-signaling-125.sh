#!/bin/sh
set -eu
BASE="$HOME/.local/share/hefei-night-server"
NODE="$BASE/runtime/node-v24.22.0-linux-x64/bin/node"
RELEASE="$BASE/signaling-releases/1.25.0/signaling.cjs"
"$NODE" --check "$RELEASE"
test "$(cat "$BASE/server.pause")" = paused
if ss -Htn state established 'sport = :29805' | grep . >/dev/null; then
 echo 'Setup connections are active; defer upgrade.' >&2; exit 1
fi
LOOP=$(cat "$BASE/signaling-loop.pid")
PID=$(cat "$BASE/signaling.pid")
case "$LOOP:$PID" in *[!0-9:]*|:*) echo 'Invalid own PIDs' >&2; exit 1;; esac
ps -p "$LOOP" -o args= | grep -F "$BASE/run-signaling.sh" >/dev/null
ps -p "$PID" -o args= | grep -F "$BASE/signaling-releases/1.24.0/signaling.cjs" >/dev/null
cp -p "$BASE/run-signaling.sh" "$BASE/run-signaling.before-1.25.0.sh"
sed 's@signaling-releases/1.24.0/@signaling-releases/1.25.0/@' "$BASE/run-signaling.sh" > "$BASE/run-signaling.next.sh"
chmod 700 "$BASE/run-signaling.next.sh"
kill "$LOOP"
kill "$PID"
sleep 1
if ss -Hltun 'sport = :29805' | grep . >/dev/null; then echo 'Unexpected listener still present' >&2; exit 1; fi
mv "$BASE/run-signaling.next.sh" "$BASE/run-signaling.sh"
sh "$BASE/start-signaling.sh"
sleep 1
ss -Hltun 'sport = :29805' | grep . >/dev/null
test "$(cat "$BASE/server.pause")" = paused
if ss -Hltun 'sport = :29804' | grep . >/dev/null; then echo 'Game service unexpectedly listening' >&2; exit 1; fi
echo 'Signaling updated for game protocols 25, 26, 27 and 28; original relay remains paused.'
