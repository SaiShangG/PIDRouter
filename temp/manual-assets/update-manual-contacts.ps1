param([Parameter(Mandatory = $true)][string]$DocumentPath, [switch]$Apply)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Security
$sourcePath = (Resolve-Path $DocumentPath).Path
$sourceHash = (Get-FileHash $sourcePath -Algorithm SHA256).Hash
$archive = [IO.Compression.ZipFile]::OpenRead($sourcePath)
$partHashes = @{}
try {
    foreach ($entry in $archive.Entries) {
        $stream = $entry.Open(); $hasher = [Security.Cryptography.SHA256]::Create()
        try { $partHashes[$entry.FullName] = [Convert]::ToBase64String($hasher.ComputeHash($stream)) }
        finally { $stream.Dispose(); $hasher.Dispose() }
    }
    $reader = [IO.StreamReader]::new($archive.GetEntry('word/document.xml').Open())
    try { $sourceXml = $reader.ReadToEnd() } finally { $reader.Dispose() }
} finally { $archive.Dispose() }
$xml = [Xml.XmlDocument]::new(); $xml.PreserveWhitespace = $true; $xml.LoadXml($sourceXml)
$wordNamespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
$ns = [Xml.XmlNamespaceManager]::new($xml.NameTable); $ns.AddNamespace('w', $wordNamespace)
function Get-Text($node) { return ($node.SelectNodes('.//w:t', $ns) | ForEach-Object InnerText) -join '' }
function Set-Attribute($node, [string]$name, [string]$value) {
    $attribute = $xml.CreateAttribute('w', $name, $wordNamespace); $attribute.Value = $value
    [void]$node.Attributes.SetNamedItem($attribute)
}
function Get-CanonicalHash($document) {
    $transform = [Security.Cryptography.Xml.XmlDsigC14NTransform]::new(); $transform.LoadInput($document)
    $stream = $transform.GetOutput([IO.Stream]); $hasher = [Security.Cryptography.SHA256]::Create()
    try { return [Convert]::ToBase64String($hasher.ComputeHash($stream)) }
    finally { $stream.Dispose(); $hasher.Dispose() }
}
$paragraphs = @($xml.SelectNodes('//w:body/w:p', $ns))
$headings = @($paragraphs | Where-Object { (Get-Text $_) -match '^15\s+联系人$' })
if ($headings.Count -eq 0) { throw 'Contact section not found; no changes made' }
$heading = $headings[-1]
$contactNodes = [Collections.Generic.List[Xml.XmlNode]]::new()
$following = $heading.NextSibling
while ($following -and (Get-Text $following) -notmatch '^附录\s*A') {
    if (Get-Text $following) { $contactNodes.Add($following) }
    $following = $following.NextSibling
}
if (-not $following) { throw 'Cannot confirm contact section boundary' }
$contacts = @(
    @('Tong Chen', 'tchen2@rockwellautomation.com'),
    @('Jason Yi Ren', 'Yi.Ren@rockwellautomation.com'),
    @('Sai Shang', 'sai.shang@rockwellautomation.com'),
    @('Krishna A', 'akrishna@rockwellautomation.com'),
    @('Kenny Tay', 'kenny.tay@rockwellautomation.com')
)
$actualText = (($contactNodes | ForEach-Object { Get-Text $_ }) -join '') -replace '\s', ''
$expectedText = (($contacts | ForEach-Object { $_ -join '' }) -join '') -replace '\s', ''
if ($actualText -cne $expectedText) { throw 'Contact details changed; review before updating' }
foreach ($node in $contactNodes) {
    if ($node.SelectNodes('.//w:drawing|.//w:pict|.//w:bookmarkStart|.//w:bookmarkEnd', $ns).Count) {
        throw 'Contact paragraphs contain embedded objects or bookmarks; manual review needed'
    }
}
$body = $heading.ParentNode
$untouched = @($body.ChildNodes | Where-Object { -not $contactNodes.Contains($_) -and $_ -notin $headings })
$snapshots = @($untouched | ForEach-Object OuterXml)
$template = $contactNodes[0]
$originalLinks = @($contactNodes | ForEach-Object { $_.SelectNodes('.//w:hyperlink', $ns) })
function New-Paragraph([string]$text, [bool]$bold = $false) {
    $paragraph = $xml.CreateElement('w', 'p', $wordNamespace)
    $properties = $template.SelectSingleNode('w:pPr', $ns)
    if ($properties) { [void]$paragraph.AppendChild($properties.CloneNode($true)) }
    $run = $xml.CreateElement('w', 'r', $wordNamespace)
    $runProperties = $template.SelectSingleNode('w:r/w:rPr', $ns)
    if ($runProperties) { $runProperties = $runProperties.CloneNode($true) }
    else { $runProperties = $xml.CreateElement('w', 'rPr', $wordNamespace) }
    if ($bold) { [void]$runProperties.AppendChild($xml.CreateElement('w', 'b', $wordNamespace)) }
    [void]$run.AppendChild($runProperties)
    $textNode = $xml.CreateElement('w', 't', $wordNamespace); $textNode.InnerText = $text
    [void]$run.AppendChild($textNode); [void]$paragraph.AppendChild($run)
    return ,$paragraph
}
foreach ($title in $headings) {
    $textNodes = @($title.SelectNodes('.//w:t', $ns))
    $textNodes[0].InnerText = '15 联系人与技术支持'
    foreach ($textNode in $textNodes | Select-Object -Skip 1) { $textNode.InnerText = '' }
}
$intro = New-Paragraph '如需咨询系统功能、操作方法或反馈使用问题，请联系以下人员。'
[void]$body.InsertAfter($intro, $heading)
$table = $xml.CreateElement('w', 'tbl', $wordNamespace)
$properties = $xml.CreateElement('w', 'tblPr', $wordNamespace)
$width = $xml.CreateElement('w', 'tblW', $wordNamespace)
Set-Attribute $width 'w' '5000'; Set-Attribute $width 'type' 'pct'
[void]$properties.AppendChild($width)
$borders = $xml.CreateElement('w', 'tblBorders', $wordNamespace)
foreach ($edge in @('top','left','bottom','right','insideH','insideV')) {
    $border = $xml.CreateElement('w', $edge, $wordNamespace)
    Set-Attribute $border 'val' 'single'; Set-Attribute $border 'sz' '4'; Set-Attribute $border 'color' 'BBBBBB'
    [void]$borders.AppendChild($border)
}
[void]$properties.AppendChild($borders); [void]$table.AppendChild($properties)
$grid = $xml.CreateElement('w', 'tblGrid', $wordNamespace)
foreach ($size in @('3000','6800')) {
    $column = $xml.CreateElement('w', 'gridCol', $wordNamespace); Set-Attribute $column 'w' $size
    [void]$grid.AppendChild($column)
}
[void]$table.AppendChild($grid)
$rows = @(,@('联系人','电子邮箱')) + $contacts
for ($rowIndex = 0; $rowIndex -lt $rows.Count; $rowIndex++) {
    $row = $xml.CreateElement('w', 'tr', $wordNamespace)
    $rowProperties = $xml.CreateElement('w', 'trPr', $wordNamespace)
    [void]$rowProperties.AppendChild($xml.CreateElement('w', 'cantSplit', $wordNamespace))
    if ($rowIndex -eq 0) { [void]$rowProperties.AppendChild($xml.CreateElement('w', 'tblHeader', $wordNamespace)) }
    [void]$row.AppendChild($rowProperties)
    foreach ($value in $rows[$rowIndex]) {
        $cell = $xml.CreateElement('w', 'tc', $wordNamespace)
        $paragraph = New-Paragraph $value ($rowIndex -eq 0)
        $matchingLinks = @($originalLinks | Where-Object { (Get-Text $_) -ceq $value })
        if ($matchingLinks.Count -eq 1) {
            foreach ($run in @($paragraph.SelectNodes('w:r', $ns))) { [void]$paragraph.RemoveChild($run) }
            [void]$paragraph.AppendChild($matchingLinks[0].CloneNode($true))
        }
        [void]$cell.AppendChild($paragraph)
        [void]$row.AppendChild($cell)
    }
    [void]$table.AppendChild($row)
}
[void]$body.InsertAfter($table, $intro)
$note = New-Paragraph '问题反馈建议：请提供软件版本、项目及阶段名称、操作步骤、预期结果和错误截图，以便定位问题。提交前请隐去密码、密钥及其他敏感信息。'
[void]$body.InsertAfter($note, $table)
foreach ($node in $contactNodes) { [void]$body.RemoveChild($node) }
for ($index = 0; $index -lt $untouched.Count; $index++) {
    if ($untouched[$index].OuterXml -cne $snapshots[$index]) { throw "Unrelated body content changed at index $index" }
}
if ($table.SelectNodes('w:tr', $ns).Count -ne 6) { throw 'Expected header plus five contacts' }
$newLinks = @($table.SelectNodes('.//w:hyperlink', $ns))
if (($originalLinks | ForEach-Object OuterXml) -join '' -cne (($newLinks | ForEach-Object OuterXml) -join '')) { throw 'Contact hyperlinks changed' }
$tableValues = @($table.SelectNodes('w:tr[position()>1]/w:tc', $ns) | ForEach-Object { Get-Text $_ })
if (($tableValues -join '') -cne (($contacts | ForEach-Object { $_ -join '' }) -join '')) { throw 'Contact data mismatch' }
$verification = [Xml.XmlDocument]::new(); $verification.PreserveWhitespace = $true; $verification.LoadXml($xml.OuterXml)
if ((Get-CanonicalHash $verification) -cne (Get-CanonicalHash $xml)) { throw 'XML round-trip mismatch' }
Write-Output "Validated five unchanged contact records, six table rows and $($untouched.Count) untouched body elements."
if (-not $Apply) { Write-Output 'Dry run only. Word unchanged.'; return }
$backupRoot = Join-Path (Split-Path $sourcePath -Parent) 'manual-assets/backups'
[void][IO.Directory]::CreateDirectory($backupRoot)
$backup = Join-Path $backupRoot ([IO.Path]::GetFileNameWithoutExtension($sourcePath) + '-before-contacts-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff') + '.docx')
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
            if ($hash -cne $partHashes[$entry.FullName]) { throw "Unrelated part changed: $($entry.FullName)" }
        }
        $reader = [IO.StreamReader]::new($archive.GetEntry('word/document.xml').Open())
        try { $verification.LoadXml($reader.ReadToEnd()) } finally { $reader.Dispose() }
        if ((Get-CanonicalHash $verification) -cne (Get-CanonicalHash $xml)) { throw 'Saved content mismatch' }
    } finally { $archive.Dispose() }
    if ((Get-FileHash $sourcePath -Algorithm SHA256).Hash -cne $sourceHash) { throw 'Source changed during editing; cancelled' }
    [IO.File]::Replace($temporary, $sourcePath, $backup)
    Write-Output "Updated contact section only. Backup: $backup"
} finally { if (Test-Path $temporary) { Remove-Item $temporary } }