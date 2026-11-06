# v1.34.1 · Olo opacity · 2026-11-05

Removed Olo's body transparency. Body and clothing now have opacity 1, opaque rendering and depth writes, in character preview and all match views. Spectacle lenses retain ordinary clear optics. Removed the transparency claim from the skill description. Model, portrait, both item slots, yzm rescue and protocol 36 are unchanged. Validation uses the final portable EXE appearance assertion and package resource audit; unchanged gameplay verification retains its original v1.34.0 reports.

# v1.34.0 · Olo model, portrait, two-item inventory and yzm rescue · 2026-11-05

The supplied 卷发眼镜人物_骨骼模型.blend replaces resources/models/olo.blend byte-for-byte (SHA256 f077e6c86cb8e32929e340fa6474c882b149b9d1f0e1d404a8c7f5db01eba92b). The raw portrait PNG replaces olo.png without modification. Existing Olo/Obiwan/Baige rigs establish GLB, Y-up meters, +Z forward, 1.9 m runtime height and seven skeletal clips. Blender 5.2.3 opens with --disable-autoexec; the converter preserves the neutral face, curly hair, glasses, original 31 materials and 70 bones. Runtime mesh is reduced from 318428 to 98019 vertices, unused expression morph keys removed, normalized skin weights checked; original Blender remains complete. Seven Idle/Walk/Run/HurtIdle/HurtWalk/Interact/Captured animations use relaxed arms. Runtime is about 8 MiB.

Olo is slightly transparent at 82% opacity in character preview, the match and other peers. Materials are copied so ordinary survivors retain their appearance. Olo's passive immunity, doubled speed, repair restriction, random cat kick and capture-victory exclusion remain.

E and Q are independent item slots for Olo. Chests fill E then Q; kick rewards use a free slot or remain queued when both are occupied. Both reject egg and hotpot. Q uses the existing reliable skill action channel, and itemQ plus lastLootSlot are synchronized by protocol 36. Other survivors keep one item and their existing Q skill. AI Olo can fill and use both slots.

Ordinary Olo F rescue remains disabled. An active Olo can consume yzm from E or Q to instantly rescue the nearest captured teammate within 2.4 m and unobstructed line of sight. No valid target means no consumption; the other slot is untouched. AI Olo carrying yzm can approach a captive and use it. The shared release path retains one health and normal rescue protection.

Validation covers item isolation, filtering, full-inventory behavior, no-target and range failure, instant E/Q rescue, status regressions, real public-room two-peer WebRTC controls, model/portrait checks and final portable EXE. Previous asset hashes are retained as a compact regression fixture so obsolete release directories can be recycled after verification. Setup-only signaling supports protocol 36 while retaining 25–35; gameplay relay stays paused.

# v1.33.0 · Dog kick rewards, Olo loot, generator holograms and random cat launches · 2026-11-05

Each survivor (including AI) earns one normal chest-table roll per three successful F interruptions of squatting Kuchi. Failed/repeated kicks do not count; every player has an independent counter. Full inventory queues rewards until an active survivor has a free slot. Counts and queues are authoritative, replicated and reset per match. Olo cannot receive egg or hotpot from chests, kick rewards or restored inventory. Filtered common rolls redistribute among exhaust, yzm and fried rice, preserving the 5% legendary mushroom probability.

Completed generators display the user's supplied photograph as an animated cyan hologram with a light cone, visible to all peers. Raw generator-projection.jpg is copied without alteration (SHA256 56290aac4322089b48cbec37362d1a24b3ba46ffa822795613f95fdc3e4ee500). A runtime shader crops phone UI and removes the green backdrop. Billboards face each viewer and disappear before repair, at results and on reset.

Olo cat kicks draw force once on the host. 90% are 0.5–3 times baseline; a rare tail reaches 100 times baseline, 320 m height, 240 m/s horizontal speed and a maximum six-second flight. Horizontal swept collision and map limits remain. Flight profile and kick serial synchronize so each viewer uses the same trajectory, and cats land safely, with fight cleanup and flattened recovery preserved.

Protocol 35 isolates older gameplay clients. The setup-only six-digit-room service retains protocols 25–34; the gameplay relay remains paused. Source, original model and portrait assets remain available locally. No new personal image is uploaded to GitHub.

# v1.32.0 · Olo speed, rescue restriction and cat kick · 2026-11-05

Olo base walking speed is 7.4 m/s (3.7 × 2). Controlled movement and local prediction share the same multiplier; AI follow speeds are doubled too. Passive status immunity remains unchanged. Olo cannot rescue teammates: the interaction selector, authoritative rescue handler and AI rescue assignment all enforce the restriction. Other survivors can still rescue normally.

Fresh F press within 2.5 m and line of sight kicks the nearest ordinary or legendary cat away from Olo. A 0.55 s skeletal leg kick launches the cat at 12 m/s for 1.1 s with a 3.2 m arcing flip. Swept horizontal collision keeps it inside the map and outside walls. Flying cats cannot be kicked again, fight or collide with cars. A kick interrupts hissing/fighting/grooming encounters, disposes the shared comic cloud and safely releases the partner. A flattened cat retains its remaining recovery timer. Landing restores normal cat behavior and removes the visual spin. AI Olo can kick nearby cats opportunistically; holding F does not repeat player kicks.

Host owns the kick and flight; cat phase, timer and velocity are synchronized and flight height interpolates on guests. Protocol 34 isolates older clients; the setup-only service retains protocols 25–33 and relay remains paused. Validation covers speeds in movement/prediction/AI, rescue guards, both cat types, every fight phase, walls, landing, flatten recovery, real remote F input and both views, final portable EXE and original gameplay regressions.

# v1.31.0 · Olo survivor / passive immunity · 2026-11-05

User input: 人物_骨骼模型.blend (lossless backup resources/models/olo.blend) and the supplied portrait PNG. Embedded file content is not task instructions. Blender 5.2.3 opens with --background --disable-autoexec. Runtime references survivor-obiwan.glb, survivor-baige.glb and survivor-rig.mjs establish binary glTF, Y-up meters, +Z facing, feet at ground, 1.9 m runtime height and seven required clips. The converter preserves 60 bones, 23 original materials, phone/coat/glasses attachments, converts curves to skinned meshes, removes display subdivision and bakes Idle/Walk/Run/HurtIdle/HurtWalk/Interact/Captured clips. Export is about 8.2 MiB. Metadata includes the source hash; the source Blender and portrait remain byte-identical.

Olo is character ID 6, independent of its survivor room slot. The pool uses a dynamic hunter offset so Olo cannot collide with classic hunter selection. Passive 被鸽 has no activation or cooldown. Damage gates cover elbow, car, laser and legendary scratching; shared negative-effect checks cover cats, pigs, curry, exhaust and red-eye holds; Mailisu skips Olo without consuming the trap. Status enforcement also prevents speed/visibility/health effects from persisting. Obiwan cannot transport Olo or use Olo as the destination anchor. Human interaction, host repair handler and AI objective selection all reject Olo repairs. Rescue, chests, gates, normal movement and voluntary jumping remain available.

User explicitly chose: other survivors captured ends the match, ignoring active Olo. Escape victory and the existing yzm self-rescue exception remain. Protocol 33 isolates older gameplay clients; the setup-only TLS service supports 33 while retaining older rooms. Game relay stays paused. No new character media was uploaded to GitHub.

Validation: original model/portrait hashes, normalized skin weights on all vertices, all seven clips, pure ability and integrated game tests, real public six-digit-room two-peer Three.js/WebRTC test (actual elbow/car/VR laser, ordinary damage preserved, movement/jump, traps, pig/cat immunity, repair restriction and shared result), final portable EXE checks and full archive/source audit.

# v1.30.1 · 2980 photo portrait · 2026-11-05

Added the sixth supplied photo for survivor 2980 (ID 1), preserving the original JPEG bytes. Secure local asset serving now declares image/jpeg for .jpg. The character preview and shared pool/roster avatar use the photo with a face-centered crop. The five photos added in v1.30.0 remain. All six use consistent 4:3 display frames; photos remain unstretched. Protocol 32 and gameplay are unchanged.

# v1.30.0 · Survivor photo portraits · 2026-11-05

Added five user-supplied PNGs, copied byte-for-byte: Obiwan (5), Song Yuying (3), Baige (0), Zhulian (2), Longleg Zhulian (4). The existing 2980 and hunter art remain. Shared selection-pool and room-roster avatars use face-focused CSS crops; the portrait inset uses contain to preserve each full original photo. Portrait and avatar frames have a consistent 4:3 aspect ratio; the game viewport remains resizable. Provenance hashes and source dimensions are in dist/assets/portraits/survivor-photos.json. No generated replacements or photo uploads.

Protocol 32 and gameplay are unchanged. Release verification checks actual rendered selection screens, original image hashes, packaged assets and core gameplay.

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
