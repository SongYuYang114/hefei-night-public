param([Parameter(Mandatory=$true)][int]$GameProcessId,[Parameter(Mandatory=$true)][string]$OutputPath)
$ErrorActionPreference='Stop'
$game=Get-Process -Id $GameProcessId
if(!$game.MainWindowHandle -or $game.MainWindowTitle -notmatch '合肥惊魂夜'){throw 'Expected the running game window.'}
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class HefeiWindowCapture {
 [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left,Top,Right,Bottom; }
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd,out RECT rect);
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd,IntPtr hdc,uint flags);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
}
'@
$rect=New-Object HefeiWindowCapture+RECT
if(![HefeiWindowCapture]::IsWindowVisible($game.MainWindowHandle)){throw 'Game window is not visible.'}
[void][HefeiWindowCapture]::GetWindowRect($game.MainWindowHandle,[ref]$rect)
$bitmap=New-Object Drawing.Bitmap ($rect.Right-$rect.Left),($rect.Bottom-$rect.Top)
$graphics=[Drawing.Graphics]::FromImage($bitmap)
$dc=$graphics.GetHdc()
try{$ok=[HefeiWindowCapture]::PrintWindow($game.MainWindowHandle,$dc,2)}finally{$graphics.ReleaseHdc($dc)}
if(!$ok){throw 'Window capture failed.'}
$bitmap.Save([IO.Path]::GetFullPath($OutputPath),[Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose();$bitmap.Dispose()
Write-Output "Captured game window PID $GameProcessId"
