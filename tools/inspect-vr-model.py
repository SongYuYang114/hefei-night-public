import bpy,json,sys
from pathlib import Path
from mathutils import Vector
out=Path(sys.argv[sys.argv.index('--')+1])
objects=[]
for o in bpy.data.objects:
    bounds=[o.matrix_world@Vector(p) for p in o.bound_box] if o.type=='MESH' else []
    objects.append({'name':o.name,'type':o.type,'parent':o.parent.name if o.parent else None,'dimensions':list(o.dimensions),'bounds':[[min(p[i] for p in bounds),max(p[i] for p in bounds)] for i in range(3)] if bounds else None,'vertices':len(o.data.vertices) if o.type=='MESH' else None,'materials':[m.name for m in o.data.materials] if o.type=='MESH' else None,'bones':[{'name':b.name,'head':list(b.head_local),'tail':list(b.tail_local)} for b in o.data.bones] if o.type=='ARMATURE' else None})
out.write_text(json.dumps({'version':bpy.app.version_string,'objects':objects,'actions':[a.name for a in bpy.data.actions]},ensure_ascii=False,indent=2),encoding='utf-8')
print('MODEL_INSPECTED',len(objects))
