package frontend

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"time"
)

type serviceConfig struct {
	name      string
	healthURL string
}

type ServiceStatus struct {
	Name      string `json:"name"`
	HealthURL string `json:"health_url"`
	OK        bool   `json:"ok"`
	LatencyMs int64  `json:"latency_ms"`
	Error     string `json:"error,omitempty"`
}

type Service struct {
	services   []serviceConfig
	httpClient *http.Client
}

func NewService(login, platform, core, api string) *Service {
	return &Service{
		services: []serviceConfig{
			{name: "Login",    healthURL: login + "/auth/health"},
			{name: "Platform", healthURL: platform + "/platform/health"},
			{name: "Core",     healthURL: core + "/health"},
			{name: "API",      healthURL: api + "/api/health"},
		},
		httpClient: &http.Client{Timeout: 5 * time.Second},
	}
}

func (s *Service) CheckAll(ctx context.Context) []ServiceStatus {
	results := make([]ServiceStatus, len(s.services))
	var wg sync.WaitGroup

	for i, svc := range s.services {
		wg.Add(1)
		go func(idx int, cfg serviceConfig) {
			defer wg.Done()
			results[idx] = s.check(ctx, cfg)
		}(i, svc)
	}

	wg.Wait()
	return results
}

func (s *Service) check(ctx context.Context, cfg serviceConfig) ServiceStatus {
	st := ServiceStatus{Name: cfg.name, HealthURL: cfg.healthURL}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, cfg.healthURL, nil)
	if err != nil {
		st.Error = err.Error()
		return st
	}

	start := time.Now()
	resp, err := s.httpClient.Do(req)
	st.LatencyMs = time.Since(start).Milliseconds()

	if err != nil {
		st.Error = err.Error()
		return st
	}
	resp.Body.Close()

	st.OK = resp.StatusCode >= 200 && resp.StatusCode < 300
	if !st.OK {
		st.Error = fmt.Sprintf("HTTP %d", resp.StatusCode)
	}
	return st
}
