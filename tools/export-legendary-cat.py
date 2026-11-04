import bpy, math, json, sys, hashlib, bmesh
from pathlib import Path
from mathutils import Matrix, Quaternion, Vector

out=Path(sys.argv[sys.argv.index('--')+1]).resolve();out.parent.mkdir(parents=True,exist_ok=True)
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig.animation_data_clear()
for a in list(bpy.data.actions):bpy.data.actions.remove(a)
for b in rig.pose.bones:
    for c in list(b.constraints):b.constraints.remove(c)
    b.rotation_mode='QUATERNION';b.matrix_basis=Matrix.Identity(4)
bpy.context.scene.render.fps=30;bpy.context.scene.frame_set(1);bpy.context.view_layer.update()
items=[o for o in bpy.data.objects if o.parent==rig and o.type in ['MESH','CURVE']]
for o in items:
    o.hide_set(False);o.hide_render=False
    if o.type=='CURVE':
        o.data.resolution_u=min(o.data.resolution_u,5);o.data.bevel_resolution=min(o.data.bevel_resolution,1)
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
        bpy.ops.object.convert(target='MESH');o=bpy.context.object
        name='front.paw.'+('L' if '.L.' in o.name else 'R') if o.name.startswith('Toe crease') else 'head'
        o.vertex_groups.clear();g=o.vertex_groups.new(name=name);g.add(list(range(len(o.data.vertices))),1,'REPLACE')
        if not any(m.type=='ARMATURE' for m in o.modifiers):m=o.modifiers.new('Game skin','ARMATURE');m.object=rig
    for m in list(o.modifiers):
        if m.type=='SUBSURF':o.modifiers.remove(m)
        elif m.type!='ARMATURE':
            bpy.context.view_layer.objects.active=o
            try:bpy.ops.object.modifier_apply(modifier=m.name)
            except RuntimeError:pass
    if o.name.startswith('FUR'):
        # Individual fibers are disconnected five-vertex components. Preserve a
        # deterministic eighth of them, including skin weights and coat colors.
        parent=list(range(len(o.data.vertices)))
        def find(x):
            while parent[x]!=x:parent[x]=parent[parent[x]];x=parent[x]
            return x
        for e in o.data.edges:
            a,b=map(find,e.vertices)
            if a!=b:parent[max(a,b)]=min(a,b)
        bm=bmesh.new();bm.from_mesh(o.data);bm.verts.ensure_lookup_table()
        roots=sorted({find(i) for i in range(len(parent))});keep=set(roots[::8])
        bmesh.ops.delete(bm,geom=[v for v in bm.verts if find(v.index) not in keep],context='VERTS');bm.to_mesh(o.data);bm.free()
    elif len(o.data.vertices)>1000:
        bpy.context.view_layer.objects.active=o;m=o.modifiers.new('Game mesh reduction','DECIMATE');m.ratio=.65 if o.name.startswith('CAT') else .16
        bpy.ops.object.modifier_apply(modifier=m.name)

items=[o for o in bpy.data.objects if o.parent==rig and o.type=='MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in items:o.select_set(True)
bpy.context.view_layer.objects.active=items[0];bpy.ops.object.join();body=bpy.context.object;body.name='Legendary_Orange_Cat'
world=body.matrix_world.copy();body.parent=rig;body.parent_type='OBJECT';body.parent_bone='';body.matrix_world=world
for m in list(body.modifiers):
    if m.type=='ARMATURE':body.modifiers.remove(m)
m=body.modifiers.new('Legendary cat skin','ARMATURE');m.object=rig;m.use_vertex_groups=True

def rotate(name,axis,angle):
    b=rig.pose.bones[name];m=b.matrix.copy();b.matrix=Matrix.LocRotScale(m.translation,Quaternion(Vector(axis),angle)@m.to_quaternion(),m.to_scale());bpy.context.view_layer.update()
def pose(kind,t):
    for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
    bpy.context.view_layer.update()
    rotate('chest',(1,0,0),math.sin(t*math.tau)*.012)
    for i in range(1,8):rotate('tail.%02d'%i,(0,0,1),math.sin(t*math.tau+i*.4)*.025)
    if kind=='Walk':
        for side,sign in [('L',1),('R',-1)]:
            swing=math.sin(t*math.tau)*sign
            rotate('front.upper.'+side,(1,0,0),swing*.24);rotate('front.lower.'+side,(1,0,0),max(0,-swing)*.18)
            rotate('hind.upper.'+side,(1,0,0),-swing*.16)
    if kind in ['Hiss','Recoil']:
        amount=math.sin(math.pi*min(1,t)) if kind=='Hiss' else math.sin(math.pi*t)
        rotate('jaw',(1,0,0),.46*amount);rotate('head',(1,0,0),-.12*amount);rotate('spine',(1,0,0),.08*amount)
        for side,sign in [('L',1),('R',-1)]:rotate('ear.'+side,(0,1,0),sign*.55*amount)
    if kind=='Scratch':
        # Three alternating paw strokes, timed to the authoritative impacts.
        seconds=t*1.5
        rotate('jaw',(1,0,0),.42*math.sin(math.pi*t)**.5)
        rotate('head',(1,0,0),-.15*math.sin(math.pi*t))
        for i,beat in enumerate([.35,.75,1.15]):
            progress=(seconds-(beat-.22))/.4
            if 0<progress<1:
                side='L' if i%2==0 else 'R';sign=1 if side=='L' else -1
                lift=math.sin(math.pi*progress)
                rotate('front.upper.'+side,(1,0,0),-1.4*lift)
                rotate('front.lower.'+side,(1,0,0),-.55*lift)
                rotate('front.upper.'+side,(0,0,1),sign*(progress-.5)*1.6*lift)
                rotate('front.paw.'+side,(0,0,1),-sign*.4*lift)
                rotate('chest',(0,0,1),sign*.1*lift)
        for side,sign in [('L',1),('R',-1)]:rotate('ear.'+side,(0,1,0),sign*.55*math.sin(math.pi*t))
    if kind=='Groom':
        amount=(math.sin(t*math.tau)+1)*.5
        rotate('head',(1,0,0),.23+.08*amount);rotate('jaw',(1,0,0),.1*amount)
        rotate('front.upper.L',(1,0,0),-1.05);rotate('front.lower.L',(1,0,0),-.8)

for name,duration in [('Idle',2),('Walk',.8),('Hiss',3),('Groom',3),('Recoil',.7),('Scratch',1.5)]:
    rig.animation_data_create();action=bpy.data.actions.new(name);rig.animation_data.action=action
    frames=round(duration*30)
    for frame in range(frames+1):
        pose(name,frame/frames)
        for b in rig.pose.bones:
            if b.name.startswith('CTRL.'):continue
            b.keyframe_insert(data_path='rotation_quaternion',frame=frame+1,group=b.name)
    track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,1,action);track.mute=True
rig.animation_data.action=None
for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update();bpy.context.scene.frame_set(1)
# Blender -Y forward becomes glTF +Z; the runtime normalizes feet and scale.
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);body.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,export_def_bones=True,export_force_sampling=True,export_yup=True,export_extras=True)
meta={'source':'橘猫_骨骼模型.blend','sourceSHA256':hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest(),'vertices':len(body.data.vertices),'bones':len(rig.data.bones),'clips':['Idle','Walk','Hiss','Groom','Recoil','Scratch'],'furRetainedFraction':.125,'normalizedRuntimeHeight':1.15,'forward':'+Z','up':'+Y','bytes':out.stat().st_size}
out.with_suffix('.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8');print(meta)
