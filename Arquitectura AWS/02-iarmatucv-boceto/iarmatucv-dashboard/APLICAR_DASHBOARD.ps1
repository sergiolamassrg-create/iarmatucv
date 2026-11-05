# Ejecutar en la raiz de "Proyecto Final - Dev en la nube" despues de descomprimir el ZIP.
$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path
$expected = Join-Path $root 'Front End\src\app\features\access\access.component.html'
if (-not (Test-Path $expected)) { throw 'Ejecuta el script desde la carpeta raiz del proyecto, donde esta Front End.' }
$source = Join-Path $PSScriptRoot 'Front End'
if (-not (Test-Path $source)) { throw 'No encuentro la carpeta Front End dentro de los archivos descargados.' }
$files = Get-ChildItem $source -Recurse -File
$backup = Join-Path $root ('respaldo-dashboard-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
foreach ($f in $files) {
  $rel = $f.FullName.Substring($PSScriptRoot.Length + 1)
  $target = Join-Path $root $rel
  if (Test-Path $target) {
    $copy = Join-Path $backup $rel
    New-Item -ItemType Directory -Force -Path (Split-Path $copy) | Out-Null
    Copy-Item -LiteralPath $target -Destination $copy
  }
  New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
  Copy-Item -LiteralPath $f.FullName -Destination $target -Force
  Write-Host "Preparado: $rel"
}
# Parche quirurgico del HTML de acceso (conservando todo el formulario existente)
$html = Get-Content -LiteralPath $expected -Raw -Encoding UTF8
$before = '<a routerLink="/" class="access-account-home">← Volver al inicio</a>'
$after = '<a routerLink="/panel" class="access-account-home">Ir a mi espacio →</a>'
if ($html.Contains($before)) {
  $copy = Join-Path $backup 'Front End\src\app\features\access\access.component.html'
  New-Item -ItemType Directory -Force -Path (Split-Path $copy) | Out-Null
  Copy-Item -LiteralPath $expected -Destination $copy
  $html = $html.Replace($before,$after)
  Set-Content -LiteralPath $expected -Value $html -Encoding utf8
  Write-Host 'Actualizado el enlace de acceso a /panel'
} else { Write-Warning 'No se encontro el enlace original; se dejo el HTML de acceso sin cambios.' }
Write-Host "`nArchivos listos. Respaldo de archivos reemplazados: $backup"
Write-Host 'Probá: npm.cmd run frontend:dev'
