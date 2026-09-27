param(
    [Parameter(Mandatory = $true)][string]$DocumentPath,
    [switch]$Apply
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$sourcePath = (Resolve-Path $DocumentPath).Path
$sourceHash = (Get-FileHash $sourcePath -Algorithm SHA256).Hash
$pattern = '^\s*\u6b65\u9aa4\s*([0-9]+)\s*[:\uFF1A\u3001.\uFF0E]?\s*'
$archive = [IO.Compression.ZipFile]::OpenRead($sourcePath)
$originalParts = @{}
try {
    foreach ($entry in $archive.Entries) {
        $stream = $entry.Open()
        $hasher = [Security.Cryptography.SHA256]::Create()
        try { $originalParts[$entry.FullName] = [Convert]::ToBase64String($hasher.ComputeHash($stream)) }
        finally { $stream.Dispose(); $hasher.Dispose() }
    }
    $reader = [IO.StreamReader]::new($archive.GetEntry('word/document.xml').Open())
    try { $documentXml = $reader.ReadToEnd() } finally { $reader.Dispose() }
} finally { $archive.Dispose() }
$xml = [Xml.XmlDocument]::new()
$xml.PreserveWhitespace = $true
$xml.LoadXml($documentXml)
$namespaces = [Xml.XmlNamespaceManager]::new($xml.NameTable)
$namespaces.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
$expectedParagraphs = [Collections.Generic.List[string]]::new()
$changedCount = 0
foreach ($paragraph in $xml.SelectNodes('//w:p', $namespaces)) {
    $nodes = @($paragraph.SelectNodes('.//w:t', $namespaces))
    $originalText = ($nodes | ForEach-Object InnerText) -join ''
    $match = [regex]::Match($originalText, $pattern)
    if (-not $match.Success) { $expectedParagraphs.Add($originalText); continue }
    $replacement = $match.Groups[1].Value + '. '
    $expectedParagraphs.Add($replacement + $originalText.Substring($match.Length))
    $remaining = $match.Length
    $firstNode = $true
    foreach ($node in $nodes) {
        if ($remaining -le 0) { break }
        $consumed = [Math]::Min($remaining, $node.InnerText.Length)
        $suffix = $node.InnerText.Substring($consumed)
        if ($firstNode) {
            $node.InnerText = $replacement + $suffix
            $node.SetAttribute('space', 'http://www.w3.org/XML/1998/namespace', 'preserve')
            $firstNode = $false
        } else { $node.InnerText = $suffix }
        $remaining -= $consumed
    }
    $actualText = ($nodes | ForEach-Object InnerText) -join ''
    if ($actualText -cne $expectedParagraphs[$expectedParagraphs.Count - 1]) { throw 'Paragraph replacement mismatch' }
    $changedCount++
}
if ($changedCount -eq 0) { Write-Output 'No step prefixes found. Document unchanged.'; return }
Write-Output "Validated $changedCount prefix replacements across $($expectedParagraphs.Count) paragraphs."
if (-not $Apply) { Write-Output 'Dry run only. No document modified.'; return }
$backupDirectory = Join-Path (Split-Path $sourcePath -Parent) 'manual-assets/backups'
[void][IO.Directory]::CreateDirectory($backupDirectory)
$backupPath = Join-Path $backupDirectory ([IO.Path]::GetFileNameWithoutExtension($sourcePath) + '-before-numbering-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff') + '.docx')
$temporaryPath = Join-Path (Split-Path $sourcePath -Parent) ([Guid]::NewGuid().ToString('N') + '.docx')
try {
    [IO.File]::Copy($sourcePath, $temporaryPath)
    $archive = [IO.Compression.ZipFile]::Open($temporaryPath, [IO.Compression.ZipArchiveMode]::Update)
    try {
        $entry = $archive.GetEntry('word/document.xml')
        $stream = $entry.Open()
        try {
            $stream.SetLength(0)
            $settings = [Xml.XmlWriterSettings]::new()
            $settings.Encoding = [Text.UTF8Encoding]::new($false)
            $settings.Indent = $false
            $writer = [Xml.XmlWriter]::Create($stream, $settings)
            try { $xml.Save($writer) } finally { $writer.Dispose() }
        } finally { $stream.Dispose() }
    } finally { $archive.Dispose() }
    $archive = [IO.Compression.ZipFile]::OpenRead($temporaryPath)
    try {
        if ($archive.Entries.Count -ne $originalParts.Count) { throw 'Document part count changed' }
        foreach ($entry in $archive.Entries) {
            if ($entry.FullName -eq 'word/document.xml') { continue }
            $stream = $entry.Open()
            $hasher = [Security.Cryptography.SHA256]::Create()
            try { $actualHash = [Convert]::ToBase64String($hasher.ComputeHash($stream)) }
            finally { $stream.Dispose(); $hasher.Dispose() }
            if ($actualHash -cne $originalParts[$entry.FullName]) { throw "Unrelated part changed: $($entry.FullName)" }
        }
        $reader = [IO.StreamReader]::new($archive.GetEntry('word/document.xml').Open())
        try { $verifiedXml = [Xml.XmlDocument]::new(); $verifiedXml.LoadXml($reader.ReadToEnd()) }
        finally { $reader.Dispose() }
        $actualParagraphs = @($verifiedXml.SelectNodes('//w:p', $namespaces) | ForEach-Object { ($_.SelectNodes('.//w:t', $namespaces) | ForEach-Object InnerText) -join '' })
        if ($actualParagraphs.Count -ne $expectedParagraphs.Count) { throw 'Paragraph count changed' }
        for ($index = 0; $index -lt $actualParagraphs.Count; $index++) {
            if ($actualParagraphs[$index] -cne $expectedParagraphs[$index]) { throw "Paragraph verification failed: $index" }
            if ($actualParagraphs[$index] -match $pattern) { throw 'Unconverted prefix remains' }
        }
    } finally { $archive.Dispose() }
    if ((Get-FileHash $sourcePath -Algorithm SHA256).Hash -cne $sourceHash) { throw 'Source document changed during processing; no replacement made' }
    [IO.File]::Replace($temporaryPath, $sourcePath, $backupPath)
    Write-Output "Updated $changedCount prefixes. All other paragraph text and ZIP parts preserved."
    Write-Output "Backup: $backupPath"
} finally {
    if (Test-Path $temporaryPath) { Remove-Item $temporaryPath }
}