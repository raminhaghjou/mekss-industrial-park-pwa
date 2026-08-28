param(
  [string]$BaseUrl = 'http://127.0.0.1:5173/api/v1'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$password = $env:MEKSS_SMOKE_PASSWORD
if ([string]::IsNullOrWhiteSpace($password)) {
  throw 'MEKSS_SMOKE_PASSWORD must be set in the current process.'
}

Add-Type -AssemblyName System.Net.Http
$handler = [System.Net.Http.HttpClientHandler]::new()
$handler.UseProxy = $false
$client = [System.Net.Http.HttpClient]::new($handler)
$client.Timeout = [TimeSpan]::FromSeconds(20)
$base = $BaseUrl.TrimEnd('/')
$assertions = 0

function Invoke-SmokeRequest {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Path,
    [string]$Token,
    [AllowNull()][object]$Body = $null
  )

  $request = [System.Net.Http.HttpRequestMessage]::new(
    [System.Net.Http.HttpMethod]::new($Method),
    "$base/$($Path.TrimStart('/'))"
  )
  try {
    if (-not [string]::IsNullOrWhiteSpace($Token)) {
      $request.Headers.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $Token)
    }
    if ($null -ne $Body) {
      $json = $Body | ConvertTo-Json -Depth 12 -Compress
      $request.Content = [System.Net.Http.StringContent]::new($json, [Text.Encoding]::UTF8, 'application/json')
    }

    $response = $client.SendAsync($request).GetAwaiter().GetResult()
    try {
      $content = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
      $data = $null
      if (-not [string]::IsNullOrWhiteSpace($content)) {
        try { $data = $content | ConvertFrom-Json } catch { $data = $content }
      }
      return [pscustomobject]@{
        Status = [int]$response.StatusCode
        Data = $data
      }
    }
    finally {
      $response.Dispose()
    }
  }
  finally {
    $request.Dispose()
  }
}

function Assert-Status {
  param([object]$Response, [int]$Expected, [string]$Label)
  if ($Response.Status -ne $Expected) {
    $detail = if ($Response.Data -is [string]) { $Response.Data } else { $Response.Data | ConvertTo-Json -Depth 5 -Compress }
    throw "$Label expected HTTP $Expected but received $($Response.Status): $detail"
  }
  $script:assertions++
  Write-Output "PASS [$Expected] $Label"
}

function Assert-That {
  param([bool]$Condition, [string]$Label)
  if (-not $Condition) { throw "Assertion failed: $Label" }
  $script:assertions++
  Write-Output "PASS       $Label"
}

$accounts = @(
  @{ Role = 'SUPER_ADMIN'; Phone = '09120000000' },
  @{ Role = 'PARK_MANAGER'; Phone = '09120000001' },
  @{ Role = 'FACTORY_OWNER'; Phone = '09120000002' },
  @{ Role = 'SECURITY_GUARD'; Phone = '09120000003' },
  @{ Role = 'GOVERNMENT_OFFICIAL'; Phone = '09120000004' }
)
$logins = @{}
$createdUserId = $null
$createdParkId = $null
$createdAnnouncementId = $null
$createdAdvertisementId = $null
$failure = $null

try {
  foreach ($account in $accounts) {
    $login = Invoke-SmokeRequest -Method POST -Path 'auth/login' -Body @{
      phoneNumber = $account.Phone
      password = $password
    }
    Assert-Status $login 200 "login $($account.Role)"
    Assert-That ($login.Data.user.role -eq $account.Role) "login role matches $($account.Role)"
    Assert-That (-not [string]::IsNullOrWhiteSpace([string]$login.Data.accessToken)) "access token issued for $($account.Role)"
    $logins[$account.Role] = $login.Data
  }

  $adminToken = [string]$logins['SUPER_ADMIN'].accessToken
  $managerToken = [string]$logins['PARK_MANAGER'].accessToken
  $ownerToken = [string]$logins['FACTORY_OWNER'].accessToken
  $guardToken = [string]$logins['SECURITY_GUARD'].accessToken
  $officialToken = [string]$logins['GOVERNMENT_OFFICIAL'].accessToken

  Assert-Status (Invoke-SmokeRequest -Method GET -Path 'users?page=1&pageSize=5' -Token $adminToken) 200 'SUPER_ADMIN can list users'
  Assert-Status (Invoke-SmokeRequest -Method GET -Path 'users?page=1&pageSize=5' -Token 'invalid-smoke-token') 401 'invalid token is rejected'
  Assert-Status (Invoke-SmokeRequest -Method GET -Path 'announcements/managed' -Token $managerToken) 200 'PARK_MANAGER can list managed announcements'
  Assert-Status (Invoke-SmokeRequest -Method GET -Path 'users?page=1&pageSize=5' -Token $managerToken) 403 'PARK_MANAGER cannot list users'
  Assert-Status (Invoke-SmokeRequest -Method GET -Path 'invoices' -Token $ownerToken) 200 'FACTORY_OWNER can list invoices'
  Assert-Status (Invoke-SmokeRequest -Method GET -Path 'reports?type=requests' -Token $ownerToken) 403 'FACTORY_OWNER cannot read reports'
  Assert-Status (Invoke-SmokeRequest -Method GET -Path 'gate-passes' -Token $guardToken) 200 'SECURITY_GUARD can list gate passes'
  Assert-Status (Invoke-SmokeRequest -Method GET -Path 'invoices' -Token $guardToken) 403 'SECURITY_GUARD cannot list invoices'
  Assert-Status (Invoke-SmokeRequest -Method GET -Path 'reports?type=requests' -Token $officialToken) 200 'GOVERNMENT_OFFICIAL can read reports'
  Assert-Status (Invoke-SmokeRequest -Method GET -Path 'announcements/managed' -Token $officialToken) 403 'GOVERNMENT_OFFICIAL cannot manage announcements'

  $suffix = ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() % 1000000000).ToString('D9')
  $testPhone = "09$suffix"
  $createUser = Invoke-SmokeRequest -Method POST -Path 'users' -Token $adminToken -Body @{
    phoneNumber = $testPhone
    name = 'Smoke User'
    password = $password
    role = 'EMPLOYEE'
    isApproved = $true
  }
  Assert-Status $createUser 201 'create managed user'
  $createdUserId = [string]$createUser.Data.id
  Assert-That (-not [string]::IsNullOrWhiteSpace($createdUserId)) 'created user returns id'
  Assert-That (-not ($createUser.Data.PSObject.Properties.Name -contains 'password')) 'managed user response excludes password'

  $updateUser = Invoke-SmokeRequest -Method PATCH -Path "users/$createdUserId" -Token $adminToken -Body @{ name = 'Updated Smoke User' }
  Assert-Status $updateUser 200 'update managed user'
  Assert-That ($updateUser.Data.name -eq 'Updated Smoke User') 'managed user update persisted'

  $deactivateUser = Invoke-SmokeRequest -Method POST -Path "users/$createdUserId/deactivate" -Token $adminToken
  Assert-Status $deactivateUser 201 'deactivate managed user'
  Assert-That ($deactivateUser.Data.isActive -eq $false) 'managed user is inactive'

  $resetUser = Invoke-SmokeRequest -Method POST -Path "users/$createdUserId/reset-password" -Token $adminToken -Body @{ newPassword = $password }
  Assert-Status $resetUser 201 'reset managed user password'
  Assert-That ($resetUser.Data.mustChangePassword -eq $true) 'password reset requires change'

  $activateUser = Invoke-SmokeRequest -Method POST -Path "users/$createdUserId/activate" -Token $adminToken
  Assert-Status $activateUser 201 'activate managed user'
  Assert-That ($activateUser.Data.isActive -eq $true) 'managed user is active'

  $deleteUser = Invoke-SmokeRequest -Method DELETE -Path "users/$createdUserId" -Token $adminToken
  Assert-Status $deleteUser 200 'delete managed user'
  Assert-That ($deleteUser.Data.deleted -eq $true) 'managed user deletion confirmed'
  Assert-Status (Invoke-SmokeRequest -Method GET -Path "users/$createdUserId" -Token $adminToken) 404 'deleted user is absent'
  $createdUserId = $null

  $parkCode = "SMOKE-$suffix"
  $createPark = Invoke-SmokeRequest -Method POST -Path 'industrial-parks' -Token $adminToken -Body @{
    code = $parkCode
    name = 'Smoke Industrial Park'
    province = 'Tehran'
    city = 'Tehran'
    address = 'Smoke test address'
    phoneNumber = '02112345678'
    guardPhone = '02187654321'
    totalArea = 1000
    status = 'ACTIVE'
  }
  Assert-Status $createPark 201 'create industrial park'
  $createdParkId = [string]$createPark.Data.id
  Assert-That (-not [string]::IsNullOrWhiteSpace($createdParkId)) 'created park returns id'
  Assert-Status (Invoke-SmokeRequest -Method GET -Path "industrial-parks/$createdParkId" -Token $adminToken) 200 'read industrial park'

  $updatePark = Invoke-SmokeRequest -Method PUT -Path "industrial-parks/$createdParkId" -Token $adminToken -Body @{ name = 'Updated Smoke Industrial Park'; totalArea = 1200 }
  Assert-Status $updatePark 200 'update industrial park'
  Assert-That ($updatePark.Data.name -eq 'Updated Smoke Industrial Park') 'industrial park update persisted'

  $deletePark = Invoke-SmokeRequest -Method DELETE -Path "industrial-parks/$createdParkId" -Token $adminToken
  Assert-Status $deletePark 200 'delete industrial park'
  Assert-That ($deletePark.Data.deleted -eq $true) 'industrial park deletion confirmed'
  Assert-Status (Invoke-SmokeRequest -Method GET -Path "industrial-parks/$createdParkId" -Token $adminToken) 404 'deleted industrial park is absent'
  $createdParkId = $null

  $createAnnouncement = Invoke-SmokeRequest -Method POST -Path 'announcements' -Token $adminToken -Body @{
    title = "Smoke announcement $suffix"
    content = 'Created by the production API smoke test.'
    isGlobal = $true
    isPinned = $false
    priority = 1
  }
  Assert-Status $createAnnouncement 201 'create announcement'
  $createdAnnouncementId = [string]$createAnnouncement.Data.id
  Assert-That (-not [string]::IsNullOrWhiteSpace($createdAnnouncementId)) 'created announcement returns id'

  $managedAnnouncements = Invoke-SmokeRequest -Method GET -Path 'announcements/managed' -Token $adminToken
  Assert-Status $managedAnnouncements 200 'list managed announcements'
  Assert-That (@($managedAnnouncements.Data | Where-Object { $_.id -eq $createdAnnouncementId }).Count -eq 1) 'created announcement appears in managed list'

  $updateAnnouncement = Invoke-SmokeRequest -Method PUT -Path "announcements/$createdAnnouncementId" -Token $adminToken -Body @{ title = "Updated smoke announcement $suffix"; priority = 2 }
  Assert-Status $updateAnnouncement 200 'update announcement'
  Assert-That ($updateAnnouncement.Data.priority -eq 2) 'announcement update persisted'

  $deleteAnnouncement = Invoke-SmokeRequest -Method DELETE -Path "announcements/$createdAnnouncementId" -Token $adminToken
  Assert-Status $deleteAnnouncement 200 'delete announcement'
  Assert-That ($deleteAnnouncement.Data.deleted -eq $true) 'announcement deletion confirmed'
  $createdAnnouncementId = $null

  $creationScope = Invoke-SmokeRequest -Method GET -Path 'advertisements/creation-scope' -Token $ownerToken
  Assert-Status $creationScope 200 'FACTORY_OWNER reads authoritative advertisement creation scope'
  Assert-That ($creationScope.Data.canCreate -eq $true) 'factory owner has an active advertisement scope'
  Assert-That (@($creationScope.Data.parks).Count -ge 1) 'creation scope returns durable parks'

  $createAdvertisement = Invoke-SmokeRequest -Method POST -Path 'advertisements' -Token $ownerToken -Body @{
    title = "Smoke advertisement $suffix"
    category = 'OTHER'
    province = 'Tehran'
    city = 'Tehran'
    content = 'Created by the production API smoke test.'
    contactInfo = @{ phoneNumber = '09120000002' }
    images = @()
  }
  Assert-Status $createAdvertisement 201 'FACTORY_OWNER creates advertisement'
  $createdAdvertisementId = [string]$createAdvertisement.Data.id
  Assert-That ($createAdvertisement.Data.category.key -eq 'OTHER') 'advertisement resolves category relation'
  Assert-That ($createAdvertisement.Data.status -eq 'PENDING') 'new advertisement is pending'
  Assert-That (-not [string]::IsNullOrWhiteSpace([string]$createAdvertisement.Data.park.id)) 'advertisement stores derived park scope'
  if (-not [string]::IsNullOrWhiteSpace([string]$creationScope.Data.autoSelectedParkId)) {
    Assert-That ($createAdvertisement.Data.park.id -eq $creationScope.Data.autoSelectedParkId) 'single creation scope is selected authoritatively'
  }

  $pendingPage = Invoke-SmokeRequest -Method GET -Path 'advertisements/managed?view=PENDING&page=1&pageSize=100' -Token $adminToken
  Assert-Status $pendingPage 200 'SUPER_ADMIN reads paginated pending advertisements'
  Assert-That (@($pendingPage.Data.items | Where-Object { $_.id -eq $createdAdvertisementId }).Count -eq 1) 'created advertisement appears in managed pending page'
  $pendingForManager = Invoke-SmokeRequest -Method GET -Path 'advertisements/managed/pending' -Token $managerToken
  Assert-Status $pendingForManager 200 'PARK_MANAGER reads scoped pending advertisements'
  Assert-That (@($pendingForManager.Data | Where-Object { $_.id -eq $createdAdvertisementId }).Count -eq 1) 'owner advertisement is visible to its park manager'
  $pendingDetail = Invoke-SmokeRequest -Method GET -Path "advertisements/managed/$createdAdvertisementId" -Token $adminToken
  Assert-Status $pendingDetail 200 'SUPER_ADMIN reads managed advertisement detail'
  Assert-That ($pendingDetail.Data.contactInfo.phoneNumber -eq '09120000002') 'managed detail returns allowlisted contact metadata'

  $blankRejection = Invoke-SmokeRequest -Method POST -Path "advertisements/$createdAdvertisementId/approve" -Token $adminToken -Body @{
    approved = $false
    rejectionReason = '   '
  }
  Assert-Status $blankRejection 400 'blank advertisement rejection is non-mutating'

  $rejectAdvertisement = Invoke-SmokeRequest -Method POST -Path "advertisements/$createdAdvertisementId/approve" -Token $adminToken -Body @{
    approved = $false
    rejectionReason = '  Smoke moderation rejection  '
  }
  Assert-Status $rejectAdvertisement 201 'SUPER_ADMIN rejects advertisement'
  Assert-That ($rejectAdvertisement.Data.status -eq 'REJECTED') 'advertisement rejection persisted'
  Assert-That ($rejectAdvertisement.Data.isApproved -eq $false) 'rejected advertisement is not approved'
  Assert-That ($rejectAdvertisement.Data.rejectionReason -eq 'Smoke moderation rejection') 'advertisement rejection reason is trimmed'
  Assert-That (-not [string]::IsNullOrWhiteSpace([string]$rejectAdvertisement.Data.moderatedAt)) 'advertisement moderation timestamp recorded'
  Assert-That (-not [string]::IsNullOrWhiteSpace([string]$rejectAdvertisement.Data.moderatedBy.id)) 'advertisement moderator recorded'

  $duplicateDecision = Invoke-SmokeRequest -Method POST -Path "advertisements/$createdAdvertisementId/approve" -Token $adminToken -Body @{ approved = $true }
  Assert-Status $duplicateDecision 409 'duplicate advertisement moderation conflicts'

  $historyPage = Invoke-SmokeRequest -Method GET -Path 'advertisements/managed?view=HISTORY&status=REJECTED&page=1&pageSize=100' -Token $adminToken
  Assert-Status $historyPage 200 'read paginated advertisement moderation history'
  $historyItem = @($historyPage.Data.items | Where-Object { $_.id -eq $createdAdvertisementId })
  Assert-That ($historyItem.Count -eq 1) 'rejected advertisement appears in paginated history'
  Assert-That ($historyItem[0].rejectionReason -eq 'Smoke moderation rejection') 'history preserves canonical rejection metadata'
  Assert-That (-not [string]::IsNullOrWhiteSpace([string]$historyItem[0].moderatedBy.id)) 'history preserves moderator metadata'

  $historyDetail = Invoke-SmokeRequest -Method GET -Path "advertisements/managed/$createdAdvertisementId" -Token $adminToken
  Assert-Status $historyDetail 200 'read canonical post-moderation detail'
  Assert-That ($historyDetail.Data.status -eq 'REJECTED') 'detail re-read returns server-authoritative terminal state'

  $history = Invoke-SmokeRequest -Method GET -Path 'advertisements/managed/history' -Token $adminToken
  Assert-Status $history 200 'legacy advertisement history remains compatible'
  Assert-That (@($history.Data | Where-Object { $_.id -eq $createdAdvertisementId }).Count -eq 1) 'rejected advertisement appears in legacy history'
  Assert-Status (Invoke-SmokeRequest -Method GET -Path 'advertisements') 200 'public approved advertisement read remains unauthenticated'

  Write-Output "SMOKE COMPLETE: $assertions assertions passed; advertisement $createdAdvertisementId intentionally retained as moderation history."
}
catch {
  $failure = $_
}
finally {
  if ($logins.ContainsKey('SUPER_ADMIN')) {
    $adminToken = [string]$logins['SUPER_ADMIN'].accessToken
    foreach ($cleanup in @(
      @{ Kind = 'announcement'; Id = $createdAnnouncementId; Path = 'announcements' },
      @{ Kind = 'park'; Id = $createdParkId; Path = 'industrial-parks' },
      @{ Kind = 'user'; Id = $createdUserId; Path = 'users' }
    )) {
      if (-not [string]::IsNullOrWhiteSpace([string]$cleanup.Id)) {
        $cleanupResponse = Invoke-SmokeRequest -Method DELETE -Path "$($cleanup.Path)/$($cleanup.Id)" -Token $adminToken
        Write-Output "CLEANUP [$($cleanupResponse.Status)] $($cleanup.Kind)"
      }
    }
  }

  foreach ($role in @($logins.Keys)) {
    $session = $logins[$role]
    $logout = Invoke-SmokeRequest -Method POST -Path 'auth/logout' -Token ([string]$session.accessToken) -Body @{ refreshToken = [string]$session.refreshToken }
    Write-Output "SESSION [$($logout.Status)] logout $role"
  }

  $client.Dispose()
  $handler.Dispose()
}

if ($null -ne $failure) { throw $failure }
