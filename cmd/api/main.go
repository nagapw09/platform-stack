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

	"github.com/Fullstack/test-capsule/internal/config"
	"github.com/Fullstack/test-capsule/internal/middleware"
	apisvc "github.com/Fullstack/test-capsule/services/api"
)

func main() {
	cfg := config.Load()
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	svc := apisvc.NewService(cfg.CoreServiceURL)
	handler := apisvc.NewHandler(svc)

	r := gin.New()
	r.Use(middleware.Logger(), gin.Recovery())
	r.GET("/health", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})
	handler.Register(r.Group("/api"))

	srv := &http.Server{Addr: ":" + cfg.Port, Handler: r}

	go func() {
		slog.Info("api service starting", "port", cfg.Port)
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
	slog.Info("api service stopped")
}
