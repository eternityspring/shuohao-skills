<#
.SYNOPSIS
    把本仓库的 skill 联接进 Claude Code 和/或 Codex 的 skills 目录（Windows 版 install.sh）。

.DESCRIPTION
    用目录联接（Junction）代替符号链接：Windows 上不需要管理员权限，也不需要开发者模式，
    git pull 之后立即生效，不需要重新安装。
    只创建联接，不改动真实目录：目标位置已存在且不是联接时一律跳过。

    目录联接只在本地卷之间有效；skills 目录与仓库位于不同的本地磁盘同样可以联接。
    卸载时只删除联接本身，不会触及目标目录中的文件。

.EXAMPLE
    .\scripts\install.ps1
        安装全部，安装到检测到的所有 agent

.EXAMPLE
    .\scripts\install.ps1 novel-characters
        只安装某一个

.EXAMPLE
    .\scripts\install.ps1 --claude
        只安装到 Claude Code（~\.claude\skills）

.EXAMPLE
    .\scripts\install.ps1 --codex
        只安装到 Codex（~\.codex\skills）

.EXAMPLE
    .\scripts\install.ps1 --uninstall
        取消联接

.EXAMPLE
    .\scripts\install.ps1 --dry-run
        只打印将要执行的操作，不做任何改动
#>
[CmdletBinding()]
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Rest)

$ErrorActionPreference = 'Stop'

$Repo = Split-Path -Parent $PSScriptRoot
$SkillsDir = Join-Path $Repo 'skills'
$HomeDir = $env:USERPROFILE

$Usage = @'
用法：install.ps1 [skill...] [--claude] [--codex] [--uninstall] [--dry-run]

  install.ps1                    安装全部，安装到检测到的所有 agent
  install.ps1 novel-characters   只安装某一个
  install.ps1 --claude           只安装到 Claude Code（~\.claude\skills）
  install.ps1 --codex            只安装到 Codex（~\.codex\skills）
  install.ps1 --uninstall        取消联接
  install.ps1 --dry-run          只打印将要执行的操作，不做任何改动
'@

function Test-Link($item) {
    return ($item.LinkType -eq 'Junction' -or $item.LinkType -eq 'SymbolicLink')
}

$targets = @()
$wanted = @()
$uninstall = $false
$dryRun = $false

foreach ($arg in $Rest) {
    switch -Wildcard ($arg) {
        '--claude'    { $targets += (Join-Path $HomeDir '.claude\skills') }
        '--codex'     { $targets += (Join-Path $HomeDir '.codex\skills') }
        '--uninstall' { $uninstall = $true }
        '--dry-run'   { $dryRun = $true }
        '-h'          { Write-Output $Usage; exit 0 }
        '--help'      { Write-Output $Usage; exit 0 }
        default {
            if ($arg -like '-*') {
                Write-Error "未知选项 $arg"
                Write-Output $Usage
                exit 1
            }
            $wanted += $arg
        }
    }
}

# 没有指定目标时自动检测：哪个 agent 存在就安装到哪个
if ($targets.Count -eq 0) {
    foreach ($d in @('.claude', '.codex')) {
        if (Test-Path -LiteralPath (Join-Path $HomeDir $d)) {
            $targets += (Join-Path $HomeDir "$d\skills")
        }
    }
}
if ($targets.Count -eq 0) {
    Write-Error '没有找到 ~\.claude 或 ~\.codex，指定 --claude 或 --codex 试试'
    exit 1
}

# 没有指定 skill 时安装全部（必须具备 SKILL.md）
if ($wanted.Count -eq 0) {
    foreach ($d in Get-ChildItem -LiteralPath $SkillsDir -Directory) {
        if (Test-Path -LiteralPath (Join-Path $d.FullName 'SKILL.md')) { $wanted += $d.Name }
    }
}

foreach ($target in $targets) {
    if (-not (Test-Path -LiteralPath $target)) {
        if ($dryRun) { Write-Output "[dry-run] 将创建目录 $target" }
        else { New-Item -ItemType Directory -Path $target -Force | Out-Null }
    }
    foreach ($name in $wanted) {
        $src = Join-Path $SkillsDir $name
        $dst = Join-Path $target $name

        if (-not (Test-Path -LiteralPath (Join-Path $src 'SKILL.md'))) {
            Write-Error "✗ $name — 不是一个 skill（缺少 SKILL.md）"
            exit 1
        }

        if ($uninstall) {
            if (-not (Test-Path -LiteralPath $dst)) { continue }
            $item = Get-Item -LiteralPath $dst -Force
            if (Test-Link $item) {
                if ($dryRun) { Write-Output "[dry-run] − $dst" }
                else {
                    # 只删除联接本身；不使用 Remove-Item -Recurse，避免连结指向的内容被一并删除
                    [System.IO.Directory]::Delete($dst, $false)
                    Write-Output "− $dst"
                }
            }
            else {
                Write-Error "✗ $dst 不是联接，跳过"
            }
            continue
        }

        if (Test-Path -LiteralPath $dst) {
            $item = Get-Item -LiteralPath $dst -Force
            if (-not (Test-Link $item)) {
                Write-Error "✗ $dst 已存在且不是联接，跳过"
                continue
            }
            if (($item.Target -join '') -eq $src) {
                Write-Output "= $dst 已指向 $src"
                continue
            }
            if ($dryRun) { Write-Output "[dry-run] − $dst（指向别处，将重建）" }
            else { [System.IO.Directory]::Delete($dst, $false) }
        }

        if ($dryRun) { Write-Output "[dry-run] ✓ $dst → $src" }
        else {
            New-Item -ItemType Junction -Path $dst -Target $src | Out-Null
            Write-Output "✓ $dst → $src"
        }
    }
}
