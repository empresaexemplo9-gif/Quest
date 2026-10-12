package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"time"
)

func waitForAssetService(exited <-chan error, portFile string, timeout time.Duration) (*url.URL, error) {
	timer := time.NewTimer(timeout)
	defer timer.Stop()
	tick := time.NewTicker(250 * time.Millisecond)
	defer tick.Stop()
	for {
		select {
		case err := <-exited:
			if err == nil {
				err = errors.New("processo encerrou antes de carregar os mapas")
			}
			return nil, fmt.Errorf("o serviço de mapas encerrou: %w. Abra o diagnóstico do cliente", err)
		case <-timer.C:
			return nil, errors.New("o serviço de mapas não respondeu; abra o diagnóstico do cliente")
		case <-tick.C:
			data, err := os.ReadFile(portFile)
			if err != nil {
				continue
			}
			var info struct {
				Port int `json:"port"`
			}
			if json.Unmarshal(data, &info) != nil || info.Port <= 0 || info.Port > 65535 {
				continue
			}
			endpoint := fmt.Sprintf("http://127.0.0.1:%d", info.Port)
			response, err := (&http.Client{Timeout: 2 * time.Second}).Get(endpoint + "/data/prontera.gat")
			if err != nil {
				continue
			}
			magic := make([]byte, 4)
			_, err = io.ReadFull(response.Body, magic)
			response.Body.Close()
			if err == nil && response.StatusCode == 200 && string(magic) == "GRAT" {
				return url.Parse(endpoint)
			}
		}
	}
}

func assetLogTail(path string, limit int64) ([]byte, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return nil, err
	}
	if info.Size() > limit {
		if _, err = file.Seek(-limit, io.SeekEnd); err != nil {
			return nil, err
		}
	}
	return io.ReadAll(io.LimitReader(file, limit))
}
