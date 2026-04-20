package login

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Service struct {
	jwtSecret string
}

func NewService(jwtSecret string) *Service {
	return &Service{jwtSecret: jwtSecret}
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	Token string `json:"token"`
	Email string `json:"email"`
}

// Authenticate validates credentials and returns a signed JWT.
// In production this would verify against Firebase / Google Identity Platform.
func (s *Service) Authenticate(req LoginRequest) (*LoginResponse, error) {
	if req.Password == "" {
		return nil, errors.New("invalid credentials")
	}

	token, err := s.issueToken(req.Email)
	if err != nil {
		return nil, fmt.Errorf("issue token: %w", err)
	}

	return &LoginResponse{Token: token, Email: req.Email}, nil
}

func (s *Service) issueToken(email string) (string, error) {
	claims := jwt.MapClaims{
		"email": email,
		"exp":   time.Now().Add(24 * time.Hour).Unix(),
		"iat":   time.Now().Unix(),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(s.jwtSecret))
}
