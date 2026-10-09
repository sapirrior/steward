# PowerShell Installer for Steward
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$APP = "steward"
$REPO = "sapirrior/steward"

# ANSI Colors matching install.sh
$e = [char]27
$MUTED = "$e[0;2m"
$RED = "$e[0;31m"
$ORANGE = "$e[38;5;214m"
$WHITE = "$e[1;37m"
$NC = "$e[0m"

function Usage {
    @"
Steward Installer

Usage: install.ps1 [options]

Options:
    -h, --help              Display this help message
    -v, --version <version> Install a specific version (e.g., 0.1.0)
    -b, --binary <path>     Install from a local binary instead of downloading
        --no-modify-path    Don't modify shell environment PATH

Examples:
    irm https://raw.githubusercontent.com/$REPO/main/installer/install.ps1 | iex
    irm https://raw.githubusercontent.com/$REPO/main/installer/install.ps1 | iex -args "-v 0.1.0"
    .\install.ps1 -b C:\path\to\steward.exe
"@
}

$RequestedVersion = if ($env:VERSION) { $env:VERSION } else { "" }
$NoModifyPath = $false
$BinaryPath = ""

# Parse arguments (supports both powershell named params and unix style flags)
$i = 0
while ($i -lt $args.Count) {
    $arg = $args[$i]
    switch -Regex ($arg) {
        '^(-h|--help)$' {
            Usage
            exit 0
        }
        '^(-v|--version)$' {
            if ($i + 1 -lt $args.Count) {
                $RequestedVersion = $args[$i + 1]
                $i++
            } else {
                Write-Host "${RED}Error: --version requires a version argument${NC}"
                exit 1
            }
        }
        '^(-b|--binary)$' {
            if ($i + 1 -lt $args.Count) {
                $BinaryPath = $args[$i + 1]
                $i++
            } else {
                Write-Host "${RED}Error: --binary requires a path argument${NC}"
                exit 1
            }
        }
        '^--no-modify-path$' {
            $NoModifyPath = $true
        }
        default {
            Write-Host "${ORANGE}Warning: Unknown option '$arg'${NC}"
        }
    }
    $i++
}

$InstallDir = if ($env:STEWARD_INSTALL_DIR) { $env:STEWARD_INSTALL_DIR } else { Join-Path $HOME ".steward\bin" }
$ShareDir = Join-Path $HOME ".steward\share"

if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

function Print-Message([string]$Level, [string]$Message) {
    $Color = ""
    switch ($Level) {
        "info"    { $Color = $NC }
        "warning" { $Color = $NC }
        "error"   { $Color = $RED }
    }
    Write-Host "${Color}${Message}${NC}"
}

function Print-LogoAndFooter {
    Write-Host ""
    Write-Host "${WHITE}                                  ▄ ${NC}"
    Write-Host "${WHITE}█▀▀▀ ▀█▀▀ █▀▀█ █ █ █ ▀▀▀█ █▀▀▄ █▀▀█${NC}"
    Write-Host "${WHITE}▀▀▀█  █   █▀▀▀ █░█░█ █▀▀█ █    █░░█${NC}"
    Write-Host "${WHITE}▀▀▀▀  ▀   ▀▀▀▀ ▀▀ ▀▀ ▀▀▀▀ ▀    ▀▀▀▀${NC}"
    Write-Host ""
    Write-Host ""
    Write-Host "${MUTED}to start:${NC}"
    Write-Host ""
    Write-Host "cd <project>  ${MUTED}# Open directory${NC}"
    Write-Host "steward       ${MUTED}# Run command${NC}"
    Write-Host ""
    Write-Host "${MUTED}For more information visit ${NC}https://github.com/$REPO"
    Write-Host ""
    Write-Host ""
}

function Check-ExistingVersion([string]$TargetVersion) {
    $BinTarget = Join-Path $InstallDir "$APP.exe"
    $InstalledVersion = ""

    if (Test-Path $BinTarget) {
        try {
            $InstalledVersion = (& $BinTarget --version 2>$null)
        } catch {}
    } elseif (Get-Command $APP -ErrorAction SilentlyContinue) {
        try {
            $InstalledVersion = (& $APP --version 2>$null)
        } catch {}
    }

    if ($InstalledVersion) {
        $InstalledClean = ($InstalledVersion -replace '^v','').Trim().Split(' ')[0]
        $TargetClean = ($TargetVersion -replace '^v','').Trim()

        if ($TargetVersion -ne "latest" -and $InstalledClean -and $InstalledClean -eq $TargetClean) {
            Print-Message "info" "${MUTED}Version ${NC}$TargetVersion${MUTED} already installed"
            Print-LogoAndFooter
            exit 0
        } elseif ($InstalledClean) {
            Print-Message "info" "${MUTED}Installed version: ${NC}$InstalledClean."
        }
    }
}

function Print-Progress([long]$Bytes, [long]$Length) {
    if ($Length -le 0) { return }
    $Width = 50
    $Percent = [int](($Bytes * 100) / $Length)
    if ($Percent -gt 100) { $Percent = 100 }
    $On = [int](($Percent * $Width) / 100)
    $Off = $Width - $On

    $Filled = ("■" * $On)
    $Empty = ("･" * $Off)

    $PercentStr = ("{0,3}" -f $Percent)
    [Console]::Write("`r${ORANGE}${Filled}${Empty} ${PercentStr}%${NC}")
}

function Download-WithProgress([string]$Url, [string]$Output) {
    try {
        $Request = [System.Net.HttpWebRequest]::Create($Url)
        $Request.Method = "GET"
        $Request.Timeout = 120000
        $Request.UserAgent = "steward-installer"
        $Response = $Request.GetResponse()
        $TotalBytes = $Response.ContentLength
        $Stream = $Response.GetResponseStream()
        $FileStream = [System.IO.File]::Create($Output)
        $Buffer = New-Object byte[] 65536
        $TotalRead = 0

        # Hide cursor if supported
        try { [Console]::CursorVisible = $false } catch {}

        while (($Read = $Stream.Read($Buffer, 0, $Buffer.Length)) -gt 0) {
            $FileStream.Write($Buffer, 0, $Read)
            $TotalRead += $Read
            if ($TotalBytes -gt 0) {
                Print-Progress $TotalRead $TotalBytes
            }
        }

        $FileStream.Close()
        $Stream.Close()
        $Response.Close()
        Write-Host ""
        return $true
    }
    catch {
        return $false
    }
    finally {
        try { [Console]::CursorVisible = $true } catch {}
    }
}

function Download-And-Install {
    $Filename = "$APP-windows-x64.zip"
    $SpecificVersion = ""
    $DownloadUrl = ""

    if (-not $RequestedVersion) {
        try {
            $ReleaseInfo = Invoke-RestMethod -Uri "https://api.github.com/repos/$REPO/releases/latest" -UseBasicParsing -TimeoutSec 15
            $SpecificVersion = ($ReleaseInfo.tag_name -replace '^v','')
            $DownloadUrl = "https://github.com/$REPO/releases/download/v$SpecificVersion/$Filename"
        } catch {
            $SpecificVersion = "latest"
            $DownloadUrl = "https://github.com/$REPO/releases/latest/download/$Filename"
        }
    } else {
        $SpecificVersion = ($RequestedVersion -replace '^v','')
        $DownloadUrl = "https://github.com/$REPO/releases/download/v$SpecificVersion/$Filename"

        # Verify release exists
        try {
            $Check = Invoke-WebRequest -Uri "https://github.com/$REPO/releases/tag/v$SpecificVersion" -Method Head -UseBasicParsing -TimeoutSec 15
        } catch {
            if ($_.Exception.Response.StatusCode.value__ -eq 404) {
                Write-Host "${RED}Error: Release v$SpecificVersion not found${NC}"
                Write-Host "${MUTED}Available releases: https://github.com/$REPO/releases${NC}"
                exit 1
            }
        }
    }

    Check-ExistingVersion $SpecificVersion

    Print-Message "info" "`n${MUTED}Installing ${NC}$APP ${MUTED}version: ${NC}$SpecificVersion"

    $TmpDir = Join-Path ([System.IO.Path]::GetTempPath()) "steward_install_$([System.Guid]::NewGuid().ToString('N'))"
    New-Item -ItemType Directory -Path $TmpDir -Force | Out-Null
    $TargetZip = Join-Path $TmpDir $Filename

    try {
        if (-not (Download-WithProgress $DownloadUrl $TargetZip)) {
            Invoke-WebRequest -Uri $DownloadUrl -OutFile $TargetZip -UseBasicParsing -TimeoutSec 120
        }

        if (-not (Test-Path $TargetZip) -or (Get-Item $TargetZip).Length -eq 0) {
            throw "Downloaded zip archive is empty or missing."
        }

        Expand-Archive -Path $TargetZip -DestinationPath $TmpDir -Force

        $SourceExe = Join-Path $TmpDir "$APP.exe"
        if (-not (Test-Path $SourceExe)) {
            throw "Failed to find $APP.exe in the downloaded archive."
        }

        if (Test-Path $ShareDir) {
            Remove-Item -Recurse -Force $ShareDir -ErrorAction SilentlyContinue
        }

        Copy-Item -Path $SourceExe -Destination (Join-Path $InstallDir "$APP.exe") -Force
    }
    finally {
        if (Test-Path $TmpDir) {
            Remove-Item -Recurse -Force $TmpDir -ErrorAction SilentlyContinue
        }
    }
}

function Install-From-Binary {
    Print-Message "info" "`n${MUTED}Installing ${NC}$APP ${MUTED}from: ${NC}$BinaryPath"
    if (-not (Test-Path $BinaryPath)) {
        Write-Host "${RED}Error: Binary not found at $BinaryPath${NC}"
        exit 1
    }
    if (Test-Path $ShareDir) {
        Remove-Item -Recurse -Force $ShareDir -ErrorAction SilentlyContinue
    }
    Copy-Item -Path $BinaryPath -Destination (Join-Path $InstallDir "$APP.exe") -Force
}

# TLS Configuration
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
} catch {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
}

if ($BinaryPath) {
    Install-From-Binary
} else {
    Download-And-Install
}

# Add to PATH
if (-not $NoModifyPath) {
    $UserPath = [Environment]::GetEnvironmentVariable("Path", [EnvironmentVariableTarget]::User)
    if ($UserPath -notlike "*$InstallDir*") {
        [Environment]::SetEnvironmentVariable("Path", "$UserPath;$InstallDir", [EnvironmentVariableTarget]::User)
        $env:Path = "$env:Path;$InstallDir"
    }
}

if ($env:GITHUB_ACTIONS -eq "true") {
    Add-Content -Path $env:GITHUB_PATH -Value $InstallDir
    Print-Message "info" "Added $InstallDir to `$GITHUB_PATH"
}

Print-LogoAndFooter
