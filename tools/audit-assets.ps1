param([string]$Resources = 'G:\Old Republic Assets\resources', [string]$Report = '.\reports\asset-links.json')
$ErrorActionPreference = 'Stop'
$resourceRoot = [IO.Path]::GetFullPath($Resources)
$reportPath = [IO.Path]::GetFullPath($Report)
if ($reportPath.StartsWith($resourceRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Write reports outside source assets' }
[xml]$index = Get-Content -LiteralPath (Join-Path $Resources 'art\dynamic\index.xml') -Raw
$slots = foreach ($entry in $index.AssetIndexFiles.AssetIndexFile) {
    $relative = $entry.InnerText.TrimStart('/').Replace('/', '\')
    $source = Join-Path $Resources $relative
    if (Test-Path -LiteralPath $source) {
        [xml]$slot = Get-Content -LiteralPath $source -Raw
        $assets = @($slot.Assets.Asset)
        [pscustomobject]@{ slot = $entry.slot; file = $relative; count = $assets.Count; sample = @($assets | Select-Object -First 2 | ForEach-Object {
            [pscustomobject]@{ id = $_.ID; artName = $_.ArtName; designerName = $_.DesignerName; baseFile = $_.BaseFile }
        }) }
    } else { [pscustomobject]@{slot = $entry.slot; file = $relative; missing = $true} }
}
$materialPath = Join-Path $Resources 'art\shaders\materials\astromech_rep_a01_v01.mat'
[xml]$material = Get-Content -LiteralPath $materialPath -Raw
$textures = foreach ($inputNode in $material.Material.input) {
    if ($inputNode.type -ne 'texture') { continue }
    $relative = $inputNode.value.TrimStart('/','\') + '.dds'
    [pscustomobject]@{ semantic = $inputNode.semantic; file = $relative; exists = (Test-Path -LiteralPath (Join-Path $Resources $relative)) }
}
$result = [pscustomobject]@{
    resources = $Resources
    namingStatus = 'XML ArtName/DesignerName are internal labels, not verified localized game names. Inventory found no .stb files.'
    slots = @($slots)
    probeMaterial = [pscustomobject]@{ file = $materialPath; family = $material.Material.Derived; alpha = $material.Material.AlphaMode; textures = @($textures) }
}
$result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Report -Encoding utf8
$result | ConvertTo-Json -Depth 8
