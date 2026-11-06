$ErrorActionPreference = 'Stop'
$api = 'http://127.0.0.1:3000/api/v1'
$etapa = 'inicio de sesion'

try {
    $cuenta = Get-Credential -Message 'Cuenta real de Cognito para consultar tu perfil'
    if (-not $cuenta) { throw 'Ingreso cancelado.' }

    $login = Invoke-RestMethod -Uri "$api/auth/ingreso" -Method Post `
        -ContentType 'application/json' `
        -Headers @{ Origin = 'http://127.0.0.1:4200' } `
        -Body (@{
            email = $cuenta.UserName
            password = $cuenta.GetNetworkCredential().Password
        } | ConvertTo-Json -Compress) -SessionVariable sesion
    $cuenta = $null

    $etapa = 'cookie JWT'
    $access = $sesion.Cookies.GetCookies([Uri]"$api/perfil") |
        Where-Object Name -EQ 'iarmatucv.access'
    if (-not $access) { throw 'El login no entrego una cookie JWT para la ruta del perfil.' }

    $etapa = 'verificacion de sesion'
    $identidad = Invoke-RestMethod -Uri "$api/auth/sesion" -WebSession $sesion
    if (-not $identidad.data.id -or $identidad.data.id -cne $login.data.id) {
        throw 'No se pudo confirmar la identidad del usuario.'
    }

    $etapa = 'lectura de perfil'
    $perfil = Invoke-RestMethod -Uri "$api/perfil" -WebSession $sesion
    if (-not $perfil.data.userId -or $perfil.data.userId -cne $identidad.data.id -or
        $perfil.data.userId -ceq 'DEMO_USER_SUB_REEMPLAZAR') {
        throw 'El perfil no coincide con la identidad autenticada.'
    }

    [pscustomobject]@{
        loginReal = $true
        cookieJwtRecibida = $true
        sesionRealConfirmada = $true
        perfilRealRecuperado = $true
        subCoincide = $true
        soloLecturaDePerfil = $true
    } | ConvertTo-Json
}
catch {
    $codigo = 'SIN_CODIGO_API'
    try {
        $detalle = $_.ErrorDetails.Message | ConvertFrom-Json
        if ($detalle.error.codigo -match '^[A-Z_]+$') { $codigo = $detalle.error.codigo }
    } catch {}
    Write-Error "No se completo la prueba. Etapa: $etapa. Codigo API: $codigo. No compartir contrasenas ni cookies." -ErrorAction Continue
    exit 1
}
finally {
    $cuenta = $null
    $access = $null
    $sesion = $null
    $perfil = $null
    $login = $null
    $identidad = $null
}
