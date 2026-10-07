$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$target = Join-Path $PSScriptRoot '../assets/viewer.ico'
[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target)) | Out-Null
$frames = @()
foreach ($size in @(16, 32, 48, 64, 128, 256)) {
    $bitmap = New-Object Drawing.Bitmap($size, $size)
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([Drawing.Color]::FromArgb(255, 20, 28, 38))
    $pen = New-Object Drawing.Pen([Drawing.Color]::FromArgb(229, 194, 121), ([Math]::Max(1.2, $size / 30)))
    $points = [Drawing.PointF[]]@(
        [Drawing.PointF]::new($size*.5,$size*.15), [Drawing.PointF]::new($size*.81,$size*.32),
        [Drawing.PointF]::new($size*.81,$size*.68), [Drawing.PointF]::new($size*.5,$size*.85),
        [Drawing.PointF]::new($size*.19,$size*.68), [Drawing.PointF]::new($size*.19,$size*.32))
    $graphics.DrawPolygon($pen,$points)
    $graphics.DrawLine($pen,$points[1],[Drawing.PointF]::new($size*.5,$size*.5))
    $graphics.DrawLine($pen,$points[5],[Drawing.PointF]::new($size*.5,$size*.5))
    $graphics.DrawLine($pen,$points[3],[Drawing.PointF]::new($size*.5,$size*.5))
    $stream = New-Object IO.MemoryStream
    $bitmap.Save($stream,[Drawing.Imaging.ImageFormat]::Png)
    $frames += ,@($size, $stream.ToArray())
    if ($size -eq 256) { $bitmap.Save((Join-Path $PSScriptRoot '../assets/viewer.png'),[Drawing.Imaging.ImageFormat]::Png) }
    $stream.Dispose(); $pen.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
$file = [IO.File]::Create($target)
$writer = New-Object IO.BinaryWriter($file)
$writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$frames.Count)
$offset = 6 + 16 * $frames.Count
foreach ($frame in $frames) {
    $dimension = if ($frame[0] -eq 256) { 0 } else { $frame[0] }
    $writer.Write([byte]$dimension); $writer.Write([byte]$dimension)
    $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([uint16]1); $writer.Write([uint16]32)
    $writer.Write([uint32]$frame[1].Length); $writer.Write([uint32]$offset)
    $offset += $frame[1].Length
}
foreach ($frame in $frames) { $writer.Write([byte[]]$frame[1]) }
$writer.Dispose()
Write-Output $target
