package frontend

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
	r.GET("/", h.dashboard)
	r.GET("/status", h.status)
	r.GET("/health", h.health)
}

func (h *Handler) dashboard(c *gin.Context) {
	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(dashboardHTML))
}

func (h *Handler) status(c *gin.Context) {
	statuses := h.svc.CheckAll(c.Request.Context())
	c.JSON(http.StatusOK, statuses)
}

func (h *Handler) health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "frontend"})
}

const dashboardHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Service Status</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #0f172a;
  color: #e2e8f0;
  min-height: 100vh;
  padding: 2rem;
}
header { margin-bottom: 2rem; }
h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 0.25rem; }
.subtitle { color: #64748b; font-size: 0.875rem; }
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}
.card {
  background: #1e293b;
  border-radius: 0.75rem;
  padding: 1.5rem;
  border: 1px solid #334155;
  border-left-width: 4px;
  transition: border-color 0.3s;
}
.card.ok    { border-left-color: #22c55e; }
.card.error { border-left-color: #ef4444; }
.card.wait  { border-left-color: #475569; }
.card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
.name { font-size: 1.1rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem; }
.dot {
  width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0;
}
.dot.ok    { background: #22c55e; animation: pulse 2s ease-in-out infinite; }
.dot.error { background: #ef4444; }
.dot.wait  { background: #475569; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
.badge {
  padding: 0.2rem 0.65rem; border-radius: 999px;
  font-size: 0.7rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
}
.badge.ok    { background: #14532d; color: #86efac; }
.badge.error { background: #7f1d1d; color: #fca5a5; }
.badge.wait  { background: #1e3a5f; color: #93c5fd; }
.url { font-size: 0.78rem; color: #64748b; word-break: break-all; margin-bottom: 0.6rem; }
.meta { font-size: 0.82rem; color: #94a3b8; }
.meta span { color: #e2e8f0; }
.err-msg { margin-top: 0.5rem; font-size: 0.78rem; color: #fca5a5; }
footer { margin-top: 2.5rem; text-align: center; color: #475569; font-size: 0.78rem; }
</style>
</head>
<body>
<header>
  <h1>Service Status</h1>
  <p class="subtitle" id="ts">Checking services…</p>
</header>
<div class="grid" id="grid"></div>
<footer>Auto-refreshes every 10 seconds</footer>

<script>
const grid = document.getElementById('grid');
const ts   = document.getElementById('ts');

function card(s) {
  const cls = s.ok ? 'ok' : 'error';
  return '<div class="card ' + cls + '">' +
    '<div class="card-top">' +
      '<span class="name"><span class="dot ' + cls + '"></span>' + s.name + '</span>' +
      '<span class="badge ' + cls + '">' + (s.ok ? 'OK' : 'DOWN') + '</span>' +
    '</div>' +
    '<div class="url">' + s.health_url + '</div>' +
    (s.ok ? '<div class="meta">Latency: <span>' + s.latency_ms + ' ms</span></div>' : '') +
    (s.error ? '<div class="err-msg">' + s.error + '</div>' : '') +
  '</div>';
}

function skeleton() {
  grid.innerHTML = ['Login','Platform','Core','API'].map(n =>
    '<div class="card wait"><div class="card-top">' +
    '<span class="name"><span class="dot wait"></span>' + n + '</span>' +
    '<span class="badge wait">Checking…</span>' +
    '</div></div>'
  ).join('');
}

async function refresh() {
  try {
    const r = await fetch('/status');
    const data = await r.json();
    grid.innerHTML = data.map(card).join('');
    ts.textContent = 'Last updated: ' + new Date().toLocaleTimeString();
  } catch(e) {
    ts.textContent = 'Error: ' + e.message;
  }
}

skeleton();
refresh();
setInterval(refresh, 10000);
</script>
</body>
</html>`
