package api

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

type Resource struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Data      string    `json:"data"`
	OwnerID   int64     `json:"owner_id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (s *Service) ListResources(ctx context.Context) ([]Resource, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.coreURL+"/core/resources", nil)
	if err != nil {
		return nil, err
	}
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("call core: %w", err)
	}
	defer resp.Body.Close()

	var resources []Resource
	if err := json.NewDecoder(resp.Body).Decode(&resources); err != nil {
		return nil, fmt.Errorf("decode: %w", err)
	}
	return resources, nil
}

func (s *Service) GetResource(ctx context.Context, id string) (*Resource, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		fmt.Sprintf("%s/core/resources/%s", s.coreURL, id), nil)
	if err != nil {
		return nil, err
	}
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("call core: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("resource not found")
	}
	var resource Resource
	if err := json.NewDecoder(resp.Body).Decode(&resource); err != nil {
		return nil, fmt.Errorf("decode: %w", err)
	}
	return &resource, nil
}
