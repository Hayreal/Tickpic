!include "LogicLib.nsh"
!include "nsDialogs.nsh"

; MD5("potato20tic26")
!define EXPECTED_ACTIVATION_MD5 "24c8325b6edd4e97dc57f95df92fd5b3"

!ifndef BUILD_UNINSTALLER

Var ActivationDialog
Var ActivationCodeInput

!macro customWelcomePage
  Page custom ActivationPageShow ActivationPageLeave "激活验证"
!macroend

Function ActivationPageShow
  nsDialogs::Create 1018
  Pop $ActivationDialog

  ${If} $ActivationDialog == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 24u "请输入激活码以继续安装 Tickpic："
  Pop $0

  ${NSD_CreatePassword} 0 28u 100% 12u ""
  Pop $ActivationCodeInput

  nsDialogs::Show
FunctionEnd

Function ActivationPageLeave
  ${NSD_GetText} $ActivationCodeInput $0

  ${If} $0 == ""
    MessageBox MB_ICONEXCLAMATION|MB_OK "请输入激活码。"
    Abort
  ${EndIf}

  InitPluginsDir
  StrCpy $R0 "$PLUGINSDIR\activation.txt"
  StrCpy $R1 "$PLUGINSDIR\activation.hash"

  FileOpen $2 $R0 w
  FileWrite $2 $0
  FileClose $2

  StrCpy $R2 "$PLUGINSDIR\hash.ps1"
  FileOpen $2 $R2 w
  FileWrite $2 "$$inputPath = $$args[0]$\r$\n"
  FileWrite $2 "$$outputPath = $$args[1]$\r$\n"
  FileWrite $2 "$$code = [IO.File]::ReadAllText($$inputPath).Trim()$\r$\n"
  FileWrite $2 "$$hash = [BitConverter]::ToString([Security.Cryptography.MD5]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($$code))).Replace('-', '').ToLower()$\r$\n"
  FileWrite $2 "[IO.File]::WriteAllText($$outputPath, $$hash)$\r$\n"
  FileClose $2

  ClearErrors
  ExecWait 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$R2" "$R0" "$R1"' $2
  ${If} ${Errors}
    MessageBox MB_ICONSTOP|MB_OK "激活码校验失败，请重试。"
    Abort
  ${EndIf}

  ${If} $2 != 0
    MessageBox MB_ICONSTOP|MB_OK "激活码校验失败，请重试。"
    Abort
  ${EndIf}

  ClearErrors
  FileOpen $2 $R1 r
  ${If} ${Errors}
    MessageBox MB_ICONSTOP|MB_OK "激活码校验失败，请重试。"
    Abort
  ${EndIf}
  FileRead $2 $3
  FileClose $2

  StrCpy $4 $3 32
  ${If} $4 != "${EXPECTED_ACTIVATION_MD5}"
    MessageBox MB_ICONEXCLAMATION|MB_OK "激活码无效，请检查后重试。"
    Abort
  ${EndIf}
FunctionEnd

!endif
