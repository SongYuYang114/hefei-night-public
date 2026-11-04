#!/bin/sh
set -eu
BASE="$HOME/.local/share/hefei-night-server"
NODE="$BASE/runtime/node-v24.22.0-linux-x64/bin/node"
RELEASE="$BASE/signaling-releases/1.22.0/signaling.cjs"
test -r "$RELEASE"
test -r "$BASE/tls/server.key"
test -r "$BASE/tls/server.crt"
"$NODE" --check "$RELEASE"
if ss -Hltun 'sport = :29805' | grep . >/dev/null; then
 echo 'Port 29805 already in use; refusing to replace an unknown listener.' >&2
 exit 1
fi
cat > "$BASE/run-signaling.sh" <<'EOF'
#!/bin/sh
BASE="$HOME/.local/share/hefei-night-server"
NODE="$BASE/runtime/node-v24.22.0-linux-x64/bin/node"
while [ "$(cat "$BASE/signaling.pause" 2>/dev/null)" != paused ]; do
 HEFEI_TLS_KEY="$BASE/tls/server.key" HEFEI_TLS_CERT="$BASE/tls/server.crt" "$NODE" "$BASE/signaling-releases/1.22.0/signaling.cjs" 29805 &
 echo $! > "$BASE/signaling.pid"
 wait "$!"
 sleep 3
done
EOF
cat > "$BASE/start-signaling.sh" <<'EOF'
#!/bin/sh
set -eu
BASE="$HOME/.local/share/hefei-night-server"
if [ "$(cat "$BASE/signaling.pause" 2>/dev/null)" = paused ]; then exit 0; fi
if [ -f "$BASE/signaling-loop.pid" ]; then
 PID=$(cat "$BASE/signaling-loop.pid")
 case "$PID" in *[!0-9]*|'') ;; *)
  if ps -p "$PID" -o args= 2>/dev/null | grep -F "$BASE/run-signaling.sh" >/dev/null; then exit 0; fi ;;
 esac
fi
nohup sh "$BASE/run-signaling.sh" >> "$BASE/signaling.log" 2>&1 </dev/null &
echo $! > "$BASE/signaling-loop.pid"
EOF
chmod 700 "$BASE/run-signaling.sh" "$BASE/start-signaling.sh"
printf 'active\n' > "$BASE/signaling.pause"
TASK_CRON=$(mktemp)
crontab -l > "$TASK_CRON" 2>/dev/null || true
ENTRY="@reboot $BASE/start-signaling.sh"
if ! grep -Fx "$ENTRY" "$TASK_CRON" >/dev/null; then printf '%s\n' "$ENTRY" >> "$TASK_CRON"; fi
crontab "$TASK_CRON"
rm -f "$TASK_CRON"
sh "$BASE/start-signaling.sh"
sleep 1
test "$(cat "$BASE/server.pause")" = paused
if ss -Hltun 'sport = :29804' | grep . >/dev/null; then echo 'Original game service unexpectedly listening' >&2; exit 1; fi
ss -Hltun 'sport = :29805' | grep . >/dev/null
echo 'Setup service ready on TCP 29805; game service remains paused on 29804.'
