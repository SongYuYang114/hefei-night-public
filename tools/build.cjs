const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),template=path.join(root,'node_modules/app-builder-lib/templates/nsis/portable.nsi'),original=fs.readFileSync(template,'utf8'),normalized=original.replace(/\r\n/g,'\n');
const before='\tExecWait "$INSTDIR\\${APP_EXECUTABLE_FILENAME} $R0" $0\n  SetErrorLevel $0';
const after=`  Sleep 600
  StrCpy $R8 0
  RetryLaunch:
    ClearErrors
    ExecWait '\"$INSTDIR\\\${APP_EXECUTABLE_FILENAME}\" $R0' $0
    IfErrors 0 LaunchFinished
    IntOp $R8 $R8 + 1
    IntCmp $R8 5 LaunchFailed
    Sleep 500
    Goto RetryLaunch
  LaunchFailed:
    StrCpy $0 2
  LaunchFinished:
    SetErrorLevel $0`;
if(!normalized.includes(before))throw Error('Portable launcher template changed; review it before building.');
let status=1;try{fs.writeFileSync(template,normalized.replace(before,after));const r=spawnSync(process.execPath,[path.join(root,'node_modules/electron-builder/cli.js'),'--win','portable','--x64','--publish','never','--config.portable.useZip=true',...process.argv.slice(2)],{cwd:root,stdio:'inherit',windowsHide:true});if(r.error)throw r.error;status=r.status??1;}finally{fs.writeFileSync(template,original);}process.exitCode=status;
