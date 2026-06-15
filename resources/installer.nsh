!include "LogicLib.nsh"
!include "nsDialogs.nsh"

; MD5("potato20tic26")
!define EXPECTED_ACTIVATION_MD5 "24c8325b6edd4e97dc57f95df92fd5b3"

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

  ClearErrors
  ExecWait 'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$t=[IO.File]::ReadAllText(''$R0'').Trim();$h=[BitConverter]::ToString([Security.Cryptography.MD5]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($t))).Replace(''-'','''').ToLower();[IO.File]::WriteAllText(''$R1'',$h)"' $2
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
