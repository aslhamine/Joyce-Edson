const settings = window.WEDDING_SUPABASE || {};
const hasConfig = Boolean(settings.url && settings.anonKey && window.supabase);
const client = hasConfig ? window.supabase.createClient(settings.url, settings.anonKey) : null;

const loginPanel = document.getElementById("loginPanel");
const dashboardPanel = document.getElementById("dashboardPanel");
const loginForm = document.getElementById("loginForm");
const loginStatus = document.getElementById("loginStatus");
const dashboardStatus = document.getElementById("dashboardStatus");
const adminList = document.getElementById("adminList");
const adminStats = document.getElementById("adminStats");
const logoutButton = document.getElementById("logoutButton");
const refreshButton = document.getElementById("refreshButton");
let currentFilter = "all";
let rsvps = [];
let refreshTimer;

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  return new Intl.DateTimeFormat("pt-MZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function setStatus(message) {
  dashboardStatus.textContent = message || "";
}

function showDashboard() {
  loginPanel.hidden = true;
  dashboardPanel.hidden = false;
}

function showLogin() {
  loginPanel.hidden = false;
  dashboardPanel.hidden = true;
}

function getFilteredRows() {
  return rsvps.filter((item) => {
    if (currentFilter === "pending") return item.message && !item.is_approved;
    if (currentFilter === "approved") return item.is_approved;
    if (currentFilter === "attending") return item.answer === "sim";
    if (currentFilter === "declined") return item.answer === "nao";
    return true;
  });
}

function renderStats() {
  const attending = rsvps.filter((item) => item.answer === "sim").length;
  const declined = rsvps.filter((item) => item.answer === "nao").length;
  const pending = rsvps.filter((item) => item.message && !item.is_approved).length;
  const approved = rsvps.filter((item) => item.is_approved).length;
  const stats = [
    ["Total", rsvps.length],
    ["Presentes", attending],
    ["Ausentes", declined],
    ["Por aprovar", pending],
    ["Publicadas", approved]
  ];

  adminStats.innerHTML = stats.map(([label, value]) => `
    <article class="stat-card"><strong>${value}</strong><span>${label}</span></article>
  `).join("");
}

function renderRows() {
  const rows = getFilteredRows();
  renderStats();

  if (!rows.length) {
    adminList.innerHTML = '<article class="admin-card"><p>Nenhuma confirmação neste filtro.</p></article>';
    return;
  }

  adminList.innerHTML = rows.map((item) => {
    const tableLabel = item.table_name ? `Mesa ${item.table_name}` : "Mesa a confirmar";
    const answer = item.answer === "sim" ? "Vai comparecer" : "Não poderá comparecer";
    const message = item.message ? escapeHtml(item.message) : "Sem mensagem.";
    const approval = item.is_approved ? "Publicada no mural" : "Ainda privada";

    return `
      <article class="admin-card">
        <header>
          <span class="admin-meta">${answer} · ${approval}</span>
          <h2>${escapeHtml(item.name)}</h2>
          <p>${escapeHtml(tableLabel)} · ${escapeHtml(item.phone || "Sem telefone")} · ${formatDate(item.created_at)}</p>
        </header>
        <p class="admin-message">${message}</p>
        <div class="admin-actions">
          <button type="button" data-action="approve" data-id="${item.id}" ${item.is_approved || !item.message ? "disabled" : ""}>Aprovar</button>
          <button type="button" data-action="hide" data-id="${item.id}" ${!item.is_approved ? "disabled" : ""}>Ocultar</button>
          <button class="danger" type="button" data-action="delete" data-id="${item.id}">Remover</button>
        </div>
      </article>
    `;
  }).join("");
}

async function loadRsvps() {
  setStatus("A carregar confirmações...");
  const { data, error } = await client
    .from("rsvps")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    setStatus(`Não foi possível carregar as confirmações: ${error.message}`);
    return;
  }

  rsvps = data || [];
  setStatus(`Actualizado: ${new Intl.DateTimeFormat("pt-MZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date())}`);
  renderRows();
}

function startAutoRefresh() {
  window.clearInterval(refreshTimer);
  refreshTimer = window.setInterval(() => {
    if (!dashboardPanel.hidden) loadRsvps();
  }, 6000);
}

async function updateApproval(id, isApproved) {
  setStatus("A actualizar...");
  const { error } = await client
    .from("rsvps")
    .update({ is_approved: isApproved })
    .eq("id", id);

  if (error) {
    setStatus("Não foi possível actualizar esta mensagem.");
    return;
  }

  await loadRsvps();
}

async function deleteRsvp(id) {
  const confirmed = window.confirm("Remover esta confirmação definitivamente?");
  if (!confirmed) return;

  setStatus("A remover...");
  const { error } = await client
    .from("rsvps")
    .delete()
    .eq("id", id);

  if (error) {
    setStatus("Não foi possível remover esta confirmação.");
    return;
  }

  await loadRsvps();
}

async function init() {
  if (!client) {
    loginStatus.textContent = "Configure primeiro o Supabase em js/supabase-config.js.";
    loginForm.querySelector("button").disabled = true;
    return;
  }

  const { data } = await client.auth.getSession();
  if (data.session) {
    showDashboard();
    await loadRsvps();
    startAutoRefresh();
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginStatus.textContent = "A entrar...";

  const email = document.getElementById("adminEmail").value.trim();
  const password = document.getElementById("adminPassword").value;
  const { error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    loginStatus.textContent = "Email ou palavra-passe inválidos.";
    return;
  }

  loginStatus.textContent = "";
  showDashboard();
  await loadRsvps();
  startAutoRefresh();
});

logoutButton.addEventListener("click", async () => {
  window.clearInterval(refreshTimer);
  await client.auth.signOut();
  showLogin();
});

refreshButton.addEventListener("click", loadRsvps);

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-filter]").forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    currentFilter = button.dataset.filter;
    renderRows();
  });
});

adminList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;
  if (action === "approve") await updateApproval(id, true);
  if (action === "hide") await updateApproval(id, false);
  if (action === "delete") await deleteRsvp(id);
});

init();
