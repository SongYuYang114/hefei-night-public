const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');

// Exercise the actual selection UI, including the shared room-roster avatar path.
exports.run=async(win,out)=>{
 const js=s=>win.webContents.executeJavaScript(s,true);
 const manifest=JSON.parse(await fs.readFile(path.join(__dirname,'../dist/assets/portraits/survivor-photos.json'),'utf8'));
 const initial=win.getContentSize(),details=[];
 try{
  for(const size of [[1440,900],[1200,900]]){
   win.setContentSize(...size);
   for(const item of manifest.portraits){
    await js(`document.querySelector('#survivor-role').click();document.querySelector('.character-card[data-character="${item.characterId}"]').click()`);
    const info=await js(`(async()=>{
     const portrait=document.querySelector('#selection-portrait');
     const card=document.querySelector('.character-card[data-character="${item.characterId}"] .selection-avatar');
     const row=document.querySelector('.selection-player[data-character="${item.characterId}"] .selection-avatar');
     await Promise.all([portrait,card.querySelector('img'),row.querySelector('img')].map(img=>img.decode()));
     await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
     const ratio=e=>{const b=e.getBoundingClientRect();return b.width/b.height;};
     return {title:document.querySelector('#selection-title').textContent,src:portrait.getAttribute('src'),width:portrait.naturalWidth,height:portrait.naturalHeight,fit:getComputedStyle(portrait).objectFit,portraitRatio:ratio(portrait.parentElement),cardRatio:ratio(card),rosterRatio:ratio(row),cardSrc:card.querySelector('img').getAttribute('src'),rosterSrc:row.querySelector('img').getAttribute('src'),modelVisible:document.querySelector('#model-view canvas').getBoundingClientRect().width>0};
    })()`);
    assert.equal(info.title,item.name);assert.equal(info.src,`./assets/portraits/${item.file}`);
    assert.equal(info.cardSrc,info.src);assert.equal(info.rosterSrc,info.src);
    assert.deepEqual([info.width,info.height],item.size);assert.equal(info.fit,'contain');assert(info.modelVisible);
    for(const k of ['portraitRatio','cardRatio','rosterRatio'])assert(Math.abs(info[k]-4/3)<.035,`${item.name}: ${k}=${info[k]}`);
    details.push({character:item.name,size, ...info});
    await fs.writeFile(path.join(out,`portrait-${item.characterId}-${size[0]}.png`),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
   }
  }
 }finally{win.setContentSize(...initial);}
 await fs.writeFile(path.join(out,'portrait-details.json'),JSON.stringify(details,null,2));
 return {sevenUserPortraits:true,portraitPoolAndRoster:true,uniformFourThreeFrames:true,photosPreservedWithoutStretching:true,selectionAtFourThreeAndWidescreen:true};
};
