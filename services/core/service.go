package core

import (
	"context"
	"fmt"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) CreateUser(ctx context.Context, req CreateUserRequest) (*User, error) {
	return s.repo.CreateUser(ctx, req.Email, req.Name)
}

func (s *Service) GetUser(ctx context.Context, id int64) (*User, error) {
	u, err := s.repo.GetUser(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("user %d: %w", id, err)
	}
	return u, nil
}

func (s *Service) ListUsers(ctx context.Context) ([]User, error) {
	return s.repo.ListUsers(ctx)
}

func (s *Service) UpdateUser(ctx context.Context, id int64, req UpdateUserRequest) (*User, error) {
	return s.repo.UpdateUser(ctx, id, req.Name)
}

func (s *Service) DeleteUser(ctx context.Context, id int64) error {
	return s.repo.DeleteUser(ctx, id)
}

func (s *Service) CreateResource(ctx context.Context, req CreateResourceRequest) (*Resource, error) {
	return s.repo.CreateResource(ctx, req.Name, req.Data, req.OwnerID)
}

func (s *Service) GetResource(ctx context.Context, id int64) (*Resource, error) {
	return s.repo.GetResource(ctx, id)
}

func (s *Service) ListResources(ctx context.Context) ([]Resource, error) {
	return s.repo.ListResources(ctx)
}

func (s *Service) DeleteResource(ctx context.Context, id int64) error {
	return s.repo.DeleteResource(ctx, id)
}
