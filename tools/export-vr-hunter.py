import bpy,math,json,sys,hashlib
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
out=Path(sys.argv[sys.argv.index('--')+1]).resolve();out.parent.mkdir(parents=True,exist_ok=True)
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig.animation_data_clear();bpy.context.scene.render.fps=30
for action in list(bpy.data.actions):bpy.data.actions.remove(action)
for b in rig.pose.bones:
    for c in list(b.constraints):b.constraints.remove(c)
    b.rotation_mode='QUATERNION';b.matrix_basis=Matrix.Identity(4)
meshes=[o for o in bpy.data.objects if o.type=='MESH' and o.parent==rig]
for o in meshes:
    o.hide_set(False);o.hide_render=False
    for m in list(o.modifiers):
        if m.type=='SUBSURF':o.modifiers.remove(m);continue
        if m.type!='ARMATURE':
            bpy.context.view_layer.objects.active=o
            try:bpy.ops.object.modifier_apply(modifier=m.name)
            except RuntimeError:pass
    if o.name.startswith('VR |'):
        o.vertex_groups.clear();g=o.vertex_groups.new(name='VR_headset');g.add(list(range(len(o.data.vertices))),1,'REPLACE')
def join(items,name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in items:o.select_set(True)
    bpy.context.view_layer.objects.active=items[0];bpy.ops.object.join();o=bpy.context.object;o.name=name
    o.data.name=name;o['game_part']='vr' if name=='VR_Headset' else 'body';return o
vr_items=[o for o in meshes if o.name.startswith('VR |')];body_items=[o for o in meshes if not o.name.startswith('VR |')]
vr=join(vr_items,'VR_Headset');body=join(body_items,'Hunter_AI_Jiahao')
def reset():
    for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
    bpy.context.view_layer.update()
def direction(name,child,target):
    b=rig.pose.bones[name];end=rig.pose.bones[child];bpy.context.view_layer.update()
    current=(end.head-b.head).normalized();desired=Vector(target).normalized();m=b.matrix.copy();q=current.rotation_difference(desired)@m.to_quaternion();b.matrix=Matrix.LocRotScale(m.translation,q,m.to_scale());bpy.context.view_layer.update()
def rotate(name,axis,angle):
    b=rig.pose.bones[name];m=b.matrix.copy();b.matrix=Matrix.LocRotScale(m.translation,Quaternion(Vector(axis),angle)@m.to_quaternion(),m.to_scale());bpy.context.view_layer.update()
def pose(kind,t):
    reset()
    if kind=='Idle':rotate('chest',(1,0,0),math.sin(t*math.tau)*.012)
    if kind=='Walk':
        for side,sign in [('R',1),('L',-1)]:
            swing=math.sin(t*math.tau)*.65*sign
            rotate('thigh.'+side,(1,0,0),swing);rotate('shin.'+side,(1,0,0),max(0,-swing)*.8)
            rotate('upper_arm.'+side,(1,0,0),-swing*.55)
    if kind=='Elbow':
        # Fold the right forearm and sweep the elbow across the chest.
        strength=math.sin(math.pi*min(1,t/.8))
        direction('upper_arm.R','forearm.R',(-.6+.6*strength,-.85*strength,.15+.25*strength))
        direction('forearm.R','hand.R',(.7,-.2+.6*strength,.6))
        rotate('chest',(0,0,1),-.32*strength)
    if kind in ['Dance','Equip']:
        if kind=='Equip':
            reach=min(1,t/.6)
            for side,sign in [('R',-1),('L',1)]:
                direction('upper_arm.'+side,'forearm.'+side,(sign*.6,-.35,.5))
                direction('forearm.'+side,'hand.'+side,(-sign*.35,-.25,.85))
            b=rig.pose.bones['VR_headset'];m=b.matrix.copy();m.translation+=Vector((0,-.28*(1-reach),-.28*(1-reach)));b.matrix=m
        else:
            wave=math.sin(t*math.pi*2);rotate('pelvis',(0,1,0),wave*.13);rotate('chest',(0,0,1),wave*.24);rotate('head',(1,0,0),math.sin(t*math.pi*4)*.13)
            for side,sign in [('R',-1),('L',1)]:
                direction('upper_arm.'+side,'forearm.'+side,(sign*.8,-.35,.15+wave*sign*.3))
                direction('forearm.'+side,'hand.'+side,(-sign*.2,-.35,.8))
                rotate('thigh.'+side,(1,0,0),max(0,wave*sign)*.2)
clips=[]
for name,seconds in [('Idle',2),('Walk',1),('Elbow',.8),('Equip',.7),('Dance',2)]:
    action=bpy.data.actions.new(name);rig.animation_data_create();rig.animation_data.action=action
    frames=round(seconds*30)
    for f in range(frames+1):
        bpy.context.scene.frame_set(f+1);pose(name,f/30)
        for b in rig.pose.bones:
            b.keyframe_insert(data_path='rotation_quaternion',frame=f+1,group=b.name)
            if b.name in ['VR_headset','pelvis']:b.keyframe_insert(data_path='location',frame=f+1,group=b.name)
    track=rig.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,1,action);track.mute=True;clips.append(name)
rig.animation_data.action=None;reset();bpy.context.scene.frame_set(1)
# glTF converts Blender -Y forward to +Z, matching the engine's movement heading.
bpy.ops.object.select_all(action='DESELECT')
for o in [rig,body,vr]:o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_frame_range=False,export_yup=True,export_skins=True,export_apply=False,export_lights=False,export_cameras=False)
meta={'source':Path(bpy.data.filepath).name,'sourceSHA256':hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest(),'bones':len(rig.data.bones),'bodyVertices':len(body.data.vertices),'vrVertices':len(vr.data.vertices),'vrSeparateMesh':True,'forward':[0,0,1],'clips':clips,'bytes':out.stat().st_size}
out.with_suffix('.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8');print('EXPORTED',out)
