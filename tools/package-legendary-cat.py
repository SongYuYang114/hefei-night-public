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
    ('legendary-cat-unit.json', '传说橘猫行为与顶飞规则测试.json'),
    ('legendary-asset-result.json', '用户橘猫模型骨骼颜色与动画校验.json'),
    ('legendary-cat-p2p/result.json', '传说橘猫真实3D双端联机测试.json'),
    ('hakimi-unit.json', '普通猫原有规则测试.json'),
    ('cat-car-unit.json', '普通猫压扁规则回归测试.json'),
    ('hakimi-visual-unit.json', '普通猫动作与恢复回归测试.json'),
    ('unit-result.json', '原有游戏与汽车回归测试.json'),
    ('legendary-motion.json', '丢包移动同步回归测试.json'),
    ('legendary-five-public/result.json', '公网五人房间号测试.json'),
    ('signal-version-result.json', '新旧协议房间隔离测试.json'),
    ('legendary-service-verification.json', '轻量服务与中继停用验证.json'),
    ('legendary-portable/result.json', '最终EXE实机测试.json'),
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
assert json.loads((base / 'legendary-cat-p2p/result.json').read_text(encoding='utf-8'))['legendaryInFightAlsoRepelsCar']
unit = json.loads((base / 'hakimi-unit.json').read_text(encoding='utf-8'))
assert unit['randomCats'] == 5 and unit['roamSpeedMetersPerSecond'] == 4 and unit['encounterRadiusMeters'] == 4
assert json.loads((base / 'legendary-portable/result.json').read_text(encoding='utf-8'))['packaged']
assert sha(release / 'HefeiNight.exe') == sha(build / 'HefeiNight.exe')
for name in ['docs/PLAYER-GUIDE.md', 'docs/MULTIPLAYER.md', 'docs/history/EASY-P2P.md', 'docs/history/P2P-LOSS-FIX.md', 'MODLOG.md']:
    shutil.copy2(source / name, release / Path(name).name)
for name in ['传说橘猫用户模型炸毛.png','传说橘猫顶飞汽车.png','汽车撞散猫架压成平面.png']:
    shutil.copy2(base / 'legendary-cat-p2p' / '传说橘猫用户模型见人炸毛.png' if name == '传说橘猫用户模型炸毛.png' else base / 'legendary-portable' / name, release / name)
for name in ['传说橘猫用户模型见人炸毛.png','打架中的橘猫也不会变扁.png']:
    shutil.copy2(base / 'legendary-cat-p2p' / name, release / name)

files = [p for p in source.rglob('*') if p.is_file() and p.name != 'hefei-runtime.json' and not p.name.endswith('.local.json') and not p.name.startswith('.env') and not any(
    part in ['node_modules', 'build', '.git', '__pycache__', '.local', 'artifacts'] for part in p.relative_to(source).parts)]
assert not any(p.suffix == '.key' or p.name == 'key.pem' for p in files)
archive = release / f'合肥惊魂夜_v{version}_完整源码备份.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for file in files:
        z.write(file, Path('hefei-night') / file.relative_to(source))
shutil.copy2(archive, base / archive.name)

manifest = {
    'version': version, 'protocol': 30, 'createdUTC': datetime.now(timezone.utc).isoformat(),
    'legendaryCat': {'count':1,'totalCats':6,'sourceModel':'橘猫_骨骼模型.blend','sourceSHA256':json.loads((source/'dist/assets/legendary-orange-cat.json').read_text(encoding='utf-8'))['sourceSHA256'],'sightRangeMeters':8,'warningSeconds':3,'reactionCooldown':9,'neverFlattened':True,'topplesCarIncludingDuringFight':True,'landingStunSeconds':5,'P2PSynchronized':True},
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
for target in [release / '版本信息.json', base / 'legendary-complete.json']:
    target.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
normalize()
print(json.dumps({'release': str(release), 'testsPassed': len(reports),
                  'exe': manifest['exe'], 'sourceBackup': manifest['sourceBackup']}, ensure_ascii=False, indent=2))
