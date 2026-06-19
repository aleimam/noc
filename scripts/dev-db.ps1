# Start the local development MariaDB (portable) for the NOC platform.
# Usage:  npm run db:start   — or —   powershell -ExecutionPolicy Bypass -File scripts/dev-db.ps1
# The DB listens on 127.0.0.1:3306 with database `noc` (user `noc` / `noc_dev_pw`).
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$base = Get-ChildItem -Path (Join-Path $root '.devdb') -Directory -Filter 'mariadb-*-winx64' |
  Select-Object -First 1
if (-not $base) {
  Write-Error 'Portable MariaDB not found under .devdb\. Run the database setup first.'
  exit 1
}
$data = Join-Path $root '.devdb\data'
$mariadbd = Join-Path $base.FullName 'bin\mariadbd.exe'
Write-Host "Starting MariaDB ($($base.Name)) on 127.0.0.1:3306 ..."
& $mariadbd --defaults-file="$data\my.ini" --basedir="$($base.FullName)" --port=3306 --console
