from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import shutil
import subprocess
import sys
import zipfile

sys.stdout.reconfigure(encoding='utf-8')
source = Path(__file__).resolve().parents[1]
base = source.parent
version = json.loads((source / 'package.json').read_text(encoding='utf-8'))['version']
release = Path.home() / 'Downloads' / f'HefeiNight_v{version}'
build = base / f'build-v{version}'
reports = [
    ('hakimi-unit.json', '猫咪原有规则测试.json'),
    ('cat-car-unit.json', '汽车压扁猫咪规则与碰撞测试.json'),
    ('hakimi-visual-unit.json', '平面建模与恢复动作测试.json'),
    ('unit-result.json', '原有游戏与汽车规则回归测试.json'),
    ('cat-car-p2p/result.json', '汽车压扁猫咪真实双端联机测试.json'),
    ('cat-car-motion.json', '丢包移动同步回归测试.json'),
    ('cat-car-five-public/result.json', '公网五人房间号测试.json'),
    ('signal-version-result.json', '新旧协议房间隔离测试.json'),
    ('cat-car-service-verification.json', '轻量服务与中继停用验证.json'),
    ('cat-car-portable/result.json', '最终EXE实机测试.json'),
    ('package-audit.json', '打包资源校验.json'),
]


def sha(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


def copy_changed(src, dst):
    src, dst = Path(src), Path(dst)
    if dst.is_file() and src.stat().st_size == dst.stat().st_size and sha(src) == sha(dst):
        return str(dst)
    return shutil.copy2(src, dst)


def normalize():
    subprocess.run(['pwsh.exe', '-NoProfile', '-File', str(source / 'tools/finalize-windows-release.ps1'),
                    '-ReleaseDirectory', str(release)], check=True, creationflags=subprocess.CREATE_NO_WINDOW)


if '--stage' in sys.argv:
    release.mkdir(exist_ok=True)
    copy_changed(build / 'HefeiNight.exe', release / 'HefeiNight.exe')
    shutil.copytree(build / 'win-unpacked', release / 'Game', dirs_exist_ok=True, copy_function=copy_changed)
    (release / '版本信息.json').write_text(json.dumps({'version': version, 'status': 'validation_pending'}), encoding='utf-8')
    normalize()
    print(json.dumps({'staged': str(release)}, ensure_ascii=False))
    sys.exit(0)

for name, target in reports:
    result = json.loads((base / name).read_text(encoding='utf-8'))
    assert result['passed'] and result['version'] == version, name
    shutil.copy2(base / name, release / target)
assert json.loads((base / 'cat-car-p2p/result.json').read_text(encoding='utf-8'))['tenSecondFreezeVerifiedInRealTime']
unit = json.loads((base / 'hakimi-unit.json').read_text(encoding='utf-8'))
assert unit['randomCats'] == 5 and unit['roamSpeedMetersPerSecond'] == 4 and unit['encounterRadiusMeters'] == 4
assert json.loads((base / 'cat-car-portable/result.json').read_text(encoding='utf-8'))['packaged']
assert sha(release / 'HefeiNight.exe') == sha(build / 'HefeiNight.exe')
for name in ['使用说明.txt', '联机说明.txt', 'EASY-P2P.md', 'P2P-LOSS-FIX.md', 'MODLOG.md']:
    shutil.copy2(source / name, release / name)
for name in ['哈基米炸毛哈气.png', '漫画烟团猫架与3秒眩晕.png', '哈基米打完舔毛.png','汽车撞散猫架压成平面.png']:
    shutil.copy2(base / 'cat-car-portable' / name, release / name)

files = [p for p in source.rglob('*') if p.is_file() and not any(
    part in ['node_modules', 'build', '.git', '__pycache__'] for part in p.relative_to(source).parts)]
assert not any(p.suffix == '.key' or p.name == 'key.pem' for p in files)
archive = release / f'合肥惊魂夜_v{version}_完整源码备份.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for file in files:
        z.write(file, Path('hefei-night') / file.relative_to(source))
shutil.copy2(archive, base / archive.name)

manifest = {
    'version': version, 'protocol': 29, 'createdUTC': datetime.now(timezone.utc).isoformat(),
    'hakimi': {'count': 5, 'roamingSpeed': 4, 'encounterRangeMeters': 4,
               'windupSeconds': [5, 10], 'fightSeconds': 4, 'groomSeconds': 3,
               'stunSeconds': 3, 'stunRadiusMeters': 3, 'peaceSeconds': 12,
               'carFlattenSeconds':10,'carFlattensFightingPair':True,'flatteningEndsFight':True,'carContinuesDriving':True,
               'oneStunPerPlayerPerFight': True, 'VRImmunityRespected': True, 'P2PSynchronized': True},
    'gameplayP2POnly': True, 'gameRelayEnabled': False, 'setupOnlyServiceUpdated': True,
    'allPlayersMustUpdate': True, 'windowsStartupPermissionsNormalized': True,
    'portableEXEGameplayVerified': True, 'oldVersionsPreserved': True,
    'exe': {'file': str(release / 'HefeiNight.exe'), 'sha256': sha(release / 'HefeiNight.exe'),
            'bytes': (release / 'HefeiNight.exe').stat().st_size},
    'sourceBackup': {'file': str(archive), 'sha256': sha(archive), 'files': len(files)},
    'tests': [target for _, target in reports],
}
for target in [release / '版本信息.json', base / 'cat-car-complete.json']:
    target.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
normalize()
print(json.dumps({'release': str(release), 'testsPassed': len(reports),
                  'exe': manifest['exe'], 'sourceBackup': manifest['sourceBackup']}, ensure_ascii=False, indent=2))
