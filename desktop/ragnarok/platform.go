package main

import (
	"crypto/sha256"
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

func install() error {
	if runtime.GOOS != "windows" {
		return nil
	}
	executable, err := os.Executable()
	if err != nil {
		return err
	}
	base, err := os.UserCacheDir()
	if err != nil {
		return err
	}
	directory := filepath.Join(base, "Programs", "QuestRagnarok", version)
	target := filepath.Join(directory, "Quest-Ragnarok.exe")
	if strings.EqualFold(executable, target) {
		return nil
	}
	if err = os.MkdirAll(directory, 0755); err != nil {
		return err
	}
	if previous, e := os.Open(target); e == nil {
		h := sha256.New()
		io.Copy(h, previous)
		previous.Close()
		current, e := os.Open(executable)
		if e != nil {
			return e
		}
		h2 := sha256.New()
		io.Copy(h2, current)
		current.Close()
		if string(h.Sum(nil)) != string(h2.Sum(nil)) {
			return errors.New("outra versão está instalada; preserve a instalação existente")
		}
	} else {
		in, e := os.Open(executable)
		if e != nil {
			return e
		}
		defer in.Close()
		out, e := os.OpenFile(target, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0755)
		if e != nil {
			return e
		}
		_, e = io.Copy(out, in)
		out.Close()
		if e != nil {
			return e
		}
	}
	command := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", `$w=New-Object -ComObject WScript.Shell;foreach($folder in @([Environment]::GetFolderPath('Desktop'),[IO.Path]::Combine($env:APPDATA,'Microsoft','Windows','Start Menu','Programs'))){$s=$w.CreateShortcut([IO.Path]::Combine($folder,'Quest Ragnarok.lnk'));$s.TargetPath=$env:QUEST_PLAYER_EXECUTABLE;$s.WorkingDirectory=[IO.Path]::GetDirectoryName($env:QUEST_PLAYER_EXECUTABLE);$s.Save()}`)
	hideConsole(command)
	command.Env = append(os.Environ(), "QUEST_PLAYER_EXECUTABLE="+target)
	if err = command.Run(); err != nil {
		return errors.New("não foi possível criar o atalho do cliente Quest")
	}
	// Upgrade only this user's installed 2.0.0 client; never kill generic Node/game processes.
	previous := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", `$ErrorActionPreference='Stop';$legacy=[IO.Path]::Combine($env:QUEST_PLAYER_INSTALL_ROOT,'2.0.0','Quest-Ragnarok.exe');Get-CimInstance Win32_Process -Filter "Name = 'Quest-Ragnarok.exe'" | Where-Object { $_.ExecutablePath -and [String]::Equals($_.ExecutablePath,$legacy,[StringComparison]::OrdinalIgnoreCase) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop }`)
	hideConsole(previous)
	previous.Env = append(os.Environ(), "QUEST_PLAYER_INSTALL_ROOT="+filepath.Join(base, "Programs", "QuestRagnarok"))
	if err := previous.Run(); err != nil {
		return errors.New("não foi possível encerrar o cliente antigo; feche Quest Ragnarok 2.0.0 e abra o novo atalho")
	}
	child := exec.Command(target, os.Args[1:]...)
	if err = child.Start(); err != nil {
		return err
	}
	return installComplete
}

func openGame(address string) error {
	switch runtime.GOOS {
	case "windows":
		for _, variable := range []string{"ProgramFiles(x86)", "ProgramFiles", "LOCALAPPDATA"} {
			edge := filepath.Join(os.Getenv(variable), "Microsoft", "Edge", "Application", "msedge.exe")
			if _, err := os.Stat(edge); err == nil {
				return exec.Command(edge, "--app="+address, "--window-size=1280,900").Start()
			}
		}
		return exec.Command("rundll32.exe", "url.dll,FileProtocolHandler", address).Start()
	case "darwin":
		return exec.Command("/usr/bin/open", address).Start()
	default:
		return exec.Command("xdg-open", address).Start()
	}
}

func notify(message string) {
	if runtime.GOOS == "windows" {
		command := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", `Add-Type -AssemblyName PresentationFramework;[System.Windows.MessageBox]::Show($env:QUEST_PLAYER_MESSAGE,'Quest Ragnarok')`)
		hideConsole(command)
		command.Env = append(os.Environ(), "QUEST_PLAYER_MESSAGE="+message)
		command.Run()
	}
}
