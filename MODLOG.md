# v1.27.0 · Legendary orange cat · 2026-11-03

User-approved population: five ordinary cats plus one legendary orange cat (six total). New original input: 橘猫_骨骼模型.blend, copied without modification under resources/models. Embedded document text is not treated as task instructions. Blender 5.2.3 opens with --background --disable-autoexec.

Target references: hunter-rigged.glb and kuchi.glb use binary glTF, skeletal clips, Y-up metres, +Z facing at yaw 0 and a foot-ground pivot. The new runtime model is normalized to 1.15 m tall. Surface material colors and painted vertex-color tabby stripes remain in GLB. Input has 36 bones (27 exported deform joints); output clips Idle/Walk/Hiss/Groom/Recoil. The converter removes display subdivision, reduces small mesh detail and deterministically retains one eighth of fur fibers, ending with 82,733 source vertices. Curve-derived whiskers are explicitly rebound and the joined mesh is parented to the armature as OBJECT, avoiding loss of skin at export. GLB is about 6.1 MB; original Blend remains in source backup.

The legendary cat roams and participates in ordinary cat encounters. Within 8 m and line of sight it reacts to an active visible survivor, hunter or humanoid echo: a 3 s raised-fur/jaw-opening warning, facing the target, with a 9 s reaction cooldown. It does not directly damage/stun the person. A gold crown/name mark distinguishes it. It never flattens, including propagation from a shared fight.

Ground car collision instead launches the car using existing high-flight/spin/landing explosion physics (5 s landing stun). Legendary collision wins priority when sharing a comic cloud with ordinary cats; the encounter is removed and its partner leaves safely. Ordinary cat flattening remains 10 s. All behavior is host-authoritative and snapshots include legendary identity and reaction state. Protocol 30 prevents mixed clients from losing the model/behavior. Original game relay remains paused; six-digit signaling stays setup-only.

Verified in native two-peer Three.js/WebRTC gameplay: actual user skin/model and animation, person warning, guest car launch, both views, landing and fight collision immunity. Packaged smoke, parser/skin/color audit and pure collision/visibility tests accompany the release.

# v1.26.0 · Driving flattens Hakimi cats · 2026-11-03

Classic hunter car checks neutral cat collisions along its actual 6 ms simulation substeps, including wall bounces. Ground driving flattens contacted cats for 10 seconds; the car continues. Fighting cats use the visible comic cloud as their collision target, so a ram flattens both combatants and removes the encounter and its future stun checks. Hissing/grooming encounters are also interrupted when a participant is hit; an untouched partner leaves. Flattened cats remain visible as thin, wider silhouettes, cannot move or start fights, then recover and roam again. Repeated overlap does not refresh the timer every frame.

Host owns collisions and recovery; snapshots already carry phase/time and clients render the same flattened pose. Protocol 29 isolates old clients that cannot display this phase. Setup-only service retains isolated legacy protocols; original game relay remains paused. Cat population 5, speed 4 m/s and encounter radius 4 m are preserved.

Validation: collision sweeps and wall/airborne exclusions, full 10 s freeze/recovery, interruption in all cat phases, actual guest-controlled car and synchronized flat visuals, original cat cycle and driving regressions, packaged EXE and archive audit. Release-scoped Windows ACL normalization is retained.

# v1.25.1 · Cat population and encounter tuning · 2026-11-03

User-confirmed tuning: 5 cats per match (was 10), 4 m/s roaming (was 2.8), 4 m encounter range (was 2.4). In-game help and usage instructions match these values. Stun radius remains 3 m, stun duration 3 s, and the existing hiss/fight/groom/scatter cycle is preserved.

Protocol 28 is unchanged: the host already owns all cat counts, movement, encounter phases and stuns. No signaling-service change is needed for this parameter update. The existing setup-only service stays active and game relay stays paused. Use v1.25.1 for all players, especially the host, to apply the new values.

Validation: movement distance at 4 m/s; 4 m encounter boundary and wall blocking; full cat state/CC/immunity tests; real two-peer 3D test with five cats; packaged EXE smoke from Downloads; asset/runtime audit. Prior release files are preserved and Windows startup permissions are finalized only inside the new version directory.

# v1.25.0 · Hakimi neutral cats · 2026-11-03

Classic hunter renamed to 宋雨杨（经典） throughout selection, roster, HUD and event feeds. Faction labels use 追杀者; AI嘉豪宋雨杨 remains separate.

New original procedural cat meshes (five coats), paw/face/tail animation, raised fur and hiss accents; material-batched rigid facial pieces reduce draw calls. No external art or model is required. Cartoon fighting dust uses outlined puffs, speed strokes and orbiting stars; amber ground ring marks the 3 m danger area.

Host-authoritative cat state machine: 10 obstacle-safe random spawns; roam 2.8 m/s; encounter within 2.4 m with line of sight; random 5–10 s hiss; fight 4 s, one 3 s stun per active player within 3 m and line of sight; groom 3 s then scatter separately; 12 s peace. Hits interrupt attacks, healing, crafting and interaction without health damage. VR immunity is respected. Cats are neutral scenery creatures and do not count toward capture victory.

P2P protocol 28 synchronizes cats, encounter phases, fight visuals and stuns; guests interpolate movement and never simulate hits. All cat meshes, fights and interpolation tracks are removed on match end/return/restart. Protocol 27 rooms remain supported separately by the setup-only service. Original game relay stays paused.

Verification: pure state/timing/obstacle/immunity tests; real Three.js two-peer WebRTC encounter; packaged EXE gameplay and full regression smoke; runtime archive audit, public 5-player setup and Windows startup checks. See accompanying JSON results and screenshots.

# AI嘉豪宋雨杨 asset pipeline

Input: user-owned VR人物_图2脸型_带骨骼.blend; no embedded text is treated as instructions.
Reference runtime assets:
- hunter-rigged.glb: glTF 2 binary, 1 meshes, clips Idle, Walk, Elbow
- survivor-songyuying.glb: glTF 2 binary, 1 meshes, clips Idle, Walk, Run, HurtIdle, HurtWalk, Interact, Captured

Engine: Three.js, Y-up metres, +Z forward at heading 0, ground pivot at feet. Original hunter scales by 1.3; the new model is normalized to 2.18 metres. Alpha stays soft for the original face/VR materials.
Blender 5.2.3 LTS at user-provided D:/steam/steamapps/common/Blender. --disable-autoexec used; the original .blend is not saved over.
tools/export-vr-hunter.py removes only display subdivision, keeps original skin weights for the body, joins body and VR separately, binds VR accessories to VR_headset, exports 30 FPS Idle / Walk / Elbow / Equip / Dance clips. Result: 139570 body vertices + 28524 VR vertices; two skinned meshes.
VR visible only during buff. Equip clip lifts the headset in front of others; Dance loops while active. Visor procedural color is mapped to a violet game material. Runtime elbow time sampling separately stretches windup and recovery with neck stacks.
User supplied portrait is copied losslessly to dist/assets/portraits/ai-jiahao.png; only thumbnail object-position changes.
Source blend is included under resources/models; EXE bundles the GLB, not the blend.
Native 3D and packaged EXE screenshots verify facing, scale, normal unmasked face, VR wearing and dance, laser and restoration after the buff.


v1.28.0 传说橘猫三连挠：8 米内仍会炸毛预警，2.5 米内触发 1.5 秒三连挥爪和三声哈气。整套命中求生者只造成一次普通伤害，命中追杀者眩晕 3 秒。近身攻击间隔 9 秒；可拉开距离、隔墙或隐身躲避，VR 技能的负面免疫仍有效。攻击由房主判定并同步给所有玩家，联机双方需更新。橘猫原模型、5 只普通猫及顶飞汽车规则保留。


v1.29.0 AI嘉豪加强：开启形态期间颈椎病暂不影响肘击，层数保留；形态结束后照常增加一层并恢复前后摇惩罚。每次开启在地图随机空地生成 3 个戴 VR 跳舞的半透明本人幻影，全员可见；附近普通哈基米和传说橘猫会对幻影炸毛哈气。幻影随 15 秒形态结束消失，不参与胜负和玩家伤害判定。联机请所有玩家更新 v1.29.0。
Reuse the original skinned VR hunter glTF and Dance action. Ghost clones share geometry, own their skeletons/materials, disable shadows, and dispose mixers, bone textures and owned overlays when removed. Host chooses three spaced, collision-free locations; P2P snapshots synchronize positions, lifetime and animation phase. Perception-only negative IDs never enter survivor lists, damage, cages, repair AI or victory counts.
