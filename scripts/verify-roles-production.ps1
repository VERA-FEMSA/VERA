# Lecturas de aceptación de los cinco roles de VERA en Production.
# Pide una contraseña de forma oculta; no guarda credenciales, tokens ni respuestas.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$baseUrl = 'https://www.vera-digital-systems.com'
$accounts = @(
  @{ Prefix = 'admin'; Role = 'SUPER_ADMIN'; CanListUsers = $true },
  @{ Prefix = 'director'; Role = 'DIRECTOR'; CanListUsers = $true },
  @{ Prefix = 'gerente'; Role = 'GERENTE'; CanListUsers = $false },
  @{ Prefix = 'jefatura'; Role = 'JEFATURA'; CanListUsers = $false },
  @{ Prefix = 'auditor'; Role = 'AUDITOR'; CanListUsers = $false }
)

function Invoke-Vera {
  param([string]$Path, [string]$Method = 'GET', [object]$Body = $null, [string]$Token = '')
  $options = @{ Uri = "$baseUrl$Path"; Method = $Method; TimeoutSec = 30; SkipHttpErrorCheck = $true }
  if ($Token) { $options.Headers = @{ Authorization = "Bearer $Token" } }
  if ($null -ne $Body) {
    $options.ContentType = 'application/json; charset=utf-8'
    $options.Body = ConvertTo-Json -InputObject $Body -Compress -Depth 5
  }
  $response = Invoke-WebRequest @options
  $data = if ($response.Content -and $response.Headers['Content-Type'] -match 'application/json') {
    ConvertFrom-Json -InputObject $response.Content -AsHashtable
  } else { @{} }
  return @{ Status = [int]$response.StatusCode; Data = $data }
}

$secure = Read-Host -Prompt 'Contraseña común de las cinco cuentas (oculta)' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer); $secure.Dispose() }
if ([string]::IsNullOrEmpty($password)) { throw 'No se introdujo una contraseña.' }

$failed = 0
$managerActionId = $null
try {
  foreach ($account in $accounts) {
    $username = "$($account.Prefix)@vera-digital-systems.com"
    try {
      $login = Invoke-Vera -Method POST -Path '/api/auth/login' -Body @{ username = $username; password = $password }
      if ($login.Status -ne 200) { throw "login HTTP $($login.Status)" }
      if ($login.Data.ContainsKey('requires2FA') -or $login.Data.ContainsKey('requiresMfaSetup')) {
        throw 'la cuenta requiere un paso de autenticación adicional'
      }
      if (-not $login.Data.ContainsKey('token') -or -not $login.Data.ContainsKey('user')) {
        throw 'la sesión no devolvió token y perfil'
      }
      if ($login.Data.user.role -ne $account.Role) { throw "rol inesperado: $($login.Data.user.role)" }
      $token = [string]$login.Data.token
      $dashboard = Invoke-Vera -Path '/api/dashboard' -Token $token
      $actions = Invoke-Vera -Path '/api/actions' -Token $token
      $sources = Invoke-Vera -Path '/api/actions/sources' -Token $token
      $offset = [int][DateTimeOffset]::Now.Offset.TotalMinutes * -1
      $notifications = Invoke-Vera -Path "/api/notifications?offsetMinutes=$offset" -Token $token
      $assistant = Invoke-Vera -Path '/api/assistant/status' -Token $token
      $brief = Invoke-Vera -Path '/api/assistant/brief' -Token $token
      $users = Invoke-Vera -Path '/api/users' -Token $token

      foreach ($check in @(@('panel', $dashboard), @('acciones', $actions), @('orígenes', $sources), @('avisos', $notifications),
          @('IA', $assistant), @('prioridades', $brief))) {
        if ($check[1].Status -ne 200) { throw "$($check[0]) HTTP $($check[1].Status)" }
      }
      $expectedUsersStatus = if ($account.CanListUsers) { 200 } else { 403 }
      if ($users.Status -ne $expectedUsersStatus) { throw "permisos de usuarios HTTP $($users.Status); esperado $expectedUsersStatus" }
      if ($assistant.Data.available -ne $true) { throw 'la IA indicó available=false' }
      if ($brief.Data.role -ne $account.Role) { throw 'las prioridades usaron otro rol' }
      if ($notifications.Data.actionAlertsAvailable -ne $true) { throw 'los avisos de acciones no están disponibles' }
      if ($notifications.Data.persisted -ne $true) { throw 'la lectura de avisos no usa almacén persistente' }

      $visibleActions = @($actions.Data.actions)
      $visibleSources = @($sources.Data.sources)
      $alerts = @($notifications.Data.notifications | Where-Object { $_.type -like 'ACTION_*' })
      if ($account.Role -eq 'GERENTE') {
        $recorded = $visibleActions | Where-Object { $_.title -eq 'Verificación temporal del flujo de avisos' } |
          Select-Object -First 1
        if ($recorded) { $managerActionId = [string]$recorded.id }
      }
      if ($account.Role -eq 'AUDITOR' -and $managerActionId) {
        $foreign = Invoke-Vera -Path "/api/actions/$managerActionId" -Token $token
        $foreignAlert = @($alerts | Where-Object { $_.entityId -eq $managerActionId }).Count -gt 0
        if ($foreign.Status -ne 404 -or $foreignAlert) {
          throw 'la cuenta Auditor pudo ver una acción ajena'
        }
        Write-Host 'PASS AUDITOR     acción ajena oculta por la API (HTTP 404)'
      }
      foreach ($alert in $alerts) {
        $action = $visibleActions | Where-Object { $_.id -eq $alert.entityId } | Select-Object -First 1
        if (-not $action -or $action.assigneeId -ne $login.Data.user.id -or
            $action.status -notin @('OPEN', 'IN_PROGRESS') -or
            $alert.path -ne "/notificaciones?actionId=$([uri]::EscapeDataString($alert.entityId))") {
          throw 'un aviso de acción no corresponde a una acción activa y asignada visible'
        }
      }
      Write-Host ("PASS {0,-11} panel/acciones/avisos/IA/roles | orígenes={1}; acciones={2}; avisosAcción={3}" -f
        $account.Role, $visibleSources.Count, $visibleActions.Count, $alerts.Count)
    } catch {
      $failed++
      Write-Host ("FAIL {0,-11} {1}" -f $account.Role, $_.Exception.Message)
    } finally {
      $token = $null
      $login = $null
    }
  }
} finally { $password = $null }

if ($failed -gt 0) { exit 1 }
Write-Host 'PASS Aceptación de lectura para cinco roles; sin escrituras ni respuestas privadas guardadas.'
