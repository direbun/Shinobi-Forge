$ErrorActionPreference = "Stop"
$python = "C:\Users\Dire\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if (-not (Test-Path -LiteralPath $python)) { $python = "python" }
Write-Host "Shinobi Forge: http://localhost:4173"
& $python -m http.server 4173 --bind 127.0.0.1
