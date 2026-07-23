$ErrorActionPreference = 'Stop'

function Score($v) {
  if ($null -eq $v) { return 0 }
  return [math]::Round([double]$v * 100)
}

$base = 'https://teacher-website--educonnect-60b69.europe-west4.hosted.app'
$desktopDir = '.\lh-all\desktop'
$mobileDir = '.\lh-all\mobile'

New-Item -ItemType Directory -Force -Path $desktopDir | Out-Null
New-Item -ItemType Directory -Force -Path $mobileDir | Out-Null

if (-not (Test-Path '.\lh-all\routes.txt')) {
  throw 'Missing .\\lh-all\\routes.txt. Generate routes first.'
}

$routes = Get-Content '.\lh-all\routes.txt' | Where-Object { $_ -and $_.Trim().Length -gt 0 }

foreach ($route in $routes) {
  $slug = if ($route -eq '/') { 'root' } else { ($route.TrimStart('/') -replace '/', '__') }
  $url = "$base$route"

  $desktopPath = Join-Path $desktopDir $slug
  $mobilePath = Join-Path $mobileDir $slug

  if (-not (Test-Path $desktopPath)) {
    Write-Host "Desktop $url"
    npx --yes lighthouse "$url" --preset=desktop --chrome-flags="--headless=new --no-sandbox" --no-enable-error-reporting --quiet --output=json --output-path="$desktopPath" | Out-Null
  }

  if (-not (Test-Path $mobilePath)) {
    Write-Host "Mobile  $url"
    npx --yes lighthouse "$url" --emulated-form-factor=mobile --chrome-flags="--headless=new --no-sandbox" --no-enable-error-reporting --quiet --output=json --output-path="$mobilePath" | Out-Null
  }
}

$results = @()
foreach ($route in $routes) {
  $slug = if ($route -eq '/') { 'root' } else { ($route.TrimStart('/') -replace '/', '__') }

  $d = Get-Content (Join-Path $desktopDir $slug) -Raw | ConvertFrom-Json
  $m = Get-Content (Join-Path $mobileDir $slug) -Raw | ConvertFrom-Json

  $results += [pscustomobject]@{
    route = $route
    desktopPerformance = Score $d.categories.performance.score
    desktopAccessibility = Score $d.categories.accessibility.score
    desktopBestPractices = Score $d.categories.'best-practices'.score
    desktopSEO = Score $d.categories.seo.score
    mobilePerformance = Score $m.categories.performance.score
    mobileAccessibility = Score $m.categories.accessibility.score
    mobileBestPractices = Score $m.categories.'best-practices'.score
    mobileSEO = Score $m.categories.seo.score
  }
}

$results | Sort-Object route | ConvertTo-Json -Depth 3 | Set-Content '.\lh-all\summary.json'
$results | Sort-Object route | Export-Csv '.\lh-all\summary.csv' -NoTypeInformation
$results | Sort-Object route | Format-Table -AutoSize
