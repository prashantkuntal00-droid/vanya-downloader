$ws = New-Object -ComObject WScript.Shell
$desktop = [System.Environment]::GetFolderPath('Desktop')
$lnkPath = Join-Path $desktop "Vanya Downloader (Live).lnk"
$s = $ws.CreateShortcut($lnkPath)
$s.TargetPath = "c:\Users\prash\OneDrive\Desktop\New folder (2)\Launch-Vanya-Live.bat"
$s.WorkingDirectory = "c:\Users\prash\OneDrive\Desktop\New folder (2)"
$icon = "c:\Users\prash\OneDrive\Desktop\New folder (2)\build\icon.ico"
if (Test-Path $icon) {
    $s.IconLocation = $icon
}
$s.Save()
Write-Host "SUCCESS: Desktop shortcut created at $lnkPath"
