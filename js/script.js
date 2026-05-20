const weddingDate = new Date("2026-08-22T10:00:00+02:00");
const whatsappNumber = "258879304273";

const tables = {
  1: "Rosa",
  2: "Gardénia",
  3: "Jasmim",
  4: "Tulipa",
  5: "Orquídea",
  6: "Magnólia",
  7: "Camélia",
  8: "Lavanda",
  9: "Peónia",
  10: "Dália",
  11: "Glicínia",
  12: "Frésia",
  13: "Hortênsia",
  14: "Violeta",
  15: "Begónia",
  16: "Clematite",
  17: "Azálea",
  18: "Íris",
  19: "Crisântemo",
  20: "Mimosa"
};

const gifts = [
  ["Lua de mel", "Uma contribuição para a primeira viagem como casal casado."],
  ["Lar da família", "Para mobilar e cuidar dos detalhes do nosso novo capítulo."],
  ["Futuro do Kayler", "Um gesto de amor para os sonhos do nosso filho."],
  ["Mensagem de carinho", "Uma carta, uma oração ou uma memória partilhada."]
];

const params = new URLSearchParams(window.location.search);
const guestFromLink = (params.get("nome") || "").trim();
const guest = guestFromLink || "convidado(a)";
const table = Number(params.get("mesa"));
const tableNameFromLink = (params.get("mesaNome") || "").trim();
const inviteToken = (params.get("gid") || "").trim();
const maxGuests = Math.max(1, Number(params.get("limite") || 1));
const customInviteMessage = (params.get("msg") || "").trim();
const customInviteImage = (params.get("img") || "").trim();
const shouldShowTable = params.get("vermesa") !== "0";
const wallStorageKey = "joyce-edson-guest-wall";
const supabaseSettings = window.WEDDING_SUPABASE || {};
const hasSupabaseConfig = Boolean(supabaseSettings.url && supabaseSettings.anonKey && window.supabase);
const weddingDb = hasSupabaseConfig
  ? window.supabase.createClient(supabaseSettings.url, supabaseSettings.anonKey)
  : null;
const fallbackWallMessages = [
  {
    name: "Tia Lurdes",
    table: "Mesa Gardénia",
    message: "Que bênção acompanhar esta família crescer. Estaremos lá com muito amor!",
    time: "Hoje"
  },
  {
    name: "Carlos & Anita",
    table: "Mesa Orquídea",
    message: "Joyce, és linda! Edson, és sortudo! A ver já amanhã.",
    time: "Ontem"
  }
];

function getTableLabel() {
  if (!shouldShowTable) return "Mesa reservada";
  if (tableNameFromLink) return `Mesa ${tableNameFromLink}`;
  return table && tables[table] ? `Mesa ${tables[table]}` : "Mesa a confirmar";
}

function getTableName() {
  if (tableNameFromLink) return tableNameFromLink;
  return table && tables[table] ? tables[table] : null;
}

function setGuestDetails() {
  document.getElementById("guestName").textContent = guest;
  const rsvpName = document.getElementById("rsvpName");
  const guestCount = document.getElementById("rsvpGuestCount");
  const guestLimitHint = document.getElementById("guestLimitHint");
  const inviteMessage = document.getElementById("customInviteMessage");
  const heroImage = document.getElementById("heroImage");

  if (guestFromLink) {
    rsvpName.value = guestFromLink;
    rsvpName.readOnly = true;
    rsvpName.classList.add("is-prefilled");
    rsvpName.insertAdjacentHTML("afterend", '<span class="field-hint">Nome preenchido automaticamente pelo convite personalizado.</span>');
  }

  guestCount.max = String(maxGuests);
  guestCount.value = String(Math.min(maxGuests, Number(guestCount.value || 1)));
  guestLimitHint.textContent = `Este convite permite confirmar ate ${maxGuests} pessoa(s).`;

  if (customInviteMessage) {
    inviteMessage.textContent = customInviteMessage;
    inviteMessage.hidden = false;
  }

  if (customInviteImage) {
    heroImage.src = customInviteImage;
  }

  if (shouldShowTable && (tableNameFromLink || (table && tables[table]))) {
    document.getElementById("seatNumber").textContent = `Mesa ${table}`;
    document.getElementById("seatFlower").textContent = tableNameFromLink || tables[table];
    document.title = `Convite para ${guest} | Joyce & Edson`;
  } else if (!shouldShowTable) {
    document.getElementById("seatNumber").textContent = "Lugar reservado";
    document.getElementById("seatFlower").textContent = "Os noivos cuidaram de tudo";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function updateCountdown() {
  const distance = weddingDate - new Date();
  const countdown = document.getElementById("countdown");

  if (distance <= 0) {
    countdown.innerHTML = "<div><strong>Hoje</strong><span>É o dia</span></div>";
    return;
  }

  const days = Math.floor(distance / 86400000);
  const hours = Math.floor((distance % 86400000) / 3600000);
  const minutes = Math.floor((distance % 3600000) / 60000);
  const seconds = Math.floor((distance % 60000) / 1000);

  document.getElementById("days").textContent = String(days).padStart(3, "0");
  document.getElementById("hours").textContent = String(hours).padStart(2, "0");
  document.getElementById("minutes").textContent = String(minutes).padStart(2, "0");
  document.getElementById("seconds").textContent = String(seconds).padStart(2, "0");
}

function buildCalendar() {
  const grid = document.getElementById("calendarGrid");
  const dayNames = ["D", "S", "T", "Q", "Q", "S", "S"];
  dayNames.forEach((day) => {
    const item = document.createElement("span");
    item.className = "day-name";
    item.textContent = day;
    grid.appendChild(item);
  });

  for (let i = 0; i < 6; i += 1) {
    grid.appendChild(document.createElement("span"));
  }

  for (let day = 1; day <= 31; day += 1) {
    const item = document.createElement("span");
    item.textContent = day;
    if (day === 22) item.className = "wedding-day";
    grid.appendChild(item);
  }
}

function setupMusic() {
  const audio = document.getElementById("bgAudio");
  const button = document.getElementById("musicButton");

  button.addEventListener("click", async () => {
    if (audio.paused) {
      try {
        await audio.play();
        button.classList.add("is-playing");
        button.setAttribute("aria-label", "Pausar música");
      } catch {
        button.setAttribute("aria-label", "Toque novamente para tocar música");
      }
    } else {
      audio.pause();
      button.classList.remove("is-playing");
      button.setAttribute("aria-label", "Tocar música");
    }
  });
}

function launchConfetti() {
  const layer = document.getElementById("confettiLayer");
  const colors = ["#c39a55", "#ead9bc", "#f8f2ea", "#b97876", "#fff6db"];

  layer.innerHTML = "";

  for (let i = 0; i < 90; i += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = `${Math.random() * 0.35}s`;
    piece.style.setProperty("--drift", `${Math.random() * 220 - 110}px`);
    piece.style.setProperty("--fall-duration", `${3 + Math.random() * 1.1}s`);
    layer.appendChild(piece);
  }

  setTimeout(() => { layer.innerHTML = ""; }, 4500);
}

function getWallMessages() {
  try {
    const saved = JSON.parse(localStorage.getItem(wallStorageKey) || "[]");
    return [...saved, ...fallbackWallMessages].slice(0, 12);
  } catch {
    return fallbackWallMessages;
  }
}

async function fetchApprovedMessages() {
  if (!weddingDb) return getWallMessages();

  const { data, error } = await weddingDb
    .from("rsvps")
    .select("name, table_name, message, created_at")
    .eq("is_approved", true)
    .eq("answer", "sim")
    .not("message", "is", null)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    console.warn("Não foi possível carregar o mural público.", error);
    return getWallMessages();
  }

  const messages = data.map((item) => ({
    name: item.name,
    table: item.table_name ? `Mesa ${item.table_name}` : "Mesa a confirmar",
    message: item.message,
    time: new Intl.DateTimeFormat("pt-MZ", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(item.created_at))
  }));

  return messages.length ? messages : fallbackWallMessages;
}

async function renderGuestWall() {
  const wall = document.getElementById("guestWall");
  if (!wall) return;

  const messages = await fetchApprovedMessages();
  wall.innerHTML = messages.map((item) => `
    <article class="wall-message">
      <blockquote>"${escapeHtml(item.message)}"</blockquote>
      <footer>${escapeHtml(item.name)} · ${escapeHtml(item.table)} · ${escapeHtml(item.time)}</footer>
    </article>
  `).join("");
}

async function saveRsvp({ name, phone, answer, message, guestCount }) {
  if (!weddingDb) {
    const saved = JSON.parse(localStorage.getItem("joyce-edson-rsvps") || "[]");
    saved.unshift({
      id: crypto.randomUUID(),
      name,
      phone,
      table_number: table || null,
      table_name: getTableName(),
      guest_count: guestCount,
      invite_token: inviteToken || null,
      answer,
      message: message || null,
      is_approved: false,
      created_at: new Date().toISOString()
    });
    localStorage.setItem("joyce-edson-rsvps", JSON.stringify(saved));
    saveWallMessageLocally({ name, message });
    return { saved: false, reason: "local" };
  }

  const { error } = await weddingDb.from("rsvps").insert({
    name,
    phone: phone || null,
    table_number: table || null,
    table_name: getTableName(),
    guest_count: guestCount,
    invite_token: inviteToken || null,
    answer,
    message: message || null
  });

  if (error) {
    console.warn("Não foi possível guardar no Supabase. A guardar localmente.", error);
    saveWallMessageLocally({ name, message });
    return { saved: false, reason: "supabase", error };
  }

  return { saved: true };
}

function saveWallMessageLocally({ name, message }) {
  if (!message) return;

  const item = {
    name,
    table: getTableLabel(),
    message,
    time: new Intl.DateTimeFormat("pt-MZ", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date())
  };

  const saved = getWallMessages().filter((entry) => !fallbackWallMessages.includes(entry));
  localStorage.setItem(wallStorageKey, JSON.stringify([item, ...saved].slice(0, 10)));
  renderGuestWall();
}

function buildWhatsappUrl({ name, phone, answer, message, guestCount }) {
  const tableText = getTableLabel();
  const lines = [
    "Confirmação de Presença - Joyce & Edson",
    "",
    `Nome: ${name}`,
    `Telefone: ${phone || "Não informado"}`,
    `Pessoas: ${guestCount}`,
    `Resposta: ${answer === "sim" ? "Sim, estarei presente" : "Não poderei comparecer"}`,
    `Lugar: ${tableText}`,
    message ? `Mensagem: ${message}` : ""
  ].filter(Boolean);

  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(lines.join("\n"))}`;
}

function showRsvpThanks({ name, phone, answer, message, guestCount, saved }) {
  const form = document.getElementById("rsvpForm");
  const thanks = document.getElementById("rsvpThanks");
  const tableLabel = getTableLabel();
  const isAttending = answer === "sim";
  const whatsappUrl = buildWhatsappUrl({ name, phone, answer, message, guestCount });

  form.classList.add("is-submitted");
  thanks.hidden = false;
  thanks.innerHTML = `
    <span class="sparkles">✦ ✧ ✦</span>
    <h3>${isAttending ? `Obrigado, ${escapeHtml(name)}!` : `Sentiremos a sua falta, ${escapeHtml(name)}.`}</h3>
    <p>${isAttending ? `Reservámos ${guestCount} lugar(es) na ${escapeHtml(tableLabel)}. Até 22 de Agosto - mal podemos esperar!` : "Obrigado pela resposta. O vosso carinho continua connosco neste dia tão especial."}</p>
    <p>${saved ? "A resposta ficou guardada no painel dos noivos." : "A resposta foi registada neste dispositivo, mas ainda não chegou ao painel dos noivos. Por favor, envie também pelo WhatsApp."}</p>
    <a class="secondary-link" href="${whatsappUrl}" target="_blank" rel="noreferrer">Enviar também pelo WhatsApp</a>
  `;
}

function setupReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.16 });

  document.querySelectorAll(".reveal").forEach((item) => observer.observe(item));
}

function setupModals() {
  document.querySelectorAll("[data-open-modal]").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById(button.dataset.openModal).classList.add("is-open");
      document.body.classList.add("modal-open");
    });
  });

  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal || event.target.hasAttribute("data-close-modal")) {
        modal.classList.remove("is-open");
        document.body.classList.remove("modal-open");
      }
    });
  });
}

function renderGifts() {
  const list = document.getElementById("giftList");
  gifts.forEach(([title, description]) => {
    const item = document.createElement("article");
    item.className = "gift-item";
    item.innerHTML = `<span>Presente</span><strong>${title}</strong><p class="muted">${description}</p>`;
    list.appendChild(item);
  });
}

function setupCopyButtons() {
  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const value = document.getElementById(button.dataset.copy).textContent.trim();
      await navigator.clipboard.writeText(value);
      button.textContent = "Copiado";
      setTimeout(() => { button.textContent = "Copiar"; }, 1400);
    });
  });
}

function setupRsvp() {
  document.getElementById("rsvpForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = document.getElementById("rsvpName").value.trim();
    const phone = document.getElementById("rsvpPhone").value.trim();
    const answer = document.getElementById("rsvpAnswer").value;
    const message = document.getElementById("rsvpMessage").value.trim();
    const guestCount = Math.min(maxGuests, Math.max(1, Number(document.getElementById("rsvpGuestCount").value || 1)));
    const tableText = getTableLabel();

    const lines = [
      "Confirmação de Presença - Joyce & Edson",
      "",
      `Nome: ${name}`,
      `Telefone: ${phone || "Não informado"}`,
      `Pessoas: ${guestCount}`,
      `Resposta: ${answer === "sim" ? "Sim, estarei presente" : "Não poderei comparecer"}`,
      `Lugar: ${tableText}`,
      message ? `Mensagem: ${message}` : ""
    ].filter(Boolean);

    const result = await saveRsvp({ name, phone, answer, message, guestCount });
    showRsvpThanks({ name, phone, answer, message, guestCount, saved: result.saved });
    if (answer === "sim") launchConfetti();

  });
}

window.addEventListener("load", () => {
  setTimeout(() => document.getElementById("loader").classList.add("is-hidden"), 900);
});

setGuestDetails();
buildCalendar();
renderGifts();
renderGuestWall();
setupMusic();
setupReveal();
setupModals();
setupCopyButtons();
setupRsvp();
updateCountdown();
setInterval(updateCountdown, 1000);
