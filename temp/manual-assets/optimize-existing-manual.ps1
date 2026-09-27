param([Parameter(Mandatory = $true)][string]$DocumentPath, [switch]$Apply)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Security
$sourcePath = (Resolve-Path $DocumentPath).Path
$sourceHash = (Get-FileHash $sourcePath -Algorithm SHA256).Hash
$assetRoot = Join-Path (Get-Location) 'docs/manual-assets'
$plan = [IO.File]::ReadAllText((Join-Path $assetRoot 'manual-optimization.json'), [Text.Encoding]::UTF8) | ConvertFrom-Json
$archive = [IO.Compression.ZipFile]::OpenRead($sourcePath)
$partHashes = @{}
try {
    foreach ($entry in $archive.Entries) {
        $stream = $entry.Open(); $hasher = [Security.Cryptography.SHA256]::Create()
        try { $partHashes[$entry.FullName] = [Convert]::ToBase64String($hasher.ComputeHash($stream)) }
        finally { $stream.Dispose(); $hasher.Dispose() }
    }
    $reader = [IO.StreamReader]::new($archive.GetEntry('word/document.xml').Open())
    try { $originalXml = $reader.ReadToEnd() } finally { $reader.Dispose() }
} finally { $archive.Dispose() }
$xml = [Xml.XmlDocument]::new(); $xml.PreserveWhitespace = $true; $xml.LoadXml($originalXml)
$wordNamespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
$ns = [Xml.XmlNamespaceManager]::new($xml.NameTable); $ns.AddNamespace('w', $wordNamespace)
$paragraphs = @($xml.SelectNodes('//w:body/w:p', $ns))
if ($paragraphs.Count -ne $plan.expectedParagraphCount) { throw 'Document structure changed; review the edit plan before applying' }
$snapshots = @($paragraphs | ForEach-Object OuterXml)
$originalDrawings = @($xml.SelectNodes('//w:drawing', $ns) | ForEach-Object OuterXml)
$changed = [Collections.Generic.HashSet[int]]::new()
function Get-ParagraphText($paragraph) { return ($paragraph.SelectNodes('.//w:t', $ns) | ForEach-Object InnerText) -join '' }
function Set-TextSpace($node) {
    $attribute = $xml.CreateAttribute('xml', 'space', 'http://www.w3.org/XML/1998/namespace')
    $attribute.Value = 'preserve'
    [void]$node.Attributes.SetNamedItem($attribute)
}
function Get-CanonicalHash($document) {
    $transform = [Security.Cryptography.Xml.XmlDsigC14NTransform]::new()
    $transform.LoadInput($document)
    $stream = $transform.GetOutput([IO.Stream])
    $hasher = [Security.Cryptography.SHA256]::Create()
    try { return [Convert]::ToBase64String($hasher.ComputeHash($stream)) }
    finally { $stream.Dispose(); $hasher.Dispose() }
}
function Set-ParagraphText($paragraph, [string]$text) {
    $nodes = @($paragraph.SelectNodes('.//w:t', $ns))
    if ($nodes.Count -eq 0) { throw 'Cannot replace a paragraph without text' }
    $nodes[0].InnerText = $text
    Set-TextSpace $nodes[0]
    foreach ($node in $nodes | Select-Object -Skip 1) { $node.InnerText = '' }
}
function New-Paragraph([string]$text, [bool]$bold = $false) {
    $paragraph = $xml.CreateElement('w', 'p', $wordNamespace)
    $properties = $paragraphs[36].SelectSingleNode('w:pPr', $ns)
    if ($properties) { [void]$paragraph.AppendChild($properties.CloneNode($true)) }
    $run = $xml.CreateElement('w', 'r', $wordNamespace)
    $runProperties = $paragraphs[36].SelectSingleNode('w:r/w:rPr', $ns)
    if ($runProperties) { $runProperties = $runProperties.CloneNode($true) }
    else { $runProperties = $xml.CreateElement('w', 'rPr', $wordNamespace) }
    if ($bold) { [void]$runProperties.AppendChild($xml.CreateElement('w', 'b', $wordNamespace)) }
    [void]$run.AppendChild($runProperties)
    $textNode = $xml.CreateElement('w', 't', $wordNamespace)
    Set-TextSpace $textNode
    $textNode.InnerText = $text
    [void]$run.AppendChild($textNode); [void]$paragraph.AppendChild($run)
    return ,$paragraph
}
foreach ($edit in $plan.replacements) {
    $index = [int]$edit.index
    $current = (Get-ParagraphText $paragraphs[$index]) -replace '\s', ''
    if (-not $current.StartsWith(($edit.starts -replace '\s', ''))) { throw "Edit anchor mismatch at paragraph $index" }
    if (-not $changed.Add($index)) { throw "Duplicate replacement at paragraph $index" }
    Set-ParagraphText $paragraphs[$index] $edit.text
}
for ($index = 0; $index -lt $paragraphs.Count; $index++) {
    $text = Get-ParagraphText $paragraphs[$index]
    if ($text.StartsWith('操作目的：')) {
        Set-ParagraphText $paragraphs[$index] ('功能说明：' + $text.Substring(5))
        [void]$changed.Add($index)
    }
}
$addedParagraphs = 0
foreach ($insertion in $plan.insertions) {
    $anchor = $paragraphs[[int]$insertion.after]
    foreach ($text in $insertion.paragraphs) {
        $node = New-Paragraph $text
        [void]$anchor.ParentNode.InsertAfter($node, $anchor); $anchor = $node
        $addedParagraphs++
    }
}
$overviewHeading = New-Paragraph '功能导航：先按下表选择任务，再查看对应章节的编号步骤与截图。' $true
[void]$paragraphs[$plan.overviewAfter].ParentNode.InsertAfter($overviewHeading, $paragraphs[$plan.overviewAfter])
$table = $xml.CreateElement('w', 'tbl', $wordNamespace)
$tableProperties = $xml.CreateElement('w', 'tblPr', $wordNamespace)
$tableProperties.InnerXml = '<w:tblW xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" w:w="0" w:type="auto"/><w:tblBorders xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:top w:val="single" w:sz="4" w:color="BBBBBB"/><w:left w:val="single" w:sz="4" w:color="BBBBBB"/><w:bottom w:val="single" w:sz="4" w:color="BBBBBB"/><w:right w:val="single" w:sz="4" w:color="BBBBBB"/><w:insideH w:val="single" w:sz="4" w:color="BBBBBB"/><w:insideV w:val="single" w:sz="4" w:color="BBBBBB"/></w:tblBorders>'
[void]$table.AppendChild($tableProperties)
$grid = $xml.CreateElement('w', 'tblGrid', $wordNamespace)
foreach ($width in @(2400, 6200, 1200)) {
    $column = $xml.CreateElement('w', 'gridCol', $wordNamespace)
    $attribute = $xml.CreateAttribute('w', 'w', $wordNamespace); $attribute.Value = [string]$width
    [void]$column.Attributes.Append($attribute); [void]$grid.AppendChild($column)
}
[void]$table.AppendChild($grid)
$rowIndex = 0
foreach ($values in $plan.overview) {
    $row = $xml.CreateElement('w', 'tr', $wordNamespace)
    $rowProperties = $xml.CreateElement('w', 'trPr', $wordNamespace)
    [void]$rowProperties.AppendChild($xml.CreateElement('w', 'cantSplit', $wordNamespace))
    if ($rowIndex -eq 0) { [void]$rowProperties.AppendChild($xml.CreateElement('w', 'tblHeader', $wordNamespace)) }
    [void]$row.AppendChild($rowProperties)
    foreach ($value in $values) { $cell = $xml.CreateElement('w', 'tc', $wordNamespace); [void]$cell.AppendChild((New-Paragraph $value ($rowIndex -eq 0))); [void]$row.AppendChild($cell) }
    [void]$table.AppendChild($row); $rowIndex++
}
[void]$overviewHeading.ParentNode.InsertAfter($table, $overviewHeading)
for ($index = 0; $index -lt $paragraphs.Count; $index++) {
    if (-not $changed.Contains($index) -and $paragraphs[$index].OuterXml -cne $snapshots[$index]) { throw "Unplanned change to paragraph $index" }
}
$currentDrawings = @($xml.SelectNodes('//w:drawing', $ns) | ForEach-Object OuterXml)
if (($originalDrawings -join '') -cne ($currentDrawings -join '')) { throw 'Drawing structure changed' }
$roundTrip = [Xml.XmlDocument]::new(); $roundTrip.PreserveWhitespace = $true
$roundTrip.LoadXml($xml.OuterXml)
if ((Get-CanonicalHash $roundTrip) -cne (Get-CanonicalHash $xml)) { throw 'XML round-trip changed document content' }
Write-Output "Validated $($changed.Count) targeted paragraph updates, $addedParagraphs added instructions and one feature overview table."
Write-Output "Preserved $($paragraphs.Count - $changed.Count) original paragraphs and $($currentDrawings.Count) drawings."
if (-not $Apply) { Write-Output 'Dry run only; Word file unchanged.'; return }
$backupRoot = Join-Path $assetRoot 'backups'; [void][IO.Directory]::CreateDirectory($backupRoot)
$backup = Join-Path $backupRoot ([IO.Path]::GetFileNameWithoutExtension($sourcePath) + '-before-optimization-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff') + '.docx')
$temporary = Join-Path (Split-Path $sourcePath -Parent) ([Guid]::NewGuid().ToString('N') + '.docx')
try {
    [IO.File]::Copy($sourcePath, $temporary)
    $archive = [IO.Compression.ZipFile]::Open($temporary, [IO.Compression.ZipArchiveMode]::Update)
    try {
        $stream = $archive.GetEntry('word/document.xml').Open()
        try {
            $stream.SetLength(0)
            $settings = [Xml.XmlWriterSettings]::new(); $settings.Encoding = [Text.UTF8Encoding]::new($false)
            $writer = [Xml.XmlWriter]::Create($stream, $settings)
            try { $xml.Save($writer) } finally { $writer.Dispose() }
        } finally { $stream.Dispose() }
    } finally { $archive.Dispose() }
    $archive = [IO.Compression.ZipFile]::OpenRead($temporary)
    try {
        if ($archive.Entries.Count -ne $partHashes.Count) { throw 'Document part count changed' }
        foreach ($entry in $archive.Entries) {
            if ($entry.FullName -eq 'word/document.xml') { continue }
            $stream = $entry.Open(); $hasher = [Security.Cryptography.SHA256]::Create()
            try { $hash = [Convert]::ToBase64String($hasher.ComputeHash($stream)) }
            finally { $stream.Dispose(); $hasher.Dispose() }
            if ($hash -cne $partHashes[$entry.FullName]) { throw "Unrelated document part changed: $($entry.FullName)" }
        }
        $reader = [IO.StreamReader]::new($archive.GetEntry('word/document.xml').Open())
        try { $verification = [Xml.XmlDocument]::new(); $verification.PreserveWhitespace = $true; $verification.LoadXml($reader.ReadToEnd()) }
        finally { $reader.Dispose() }
        if ((Get-CanonicalHash $verification) -cne (Get-CanonicalHash $xml)) { throw 'Saved XML differs from validated content' }
    } finally { $archive.Dispose() }
    if ((Get-FileHash $sourcePath -Algorithm SHA256).Hash -cne $sourceHash) { throw 'Word file changed during processing; replacement cancelled' }
    [IO.File]::Replace($temporary, $sourcePath, $backup)
    Write-Output "Saved existing Word document. Backup: $backup"
} finally { if (Test-Path $temporary) { Remove-Item $temporary } }