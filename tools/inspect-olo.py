import bpy,json,sys
from pathlib import Path
out=Path(sys.argv[sys.argv.index('--')+1])
data={'objects':[]}
for o in bpy.data.objects:
    if o.type not in ['ARMATURE','MESH']:continue
    item={'name':o.name,'type':o.type,'parent':o.parent.name if o.parent else None,'parentType':o.parent_type,'parentBone':o.parent_bone,'location':list(o.location),'scale':list(o.scale),'rotation':list(o.rotation_euler)}
    if o.type=='ARMATURE':item['bones']=[{'name':b.name,'head':list(b.head_local),'tail':list(b.tail_local),'parent':b.parent.name if b.parent else None} for b in o.data.bones]
    else:item.update(vertices=len(o.data.vertices),materials=[m.name if m else None for m in o.data.materials],groups=[g.name for g in o.vertex_groups],modifiers=[m.type for m in o.modifiers])
    data['objects'].append(item)
data['actions']=[a.name for a in bpy.data.actions]
data['other']=[{'name':o.name,'type':o.type,'parent':o.parent.name if o.parent else None,'parentBone':o.parent_bone} for o in bpy.data.objects if o.type not in ['ARMATURE','MESH','CAMERA','LIGHT']]
out.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf8')
