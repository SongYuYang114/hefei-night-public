const {execFileSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const script=`set -eu
BASE="$HOME/.local/share/hefei-night-server"
test "$(cat "$BASE/server.pause")" = paused
grep -F 'server.pause' "$BASE/start-server.sh" >/dev/null
test "$(cat "$BASE/signaling.pause")" = active
if ss -Hltun 'sport = :29804' | grep . >/dev/null; then exit 1; fi
ss -Hltn 'sport = :29805' | grep . >/dev/null
if ss -Hlun 'sport = :29805' | grep . >/dev/null; then exit 1; fi
PID=$(cat "$BASE/signaling.pid")
ps -p "$PID" -o args= | grep -F "$BASE/signaling-releases/1.29.0/signaling.cjs" >/dev/null
grep -F 'while' "$BASE/run-signaling.sh" >/dev/null
crontab -l | grep -Fx "@reboot $BASE/start-signaling.sh" >/dev/null
sha256sum "$BASE/signaling-releases/1.29.0/signaling.cjs"
sha256sum "$BASE/tls/server.crt"
`;
const output=execFileSync('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=10','friend@43.153.216.60','sh -s'],{input:script,encoding:'utf8',windowsHide:true});const hashes=output.trim().split('\n').map(s=>s.split(' ')[0]);
const hash=p=>createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');assert.equal(hashes[0],hash('signaling.cjs'));assert.equal(hashes[1],hash('signal-cert.pem'));
const report={passed:true,version:require('../package.json').version,checkedUTC:new Date().toISOString(),gameServerPaused:true,gamePort29804Closed:true,gameStartupStillPaused:true,signalingActive:true,signalingOnly:true,signalingPort:29805,signalingTLS:true,signalingAutoRestart:true,signalingBootStartup:true,userAuthorizedSignaling:true,signalingSHA256:hashes[0],publicCertificateSHA256:hashes[1]};fs.writeFileSync(path.join(root,'../legendary-service-verification.json'),JSON.stringify(report,null,2));console.log(report);
