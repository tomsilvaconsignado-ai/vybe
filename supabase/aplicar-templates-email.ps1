# Aplica os modelos de e-mail de supabase/email-templates/ no projeto Supabase,
# pela API de gerenciamento (https://api.supabase.com).
#
# Uso (PowerShell, na pasta do repositório):
#   powershell -ExecutionPolicy Bypass -File supabase\aplicar-templates-email.ps1
#
# Pede um token de acesso pessoal (https://supabase.com/dashboard/account/tokens).
# O token não é salvo; apague-o no painel depois de usar.

param([string]$ProjectRef = 'efztrffuovqxmkodpbkx')

$ErrorActionPreference = 'Stop'
$pasta = Join-Path $PSScriptRoot 'email-templates'

# Assunto vem da linha "Assunto: ..." do comentário do topo; o corpo é o HTML sem esse comentário
function Ler-Modelo([string]$arquivo) {
  $texto = [IO.File]::ReadAllText((Join-Path $pasta $arquivo), [Text.Encoding]::UTF8)
  $assunto = [regex]::Match($texto, 'Assunto:\s*(.+?)\s*-->').Groups[1].Value.Trim()
  if (-not $assunto) { throw "Assunto não encontrado em $arquivo" }
  $corpo = [regex]::Replace($texto, '^\s*<!--.*?-->\s*', '', 'Singleline')
  return @{ assunto = $assunto; corpo = $corpo }
}

function Montar([hashtable]$mapa, [switch]$Aviso) {
  $cfg = @{}
  foreach ($chave in $mapa.Keys) {
    $m = Ler-Modelo $mapa[$chave]
    if ($Aviso) {
      $cfg["mailer_notifications_${chave}_enabled"] = $true
      $cfg["mailer_subjects_${chave}_notification"] = $m.assunto
      $cfg["mailer_templates_${chave}_notification_content"] = $m.corpo
    } else {
      $cfg["mailer_subjects_$chave"] = $m.assunto
      $cfg["mailer_templates_${chave}_content"] = $m.corpo
    }
  }
  return $cfg
}

$modelos = Montar @{
  confirmation     = 'confirmar-cadastro.html'
  invite           = 'convidar-usuario.html'
  magic_link       = 'link-de-acesso.html'
  email_change     = 'alterar-email.html'
  recovery         = 'redefinir-senha.html'
  reauthentication = 'reautenticacao.html'
}
$avisos = Montar -Aviso @{
  password_changed     = 'aviso-senha-alterada.html'
  email_changed        = 'aviso-email-alterado.html'
  mfa_factor_enrolled  = 'aviso-mfa-adicionado.html'
  mfa_factor_unenrolled = 'aviso-mfa-removido.html'
}

$seguro = Read-Host 'Cole o token de acesso do Supabase (sbp_...)' -AsSecureString
$token = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro))
$url = "https://api.supabase.com/v1/projects/$ProjectRef/config/auth"
$cabecalho = @{ Authorization = "Bearer $token" }
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Enviar([string]$nome, [hashtable]$cfg) {
  # O corpo vai como bytes UTF-8: no PowerShell 5.1 uma string perderia os acentos
  $bytes = [Text.Encoding]::UTF8.GetBytes(($cfg | ConvertTo-Json -Depth 3))
  try {
    Invoke-RestMethod -Method Patch -Uri $url -Headers $cabecalho -ContentType 'application/json; charset=utf-8' -Body $bytes | Out-Null
    Write-Host "OK  $nome" -ForegroundColor Green
  } catch {
    $detalhe = $_.ErrorDetails.Message
    if (-not $detalhe) { $detalhe = $_.Exception.Message }
    Write-Host "ERRO  $nome -> $detalhe" -ForegroundColor Red
  }
}

Enviar 'Modelos (cadastro, convite, link de acesso, troca de e-mail, senha, reautenticação)' $modelos
Enviar 'Avisos de segurança (senha, e-mail, MFA)' $avisos
Write-Host "`nConfira em: https://supabase.com/dashboard/project/$ProjectRef/auth/templates"
