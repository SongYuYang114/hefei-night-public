'use strict';
const $ = id => document.getElementById(id);
let state;
const mb = bytes => (bytes / 1024 / 1024).toFixed(1) + ' MB';
function render(next) {
  state = next;
  const busy = ['checking', 'downloading', 'verifying', 'restarting'].includes(state.phase);
  const downloading = state.phase === 'downloading';
  $('current-version').textContent = 'v' + state.currentVersion;
  $('status').textContent = state.message;
  $('source').textContent = state.source ? '下载来源：' + state.source : '优先从 GitHub Release 获取更新';
  $('check').disabled = busy || state.phase === 'ready';
  $('check').textContent = state.phase === 'offline' ? '重新检查' : '检查更新';
  $('update').hidden = !['available', 'ready', 'restarting'].includes(state.phase);
  $('update').disabled = state.phase === 'restarting';
  $('update').textContent = state.phase === 'ready' ? '重启并更新' : state.phase === 'restarting' ? '正在重启…' : '下载 v' + state.availableVersion;
  $('cancel').hidden = !['checking', 'downloading'].includes(state.phase);
  $('play').disabled = ['downloading', 'verifying', 'restarting'].includes(state.phase);
  $('play').textContent = state.phase === 'ready' ? '启动当前版本' : '启动游戏';
  $('progress').hidden = !['checking', 'downloading', 'verifying'].includes(state.phase);
  if (downloading && state.total) $('progress').value = state.received / state.total * 100;
  else $('progress').removeAttribute('value');
  $('transfer').hidden = !downloading;
  $('transfer').textContent = mb(state.received) + ' / ' + mb(state.total);
  if (state.notes) $('notes').textContent = state.notes;
}
async function action(fn) { try { await fn(); } catch { $('status').textContent = '操作未完成，请重试。'; } }
$('check').onclick = () => action(() => window.launcher.check());
$('update').onclick = () => action(() => state.phase === 'ready' ? window.launcher.apply() : window.launcher.download());
$('cancel').onclick = () => action(() => window.launcher.cancel());
$('play').onclick = () => action(() => window.launcher.play());
$('help').onclick = () => action(() => window.launcher.help());
window.launcher.onUpdate(render);
window.launcher.state().then(render).catch(() => { $('status').textContent = '登录器初始化失败，请重启。'; });
