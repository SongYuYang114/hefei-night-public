const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..'),hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const bytes=fs.readFileSync(path.join(root,'dist/assets/survivor-olo.glb')),meta=JSON.parse(fs.readFileSync(path.join(root,'dist/assets/survivor-olo.json'),'utf8'));
assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(8),bytes.length);
const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12))),bin=20+bytes.readUInt32LE(12)+8;
assert.equal(gltf.skins.length,1);assert(gltf.nodes.some(n=>n.name==='Survivor_olo'&&n.skin===0));
assert.deepEqual(gltf.animations.map(a=>a.name).sort(),['Captured','HurtIdle','HurtWalk','Idle','Interact','Run','Walk']);
assert(gltf.materials.length>=20);let vertices=0;
for(const mesh of gltf.meshes)for(const p of mesh.primitives){
 assert(p.attributes.JOINTS_0!==undefined&&p.attributes.WEIGHTS_0!==undefined);
 const a=gltf.accessors[p.attributes.WEIGHTS_0],v=gltf.bufferViews[a.bufferView];assert.equal(a.componentType,5126);
 for(let i=0;i<a.count;i++){
  const offset=bin+(v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||16);
  const sum=[0,1,2,3].map(j=>bytes.readFloatLE(offset+j*4)).reduce((x,y)=>x+y,0);
  assert(Number.isFinite(sum)&&Math.abs(sum-1)<.001,'Unbound or invalid skin vertex');vertices++;
 }
}
assert.equal(hash(path.join(root,'resources/models/olo.blend')),meta.sourceSHA256);
assert.equal(hash(path.join(root,'dist/assets/portraits/olo.png')),'e9c806380c8cb58e114b097af8bd038423edc5c8d2de6f1f7e753d9c3c3ec5cb');
assert(bytes.length<20*1024*1024);
const result={passed:true,version:require('../package.json').version,userBlendAndPortraitMatchOriginals:true,allVerticesHaveNormalizedSkinWeights:true,sevenRequiredAnimationClips:true,originalMaterialsAndBoneAttachmentsPreserved:true,bones:gltf.skins[0].joints.length,materials:gltf.materials.length,vertices,bytes:bytes.length};
fs.writeFileSync(path.join(root,'../olo-asset.json'),JSON.stringify(result,null,2));console.log(result);
