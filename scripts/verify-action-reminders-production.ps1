# Aceptación controlada del ciclo acción → aviso → lectura → cierre en la demo de Production.
# Crea una acción sintética y la deja terminada en la bitácora; no elimina datos.
param([switch]$Run)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
if (-not $Run) { throw 'Esta comprobación escribe una acción sintética en Production. Ejecuta con -Run conscientemente.' }

$baseUrl = 'https://www.vera-digital-systems.com'
$username = 'gerente@vera-digital-systems.com'
function Invoke-Vera {
  param([string]$Path, [string]$Method = 'GET', [object]$Body = $null, [string]$Token = '')
  $options = @{ Uri = "$baseUrl$Path"; Method = $Method; TimeoutSec = 30; SkipHttpErrorCheck = $true }
  if ($Token) { $options.Headers = @{ Authorization = "Bearer $Token" } }
  if ($null -ne $Body) {
    $options.ContentType = 'application/json; charset=utf-8'
    $options.Body = ConvertTo-Json -InputObject $Body -Depth 5 -Compress
  }
  $watch = [Diagnostics.Stopwatch]::StartNew()
  $response = Invoke-WebRequest @options
  $watch.Stop()
  $data = if ($response.Content -and $response.Headers['Content-Type'] -match 'application/json') {
    ConvertFrom-Json -InputObject $response.Content -AsHashtable
  } else { @{} }
  return @{ Status = [int]$response.StatusCode; Data = $data; DurationMs = [int]$watch.ElapsedMilliseconds }
}
function Require-Status {
  param([hashtable]$Result, [int]$Expected, [string]$Step)
  if ($Result.Status -ne $Expected) { throw "$Step devolvió HTTP $($Result.Status); se esperaba $Expected." }
}

$secure = Read-Host -Prompt 'Contraseña de la cuenta Gerente (oculta)' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer); $secure.Dispose() }
$actionId = $null
$token = $null
$failed = $false
try {
  if ([string]::IsNullOrEmpty($password)) { throw 'No se introdujo una contraseña.' }
  $login = Invoke-Vera -Method POST -Path '/api/auth/login' -Body @{ username = $username; password = $password }
  Require-Status $login 200 'Inicio de sesión'
  if (-not $login.Data.ContainsKey('token') -or $login.Data.user.role -ne 'GERENTE') {
    throw 'La cuenta no devolvió una sesión de Gerente sin pasos adicionales.'
  }
  $token = [string]$login.Data.token
  Write-Host ("PASS Sesión Gerente | {0} ms" -f $login.DurationMs)

  $sources = Invoke-Vera -Path '/api/actions/sources' -Token $token
  Require-Status $sources 200 'Orígenes visibles'
  $source = @($sources.Data.sources) | Select-Object -First 1
  if (-not $source) { throw 'No hay un registro de demostración visible para vincular la acción.' }
  $assignees = Invoke-Vera -Path "/api/actions/assignees?sourceType=$($source.sourceType)&sourceId=$([uri]::EscapeDataString($source.sourceId))" -Token $token
  Require-Status $assignees 200 'Responsables autorizados'
  $self = @($assignees.Data.assignees) | Where-Object { $_.id -eq $login.Data.user.id } | Select-Object -First 1
  if (-not $self) { throw 'La cuenta Gerente no puede asignarse una acción en el registro visible.' }

  $dueDate = (Get-Date).AddDays(1).ToString('yyyy-MM-dd')
  $created = Invoke-Vera -Method POST -Path '/api/actions' -Token $token -Body @{
    sourceType = $source.sourceType; sourceId = $source.sourceId; assigneeId = $self.id;
    dueDate = $dueDate; title = 'Verificación temporal del flujo de avisos';
    rationale = 'Comprobación autorizada de persistencia y lectura de avisos en la demo.'
  }
  Require-Status $created 201 'Registro de acción'
  $actionId = [string]$created.Data.action.id
  if (-not $actionId) { throw 'La acción no devolvió identificador.' }
  Write-Host ("PASS Acción sintética registrada | {0} ms" -f $created.DurationMs)

  $offset = [int][DateTimeOffset]::Now.Offset.TotalMinutes * -1
  $inbox = Invoke-Vera -Path "/api/notifications?offsetMinutes=$offset" -Token $token
  Require-Status $inbox 200 'Bandeja'
  if ($inbox.Data.actionAlertsAvailable -ne $true -or $inbox.Data.persisted -ne $true) {
    throw 'Los avisos de acciones o su almacén persistente no están disponibles.'
  }
  $alert = @($inbox.Data.notifications) | Where-Object { $_.id -eq "ACTION_DUE_SOON:$actionId" } | Select-Object -First 1
  if (-not $alert -or $alert.readAt -or $alert.path -ne "/notificaciones?actionId=$actionId") {
    throw 'No apareció el aviso nuevo sin leer con enlace a la acción.'
  }
  Write-Host ("PASS Aviso próximo sin leer y enlace correcto | {0} ms" -f $inbox.DurationMs)

  $encodedAlert = [uri]::EscapeDataString($alert.id)
  $read = Invoke-Vera -Method PUT -Path "/api/notifications/$encodedAlert/read?offsetMinutes=$offset" -Token $token
  Require-Status $read 200 'Marcar aviso leído'
  if (-not $read.Data.readAt) { throw 'La operación de lectura no devolvió fecha.' }
  $secondLogin = Invoke-Vera -Method POST -Path '/api/auth/login' -Body @{ username = $username; password = $password }
  Require-Status $secondLogin 200 'Segunda sesión'
  $secondToken = [string]$secondLogin.Data.token
  if (-not $secondToken) { throw 'La segunda sesión no devolvió token.' }
  $again = Invoke-Vera -Path "/api/notifications?offsetMinutes=$offset" -Token $secondToken
  Require-Status $again 200 'Avisos en segunda sesión'
  $sameAlert = @($again.Data.notifications) | Where-Object { $_.id -eq $alert.id } | Select-Object -First 1
  if (-not $sameAlert -or $sameAlert.readAt -ne $read.Data.readAt) {
    throw 'La marca de lectura no persistió entre sesiones.'
  }
  Write-Host ("PASS Lectura persistente en segunda sesión | {0} ms" -f $again.DurationMs)
  $secondToken = $null

  $current = Invoke-Vera -Path "/api/actions/$actionId" -Token $token
  Require-Status $current 200 'Lectura de acción'
  $done = Invoke-Vera -Method PATCH -Path "/api/actions/$actionId/status" -Token $token -Body @{
    version = $current.Data.action.storageVersion; status = 'DONE';
    note = 'Comprobación terminada; la acción sintética queda cerrada.'
  }
  Require-Status $done 200 'Cierre de acción'
  $after = Invoke-Vera -Path "/api/notifications?offsetMinutes=$offset" -Token $token
  Require-Status $after 200 'Bandeja después del cierre'
  if (@($after.Data.notifications | Where-Object { $_.entityId -eq $actionId -and $_.type -like 'ACTION_*' }).Count -ne 0) {
    throw 'El aviso siguió visible después de terminar la acción.'
  }
  $actionId = $null
  Write-Host ("PASS Cierre y retiro del aviso | {0} ms" -f $after.DurationMs)
  Write-Host 'PASS Aceptación completa; queda una acción sintética terminada en la bitácora.'
} catch {
  Write-Host ("FAIL {0}" -f $_.Exception.Message)
  $failed = $true
} finally {
  if ($actionId -and $token) {
    try {
      $current = Invoke-Vera -Path "/api/actions/$actionId" -Token $token
      if ($current.Status -eq 200 -and $current.Data.action.status -in @('OPEN', 'IN_PROGRESS')) {
        $cleanup = Invoke-Vera -Method PATCH -Path "/api/actions/$actionId/status" -Token $token -Body @{
          version = $current.Data.action.storageVersion; status = 'DONE';
          note = 'Cierre de resguardo tras comprobación interrumpida.'
        }
        Write-Host ("RESGUARDO Cierre de acción sintética: HTTP {0}" -f $cleanup.Status)
      }
    } catch { Write-Host 'RESGUARDO No se pudo cerrar automáticamente la acción sintética.' }
  }
  $token = $null
  $password = $null
}
if ($failed) { exit 1 }
