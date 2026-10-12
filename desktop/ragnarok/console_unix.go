//go:build !windows

package main

import "os/exec"

func hideConsole(command *exec.Cmd) {}
