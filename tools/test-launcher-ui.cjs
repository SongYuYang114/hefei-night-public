'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
exports.run = async (win, output, app) => {
  const errors=[];
  win.webContents.on('console-message', event=>{if(event.level==='error')errors.push(event.message);});
  const js=source=>win.webContents.executeJavaScript(source,true);
  try {
    await fs.mkdir(output,{recursive:true});
    await js('document.fonts.ready');
    await new Promise(resolve=>setTimeout(resolve,500));
    await js("render({phase:'current',currentVersion:'1.0.0',availableVersion:'1.0.0',source:'GitHub Release',message:'当前已是最新版本',received:0,total:0,notes:'版本分发从 1.0.0 开始。'})");
    assert.equal(await js("document.querySelector('#current-version').textContent"),'v1.0.0');
    assert(await js("document.querySelector('.character').complete && document.querySelector('.character').naturalWidth > 0"));
    await fs.writeFile(path.join(output,'launcher.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
    await js("render({...state,phase:'downloading',received:50,total:100,message:'正在下载更新…'})");
    assert(await js("document.querySelector('#play').disabled && document.querySelector('#progress').value === 50 && !document.querySelector('#cancel').hidden"));
    await js("render({...state,phase:'offline',message:'暂时无法检查更新，可启动当前版本或稍后重试。'})");
    assert(await js("!document.querySelector('#play').disabled && document.querySelector('#check').textContent === '重新检查'"));
    await js("render({...state,phase:'ready',availableVersion:'1.0.1'})");
    assert(await js("!document.querySelector('#play').disabled && document.querySelector('#update').textContent === '重启并更新'"));
    await js("render({...state,phase:'current',notes:'<img src=x onerror=alert(1)>'})");
    assert(await js("!document.querySelector('#notes img') && document.querySelector('#notes').textContent.includes('<img')"));
    await win.setSize(800,620);
    assert(await js('document.documentElement.scrollWidth <= innerWidth'));
    assert.equal(errors.length,0,errors.join('\n'));
    // Exercise the real isolated preload and the transition into the existing game.
    await js("document.querySelector('#play').click()");
    const until=Date.now()+30000;
    let game;
    while(Date.now()<until){game=require('electron').BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('hefei://game/'));if(game&&!game.webContents.isLoading())break;await new Promise(resolve=>setTimeout(resolve,100));}
    assert(game,'Launcher must open the game');
    assert.equal(game.webContents.getURL(),'hefei://game/index.html');
    const modelsDeadline=Date.now()+60000;
    let modelsReady=false;
    while(Date.now()<modelsDeadline){
      modelsReady=await game.webContents.executeJavaScript("!!document.querySelector('#start') && !document.querySelector('#start').disabled");
      if(modelsReady)break;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert(modelsReady,'Game models must load and the start button must become available');
    const result={passed:true,version:app.getVersion(),preloadIsolation:true,offlinePlay:true,progress:true,releaseNotesEscaped:true,gameLaunch:true,modelsReady:true,errors};
    await fs.writeFile(path.join(output,'result.json'),JSON.stringify(result,null,2));
    app.exit(0);
  } catch(error) {await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:false,error:error.stack},null,2));console.error(error);app.exit(1);}
};
