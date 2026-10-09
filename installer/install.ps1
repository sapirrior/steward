# PowerShell Installer for Steward on Windows
param(
    [string]$Version = "",
    [string]$Binary = "",
    [switch]$NoModifyPath = $false
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$App = "steward"
$Repo = "sapirrior/steward"

$InstallDir = Join-Path $HOME ".steward\bin"
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

function Show-LogoAndFooter {
    Write-Host ""
    Write-Host "                                  ▄ " -ForegroundColor White
    Write-Host "█▀▀▀ ▀█▀▀ █▀▀█ █ █ █ ▀▀▀█ █▀▀▄ █▀▀█" -ForegroundColor White
    Write-Host "▀▀▀█  █   █▀▀▀ █░█░█ █▀▀█ █    █░░█" -ForegroundColor White
    Write-Host "▀▀▀▀  ▀   ▀▀▀▀ ▀▀ ▀▀ ▀▀▀▀ ▀    ▀▀▀▀" -ForegroundColor White
    Write-Host ""
    Write-Host ""
    Write-Host "to start:" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "cd <project>  # Open directory"
    Write-Host "steward       # Run command"
    Write-Host ""
    Write-Host "For more information visit https://github.com/sapirrior/steward" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host ""
}

function Check-ExistingVersion([string]$TargetVersion) {
    $ExePath = Join-Path $InstallDir "steward.exe"
    $InstalledVer = ""
    if (Test-Path $ExePath) {
        try {
            $InstalledVer = (& $ExePath --version 2>$null)
        } catch {}
    } elseif (Get-Command steward -ErrorAction SilentlyContinue) {
        try {
            $InstalledVer = (steward --version 2>$null)
        } catch {}
    }

    if ($InstalledVer) {
        $InstalledClean = ($InstalledVer -replace '^v','').Split(' ')[0]
        $TargetClean = $TargetVersion -replace '^v',''
        if ($TargetVersion -and $TargetVersion -ne "latest" -and $InstalledClean -eq $TargetClean) {
            Write-Host "Version $TargetVersion already installed" -ForegroundColor DarkGray
            Show-LogoAndFooter
            exit 0
        } elseif ($InstalledClean) {
            Write-Host "Installed version: $InstalledClean." -ForegroundColor DarkGray
        }
    }
}

$TempZip = Join-Path ([System.IO.Path]::GetTempPath()) "steward-install.zip"
$TempExtract = Join-Path ([System.IO.Path]::GetTempPath()) "steward-extract-$([System.Guid]::NewGuid().ToString('N'))"

try {
    # TLS Configuration for GitHub
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
    } catch {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    }

    if ($Binary) {
        if (-not (Test-Path $Binary)) {
            Write-Host "Error: Binary not found at $Binary" -ForegroundColor Red
            exit 1
        }
        Write-Host ""
        Write-Host "Installing $App from: $Binary" -ForegroundColor DarkGray
        Copy-Item -Path $Binary -Destination (Join-Path $InstallDir "steward.exe") -Force
    } else {
        $Asset = "steward-windows-x64.zip"
        $TargetVersion = $Version

        if (-not $TargetVersion) {
            try {
                $ReleaseInfo = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" -UseBasicParsing -TimeoutSec 15
                $TargetVersion = ($ReleaseInfo.tag_name -replace '^v','')
                $DownloadUrl = "https://github.com/$Repo/releases/download/v$TargetVersion/$Asset"
            } catch {
                $TargetVersion = "latest"
                $DownloadUrl = "https://github.com/$Repo/releases/latest/download/$Asset"
            }
        } else {
            $TargetVersion = $TargetVersion -replace '^v',''
            $DownloadUrl = "https://github.com/$Repo/releases/download/v$TargetVersion/$Asset"
        }

        Check-ExistingVersion $TargetVersion

        Write-Host ""
        Write-Host "Installing $App version: $TargetVersion" -ForegroundColor DarkGray

        try {
            Invoke-WebRequest -Uri $DownloadUrl -OutFile $TempZip -UseBasicParsing -TimeoutSec 120
        } catch {
            $webClient = New-Object System.Net.WebClient
            $webClient.DownloadFile($DownloadUrl, $TempZip)
        }

        if (-not (Test-Path $TempZip) -or (Get-Item $TempZip).Length -eq 0) {
            throw "Downloaded zip archive is empty or missing."
        }

        if (Test-Path $TempExtract) {
            Remove-Item -Recurse -Force $TempExtract
        }
        Expand-Archive -Path $TempZip -DestinationPath $TempExtract -Force

        $SourceExe = Join-Path $TempExtract "steward.exe"
        if (-not (Test-Path $SourceExe)) {
            throw "Failed to find steward.exe in the downloaded archive."
        }

        Copy-Item -Path $SourceExe -Destination (Join-Path $InstallDir "steward.exe") -Force
    }

    # Verify / Update PATH
    if (-not $NoModifyPath) {
        $UserPath = [Environment]::GetEnvironmentVariable("Path", [EnvironmentVariableTarget]::User)
        if ($UserPath -notlike "*$InstallDir*") {
            [Environment]::SetEnvironmentVariable("Path", "$UserPath;$InstallDir", [EnvironmentVariableTarget]::User)
            $env:Path = "$env:Path;$InstallDir"
        }
    }

    if ($env:GITHUB_ACTIONS -eq "true") {
        Add-Content -Path $env:GITHUB_PATH -Value $InstallDir
    }

    Show-LogoAndFooter
}
catch {
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}
finally {
    if (Test-Path $TempZip) {
        Remove-Item -Force $TempZip -ErrorAction SilentlyContinue
    }
    if (Test-Path $TempExtract) {
        Remove-Item -Recurse -Force $TempExtract -ErrorAction SilentlyContinue
    }
}
