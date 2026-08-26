<#
  .SYNOPSIS
  Rasterizes the MEKSS PWA icon into every PNG size required for Android/Chrome
  install prompts and iOS home-screen/splash presentation.

  .DESCRIPTION
  Uses .NET's built-in System.Drawing (GDI+) to redraw the same silhouette as
  public/icons/icon.svg at each required pixel size, avoiding any new project
  dependency or network download (no SVG rasterizer/browser is available in
  this environment). Output files are real PNG raster images, not renamed SVGs.
  Maskable variants fill the full canvas edge-to-edge (per the W3C maskable
  icon spec) so OS icon masks do not crop the brand mark's safe zone.
#>

Add-Type -AssemblyName System.Drawing

$outDir = Join-Path $PSScriptRoot '..\public\icons'
$outDir = [System.IO.Path]::GetFullPath($outDir)
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$brandBlue = [System.Drawing.Color]::FromArgb(255, 15, 76, 129)
$white = [System.Drawing.Color]::FromArgb(245, 255, 255, 255)

function New-MekssIcon {
  param(
    [int]$Size,
    [string]$OutPath,
    [double]$ContentScale,
    [bool]$RoundedCorners
  )

  $bitmap = New-Object System.Drawing.Bitmap $Size, $Size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $bgBrush = New-Object System.Drawing.SolidBrush $brandBlue
  if ($RoundedCorners) {
    $radius = [int](42 * ($Size / 192.0))
    $d = $radius * 2
    $rectPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $rectPath.AddArc(0, 0, $d, $d, 180, 90)
    $rectPath.AddArc($Size - $d, 0, $d, $d, 270, 90)
    $rectPath.AddArc($Size - $d, $Size - $d, $d, $d, 0, 90)
    $rectPath.AddArc(0, $Size - $d, $d, $d, 90, 90)
    $rectPath.CloseFigure()
    $graphics.FillPath($bgBrush, $rectPath)
    $rectPath.Dispose()
  } else {
    $graphics.FillRectangle($bgBrush, 0, 0, $Size, $Size)
  }

  # Content is drawn against a 192-unit design grid, then scaled and centered
  # so maskable icons keep their brand mark inside the safe zone.
  $offset = ($Size - ($Size * $ContentScale)) / 2.0
  $scale = ($Size * $ContentScale) / 192.0
  $tx = { param($v) $offset + ($v * $scale) }

  $skylinePoints = @(
    (New-Object System.Drawing.PointF (& $tx 40), (& $tx 142)),
    (New-Object System.Drawing.PointF (& $tx 40), (& $tx 78)),
    (New-Object System.Drawing.PointF (& $tx 64), (& $tx 60)),
    (New-Object System.Drawing.PointF (& $tx 80), (& $tx 74)),
    (New-Object System.Drawing.PointF (& $tx 96), (& $tx 44)),
    (New-Object System.Drawing.PointF (& $tx 116), (& $tx 66)),
    (New-Object System.Drawing.PointF (& $tx 136), (& $tx 54)),
    (New-Object System.Drawing.PointF (& $tx 152), (& $tx 78)),
    (New-Object System.Drawing.PointF (& $tx 152), (& $tx 142))
  )
  $whiteBrush = New-Object System.Drawing.SolidBrush $white
  $graphics.FillPolygon($whiteBrush, $skylinePoints)

  $linePen = New-Object System.Drawing.Pen $brandBlue, ([float]([Math]::Max(2, 8 * $scale)))
  $linePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $linePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $lineY = & $tx 98
  $graphics.DrawLine($linePen, (& $tx 70), $lineY, (& $tx 82), $lineY)
  $graphics.DrawLine($linePen, (& $tx 94), $lineY, (& $tx 106), $lineY)
  $graphics.DrawLine($linePen, (& $tx 118), $lineY, (& $tx 130), $lineY)
  $graphics.DrawLine($linePen, (& $tx 55), (& $tx 126), (& $tx 137), (& $tx 126))

  $bitmap.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $graphics.Dispose()
  $bitmap.Dispose()
  $bgBrush.Dispose()
  $whiteBrush.Dispose()
  $linePen.Dispose()

  Write-Output "generated $OutPath"
}

foreach ($size in @(72, 96, 128, 144, 152, 180, 192, 384, 512)) {
  New-MekssIcon -Size $size -OutPath (Join-Path $outDir "icon-$size.png") -ContentScale 1.0 -RoundedCorners $true
}

# Maskable icons must fill the canvas edge-to-edge; keep the brand mark inside
# the ~80% safe zone recommended by the maskable icon spec.
foreach ($size in @(192, 512)) {
  New-MekssIcon -Size $size -OutPath (Join-Path $outDir "icon-maskable-$size.png") -ContentScale 0.72 -RoundedCorners $false
}

Write-Output 'PWA icon generation complete.'
