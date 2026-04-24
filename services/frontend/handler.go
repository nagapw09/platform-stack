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
	r.GET("/", h.index)
	r.GET("/health", h.health)
	r.GET("/status", h.status)

	a := r.Group("/api")
	{
		a.POST("/auth/login", h.login)
		a.GET("/dashboard", h.getDashboard)
		a.GET("/users", h.listUsers)
		a.POST("/users", h.createUser)
		a.DELETE("/users/:id", h.deleteUser)
		a.GET("/resources", h.listResources)
		a.POST("/resources", h.createResource)
		a.DELETE("/resources/:id", h.deleteResource)
	}
}

func (h *Handler) index(c *gin.Context) {
	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(pageHTML))
}

func (h *Handler) health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "frontend"})
}

func (h *Handler) status(c *gin.Context) {
	c.JSON(http.StatusOK, h.svc.CheckAll(c.Request.Context()))
}

func (h *Handler) login(c *gin.Context) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	resp, err := h.svc.Login(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, resp)
}

func (h *Handler) getDashboard(c *gin.Context) {
	data, err := h.svc.GetDashboard(c.Request.Context(), c.GetHeader("Authorization"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, data)
}

func (h *Handler) listUsers(c *gin.Context) {
	users, err := h.svc.ListUsers(c.Request.Context(), c.GetHeader("Authorization"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, users)
}

func (h *Handler) createUser(c *gin.Context) {
	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	user, err := h.svc.CreateUser(c.Request.Context(), c.GetHeader("Authorization"), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, user)
}

func (h *Handler) deleteUser(c *gin.Context) {
	if err := h.svc.DeleteUser(c.Request.Context(), c.GetHeader("Authorization"), c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) listResources(c *gin.Context) {
	resources, err := h.svc.ListResources(c.Request.Context(), c.GetHeader("Authorization"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, resources)
}

func (h *Handler) createResource(c *gin.Context) {
	var req CreateResourceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	res, err := h.svc.CreateResource(c.Request.Context(), c.GetHeader("Authorization"), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, res)
}

func (h *Handler) deleteResource(c *gin.Context) {
	if err := h.svc.DeleteResource(c.Request.Context(), c.GetHeader("Authorization"), c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

const pageHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Platform Stack</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh}
/* Login */
.login-wrap{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:1rem}
.login-box{background:#1e293b;border:1px solid #334155;border-radius:1rem;padding:2.5rem;width:100%;max-width:380px}
.login-logo{font-size:1.4rem;font-weight:700;margin-bottom:.25rem}
.login-sub{color:#64748b;font-size:.85rem;margin-bottom:1.75rem}
/* Fields */
.field{margin-bottom:.9rem}
label{display:block;font-size:.78rem;color:#94a3b8;margin-bottom:.35rem;font-weight:500}
input{width:100%;background:#0f172a;border:1px solid #334155;border-radius:.5rem;padding:.6rem .8rem;color:#f8fafc;font-size:.875rem;outline:none;transition:border-color .2s}
input:focus{border-color:#6366f1}
/* Buttons */
.btn{display:inline-flex;align-items:center;gap:.4rem;padding:.5rem 1rem;border-radius:.5rem;font-size:.83rem;font-weight:600;cursor:pointer;border:none;transition:background .15s,opacity .15s;text-decoration:none}
.btn:disabled{opacity:.5;cursor:default}
.btn-primary{background:#6366f1;color:#fff}.btn-primary:hover:not(:disabled){background:#4f46e5}
.btn-danger{background:#ef4444;color:#fff}.btn-danger:hover:not(:disabled){background:#dc2626}
.btn-ghost{background:transparent;color:#94a3b8;border:1px solid #334155}.btn-ghost:hover{color:#e2e8f0;border-color:#475569}
.btn-sm{padding:.3rem .65rem;font-size:.76rem}
.btn-full{width:100%;justify-content:center;padding:.65rem}
/* Alerts */
.alert{padding:.6rem .85rem;border-radius:.5rem;font-size:.82rem;margin-bottom:.9rem}
.alert-error{background:#7f1d1d;color:#fca5a5;border:1px solid #991b1b}
/* App layout */
.app-header{background:#1e293b;border-bottom:1px solid #334155;padding:0 1.5rem;height:54px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10}
.app-logo{font-weight:700;font-size:.95rem;color:#f8fafc}
.header-right{display:flex;align-items:center;gap:.9rem}
.user-email{font-size:.8rem;color:#64748b}
/* Tabs */
.tabs{background:#1e293b;border-bottom:1px solid #334155;padding:0 1.5rem;display:flex;gap:.1rem}
.tab-btn{padding:.7rem .95rem;font-size:.84rem;font-weight:500;color:#64748b;border:none;background:none;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;transition:color .15s,border-color .15s}
.tab-btn:hover{color:#cbd5e1}
.tab-btn.active{color:#818cf8;border-bottom-color:#818cf8}
/* Content */
.content{padding:1.5rem;max-width:1100px;margin:0 auto}
.sec-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:1.1rem}
.sec-title{font-size:1rem;font-weight:600;color:#f1f5f9}
/* Status cards */
.s-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:.9rem}
.s-card{background:#1e293b;border-radius:.7rem;padding:1.2rem;border:1px solid #334155;border-left:4px solid #475569}
.s-card.ok{border-left-color:#22c55e}.s-card.error{border-left-color:#ef4444}.s-card.wait{border-left-color:#475569}
.s-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:.55rem}
.s-name{font-weight:600;font-size:.9rem;display:flex;align-items:center;gap:.45rem}
.dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.dot.ok{background:#22c55e;animation:pulse 2s infinite}.dot.error{background:#ef4444}.dot.wait{background:#475569}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.badge{padding:.18rem .55rem;border-radius:999px;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
.badge.ok{background:#14532d;color:#86efac}.badge.error{background:#7f1d1d;color:#fca5a5}.badge.wait{background:#1e3a5f;color:#93c5fd}
.s-url{font-size:.73rem;color:#475569;margin-bottom:.4rem;word-break:break-all}
.s-meta{font-size:.78rem;color:#64748b}.s-meta span{color:#cbd5e1}
.s-err{font-size:.73rem;color:#fca5a5;margin-top:.3rem}
/* Stat cards */
.stat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:.9rem;margin-bottom:1.25rem}
.stat-card{background:#1e293b;border:1px solid #334155;border-radius:.7rem;padding:1.2rem}
.stat-label{font-size:.73rem;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.35rem}
.stat-value{font-size:2.1rem;font-weight:700;color:#f8fafc;line-height:1}
.stat-sub{font-size:.73rem;color:#475569;margin-top:.3rem}
/* Table */
.tbl-wrap{background:#1e293b;border:1px solid #334155;border-radius:.7rem;overflow:hidden}
table{width:100%;border-collapse:collapse}
th{text-align:left;padding:.6rem 1rem;font-size:.72rem;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #334155;background:#172033}
td{padding:.65rem 1rem;font-size:.84rem;border-bottom:1px solid #1a2744;vertical-align:middle}
tr:last-child td{border-bottom:none}
tr:hover td{background:#1f2f4a}
.muted{color:#64748b;font-size:.77rem}
.empty td{text-align:center;padding:2rem;color:#475569}
/* Modal */
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;z-index:50;padding:1rem}
.modal{background:#1e293b;border:1px solid #334155;border-radius:.75rem;padding:1.5rem;width:100%;max-width:400px}
.modal-title{font-size:.95rem;font-weight:600;margin-bottom:1.1rem;color:#f1f5f9}
.modal-footer{display:flex;gap:.65rem;justify-content:flex-end;margin-top:1.1rem}
.ts{font-size:.73rem;color:#475569;margin-top:.75rem}
</style>
</head>
<body>
<div id="app"></div>
<script>
// ── State ──────────────────────────────────────────────────────
const S = {
  token: localStorage.getItem('ps_token') || '',
  email: localStorage.getItem('ps_email') || '',
  tab: 'status',
};

// ── API ────────────────────────────────────────────────────────
async function api(method, path, body) {
  const opts = { method, headers: {'Content-Type':'application/json'} };
  if (S.token) opts.headers['Authorization'] = 'Bearer ' + S.token;
  if (body !== undefined) opts.body = JSON.stringify(body);
  const r = await fetch(path, opts);
  if (!r.ok) {
    const t = await r.text();
    let msg; try { msg = JSON.parse(t).error || t; } catch { msg = t; }
    throw new Error(msg || 'HTTP ' + r.status);
  }
  if (r.status === 204) return null;
  return r.json();
}

// ── Utils ──────────────────────────────────────────────────────
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function dt(s) { return s ? new Date(s).toLocaleString() : '—'; }
function $(id) { return document.getElementById(id); }
function html(id, h) { const el = typeof id === 'string' ? $(id) : id; if(el) el.innerHTML = h; }

// ── Render ─────────────────────────────────────────────────────
function render() { html('app', S.token ? appShell() : loginView()); }

// ── Login ──────────────────────────────────────────────────────
function loginView() {
  return '<div class="login-wrap"><div class="login-box">' +
    '<div class="login-logo">Platform Stack</div>' +
    '<div class="login-sub">Sign in to continue</div>' +
    '<div id="la"></div>' +
    '<div class="field"><label>Email</label><input id="le" type="email" placeholder="user@example.com"></div>' +
    '<div class="field"><label>Password</label><input id="lp" type="password" placeholder="••••••"></div>' +
    '<button class="btn btn-primary btn-full" id="lb" onclick="doLogin()">Sign in</button>' +
  '</div></div>';
}

document.addEventListener('keydown', e => { if (e.key==='Enter' && $('lb')) doLogin(); });

async function doLogin() {
  const email = ($('le')||{}).value?.trim();
  const pwd   = ($('lp')||{}).value;
  const btn   = $('lb');
  html('la','');
  if (!email || !pwd) { html('la','<div class="alert alert-error">Enter email and password</div>'); return; }
  btn.disabled = true; btn.textContent = 'Signing in…';
  try {
    const res = await api('POST', '/api/auth/login', {email, password: pwd});
    S.token = res.token; S.email = res.email;
    localStorage.setItem('ps_token', S.token);
    localStorage.setItem('ps_email', S.email);
    render(); loadTab();
  } catch(e) {
    html('la','<div class="alert alert-error">'+esc(e.message)+'</div>');
    btn.disabled = false; btn.textContent = 'Sign in';
  }
}

function doLogout() {
  S.token=''; S.email='';
  localStorage.removeItem('ps_token'); localStorage.removeItem('ps_email');
  render();
}

// ── App shell ──────────────────────────────────────────────────
const TABS = [{id:'status',label:'Status'},{id:'dashboard',label:'Dashboard'},{id:'users',label:'Users'},{id:'resources',label:'Resources'}];

function appShell() {
  const tbs = TABS.map(t =>
    '<button class="tab-btn'+(S.tab===t.id?' active':'')+'" onclick="switchTab(\''+t.id+'\')">'+t.label+'</button>'
  ).join('');
  return '<header class="app-header">'+
    '<span class="app-logo">Platform Stack</span>'+
    '<div class="header-right">'+
      '<span class="user-email">'+esc(S.email)+'</span>'+
      '<button class="btn btn-ghost btn-sm" onclick="doLogout()">Logout</button>'+
    '</div></header>'+
    '<nav class="tabs">'+tbs+'</nav>'+
    '<main class="content" id="tc"></main>';
}

function switchTab(tab) {
  S.tab = tab;
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.textContent === (TABS.find(t=>t.id===tab)||{}).label)
  );
  loadTab();
}

function loadTab() {
  const c = $('tc'); if (!c) return;
  c.innerHTML = '<div style="color:#475569;padding:.5rem">Loading…</div>';
  ({status:loadStatus, dashboard:loadDashboard, users:loadUsers, resources:loadResources}[S.tab] || (()=>{}))();
}

// ── Status tab ─────────────────────────────────────────────────
let stTimer;
async function loadStatus() {
  clearInterval(stTimer);
  renderStatus(null);
  const tick = async () => {
    try { renderStatus(await api('GET','/status')); }
    catch(e) { html('tc','<div class="alert alert-error">'+esc(e.message)+'</div>'); }
  };
  await tick();
  stTimer = setInterval(tick, 10000);
}

function renderStatus(data) {
  const items = data || TABS.slice(0,4).map(t=>({name:t.label,health_url:'—'}));
  const cards = items.map(s => {
    const cls = data ? (s.ok?'ok':'error') : 'wait';
    return '<div class="s-card '+cls+'">'+
      '<div class="s-top">'+
        '<span class="s-name"><span class="dot '+cls+'"></span>'+esc(s.name)+'</span>'+
        '<span class="badge '+cls+'">'+(data?(s.ok?'OK':'DOWN'):'…')+'</span>'+
      '</div>'+
      '<div class="s-url">'+esc(s.health_url)+'</div>'+
      (s.ok?'<div class="s-meta">Latency: <span>'+s.latency_ms+' ms</span></div>':'')+
      (s.error?'<div class="s-err">'+esc(s.error)+'</div>':'')+
    '</div>';
  }).join('');
  html('tc',
    '<div class="sec-header"><span class="sec-title">Service Health</span>'+
    '<button class="btn btn-ghost btn-sm" onclick="loadStatus()">Refresh</button></div>'+
    '<div class="s-grid">'+cards+'</div>'+
    '<p class="ts">Auto-refreshes every 10 s · '+new Date().toLocaleTimeString()+'</p>'
  );
}

// ── Dashboard tab ──────────────────────────────────────────────
async function loadDashboard() {
  try {
    const d = await api('GET','/api/dashboard');
    html('tc',
      '<div class="sec-header"><span class="sec-title">Dashboard</span>'+
      '<button class="btn btn-ghost btn-sm" onclick="loadDashboard()">Refresh</button></div>'+
      '<div class="stat-grid">'+
        '<div class="stat-card"><div class="stat-label">Users</div><div class="stat-value">'+esc(d.user_count)+'</div><div class="stat-sub">registered</div></div>'+
        '<div class="stat-card"><div class="stat-label">Resources</div><div class="stat-value">'+esc(d.resource_count)+'</div><div class="stat-sub">created</div></div>'+
      '</div>'+
      '<p class="ts">Updated: '+dt(d.timestamp)+'</p>'
    );
  } catch(e) { html('tc','<div class="alert alert-error">'+esc(e.message)+'</div>'); }
}

// ── Users tab ──────────────────────────────────────────────────
async function loadUsers() {
  try {
    const users = await api('GET','/api/users') || [];
    const rows = users.length
      ? users.map(u =>
          '<tr>'+
          '<td class="muted">'+esc(u.id)+'</td>'+
          '<td>'+esc(u.email)+'</td>'+
          '<td>'+esc(u.name)+'</td>'+
          '<td class="muted">'+dt(u.created_at)+'</td>'+
          '<td><button class="btn btn-danger btn-sm" onclick="deleteUser('+u.id+')">Delete</button></td>'+
          '</tr>'
        ).join('')
      : '<tr class="empty"><td colspan="5">No users yet</td></tr>';
    html('tc',
      '<div class="sec-header"><span class="sec-title">Users</span>'+
      '<button class="btn btn-primary btn-sm" onclick="showModal(\'user\')">+ Add User</button></div>'+
      '<div class="tbl-wrap"><table>'+
      '<thead><tr><th>ID</th><th>Email</th><th>Name</th><th>Created</th><th></th></tr></thead>'+
      '<tbody>'+rows+'</tbody></table></div>'
    );
  } catch(e) { html('tc','<div class="alert alert-error">'+esc(e.message)+'</div>'); }
}

async function deleteUser(id) {
  if (!confirm('Delete user #'+id+'?')) return;
  try { await api('DELETE','/api/users/'+id); loadUsers(); }
  catch(e) { alert('Error: '+e.message); }
}

// ── Resources tab ──────────────────────────────────────────────
async function loadResources() {
  try {
    const list = await api('GET','/api/resources') || [];
    const rows = list.length
      ? list.map(r =>
          '<tr>'+
          '<td class="muted">'+esc(r.id)+'</td>'+
          '<td>'+esc(r.name)+'</td>'+
          '<td class="muted">'+esc(r.data||'—')+'</td>'+
          '<td class="muted">'+esc(r.owner_id)+'</td>'+
          '<td class="muted">'+dt(r.created_at)+'</td>'+
          '<td><button class="btn btn-danger btn-sm" onclick="deleteResource('+r.id+')">Delete</button></td>'+
          '</tr>'
        ).join('')
      : '<tr class="empty"><td colspan="6">No resources yet</td></tr>';
    html('tc',
      '<div class="sec-header"><span class="sec-title">Resources</span>'+
      '<button class="btn btn-primary btn-sm" onclick="showModal(\'resource\')">+ Add Resource</button></div>'+
      '<div class="tbl-wrap"><table>'+
      '<thead><tr><th>ID</th><th>Name</th><th>Data</th><th>Owner ID</th><th>Created</th><th></th></tr></thead>'+
      '<tbody>'+rows+'</tbody></table></div>'
    );
  } catch(e) { html('tc','<div class="alert alert-error">'+esc(e.message)+'</div>'); }
}

async function deleteResource(id) {
  if (!confirm('Delete resource #'+id+'?')) return;
  try { await api('DELETE','/api/resources/'+id); loadResources(); }
  catch(e) { alert('Error: '+e.message); }
}

// ── Modals ─────────────────────────────────────────────────────
function showModal(type) {
  const isUser = type === 'user';
  const fields = isUser
    ? '<div class="field"><label>Email</label><input id="mf1" type="email" placeholder="user@example.com"></div>'+
      '<div class="field"><label>Name</label><input id="mf2" type="text" placeholder="John Doe"></div>'
    : '<div class="field"><label>Name</label><input id="mf1" type="text" placeholder="Resource name"></div>'+
      '<div class="field"><label>Data</label><input id="mf2" type="text" placeholder="Optional data"></div>'+
      '<div class="field"><label>Owner ID</label><input id="mf3" type="number" placeholder="1"></div>';

  document.body.insertAdjacentHTML('beforeend',
    '<div class="overlay" id="modal" onclick="if(event.target.id===\'modal\')closeModal()">'+
    '<div class="modal">'+
    '<div class="modal-title">'+(isUser?'Add User':'Add Resource')+'</div>'+
    '<div id="ma"></div>'+fields+
    '<div class="modal-footer">'+
      '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>'+
      '<button class="btn btn-primary" id="msub" onclick="submitModal(\''+type+'\')">Create</button>'+
    '</div></div></div>'
  );
  ($('mf1')||{}).focus?.();
}

async function submitModal(type) {
  const btn = $('msub');
  html('ma','');
  let body, err;

  if (type === 'user') {
    const email = ($('mf1')||{}).value?.trim();
    const name  = ($('mf2')||{}).value?.trim();
    if (!email || !name) err = 'Fill in all fields';
    else body = {email, name};
  } else {
    const name    = ($('mf1')||{}).value?.trim();
    const data    = ($('mf2')||{}).value?.trim();
    const ownerId = parseInt(($('mf3')||{}).value, 10);
    if (!name || !ownerId) err = 'Name and Owner ID are required';
    else body = {name, data, owner_id: ownerId};
  }

  if (err) { html('ma','<div class="alert alert-error">'+esc(err)+'</div>'); return; }

  btn.disabled = true; btn.textContent = 'Creating…';
  try {
    await api('POST', '/api/'+(type==='user'?'users':'resources'), body);
    closeModal();
    type === 'user' ? loadUsers() : loadResources();
  } catch(e) {
    html('ma','<div class="alert alert-error">'+esc(e.message)+'</div>');
    btn.disabled = false; btn.textContent = 'Create';
  }
}

function closeModal() { const m = $('modal'); if (m) m.remove(); }
document.addEventListener('keydown', e => { if (e.key==='Escape') closeModal(); });

// ── Init ───────────────────────────────────────────────────────
render();
if (S.token) loadTab();
</script>
</body>
</html>`
