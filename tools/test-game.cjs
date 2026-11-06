'use strict';
const { spawnSync } = require('node:child_process');
const path = require('node:path');
for (const file of ['test-restored.mjs','test-olo.mjs','test-olo-inventory.mjs','test-olo-kick.mjs','test-dog-rewards.mjs','test-olo-asset.cjs']) {
  const result = spawnSync(process.execPath, [path.join(__dirname,file)], {stdio:'inherit',windowsHide:true});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
