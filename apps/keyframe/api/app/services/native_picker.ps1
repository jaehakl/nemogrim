param(
    [ValidateSet('files', 'folder', 'probe')]
    [string]$Mode = 'files'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

if ($Mode -eq 'probe') {
    ConvertTo-Json -InputObject @(
        [Threading.Thread]::CurrentThread.ApartmentState.ToString(),
        'WinForms'
    ) -Compress
    exit 0
}

$owner = [System.Windows.Forms.Form]::new()
$owner.ShowInTaskbar = $false
$owner.TopMost = $true
$owner.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
$owner.Location = [System.Drawing.Point]::new(-32000, -32000)
$owner.Size = [System.Drawing.Size]::new(1, 1)
$owner.Opacity = 0

try {
    $owner.Show()
    $owner.Activate()

    if ($Mode -eq 'files') {
        $dialog = [System.Windows.Forms.OpenFileDialog]::new()
        try {
            $dialog.Title = 'Select video files to add'
            $dialog.Multiselect = $true
            $dialog.CheckFileExists = $true
            $dialog.CheckPathExists = $true
            $dialog.Filter = 'Playable video files|*.mp4;*.m4v;*.webm'
            if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) {
                ConvertTo-Json -InputObject @($dialog.FileNames) -Compress
            } else {
                '[]'
            }
        } finally {
            $dialog.Dispose()
        }
    } else {
        $dialog = [System.Windows.Forms.FolderBrowserDialog]::new()
        try {
            $dialog.Description = 'Select a folder containing video files'
            $dialog.ShowNewFolderButton = $false
            if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) {
                ConvertTo-Json -InputObject @($dialog.SelectedPath) -Compress
            } else {
                '[]'
            }
        } finally {
            $dialog.Dispose()
        }
    }
} finally {
    $owner.Close()
    $owner.Dispose()
}
