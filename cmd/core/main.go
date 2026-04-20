package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/Fullstack/test-capsule/internal/auth"
	"github.com/Fullstack/test-capsule/internal/config"
	"github.com/Fullstack/test-capsule/internal/db"
	"github.com/Fullstack/test-capsule/internal/middleware"
	coresvc "github.com/Fullstack/test-capsule/services/core"
)

func main() {
	cfg := config.Load()
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	pool, err := db.NewPool(context.Background(), cfg.DatabaseURL)
	if err != nil {
		slog.Error("database connection failed", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	repo := coresvc.NewRepository(pool)
	svc := coresvc.NewService(repo)
	handler := coresvc.NewHandler(svc)

	r := gin.New()
	r.Use(middleware.Logger(), gin.Recovery())
	r.GET("/health", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	// Public routes
	handler.RegisterPublic(r.Group("/core"))

	// Protected routes — IAP / JWT required
	protected := r.Group("/core")
	protected.Use(auth.IAPMiddleware(cfg.JWTSecret))
	handler.Register(protected)

	srv := &http.Server{Addr: ":" + cfg.Port, Handler: r}

	go func() {
		slog.Info("core service starting", "port", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "err", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("shutdown error", "err", err)
	}
	slog.Info("core service stopped")
}
