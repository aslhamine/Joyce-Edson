const settings = window.WEDDING_SUPABASE || {};
const forceLocalMode = new URLSearchParams(window.location.search).get("local") === "1";
const hasConfig = !forceLocalMode && Boolean(settings.url && settings.anonKey && window.supabase);
const client = hasConfig ? window.supabase.createClient(settings.url, settings.anonKey) : null;

const defaultTables = [
  { id: crypto.randomUUID(), number: 1, name: "Rosa", capacity: 8 },
  { id: crypto.randomUUID(), number: 2, name: "Gardenia", capacity: 8 },
  { id: crypto.randomUUID(), number: 3, name: "Jasmim", capacity: 8 },
  { id: crypto.randomUUID(), number: 4, name: "Tulipa", capacity: 8 }
];

const demoGuests = [
  { id: crypto.randomUUID(), name: "Carlos & Anita", phone: "+258 84 000 0001", email: "", group_size: 2, max_companions: 2, table_id: null, invite_token: crypto.randomUUID(), status: "pending" },
  { id: crypto.randomUUID(), name: "Tia Lurdes", phone: "+258 84 000 0002", email: "", group_size: 1, max_companions: 1, table_id: null, invite_token: crypto.randomUUID(), status: "pending" }
];

const storageKey = "joyce-edson-admin-data";
const inviteDefaults = {
  message: "Com carinho, convidamos para celebrar o casamento de Joyce & Edson no dia 22 de Agosto de 2026.",
  image: "assets/images/familia-sentada.png",
  showTable: true
};

const loginPanel = document.getElementById("loginPanel");
const dashboardPanel = document.getElementById("dashboardPanel");
const loginForm = document.getElementById("loginForm");
const loginStatus = document.getElementById("loginStatus");
const dashboardStatus = document.getElementById("dashboardStatus");
const adminList = document.getElementById("adminList");
const adminStats = document.getElementById("adminStats");
const logoutButton = document.getElementById("logoutButton");
const refreshButton = document.getElementById("refreshButton");
const tableBoard = document.getElementById("tableBoard");
const guestForm = document.getElementById("guestForm");
const guestImport = document.getElementById("guestImport");
const importButton = document.getElementById("importButton");
const tableForm = document.getElementById("tableForm");
const autoSeatButton = document.getElementById("autoSeatButton");
const inviteForm = document.getElementById("inviteForm");
const inviteMessage = document.getElementById("inviteMessage");
const inviteImage = document.getElementById("inviteImage");
const inviteImageUpload = document.getElementById("inviteImageUpload");
const inviteImagePreview = document.getElementById("inviteImagePreview");
const showTableInput = document.getElementById("showTableInput");
const inviteList = document.getElementById("inviteList");
const mobileMenuButton = document.getElementById("mobileMenuButton");
const mobileModuleSheet = document.getElementById("mobileModuleSheet");
const mobileMenuBackdrop = document.getElementById("mobileMenuBackdrop");

let currentFilter = "all";
let activeTab = "rsvps";
let rsvps = [];
let guests = [];
let tables = [];
let inviteSettings = { ...inviteDefaults };
let refreshTimer;

function escapeHtml(value) {
  return String(value ?? "")
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

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", reject);
    reader.readAsDataURL(file);
  });
}

function updateInviteImagePreview(src) {
  if (!inviteImagePreview) return;

  const image = inviteImagePreview.querySelector("img");
  if (!src) {
    inviteImagePreview.hidden = true;
    image.removeAttribute("src");
    return;
  }

  image.src = src;
  inviteImagePreview.hidden = false;
}

async function uploadInviteImage(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    setStatus("Escolha um ficheiro de imagem valido.");
    return;
  }

  setStatus("A carregar imagem...");

  if (client) {
    const extension = file.name.split(".").pop() || "jpg";
    const path = `convites/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const { error } = await client.storage
      .from("invite-assets")
      .upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: true
      });

    if (!error) {
      const { data } = client.storage.from("invite-assets").getPublicUrl(path);
      inviteImage.value = data.publicUrl;
      updateInviteImagePreview(data.publicUrl);
      inviteSettings = {
        message: inviteMessage.value.trim() || inviteDefaults.message,
        image: data.publicUrl,
        showTable: showTableInput.checked
      };
      await saveInviteSettings();
      renderActiveTab();
      setStatus("Imagem carregada e guardada no modelo do convite.");
      return;
    }

    setStatus(`Nao foi possivel enviar a imagem. Confirme se o bucket invite-assets existe no Supabase.`);
    return;
  }

  const dataUrl = await readFileAsDataUrl(file);
  inviteImage.value = dataUrl;
  updateInviteImagePreview(dataUrl);
  inviteSettings = {
    message: inviteMessage.value.trim() || inviteDefaults.message,
    image: dataUrl,
    showTable: showTableInput.checked
  };
  await saveInviteSettings();
  renderActiveTab();
  setStatus("Imagem carregada e guardada neste navegador.");
}

function showDashboard() {
  loginPanel.hidden = true;
  dashboardPanel.hidden = false;
}

function showLogin() {
  loginPanel.hidden = false;
  dashboardPanel.hidden = true;
}

function loadLocalData() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
    guests = saved.guests?.length ? saved.guests : demoGuests;
    tables = saved.tables?.length ? saved.tables : defaultTables;
    inviteSettings = { ...inviteDefaults, ...(saved.inviteSettings || {}) };
  } catch {
    guests = demoGuests;
    tables = defaultTables;
    inviteSettings = { ...inviteDefaults };
  }

  autoSeatGuests(false);
}

function saveLocalData() {
  localStorage.setItem(storageKey, JSON.stringify({ guests, tables, inviteSettings }));
}

async function loadPlannerData() {
  if (!client) return;

  const [tableResult, guestResult, settingsResult] = await Promise.all([
    client.from("event_tables").select("*").order("number", { ascending: true }),
    client.from("invited_guests").select("*").order("name", { ascending: true }),
    client.from("invite_settings").select("*").eq("id", "default").maybeSingle()
  ]);

  if (!tableResult.error && tableResult.data?.length) tables = tableResult.data.map(normalizeTable);
  if (!guestResult.error && guestResult.data?.length) guests = guestResult.data.map(normalizeGuest);
  if (!settingsResult.error && settingsResult.data) {
    inviteSettings = {
      message: settingsResult.data.message || inviteDefaults.message,
      image: settingsResult.data.image || inviteDefaults.image,
      showTable: settingsResult.data.show_table !== false
    };
  }

  autoSeatGuests(false);
}

async function savePlannerData() {
  saveLocalData();
  if (!client) return;

  const tableRows = tables.map((table) => ({
    id: table.id,
    number: table.number,
    name: table.name,
    capacity: table.capacity
  }));
  const guestRows = guests.map((guest) => ({
    id: guest.id,
    name: guest.name,
    phone: guest.phone || null,
    email: guest.email || null,
    group_size: guest.group_size,
    max_companions: guest.max_companions,
    table_id: guest.table_id || null,
    invite_token: guest.invite_token,
    status: guest.status || "pending"
  }));

  await Promise.all([
    tableRows.length ? client.from("event_tables").upsert(tableRows) : Promise.resolve(),
    guestRows.length ? client.from("invited_guests").upsert(guestRows) : Promise.resolve(),
    client.from("invite_settings").upsert({
      id: "default",
      message: inviteSettings.message,
      image: inviteSettings.image,
      show_table: inviteSettings.showTable
    })
  ]);
}

async function saveInviteSettings() {
  saveLocalData();
  if (!client) return { saved: true };

  const { error } = await client.from("invite_settings").upsert({
    id: "default",
    message: inviteSettings.message,
    image: inviteSettings.image,
    show_table: inviteSettings.showTable
  });

  if (error) return { saved: false, error };
  return { saved: true };
}

function normalizeGuest(row) {
  return {
    id: row.id || crypto.randomUUID(),
    name: row.name || row.nome || "Convidado",
    phone: row.phone || row.telefone || "",
    email: row.email || "",
    group_size: Number(row.group_size || row.pessoas || row.quantity || 1),
    max_companions: Number(row.max_companions || row.limite || row.group_size || row.pessoas || 1),
    table_id: row.table_id || null,
    invite_token: row.invite_token || crypto.randomUUID(),
    status: row.status || "pending"
  };
}

function normalizeTable(row) {
  return {
    id: row.id || crypto.randomUUID(),
    number: Number(row.number || row.numero || tables.length + 1),
    name: row.name || row.nome || `Mesa ${row.number || tables.length + 1}`,
    capacity: Number(row.capacity || row.capacidade || 8)
  };
}

function getTableById(id) {
  return tables.find((item) => item.id === id);
}

function getTableOccupancy(tableId) {
  return guests
    .filter((guest) => guest.table_id === tableId)
    .reduce((total, guest) => total + Number(guest.group_size || 1), 0);
}

function canSeatGuest(guest, tableId) {
  const table = getTableById(tableId);
  if (!table) return false;
  const current = getTableOccupancy(tableId) - (guest.table_id === tableId ? Number(guest.group_size || 1) : 0);
  return current + Number(guest.group_size || 1) <= Number(table.capacity || 0);
}

function autoSeatGuests(announce = true) {
  const seated = [];

  guests.forEach((guest) => {
    const currentTable = guest.table_id ? getTableById(guest.table_id) : null;
    if (currentTable) {
      const used = seated
        .filter((item) => item.table_id === currentTable.id)
        .reduce((total, item) => total + Number(item.group_size || 1), 0);
      if (used + Number(guest.group_size || 1) <= Number(currentTable.capacity || 0)) {
        seated.push({ ...guest });
        return;
      }
    }

    const table = tables.find((candidate) => {
      const used = seated
        .filter((item) => item.table_id === candidate.id)
        .reduce((total, item) => total + Number(item.group_size || 1), 0);
      return used + Number(guest.group_size || 1) <= Number(candidate.capacity || 0);
    });

    seated.push({ ...guest, table_id: table?.id || null });
  });

  guests = seated;
  saveLocalData();
  if (announce) setStatus("Distribuicao automatica concluida.");
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
  const seated = guests.filter((item) => item.table_id).length;
  const seatsUsed = guests.reduce((total, guest) => total + Number(guest.group_size || 1), 0);
  const seatsTotal = tables.reduce((total, table) => total + Number(table.capacity || 0), 0);
  const stats = [
    ["RSVPs", rsvps.length],
    ["Presentes", attending],
    ["Ausentes", declined],
    ["Por aprovar", pending],
    ["Convidados", guests.length],
    ["Alocados", seated],
    ["Lugares", `${seatsUsed}/${seatsTotal}`]
  ];

  adminStats.innerHTML = stats.map(([label, value]) => `
    <article class="stat-card"><strong>${escapeHtml(value)}</strong><span>${label}</span></article>
  `).join("");
}

function renderRsvps() {
  const rows = getFilteredRows();
  renderStats();

  if (!rows.length) {
    adminList.innerHTML = '<article class="admin-card"><p>Nenhuma confirmacao neste filtro.</p></article>';
    return;
  }

  adminList.innerHTML = rows.map((item) => {
    const tableLabel = item.table_name ? `Mesa ${item.table_name}` : "Mesa a confirmar";
    const answer = item.answer === "sim" ? "Vai comparecer" : "Nao podera comparecer";
    const message = item.message ? escapeHtml(item.message) : "Sem mensagem.";
    const approval = item.is_approved ? "Publicada no mural" : "Ainda privada";
    const guestCount = item.guest_count ? ` · ${item.guest_count} pessoa(s)` : "";

    return `
      <article class="admin-card">
        <header>
          <span class="admin-meta">${answer} · ${approval}${guestCount}</span>
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

function renderTables() {
  renderStats();
  const unseated = guests.filter((guest) => !guest.table_id);
  const columns = tables.map((table) => {
    const tableGuests = guests.filter((guest) => guest.table_id === table.id);
    const occupied = getTableOccupancy(table.id);
    const isFull = occupied >= table.capacity;

    return `
      <section class="table-column ${isFull ? "is-full" : ""}" data-table-id="${table.id}">
        <header>
          <div>
            <strong>Mesa ${escapeHtml(table.number)} · ${escapeHtml(table.name)}</strong>
            <span>${occupied}/${table.capacity} lugares</span>
          </div>
          <button type="button" data-table-remove="${table.id}" aria-label="Remover mesa">×</button>
        </header>
        <div class="table-guests" data-drop-zone="${table.id}">
          ${tableGuests.map(renderGuestChip).join("") || '<p class="empty-note">Arraste convidados para aqui.</p>'}
        </div>
      </section>
    `;
  }).join("");

  tableBoard.innerHTML = `
    <section class="table-column unseated" data-table-id="">
      <header><div><strong>Sem mesa</strong><span>${unseated.length} grupo(s)</span></div></header>
      <div class="table-guests" data-drop-zone="">${unseated.map(renderGuestChip).join("") || '<p class="empty-note">Tudo alocado.</p>'}</div>
    </section>
    ${columns}
  `;
}

function renderGuestChip(guest) {
  return `
    <article class="guest-chip" draggable="true" data-guest-id="${guest.id}">
      <strong>${escapeHtml(guest.name)}</strong>
      <span>${Number(guest.group_size || 1)} pessoa(s) · limite ${Number(guest.max_companions || guest.group_size || 1)}</span>
      <button type="button" data-unseat="${guest.id}">Remover da mesa</button>
    </article>
  `;
}

function buildInviteUrl(guest) {
  const url = new URL("index.html", window.location.href);
  url.searchParams.set("gid", guest.invite_token);
  return url.href;
}

function renderInvites() {
  inviteMessage.value = inviteSettings.message;
  inviteImage.value = inviteSettings.image;
  showTableInput.checked = inviteSettings.showTable;
  updateInviteImagePreview(inviteSettings.image);

  inviteList.innerHTML = guests.map((guest) => {
    const inviteUrl = buildInviteUrl(guest);
    const table = getTableById(guest.table_id);
    const text = `${inviteSettings.message}\n\n${inviteUrl}`;
    const whatsapp = `https://wa.me/${String(guest.phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
    const mailto = `mailto:${guest.email || ""}?subject=${encodeURIComponent("Convite Joyce & Edson")}&body=${encodeURIComponent(text)}`;

    return `
      <article class="invite-card">
        <div>
          <strong>${escapeHtml(guest.name)}</strong>
          <span>${table ? `Mesa ${table.number} · ${table.name}` : "Mesa a confirmar"} · limite ${guest.max_companions}</span>
        </div>
        <input readonly value="${escapeHtml(inviteUrl)}">
        <div class="invite-qr">
          <canvas data-qr-code="${escapeHtml(inviteUrl)}" aria-label="QR code do convite"></canvas>
          <button type="button" data-download-qr="${escapeHtml(guest.id)}">Descarregar QR</button>
        </div>
        <div class="admin-actions">
          <a href="${whatsapp}" target="_blank" rel="noreferrer">WhatsApp</a>
          <a href="${mailto}">E-mail</a>
          <button type="button" data-copy-link="${escapeHtml(inviteUrl)}">Copiar link</button>
        </div>
      </article>
    `;
  }).join("");

  renderQrCodes();
}

function renderQrCodes() {
  if (!window.QRCode) {
    inviteList.querySelectorAll(".invite-qr").forEach((item) => {
      const canvas = item.querySelector("canvas[data-qr-code]");
      const src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(canvas.dataset.qrCode)}`;
      canvas.hidden = true;
      item.insertAdjacentHTML("afterbegin", `<img class="qr-fallback" src="${src}" alt="QR code do convite">`);
    });
    return;
  }

  inviteList.querySelectorAll("canvas[data-qr-code]").forEach((canvas) => {
    window.QRCode.toCanvas(canvas, canvas.dataset.qrCode, {
      width: 148,
      margin: 1,
      color: {
        dark: "#2a211d",
        light: "#fffaf4"
      }
    });
  });
}

function renderActiveTab() {
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.panel !== activeTab;
  });
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === activeTab);
  });
  closeMobileMenu();

  if (activeTab === "rsvps") renderRsvps();
  if (activeTab === "tables") renderTables();
  if (activeTab === "invites") renderInvites();
}

function openMobileMenu() {
  mobileModuleSheet.hidden = false;
  mobileMenuBackdrop.hidden = false;
  mobileMenuButton.classList.add("is-open");
  mobileMenuButton.setAttribute("aria-expanded", "true");
  document.body.classList.add("admin-menu-open");
}

function closeMobileMenu() {
  if (!mobileModuleSheet || !mobileMenuBackdrop || !mobileMenuButton) return;
  mobileModuleSheet.hidden = true;
  mobileMenuBackdrop.hidden = true;
  mobileMenuButton.classList.remove("is-open");
  mobileMenuButton.setAttribute("aria-expanded", "false");
  document.body.classList.remove("admin-menu-open");
}

function activateTab(tabName, shouldScroll = true) {
  activeTab = tabName;
  renderActiveTab();
  if (shouldScroll) {
    document.querySelector(`[data-panel="${activeTab}"]`)?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}

async function loadRsvps() {
  if (!client) {
    rsvps = JSON.parse(localStorage.getItem("joyce-edson-rsvps") || "[]");
    renderActiveTab();
    setStatus("Modo local: dados guardados neste navegador.");
    return;
  }

  setStatus("A carregar confirmacoes...");
  const { data, error } = await client
    .from("rsvps")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    setStatus(`Nao foi possivel carregar as confirmacoes: ${error.message}`);
    return;
  }

  rsvps = data || [];
  setStatus(`Actualizado: ${new Intl.DateTimeFormat("pt-MZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date())}`);
  renderActiveTab();
}

function startAutoRefresh() {
  window.clearInterval(refreshTimer);
  refreshTimer = window.setInterval(() => {
    if (!dashboardPanel.hidden) loadRsvps();
  }, 6000);
}

async function updateApproval(id, isApproved) {
  if (!client) return;
  setStatus("A actualizar...");
  const { error } = await client
    .from("rsvps")
    .update({ is_approved: isApproved })
    .eq("id", id);

  if (error) {
    setStatus("Nao foi possivel actualizar esta mensagem.");
    return;
  }

  await loadRsvps();
}

async function deleteRsvp(id) {
  const confirmed = window.confirm("Remover esta confirmacao definitivamente?");
  if (!confirmed || !client) return;

  setStatus("A remover...");
  const { error } = await client
    .from("rsvps")
    .delete()
    .eq("id", id);

  if (error) {
    setStatus("Nao foi possivel remover esta confirmacao.");
    return;
  }

  await loadRsvps();
}

function parseGuestImport(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, phone = "", email = "", groupSize = "1", limit = groupSize] = line.split(",").map((item) => item.trim());
      return normalizeGuest({ name, phone, email, group_size: groupSize, max_companions: limit });
    });
}

async function init() {
  loadLocalData();

  if (!client) {
    loginStatus.textContent = "Sem Supabase configurado. Pode entrar em modo local para testar o painel.";
    loginForm.querySelector("button").textContent = "Entrar em modo local";
    document.getElementById("adminEmail").required = false;
    document.getElementById("adminPassword").required = false;
    showLogin();
    return;
  }

  const { data } = await client.auth.getSession();
  if (data.session) {
    showDashboard();
    await loadPlannerData();
    await loadRsvps();
    startAutoRefresh();
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginStatus.textContent = "A entrar...";

  if (!client) {
    loginStatus.textContent = "";
    showDashboard();
    await loadRsvps();
    renderActiveTab();
    return;
  }

  const email = document.getElementById("adminEmail").value.trim();
  const password = document.getElementById("adminPassword").value;
  const { error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    loginStatus.textContent = "Email ou palavra-passe invalidos.";
    return;
  }

  loginStatus.textContent = "";
  showDashboard();
  await loadPlannerData();
  await loadRsvps();
  startAutoRefresh();
});

logoutButton.addEventListener("click", async () => {
  window.clearInterval(refreshTimer);
  if (client) await client.auth.signOut();
  showLogin();
});

refreshButton.addEventListener("click", loadRsvps);
autoSeatButton.addEventListener("click", () => {
  autoSeatGuests();
  void savePlannerData();
  renderActiveTab();
});

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-filter]").forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    currentFilter = button.dataset.filter;
    renderRsvps();
  });
});

document.querySelectorAll("[data-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    activateTab(button.dataset.tab);
  });
});

mobileMenuButton.addEventListener("click", () => {
  if (mobileModuleSheet.hidden) openMobileMenu();
  else closeMobileMenu();
});

mobileMenuBackdrop.addEventListener("click", closeMobileMenu);

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMobileMenu();
});

adminList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;
  if (action === "approve") await updateApproval(id, true);
  if (action === "hide") await updateApproval(id, false);
  if (action === "delete") await deleteRsvp(id);
});

guestForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(guestForm);
  guests.push(normalizeGuest({
    name: form.get("name"),
    phone: form.get("phone"),
    email: form.get("email"),
    group_size: form.get("group_size"),
    max_companions: form.get("max_companions")
  }));
  autoSeatGuests(false);
  void savePlannerData();
  guestForm.reset();
  renderActiveTab();
});

tableForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(tableForm);
  tables.push(normalizeTable({
    number: form.get("number"),
    name: form.get("name"),
    capacity: form.get("capacity")
  }));
  void savePlannerData();
  tableForm.reset();
  renderActiveTab();
});

importButton.addEventListener("click", () => {
  const imported = parseGuestImport(guestImport.value);
  if (!imported.length) return;
  guests = [...guests, ...imported];
  autoSeatGuests(false);
  void savePlannerData();
  guestImport.value = "";
  renderActiveTab();
  setStatus(`${imported.length} convidado(s) importado(s).`);
});

inviteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  inviteSettings = {
    message: inviteMessage.value.trim() || inviteDefaults.message,
    image: inviteImage.value.trim() || inviteDefaults.image,
    showTable: showTableInput.checked
  };
  const result = await saveInviteSettings();
  renderActiveTab();
  setStatus(result.saved ? "Modelo do convite guardado." : `Nao foi possivel guardar o modelo: ${result.error.message}`);
});

inviteImage.addEventListener("input", () => {
  updateInviteImagePreview(inviteImage.value.trim());
});

inviteImageUpload.addEventListener("change", () => {
  void uploadInviteImage(inviteImageUpload.files?.[0]);
});

tableBoard.addEventListener("dragstart", (event) => {
  const chip = event.target.closest("[data-guest-id]");
  if (!chip) return;
  event.dataTransfer.setData("text/plain", chip.dataset.guestId);
});

tableBoard.addEventListener("dragover", (event) => {
  if (event.target.closest("[data-drop-zone]")) event.preventDefault();
});

tableBoard.addEventListener("drop", (event) => {
  const zone = event.target.closest("[data-drop-zone]");
  if (!zone) return;
  event.preventDefault();

  const guestId = event.dataTransfer.getData("text/plain");
  const guest = guests.find((item) => item.id === guestId);
  const tableId = zone.dataset.dropZone || null;
  if (!guest) return;

  if (tableId && !canSeatGuest(guest, tableId)) {
    setStatus("Esta mesa ja atingiu o limite de capacidade.");
    return;
  }

  guest.table_id = tableId;
  void savePlannerData();
  renderActiveTab();
});

tableBoard.addEventListener("click", (event) => {
  const unseat = event.target.closest("[data-unseat]");
  const removeTable = event.target.closest("[data-table-remove]");

  if (unseat) {
    const guest = guests.find((item) => item.id === unseat.dataset.unseat);
    if (guest) guest.table_id = null;
    void savePlannerData();
    renderActiveTab();
  }

  if (removeTable) {
    const tableId = removeTable.dataset.tableRemove;
    guests = guests.map((guest) => guest.table_id === tableId ? { ...guest, table_id: null } : guest);
    tables = tables.filter((table) => table.id !== tableId);
    void savePlannerData();
    if (client) void client.from("event_tables").delete().eq("id", tableId);
    renderActiveTab();
  }
});

inviteList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-copy-link]");
  const qrButton = event.target.closest("[data-download-qr]");

  if (button) {
    await navigator.clipboard.writeText(button.dataset.copyLink);
    button.textContent = "Copiado";
    setTimeout(() => { button.textContent = "Copiar link"; }, 1400);
  }

  if (qrButton) {
    const card = qrButton.closest(".invite-card");
    const guestName = card.querySelector("strong")?.textContent || "convite";
    const canvas = card.querySelector("canvas");
    const fallback = card.querySelector(".qr-fallback");

    const link = document.createElement("a");
    link.download = `qr-${guestName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
    link.href = fallback?.src || canvas.toDataURL("image/png");
    if (fallback) {
      link.target = "_blank";
      link.rel = "noreferrer";
    }
    link.click();
  }
});

init();
