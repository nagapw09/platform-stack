package auth

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const (
	// IAPEmailHeader is set by Google Cloud IAP in GCP environments.
	IAPEmailHeader = "X-Goog-Authenticated-User-Email"
	CtxUserEmail   = "user_email"
)

type Claims struct {
	Email string `json:"email"`
	jwt.RegisteredClaims
}

// IAPMiddleware validates Google Cloud IAP headers.
// Falls back to Bearer JWT validation for local development.
func IAPMiddleware(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if email := c.GetHeader(IAPEmailHeader); email != "" {
			email = strings.TrimPrefix(email, "accounts.google.com:")
			c.Set(CtxUserEmail, email)
			c.Next()
			return
		}

		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(jwtSecret), nil
		})
		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}

		c.Set(CtxUserEmail, claims.Email)
		c.Next()
	}
}
