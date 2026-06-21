param(
    [string]$ErrorWebhookUrl,
    [string]$EventWebhookUrl
)

if ([string]::IsNullOrWhiteSpace($ErrorWebhookUrl)) {
    $ErrorWebhookUrl = "https://discord.com/api/webhooks/1517953901964558387/pLtPZUL1mMVKzlXOQUpyP1OTj9S7LNZRfYm0ixlFeisG1_rOXOnjPaieL-msukxef_kd"
}
if ([string]::IsNullOrWhiteSpace($EventWebhookUrl)) {
    $EventWebhookUrl = "https://discord.com/api/webhooks/1517957654738112750/Om7ApikcJXD2No_zRvvM397z_AwpRuOGWRgm62QJThUWw7V4uUGTd2LYP1OBZYIpmWwQ"
}

$ErrorWebhookUrl = $ErrorWebhookUrl.Trim('"', "'", ' ')
$EventWebhookUrl = $EventWebhookUrl.Trim('"', "'", ' ')

function Send-DiscordText {
    param($Url, $Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return }
    $safe = $Text -replace '@everyone', '@[everyone]' -replace '@here', '@[here]'
    if ($safe.Length -gt 1900) { $safe = $safe.Substring(0, 1900) + [char]0x2026 }
    $body = @{ content = $safe } | ConvertTo-Json -Compress
    try { Invoke-RestMethod -Uri $Url -Method Post -ContentType "application/json" -Body $body -ErrorAction Stop | Out-Null } catch {}
}

Write-Host "========================================"
Write-Host " Windows System Event Log -> Discord"
Write-Host " Started at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host " Errors/Warnings -> errors channel"
Write-Host " Info            -> events channel"
Write-Host "========================================"

function Send-EventEmbed {
    param($Url, $Rec)
    $t = $Rec.TimeCreated.ToString("yyyy-MM-dd HH:mm:ss")
    $l = $Rec.LevelDisplayName
    $c = switch ($l) { "Error" { 15158332 } "Warning" { 15844367 } "Information" { 3447003 } default { 10197915 } }
    $m = $Rec.Message
    if ($m) { $m = $m -replace "`r`n"," " -replace "`n"," " -replace "`r"," "; if ($m.Length -gt 950) { $m = $m.Substring(0,950) + [char]0x2026 } } else { $m = "(no message)" }
    $fields = @(
        @{name="Timestamp"; value=$t; inline=$true}
        @{name="Level"; value=$l; inline=$true}
        @{name="Event ID"; value="$($Rec.Id)"; inline=$true}
        @{name="Source"; value=$Rec.ProviderName; inline=$true}
        @{name="Message"; value="``````ansi`n$m``````"; inline=$false}
    )
    $embed = @{color=$c; fields=$fields; footer=@{text="Windows System Event Log"}; timestamp=(Get-Date).ToString("o")}
    $body = @{embeds=@($embed)} | ConvertTo-Json -Compress -Depth 4
    try { Invoke-RestMethod -Uri $Url -Method Post -ContentType "application/json" -Body $body -ErrorAction Stop | Out-Null } catch {}
}

$recent = Get-WinEvent -LogName System -MaxEvents 25
$recent | Where-Object { $_.Level -le 3 } | Sort-Object TimeCreated | ForEach-Object {
    Start-Sleep -Milliseconds 600
    Send-EventEmbed -Url $ErrorWebhookUrl -Rec $_
}
$recent | Where-Object { $_.Level -gt 3 } | Sort-Object TimeCreated | ForEach-Object {
    Start-Sleep -Milliseconds 600
    Send-EventEmbed -Url $EventWebhookUrl -Rec $_
}

Send-DiscordText -Url $ErrorWebhookUrl -Text "**Now monitoring for new Errors/Warnings...**"
Send-DiscordText -Url $EventWebhookUrl -Text "**Now monitoring for new Events...**"

$query = New-Object System.Diagnostics.Eventing.Reader.EventLogQuery "System", ([System.Diagnostics.Eventing.Reader.PathType]::LogName)
$watcher = New-Object System.Diagnostics.Eventing.Reader.EventLogWatcher $query

$action = {
    try {
        $rec = $EventArgs.EventRecord
        if (-not $rec) { return }

        $time = $rec.TimeCreated.ToString("yyyy-MM-dd HH:mm:ss")
        $id = $rec.Id
        $levelName = $rec.LevelDisplayName
        $src = $rec.ProviderName
        $msg = $rec.Message
        if ($msg) {
            $msg = $msg -replace "`r`n", " " -replace "`n", " " -replace "`r", " "
            if ($msg.Length -gt 950) { $msg = $msg.Substring(0, 950) + [char]0x2026 }
        } else {
            $msg = "(no message)"
        }

        $color = switch ($levelName) {
            "Error"       { 15158332 }
            "Warning"     { 15844367 }
            "Information" { 3447003 }
            default       { 10197915 }
        }

        $fields = @(
            @{ name = "Timestamp"; value = $time; inline = $true }
            @{ name = "Level"; value = $levelName; inline = $true }
            @{ name = "Event ID"; value = "$id"; inline = $true }
            @{ name = "Source"; value = $src; inline = $true }
            @{ name = "Message"; value = "``````ansi`n$msg``````"; inline = $false }
        )

        $embed = @{
            color  = $color
            fields = $fields
            footer = @{ text = "Windows System Event Log" }
            timestamp = (Get-Date).ToString("o")
        }
        $embedBody = @{ embeds = @($embed) } | ConvertTo-Json -Compress -Depth 4

        $eUrl = $using:ErrorWebhookUrl
        $iUrl = $using:EventWebhookUrl
        $targetUrl = if ($rec.Level -le 3) { $eUrl } else { $iUrl }
        try { Invoke-RestMethod -Uri $targetUrl -Method Post -ContentType "application/json" -Body $embedBody -ErrorAction Stop | Out-Null } catch {}
    } catch {
        Write-Host "[!] Event error: $_"
    }
}

Register-ObjectEvent -InputObject $watcher -EventName "EventRecordWritten" -Action $action -SourceIdentifier "SysLog2Discord" | Out-Null
$watcher.Enabled = $true

Write-Host "[+] Monitoring live. Press Ctrl+C to stop."

try {
    while ($true) { Start-Sleep -Seconds 30 }
} finally {
    $watcher.Enabled = $false
    $watcher.Dispose()
    Unregister-Event -SourceIdentifier "SysLog2Discord" -Force -ErrorAction SilentlyContinue
    Write-Host "[-] Monitor stopped."
}
