package platform

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/Fullstack/test-capsule/internal/auth"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Register(r *gin.RouterGroup, jwtSecret string) {
	r.GET("/health", h.health)

	secured := r.Group("")
	secured.Use(auth.IAPMiddleware(jwtSecret))
	{
		secured.GET("/dashboard", h.dashboard)
		secured.GET("/profile", h.profile)
	}
}

func (h *Handler) dashboard(c *gin.Context) {
	data, err := h.svc.GetDashboard(c.Request.Context(), c.GetHeader("Authorization"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, data)
}

func (h *Handler) profile(c *gin.Context) {
	email, _ := c.Get(auth.CtxUserEmail)
	c.JSON(http.StatusOK, gin.H{"email": email})
}

func (h *Handler) health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "platform"})
}
