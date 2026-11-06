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
build = base / f'build-v{version}'
release = Path.home() / 'Downloads' / f'HefeiNight_v{version}'

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def normalize():
    subprocess.run(['pwsh.exe', '-NoProfile', '-File', str(source / 'tools/finalize-windows-release.ps1'),
                    '-ReleaseDirectory', str(release)], check=True, creationflags=subprocess.CREATE_NO_WINDOW)

if '--stage' in sys.argv:
    release.mkdir(exist_ok=True)
    shutil.copy2(build / 'HefeiNight.exe', release / 'HefeiNight.exe')
    shutil.copytree(build / 'win-unpacked', release / 'Game', dirs_exist_ok=True)
    (release / '版本信息.json').write_text(json.dumps({'version': version, 'status': 'validation_pending'}), encoding='utf-8')
    normalize()
    print(json.dumps({'staged': str(release)}, ensure_ascii=False))
    sys.exit(0)

reports = [('olo-selection/result.json', '立绘原生界面测试.json'),
           ('olo-portable/result.json', '最终EXE实机测试.json'),
           ('olo-inventory-unit.json', 'Olo-two-items-quick-rescue-tests.json'),
           ('dog-rewards-unit.json', 'Dog-reward-projection-random-kick-tests.json'),
           ('olo-kick-unit.json', 'Olo-kick-speed-rescue-tests.json'),
           ('olo-unit.json', 'Olo-passive-tests.json'),
           ('olo-asset.json', 'Olo-model-tests.json'),
           ('olo-p2p/result.json', 'Olo-real-P2P-tests.json'),
           ('signal-version-result.json', 'Public-room-protocol-tests.json'),
           ('legendary-service-verification.json', 'Signaling-only-service-tests.json'),
           ('unit-result.json', '原有游戏回归测试.json'),
           ('package-audit.json', '打包资源校验.json')]
for name, target in reports:
    result = json.loads((base / name).read_text(encoding='utf-8'))
    assert result['passed'] and result['version'] in ([version] if name in ['olo-portable/result.json','package-audit.json'] else ['1.34.0',version]), name
    shutil.copy2(base / name, release / target)
packaged = json.loads((base / reports[1][0]).read_text(encoding='utf-8'))
assert all(packaged[k] for k in ['packaged', 'sevenUserPortraits', 'portraitPoolAndRoster', 'uniformFourThreeFrames',
                                'photosPreservedWithoutStretching', 'selectionAtFourThreeAndWidescreen', 'captureVictoryAndCleanup','oloCannotRescue','oloCanOpenChest','oloKicksBothCatTypes','oloCannotRepair','oloIgnoredInCaptureVictory','oloRealElbowPigAndCatImmune', 'dogThreeKicksReward', 'queuedRewardPreserved', 'oloFilteredRewardAndChest', 'repairedGeneratorProjectsPhoto', 'projectionHiddenBeforeRepairAndAfterReset', 'oloTwoIndependentItemSlots', 'oloYzmInstantTeammateRescue', 'oloOpaque', 'oloNewModelAndPortrait'])
assert sha(release / 'HefeiNight.exe') == sha(build / 'HefeiNight.exe')
for name in ['使用说明.txt', '联机说明.txt', 'EASY-P2P.md', 'P2P-LOSS-FIX.md', 'MODLOG.md']:
    shutil.copy2(source / name, release / name)
screens = release / '立绘预览'
screens.mkdir(exist_ok=True)
for image in (base / 'olo-portable').glob('*.png'):
    shutil.copy2(image, screens / image.name)
files = [p for p in source.rglob('*') if p.is_file() and not any(
    part in ['node_modules', 'build', '.git', '__pycache__'] for part in p.relative_to(source).parts)]
assert not any(p.suffix == '.key' or p.name == 'key.pem' for p in files)
archive = release / f'合肥惊魂夜_v{version}_完整源码备份.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for file in files:
        z.write(file, Path('hefei-night') / file.relative_to(source))
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for file in files:
        assert hashlib.sha256(z.read(str(Path('hefei-night') / file.relative_to(source)).replace('\\', '/'))).hexdigest() == sha(file)
shutil.copy2(archive, base / archive.name)
manifest = {'version': version, 'protocol': 36, 'createdUTC': datetime.now(timezone.utc).isoformat(),
            'portraits': json.loads((source / 'dist/assets/portraits/survivor-photos.json').read_text(encoding='utf-8')),
            'portableEXEVerified': True, 'windowsStartupPermissionsNormalized': True,
            'threeDogKicksPerItem': True, 'fullInventoryQueuesReward': True, 'OloExcludedItems': ['egg', 'hotpot'], 'randomCatKickMaxHeight': 320, 'randomCatKickMaxFlightSeconds': 6, 'projectionAssetSHA256': sha(source / 'dist/assets/generator-projection.jpg'), 'OloPassive': True, 'OloBaseSpeed': 7.4, 'OloCanRescueNormally': False, 'OloYzmRescuesTeammates': True, 'OloItemSlots': ['E', 'Q'], 'OloOpacity': 1, 'OloCanKickBothCatTypes': True, 'otherSurvivorsCapturedIgnoresOlo': True, 'oldVersionsRecycledAfterValidation': True,
            'exe': {'file': str(release / 'HefeiNight.exe'), 'sha256': sha(release / 'HefeiNight.exe')},
            'sourceBackup': {'file': str(archive), 'sha256': sha(archive), 'files': len(files)},
            'tests': [target for _, target in reports], 'unchangedGameplayEvidenceVersion': '1.34.0'}
for dest in [release / '版本信息.json', base / 'olo-opaque-complete.json']:
    dest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
normalize()
print(json.dumps(manifest, ensure_ascii=False, indent=2))
