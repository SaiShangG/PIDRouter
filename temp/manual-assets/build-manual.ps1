param([switch]$ValidateOnly)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assetRoot = Join-Path (Get-Location) 'docs/manual-assets'
$docsRoot = Split-Path $assetRoot -Parent
$content = [IO.File]::ReadAllText((Join-Path $assetRoot 'manual-content.json'), [Text.Encoding]::UTF8) | ConvertFrom-Json
$manifest = [IO.File]::ReadAllText((Join-Path $assetRoot 'manifest.json'), [Text.Encoding]::UTF8) | ConvertFrom-Json
foreach ($section in $content.sections) {
    if ($section.image) {
        $screen = $manifest | Where-Object name -eq $section.image
        if (-not $screen -or $screen.boxes.Count -eq 0) { throw "Missing annotated screen: $($section.image)" }
        if (-not (Test-Path (Join-Path $assetRoot "original/$($section.image).png"))) { throw 'Missing source image' }
    }
}
if ($ValidateOnly) { Write-Output "Validated $($content.sections.Count) sections and $($manifest.Count) screenshots"; return }
$annotatedRoot = Join-Path $assetRoot 'annotated'
$detailRoot = Join-Path $assetRoot 'detail'
[void][IO.Directory]::CreateDirectory($annotatedRoot)
[void][IO.Directory]::CreateDirectory($detailRoot)
foreach ($screen in $manifest) {
    $bitmap = [Drawing.Bitmap]::new((Join-Path $assetRoot "original/$($screen.name).png"))
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    $pen = [Drawing.Pen]::new([Drawing.Color]::FromArgb(220, 28, 38), 4)
    $brush = [Drawing.SolidBrush]::new($pen.Color)
    $font = [Drawing.Font]::new('Arial', 14, [Drawing.FontStyle]::Bold, [Drawing.GraphicsUnit]::Pixel)
    try {
        $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $index = 0
        foreach ($box in $screen.boxes) {
            $index++
            $left = [Math]::Max(3, [float]$box.x - 3)
            $top = [Math]::Max(3, [float]$box.y - 3)
            $width = [Math]::Min([float]$box.width + 6, $bitmap.Width - $left - 3)
            $height = [Math]::Min([float]$box.height + 6, $bitmap.Height - $top - 3)
            $graphics.DrawRectangle($pen, [float]$left, [float]$top, [float]$width, [float]$height)
            $badgeTop = [Math]::Max(0, $top - 25)
            $graphics.FillRectangle($brush, [float]$left, [float]$badgeTop, 24, 24)
            $graphics.DrawString([string]$index, $font, [Drawing.Brushes]::White, [float]($left + 7), [float]($badgeTop + 3))
        }
        $bitmap.Save((Join-Path $annotatedRoot "$($screen.name).png"), [Drawing.Imaging.ImageFormat]::Png)
        $left = [Math]::Max(0, [Math]::Floor(($screen.boxes | Measure-Object x -Minimum).Minimum - 65))
        $top = [Math]::Max(0, [Math]::Floor(($screen.boxes | Measure-Object y -Minimum).Minimum - 90))
        $right = [Math]::Min($bitmap.Width, [Math]::Ceiling((($screen.boxes | ForEach-Object { $_.x + $_.width }) | Measure-Object -Maximum).Maximum + 65))
        $bottom = [Math]::Min($bitmap.Height, [Math]::Ceiling((($screen.boxes | ForEach-Object { $_.y + $_.height }) | Measure-Object -Maximum).Maximum + 65))
        $rect = [Drawing.Rectangle]::new([int]$left, [int]$top, [int]($right - $left), [int]($bottom - $top))
        $detail = $bitmap.Clone($rect, $bitmap.PixelFormat)
        try { $detail.Save((Join-Path $detailRoot "$($screen.name).png"), [Drawing.Imaging.ImageFormat]::Png) } finally { $detail.Dispose() }
    } finally {
        $graphics.Dispose(); $pen.Dispose(); $brush.Dispose(); $font.Dispose(); $bitmap.Dispose()
    }
}
node (Join-Path $assetRoot 'build-documents.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Document generation failed' }