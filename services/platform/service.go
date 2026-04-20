package platform

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type Service struct {
	coreURL    string
	httpClient *http.Client
}

func NewService(coreURL string) *Service {
	return &Service{
		coreURL:    coreURL,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

type DashboardData struct {
	UserCount     int       `json:"user_count"`
	ResourceCount int       `json:"resource_count"`
	Timestamp     time.Time `json:"timestamp"`
}

func (s *Service) GetDashboard(ctx context.Context, authHeader string) (*DashboardData, error) {
	users, err := s.fetchList(ctx, "/core/users", authHeader)
	if err != nil {
		return nil, fmt.Errorf("fetch users: %w", err)
	}
	resources, err := s.fetchList(ctx, "/core/resources", authHeader)
	if err != nil {
		return nil, fmt.Errorf("fetch resources: %w", err)
	}
	return &DashboardData{
		UserCount:     len(users),
		ResourceCount: len(resources),
		Timestamp:     time.Now(),
	}, nil
}

func (s *Service) fetchList(ctx context.Context, path, authHeader string) ([]any, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.coreURL+path, nil)
	if err != nil {
		return nil, err
	}
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("upstream error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("upstream returned %d", resp.StatusCode)
	}
	var items []any
	if err := json.NewDecoder(resp.Body).Decode(&items); err != nil {
		return nil, fmt.Errorf("decode: %w", err)
	}
	return items, nil
}
