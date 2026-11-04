import bpy, json, sys
from pathlib import Path
from mathutils import Vector

out = Path(sys.argv[sys.argv.index('--')+1])
objects=[]
for o in bpy.data.objects:
    item={'name':o.name,'type':o.type,'location':list(o.location),'rotation':list(o.rotation_euler),'scale':list(o.scale),'dimensions':list(o.dimensions),'hidden':o.hide_render,'parent':o.parent.name if o.parent else None}
    if o.type=='MESH':
        points=[o.matrix_world @ Vector(p) for p in o.bound_box]
        item.update(vertices=len(o.data.vertices),polygons=len(o.data.polygons),modifiers=[{'name':m.name,'type':m.type} for m in o.modifiers],materials=[m.name for m in o.data.materials if m],bounds={'min':[min(p[i] for p in points) for i in range(3)],'max':[max(p[i] for p in points) for i in range(3)]})
    if o.type=='ARMATURE':
        item['bones']=[{'name':b.name,'parent':b.parent.name if b.parent else None,'head':list(b.head_local),'tail':list(b.tail_local)} for b in o.data.bones]
    objects.append(item)
data={'blender':bpy.app.version_string,'objects':objects,'actions':[{'name':a.name,'range':list(a.frame_range)} for a in bpy.data.actions],'images':[{'name':i.name,'size':list(i.size),'packed':bool(i.packed_file),'path':i.filepath} for i in bpy.data.images],'materials':[{'name':m.name,'color':list(m.diffuse_color),'nodes':[(n.name,n.type) for n in m.node_tree.nodes] if m.use_nodes else []} for m in bpy.data.materials]}
out.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
print('Inspection saved:',out)
