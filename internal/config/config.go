package config

import "os"

type Config struct {
	Port              string
	DatabaseURL       string
	JWTSecret         string
	Environment       string
	CoreServiceURL    string
	LoginServiceURL   string
	PlatformServiceURL string
	APIServiceURL     string
}

func Load() *Config {
	return &Config{
		Port:               getEnv("PORT", "8080"),
		DatabaseURL:        getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/testcapsule?sslmode=disable"),
		JWTSecret:          getEnv("JWT_SECRET", "dev-secret-change-in-prod"),
		Environment:        getEnv("ENVIRONMENT", "development"),
		CoreServiceURL:     getEnv("CORE_SERVICE_URL", "http://localhost:8083"),
		LoginServiceURL:    getEnv("LOGIN_SERVICE_URL", "http://localhost:8081"),
		PlatformServiceURL: getEnv("PLATFORM_SERVICE_URL", "http://localhost:8082"),
		APIServiceURL:      getEnv("API_SERVICE_URL", "http://localhost:8080"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
