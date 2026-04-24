package frontend

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

type serviceConfig struct {
	name      string
	healthURL string
}

// ── Health ─────────────────────────────────────────────────────

type ServiceStatus struct {
	Name      string `json:"name"`
	HealthURL string `json:"health_url"`
	OK        bool   `json:"ok"`
	LatencyMs int64  `json:"latency_ms"`
	Error     string `json:"error,omitempty"`
}

// ── Domain types ───────────────────────────────────────────────

type LoginResponse struct {
	Token string `json:"token"`
	Email string `json:"email"`
}

type DashboardData struct {
	UserCount     int       `json:"user_count"`
	ResourceCount int       `json:"resource_count"`
	Timestamp     time.Time `json:"timestamp"`
}

type User struct {
	ID        int64     `json:"id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Resource struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Data      string    `json:"data"`
	OwnerID   int64     `json:"owner_id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type CreateUserRequest struct {
	Email string `json:"email"`
	Name  string `json:"name"`
}

type CreateResourceRequest struct {
	Name    string `json:"name"`
	Data    string `json:"data"`
	OwnerID int64  `json:"owner_id"`
}

// ── Service ────────────────────────────────────────────────────

type Service struct {
	loginURL    string
	platformURL string
	coreURL     string
	apiURL      string
	services    []serviceConfig
	httpClient  *http.Client
}

func NewService(login, platform, core, api string) *Service {
	return &Service{
		loginURL:    login,
		platformURL: platform,
		coreURL:     core,
		apiURL:      api,
		services: []serviceConfig{
			{name: "Login",    healthURL: login + "/auth/health"},
			{name: "Platform", healthURL: platform + "/platform/health"},
			{name: "Core",     healthURL: core + "/health"},
			{name: "API",      healthURL: api + "/api/health"},
		},
		httpClient: &http.Client{Timeout: 5 * time.Second},
	}
}

// ── Health checks ──────────────────────────────────────────────

func (s *Service) CheckAll(ctx context.Context) []ServiceStatus {
	results := make([]ServiceStatus, len(s.services))
	var wg sync.WaitGroup
	for i, svc := range s.services {
		wg.Add(1)
		go func(idx int, cfg serviceConfig) {
			defer wg.Done()
			results[idx] = s.checkOne(ctx, cfg)
		}(i, svc)
	}
	wg.Wait()
	return results
}

func (s *Service) checkOne(ctx context.Context, cfg serviceConfig) ServiceStatus {
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

// ── Auth ───────────────────────────────────────────────────────

func (s *Service) Login(ctx context.Context, email, password string) (*LoginResponse, error) {
	body, _ := json.Marshal(map[string]string{"email": email, "password": password})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.loginURL+"/auth/login", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("login: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("%s", b)
	}
	var lr LoginResponse
	json.NewDecoder(resp.Body).Decode(&lr)
	return &lr, nil
}

// ── Dashboard ──────────────────────────────────────────────────

func (s *Service) GetDashboard(ctx context.Context, auth string) (*DashboardData, error) {
	return doGet[DashboardData](ctx, s.httpClient, s.platformURL+"/platform/dashboard", auth)
}

// ── Users ──────────────────────────────────────────────────────

func (s *Service) ListUsers(ctx context.Context, auth string) ([]User, error) {
	return doGet[[]User](ctx, s.httpClient, s.coreURL+"/core/users", auth)
}

func (s *Service) CreateUser(ctx context.Context, auth string, req CreateUserRequest) (*User, error) {
	return doPost[User](ctx, s.httpClient, s.coreURL+"/core/users", auth, req)
}

func (s *Service) DeleteUser(ctx context.Context, auth, id string) error {
	return doDelete(ctx, s.httpClient, s.coreURL+"/core/users/"+id, auth)
}

// ── Resources ──────────────────────────────────────────────────

func (s *Service) ListResources(ctx context.Context, auth string) ([]Resource, error) {
	return doGet[[]Resource](ctx, s.httpClient, s.coreURL+"/core/resources", auth)
}

func (s *Service) CreateResource(ctx context.Context, auth string, req CreateResourceRequest) (*Resource, error) {
	return doPost[Resource](ctx, s.httpClient, s.coreURL+"/core/resources", auth, req)
}

func (s *Service) DeleteResource(ctx context.Context, auth, id string) error {
	return doDelete(ctx, s.httpClient, s.coreURL+"/core/resources/"+id, auth)
}

// ── Generic HTTP helpers ───────────────────────────────────────

func doGet[T any](ctx context.Context, client *http.Client, url, auth string) (T, error) {
	var zero T
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return zero, err
	}
	if auth != "" {
		req.Header.Set("Authorization", auth)
	}
	resp, err := client.Do(req)
	if err != nil {
		return zero, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return zero, fmt.Errorf("HTTP %d: %s", resp.StatusCode, b)
	}
	var result T
	json.NewDecoder(resp.Body).Decode(&result)
	return result, nil
}

func doPost[T any](ctx context.Context, client *http.Client, url, auth string, body any) (*T, error) {
	data, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if auth != "" {
		req.Header.Set("Authorization", auth)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, b)
	}
	var result T
	json.NewDecoder(resp.Body).Decode(&result)
	return &result, nil
}

func doDelete(ctx context.Context, client *http.Client, url, auth string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, url, nil)
	if err != nil {
		return err
	}
	if auth != "" {
		req.Header.Set("Authorization", auth)
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	return nil
}
