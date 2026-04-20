package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Register(r *gin.RouterGroup) {
	r.GET("/health", h.health)

	v1 := r.Group("/v1")
	{
		v1.GET("/resources", h.listResources)
		v1.GET("/resources/:id", h.getResource)
	}
}

func (h *Handler) listResources(c *gin.Context) {
	resources, err := h.svc.ListResources(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, resources)
}

func (h *Handler) getResource(c *gin.Context) {
	res, err := h.svc.GetResource(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, res)
}

func (h *Handler) health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "api"})
}
