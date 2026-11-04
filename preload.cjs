const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('multiplayer',{
 signalConnect:options=>ipcRenderer.invoke('signal-connect',options),
 signalClose:()=>ipcRenderer.invoke('signal-close'),
 signalSend:message=>ipcRenderer.send('signal-send',message),
 onSignal:callback=>{const listener=(_event,message)=>callback(message);ipcRenderer.on('signal-event',listener);return ()=>ipcRenderer.removeListener('signal-event',listener);},
 connect:options=>ipcRenderer.invoke('net-connect',options),
 leave:()=>ipcRenderer.invoke('net-leave'),
 send:message=>ipcRenderer.send('net-send',message),
 onEvent:callback=>{const listener=(_event,message)=>callback(message);ipcRenderer.on('net-event',listener);return ()=>ipcRenderer.removeListener('net-event',listener);}
});
