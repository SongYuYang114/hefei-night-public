param([Parameter(Mandatory=$true)][string]$ReleaseDirectory)
$ErrorActionPreference='Stop'
# Scope this repair to this game's generated release, never its parent folder.
$release=(Resolve-Path -LiteralPath $ReleaseDirectory).Path.TrimEnd('\')
$downloads=[IO.Path]::GetFullPath((Join-Path $env:USERPROFILE 'Downloads')).TrimEnd('\')
if([IO.Path]::GetDirectoryName($release) -ne $downloads -or [IO.Path]::GetFileName($release) -notmatch '^HefeiNight_v\d+\.\d+\.\d+$'){
 throw 'Expected a versioned HefeiNight release directly inside Downloads.'
}
foreach($relative in @('HefeiNight.exe','Game/HefeiNight.exe','Game/resources/app.asar','版本信息.json')){
 if(!(Test-Path -LiteralPath (Join-Path $release $relative) -PathType Leaf)){throw "Missing release file: $relative"}
}
$before=Get-Acl -LiteralPath $release
$backup=Join-Path $release '启动权限修复记录.json'
if(!(Test-Path -LiteralPath $backup)){
 @{release=$release;beforeSDDL=$before.Sddl;checkedUTC=[DateTime]::UtcNow.ToString('o');reason='Generated release inherited Everyone deny Synchronize/DeleteChild and Low integrity; Electron exited before main.js.'} | ConvertTo-Json | Set-Content -LiteralPath $backup -Encoding utf8
}
# Keep the existing user, administrator and SYSTEM grants. Isolate only this
# generated directory from the problematic inherited entries.
& icacls.exe $release /inheritance:d | Out-Null
if($LASTEXITCODE -ne 0){throw 'Could not isolate the release ACL.'}
& icacls.exe $release /remove:d '*S-1-1-0' /T /C | Out-Null
if($LASTEXITCODE -ne 0){throw 'Could not clear the generated Everyone deny entries.'}
& icacls.exe $release /setintegritylevel '(OI)(CI)M' /T /C | Out-Null
if($LASTEXITCODE -ne 0){throw 'Could not normalize release integrity labels.'}
$bad=@()
foreach($item in @((Get-Item -LiteralPath $release))+(Get-ChildItem -LiteralPath $release -Recurse -Force)){
 $acl=Get-Acl -LiteralPath $item.FullName
 foreach($rule in $acl.Access){
  if($rule.AccessControlType -eq 'Deny' -and $rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -eq 'S-1-1-0'){$bad+=$item.FullName}
 }
}
if($bad.Count){throw "Unexpected Everyone deny entries remain in $($bad.Count) paths."}
Write-Output "Release startup permissions normalized: $release"
