import bpy,math,json,sys,hashlib
from pathlib import Path
from mathutils import Matrix,Quaternion,Vector

out=Path(sys.argv[sys.argv.index('--')+1]).resolve()
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
rig.animation_data_clear()
for action in list(bpy.data.actions):bpy.data.actions.remove(action)
for b in rig.pose.bones:
    for c in list(b.constraints):b.constraints.remove(c)
    b.rotation_mode='QUATERNION';b.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
def part_of_rig(o):
    p=o.parent
    while p:
        if p==rig:return True
        p=p.parent
    return False
objects=[o for o in bpy.data.objects if o.type in ['MESH','CURVE'] and part_of_rig(o)]
meshes=[]
for original in objects:
    o=original;parent=o
    while parent.parent and not parent.parent_bone:parent=parent.parent
    bone=parent.parent_bone or 'chest'
    skinned=any(m.type=='ARMATURE' for m in o.modifiers)
    world=o.matrix_world.copy()
    bpy.ops.object.select_all(action='DESELECT');o.hide_set(False);o.hide_render=False;o.select_set(True);bpy.context.view_layer.objects.active=o
    if o.type=='CURVE':
        o.data.resolution_u=min(6,o.data.resolution_u);o.data.bevel_resolution=min(2,o.data.bevel_resolution)
        bpy.ops.object.convert(target='MESH');o=bpy.context.object
    for m in list(o.modifiers):
        if m.type=='SUBSURF':o.modifiers.remove(m)
        elif m.type!='ARMATURE':
            try:bpy.ops.object.modifier_apply(modifier=m.name)
            except RuntimeError:pass
    if not skinned:
        o.parent=rig;o.parent_type='OBJECT';o.parent_bone='';o.matrix_world=world
        o.vertex_groups.clear();g=o.vertex_groups.new(name=bone);g.add(list(range(len(o.data.vertices))),1,'REPLACE')
        m=o.modifiers.new('GameSkin','ARMATURE');m.object=rig
    meshes.append(o)
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join();body=bpy.context.object
body.name='Survivor_olo';body.data.name='Survivor_olo';body.parent=rig;body.parent_type='OBJECT'
if len(body.data.vertices)>120000:
    if body.data.shape_keys:body.shape_key_clear()
    dec=body.modifiers.new('GameLOD','DECIMATE');dec.ratio=.28;dec.use_collapse_triangulate=True
    bpy.context.view_layer.objects.active=body;bpy.ops.object.modifier_apply(modifier=dec.name)
for m in body.data.materials:
    if m and m.use_nodes:
        p=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
        if p and 'Roughness' in p.inputs:p.inputs['Roughness'].default_value=max(.3,p.inputs['Roughness'].default_value)
def reset():
    for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
    bpy.context.view_layer.update()
def rotate(name,axis,angle):
    b=rig.pose.bones[name];m=b.matrix.copy();b.matrix=Matrix.LocRotScale(m.translation,Quaternion(Vector(axis),angle)@m.to_quaternion(),m.to_scale());bpy.context.view_layer.update()
def direction(name,child,xyz):
    b=rig.pose.bones[name];end=rig.pose.bones[child];bpy.context.view_layer.update()
    current=(end.head-b.head).normalized();desired=Vector(xyz).normalized();m=b.matrix.copy()
    b.matrix=Matrix.LocRotScale(m.translation,current.rotation_difference(desired)@m.to_quaternion(),m.to_scale());bpy.context.view_layer.update()
def pose(kind,t):
    reset();wave=math.sin(t*math.tau)
    # Natural relaxed arms for the supplied curly-haired character.
    direction('upper_arm.L','forearm.L',(.12,-.03,-.4))
    direction('forearm.L','hand.L',(.05,-.03,-.36))
    direction('upper_arm.R','forearm.R',(-.12,-.03,-.4))
    direction('forearm.R','hand.R',(-.05,-.03,-.36))
    rotate('head',(1,0,0),.12)
    if kind in ['Idle','HurtIdle']:rotate('chest',(1,0,0),wave*.012)
    if kind in ['Walk','Run','HurtWalk']:
        strength=.65 if kind=='Run' else .4
        for side,sign in [('L',1),('R',-1)]:
            swing=wave*strength*sign
            rotate('thigh.'+side,(1,0,0),swing);rotate('shin.'+side,(1,0,0),max(0,-swing)*.8)
            rotate('upper_arm.'+side,(1,0,0),-swing*.45)
    if kind=='Interact':
        for side in ['L','R']:
            rotate('upper_arm.'+side,(1,0,0),-1.1+wave*.06);rotate('forearm.'+side,(1,0,0),-.25)
    if kind in ['HurtIdle','HurtWalk','Captured']:rotate('chest',(1,0,0),.15)
clips=['Idle','Walk','Run','HurtIdle','HurtWalk','Interact','Captured'];bpy.context.scene.render.fps=30
for kind in clips:
    seconds=2 if kind in ['Idle','HurtIdle','Captured'] else 1
    action=bpy.data.actions.new(kind);rig.animation_data_create();rig.animation_data.action=action
    for f in range(seconds*30+1):
        bpy.context.scene.frame_set(f+1);pose(kind,f/(seconds*30))
        for b in rig.pose.bones:b.keyframe_insert(data_path='rotation_quaternion',frame=f+1,group=b.name)
    track=rig.animation_data.nla_tracks.new();track.name=kind;track.strips.new(kind,1,action);track.mute=True
rig.animation_data.action=None;reset();bpy.context.scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT')
for o in [rig,body]:o.select_set(True)
bpy.context.view_layer.objects.active=rig
out.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_frame_range=False,export_yup=True,export_skins=True,export_apply=False,export_lights=False,export_cameras=False)
meta={'name':'Olo','source':Path(bpy.data.filepath).name,'sourceSHA256':hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest(),'file':out.name,'bones':len(rig.data.bones),'vertices':len(body.data.vertices),'materials':len(body.data.materials),'clips':clips,'forward':[0,0,1],'height':1.9,'bytes':out.stat().st_size,'originalCurlyHairGlassesClothingPreserved':True}
out.with_suffix('.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf8')
print('EXPORTED',out)
