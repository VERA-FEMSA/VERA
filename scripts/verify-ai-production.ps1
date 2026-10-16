# Comprobacion puntual de HU-34 contra la instancia propia de VERA.
# Requiere PowerShell 7. No guarda credenciales, tokens, preguntas ni respuestas.
param(
  [switch]$PublicOnly,
  [string]$Username
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$baseUrl = 'https://vera-salva-ventures.vercel.app'

function Write-Result {
  param([string]$State, [string]$Step, [int]$DurationMs = 0, [string]$Detail = '')
  $suffix = if ($Detail) { " | $Detail" } else { '' }
  Write-Host ('{0,-5} {1,5} ms | {2}{3}' -f $State, $DurationMs, $Step, $suffix)
}

function Read-SecretText {
  param([string]$Prompt)
  $secure = Read-Host -Prompt $Prompt -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

function Invoke-VeraRequest {
  param(
    [ValidateSet('GET', 'POST')][string]$Method,
    [string]$Path,
    [object]$Body,
    [string]$Token
  )
  $options = @{ Uri = "$baseUrl$Path"; Method = $Method; TimeoutSec = 30; SkipHttpErrorCheck = $true }
  if ($Token) { $options.Headers = @{ Authorization = "Bearer $Token" } }
  if ($null -ne $Body) {
    $options.ContentType = 'application/json; charset=utf-8'
    $options.Body = ConvertTo-Json -InputObject $Body -Depth 8 -Compress
  }
  $watch = [Diagnostics.Stopwatch]::StartNew()
  $response = Invoke-WebRequest @options
  $watch.Stop()
  $data = if ($response.Content -and $response.Headers['Content-Type'] -match 'application/json') {
    ConvertFrom-Json -InputObject $response.Content -AsHashtable
  } else { @{} }
  return [pscustomobject]@{ Status = [int]$response.StatusCode; Data = $data; DurationMs = [int]$watch.ElapsedMilliseconds }
}

try {
  $homepageResponse = Invoke-VeraRequest -Method GET -Path '/' -Body $null -Token ''
  if ($homepageResponse.Status -ne 200) { throw "La portada respondio HTTP $($homepageResponse.Status)." }
  Write-Result PASS 'Portada publica' $homepageResponse.DurationMs 'HTTP 200'

  $anonymous = Invoke-VeraRequest -Method GET -Path '/api/assistant/status' -Body $null -Token ''
  if ($anonymous.Status -ne 401) { throw "El asistente sin sesion respondio HTTP $($anonymous.Status), se esperaba 401." }
  Write-Result PASS 'Acceso anonimo denegado' $anonymous.DurationMs 'HTTP 401'

  if ($PublicOnly) {
    Write-Result SKIP 'Sesion, datos e IA' 0 'Usa el comando sin -PublicOnly con una cuenta activa de VERA.'
    exit 0
  }

  if (-not $Username) { $Username = Read-Host -Prompt 'Usuario de VERA' }
  if ([string]::IsNullOrWhiteSpace($Username)) { throw 'Se requiere el usuario de una cuenta activa de VERA.' }
  $password = Read-SecretText 'Contrasena de VERA (no se muestra)'
  if (-not $password) { throw 'La contrasena esta vacia.' }
  try {
    $login = Invoke-VeraRequest -Method POST -Path '/api/auth/login' -Body @{ username = $Username; password = $password } -Token ''
  } finally { $password = $null }
  if ($login.Status -eq 403) {
    Write-Result BLOCK 'Inicio de sesion' $login.DurationMs 'Cuenta pendiente o deshabilitada; requiere aprobacion en VERA.'
    exit 2
  }
  if ($login.Status -ne 200) { throw "El inicio de sesion respondio HTTP $($login.Status)." }

  if ($login.Data.requires2FA) {
    $code = Read-SecretText 'Codigo de verificacion (no se muestra)'
    try {
      $session = Invoke-VeraRequest -Method POST -Path '/api/auth/verify-2fa' -Body @{
        tempToken = $login.Data.tempToken; code = $code
      } -Token ''
    } finally { $code = $null; $login = $null }
    if ($session.Status -ne 200) { throw "La verificacion de dos factores respondio HTTP $($session.Status)." }
  } else { $session = $login }
  if (-not $session.Data.token -or -not $session.Data.user.role) { throw 'La sesion no devolvio token y rol.' }
  $token = [string]$session.Data.token
  $role = [string]$session.Data.user.role
  Write-Result PASS 'Sesion autenticada' $session.DurationMs "rol=$role"

  $status = Invoke-VeraRequest -Method GET -Path '/api/assistant/status' -Body $null -Token $token
  if ($status.Status -ne 200 -or $status.Data.available -ne $true) {
    throw "La IA no esta disponible para la cuenta (HTTP $($status.Status))."
  }
  Write-Result PASS 'Azure y almacenes disponibles' $status.DurationMs 'available=true'

  $brief = Invoke-VeraRequest -Method GET -Path '/api/assistant/brief' -Body $null -Token $token
  if ($brief.Status -ne 200 -or $brief.Data.role -ne $role -or $null -eq $brief.Data.signals) {
    throw "Las prioridades respondieron de forma inesperada (HTTP $($brief.Status))."
  }
  Write-Result PASS 'Prioridades por rol' $brief.DurationMs ("senales=" + @($brief.Data.signals).Count)

  $visible = Invoke-VeraRequest -Method GET -Path '/api/risks' -Body $null -Token $token
  if ($visible.Status -ne 200 -or $null -eq $visible.Data.risks) {
    throw "No se pudo consultar el alcance visible de riesgos (HTTP $($visible.Status))."
  }
  $risks = @($visible.Data.risks)
  Write-Result PASS 'Riesgos visibles para el rol' $visible.DurationMs ("cantidad=$($risks.Count)")

  $focus = $null
  $question = 'Explica brevemente el flujo de Gobierno de VERA sin inventar expedientes.'
  if ($risks.Count -gt 0) {
    $risk = $risks[0]
    $focus = @{ type = 'risk'; id = [string]$risk.id }
    $question = 'Cual es el nivel y puntaje del riesgo enfocado? Cita el registro utilizado.'
  }
  $answer = Invoke-VeraRequest -Method POST -Path '/api/assistant/ask' -Body @{
    question = $question; history = @(); focus = $focus
  } -Token $token
  if ($answer.Status -ne 200 -or [string]::IsNullOrWhiteSpace([string]$answer.Data.answer)) {
    throw "La consulta al modelo no devolvio una respuesta utilizable (HTTP $($answer.Status))."
  }
  $inputTokens = if ($null -ne $answer.Data.usage) { $answer.Data.usage.promptTokens } else { 'n/d' }
  $outputTokens = if ($null -ne $answer.Data.usage) { $answer.Data.usage.completionTokens } else { 'n/d' }
  Write-Result PASS 'Respuesta de Azure OpenAI' $answer.DurationMs ("apiMs=$($answer.Data.durationMs); tokensEntrada=$inputTokens; tokensSalida=$outputTokens")

  if ($focus) {
    $citation = @($answer.Data.citations) | Where-Object { $null -ne $_ -and $_.sourceId -eq "risks:$($risk.id)" } | Select-Object -First 1
    if (-not $citation -or -not $citation.path.StartsWith('/') -or $citation.path.StartsWith('//')) {
      throw 'La respuesta no cito el riesgo enfocado mediante una ruta interna segura.'
    }
    if ($risk.level -and $answer.Data.answer -notmatch [regex]::Escape([string]$risk.level)) {
      throw 'La respuesta no incluye el nivel real del riesgo enfocado.'
    }
    if ($null -ne $risk.score -and $answer.Data.answer -notmatch "(?<!\d)$([regex]::Escape([string]$risk.score))(?!\d)") {
      throw 'La respuesta no incluye la puntuacion real del riesgo enfocado.'
    }
    Write-Result PASS 'Dato y fuente trazable' 0 'Nivel, puntaje y enlace interno coinciden.'
  } else {
    Write-Result SKIP 'Dato y fuente trazable' 0 'La cuenta no tiene riesgos visibles; se valido el flujo general.'
  }
  Write-Result PASS 'Aceptacion puntual terminada' 0 'No se guardaron credenciales ni respuestas.'
} catch {
  Write-Result FAIL 'Aceptacion interrumpida' 0 $_.Exception.Message
  exit 1
} finally {
  $token = $null
  $session = $null
}
