'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
async function loadRuntime({ userData, portableDirectory, appPath }) {
  const stored = path.join(userData, 'hefei-runtime.json');
  const candidates = [process.env.HEFEI_RUNTIME_CONFIG, portableDirectory && path.join(portableDirectory, 'hefei-runtime.json'), path.join(appPath, '.local', 'runtime.json'), stored].filter(Boolean);
  for (const file of candidates) {
    try {
      const data = await fs.readFile(file, 'utf8');
      const config = JSON.parse(data);
      if (file !== stored) {
        await fs.mkdir(userData, { recursive: true });
        await fs.writeFile(stored + '.tmp', data, { mode: 0o600 });
        await fs.rename(stored + '.tmp', stored);
      }
      return config;
    } catch (error) { if (error.code !== 'ENOENT') throw Error('本机运行配置无效，请联系维护者。'); }
  }
  return {};
}
module.exports = { loadRuntime };
