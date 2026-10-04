(() => {
  const host = document.querySelector("[data-account-header]");
  if (!host || !window.RPS_SESSION) return;

  const apiUrl = "https://rede-play-stex-api.vinny-fernandessoares.workers.dev";
  const icons = {
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    chevron: '<path d="m8 10 4 4 4-4"/>',
    settings: '<path d="m9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3z"/><circle cx="12" cy="12" r="3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    logout: '<path d="M9 4H4v16h5m5-13 5 5-5 5m-6-5h11"/>',
    success: '<path d="m6 12 4 4 8-8"/><circle cx="12" cy="12" r="10"/>',
    warning: '<path d="m12 3 10 18H2zM12 9v4m0 4h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 11v6m0-10h.01"/>',
    payment: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18m-14 5h3"/>',
  };
  const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.info}</svg>`;
  host.innerHTML = `
    <a class="nav-cta account-login" href="painel.html">Minha conta <span aria-hidden="true">↗</span></a>
    <div class="account-connected" hidden>
      <button class="account-bell" type="button" aria-label="Notificações" aria-expanded="false" aria-controls="account-notifications">
        ${svg("bell")}<span class="account-badge" aria-hidden="true" hidden></span>
      </button>
      <button class="account-trigger" type="button" aria-expanded="false" aria-controls="account-menu">
        <span class="account-avatar" aria-hidden="true"><span class="account-avatar-fallback">${svg("user")}</span><img alt="" hidden /></span>
        <span class="account-identity"><small>MINHA CONTA</small><strong></strong></span>${svg("chevron")}
      </button>
      <div class="account-menu account-popover" id="account-menu" hidden>
        <p class="account-menu-name"></p>
        <a href="painel.html">${svg("user")}Área do jogador<span>↗</span></a>
        <button type="button" data-account-settings>${svg("settings")}Configurações</button>
        <button class="account-logout" type="button">${svg("logout")}Sair da conta</button>
      </div>
      <section class="account-notifications account-popover" id="account-notifications" aria-labelledby="account-notifications-title" hidden>
        <div class="account-notifications-head"><div><small>SUA ATIVIDADE</small><h2 id="account-notifications-title">Notificações</h2></div><button class="account-close" type="button" aria-label="Fechar notificações">×</button></div>
        <div class="account-notifications-tools"><span class="account-unread" role="status"></span><button class="account-read-all" type="button" disabled>Marcar todas como lidas</button></div>
        <div class="account-notification-status" role="status" hidden></div>
        <div class="account-notification-list"></div>
        <button class="account-refresh" type="button">Atualizar notificações</button>
      </section>
    </div>
    <dialog class="account-settings-dialog" aria-labelledby="account-settings-title">
      <div class="account-settings-head"><div><small>MINHA CONTA</small><h2 id="account-settings-title">Configurações</h2></div><button class="account-close" type="button" data-close-settings aria-label="Fechar configurações">×</button></div>
      <p class="account-settings-player"></p>
      <p class="account-settings-description">Personalize as notificações neste aparelho.</p>
      <label class="account-preference"><span><strong>Atualizar automaticamente</strong><small>Buscar novas notificações a cada 30 segundos enquanto o site estiver aberto.</small></span><input type="checkbox" name="autoRefresh" /></label>
      <label class="account-preference"><span><strong>Mostrar notificações lidas</strong><small>Manter as notificações já vistas no histórico do sino.</small></span><input type="checkbox" name="showRead" /></label>
      <p class="account-settings-status" role="status" hidden></p>
      <a class="account-settings-link" href="painel.html">Ver meu personagem ${svg("chevron")}</a>
    </dialog>`;

  const find = (selector) => host.querySelector(selector);
  const connected = find(".account-connected");
  const loginLink = find(".account-login");
  const trigger = find(".account-trigger");
  const bell = find(".account-bell");
  const badge = find(".account-badge");
  const menu = find(".account-menu");
  const panel = find(".account-notifications");
  const list = find(".account-notification-list");
  const status = find(".account-notification-status");
  const readAll = find(".account-read-all");
  const dialog = find("dialog");
  const image = find(".account-avatar img");
  let player = null;
  let notifications = [];
  let preferences = { autoRefresh: true, showRead: true };
  let generation = 0;
  let timer;
  let loading = false;
  let markingRead = false;
  let loaded = false;

  const preferenceKey = () => `rps_account_preferences:${player.accountId}`;
  const closePopovers = () => {
    menu.hidden = panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    bell.setAttribute("aria-expanded", "false");
  };
  const showStatus = (message) => {
    status.textContent = message;
    status.hidden = !message;
  };
  const reset = () => {
    generation++;
    player = null;
    notifications = [];
    loaded = loading = markingRead = false;
    clearInterval(timer);
    closePopovers();
    if (dialog.open) dialog.close();
    connected.hidden = true;
    loginLink.hidden = false;
    list.replaceChildren();
    badge.hidden = true;
    find(".account-refresh").disabled = false;
    find(".account-logout").disabled = false;
    showStatus("");
  };
  const request = async (path, options = {}) => {
    const token = window.RPS_SESSION.getToken();
    if (!token) throw new Error("Conecte seu personagem.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`${apiUrl}${path}`, {
        ...options, signal: controller.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401 && window.RPS_SESSION.getToken() === token) {
          window.RPS_SESSION.clearToken();
          reset();
          window.dispatchEvent(new CustomEvent("rps:session-expired"));
        }
        const error = new Error(result.message || "Não foi possível conectar agora.");
        error.status = response.status;
        throw error;
      }
      if (window.RPS_SESSION.getToken() !== token) throw new Error("A conta conectada mudou.");
      return result;
    } finally {
      clearTimeout(timeout);
    }
  };
  const dateLabel = (seconds) => new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(seconds * 1000));
  const renderNotifications = () => {
    const unread = notifications.filter(item => !item.read).length;
    badge.hidden = unread === 0;
    bell.setAttribute("aria-label", unread ? `Notificações: ${unread} não lidas` : "Notificações");
    find(".account-unread").textContent = unread ? `${unread} não ${unread === 1 ? "lida" : "lidas"}` : "Tudo em dia";
    readAll.disabled = !unread || markingRead;
    list.replaceChildren();
    if (!loaded && !status.hidden) return;
    const visible = notifications.filter(item => preferences.showRead || !item.read);
    if (!visible.length) {
      const empty = document.createElement("p");
      empty.className = "account-empty";
      empty.textContent = !loaded ? "Carregando suas notificações..." : notifications.length ? "Você já leu todas as notificações." : "Tudo tranquilo por aqui. Aprovações de Pix, entregas e recompensas aparecerão aqui.";
      list.append(empty);
    }
    visible.forEach(item => {
      const row = document.createElement("a");
      row.className = `account-notification${item.read ? " is-read" : ""}`;
      row.href = ["loja.html", "painel.html"].includes(item.href) ? item.href : "painel.html";
      row.innerHTML = `<span class="account-event-icon">${svg(item.type)}</span><span class="account-event-copy"><strong></strong><span></span><time></time></span><i class="account-unread-dot" aria-label="Não lida"></i>`;
      row.querySelector("strong").textContent = item.title;
      row.querySelector(".account-event-copy > span").textContent = item.message;
      const time = row.querySelector("time");
      time.dateTime = new Date(item.createdAt * 1000).toISOString();
      time.textContent = dateLabel(item.createdAt);
      row.querySelector(".account-event-icon").classList.add(`is-${["success", "warning", "payment"].includes(item.type) ? item.type : "info"}`);
      row.querySelector("i").hidden = item.read;
      row.addEventListener("click", async event => {
        if (item.read) return;
        event.preventDefault();
        const href = row.href;
        if (await markRead([item.id])) window.location.assign(href);
      });
      list.append(row);
    });
  };
  const refreshNotifications = async () => {
    if (!player || loading || markingRead) return;
    const version = generation;
    loading = true;
    const refreshButton = find(".account-refresh");
    refreshButton.disabled = true;
    if (!loaded) showStatus("Buscando suas notificações...");
    if (!loaded) renderNotifications();
    try {
      const result = await request("/api/notifications");
      if (version !== generation) return;
      notifications = result.notifications || [];
      loaded = true;
      showStatus("");
      renderNotifications();
    } catch (error) {
      if (version === generation) {
        showStatus(error.status === 404
          ? "As notificações estão indisponíveis no momento. Tente novamente mais tarde."
          : "Não foi possível atualizar as notificações. Tente novamente.");
        renderNotifications();
      }
    } finally {
      if (version === generation) {
        loading = false;
        refreshButton.disabled = false;
      }
    }
  };
  const markRead = async (ids) => {
    if (markingRead || loading || !player) return false;
    const version = generation;
    markingRead = true;
    readAll.disabled = true;
    try {
      await request("/api/notifications/read", { method: "POST", body: JSON.stringify({ ids }) });
      if (version !== generation) return false;
      const selected = new Set(ids);
      notifications.forEach(item => { if (selected.has(item.id)) item.read = true; });
      showStatus("");
      return true;
    } catch {
      if (version === generation) showStatus("Não foi possível marcar como lida. Tente novamente.");
      return false;
    } finally {
      if (version === generation) {
        markingRead = false;
        renderNotifications();
      }
    }
  };
  const startPolling = () => {
    clearInterval(timer);
    if (player && preferences.autoRefresh) timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30000);
  };
  const setPlayer = (value) => {
    if (!value || !window.RPS_SESSION.getToken()) { reset(); return; }
    const changed = player?.accountId !== value.accountId;
    if (changed) reset();
    player = value;
    if (changed) {
      preferences = { autoRefresh: true, showRead: true };
      try {
        const saved = JSON.parse(localStorage.getItem(preferenceKey()) || "null");
        if (typeof saved?.autoRefresh === "boolean") preferences.autoRefresh = saved.autoRefresh;
        if (typeof saved?.showRead === "boolean") preferences.showRead = saved.showRead;
      } catch { /* Use defaults if storage is unavailable. */ }
    }
    loginLink.hidden = true;
    connected.hidden = false;
    find(".account-identity strong").textContent = value.name || "Jogador_RPS";
    find(".account-menu-name").textContent = value.name || "Jogador_RPS";
    trigger.setAttribute("aria-label", `Abrir menu da conta de ${value.name || "Jogador"}`);
    const skin = Number(value.skin);
    const skinId = Number.isInteger(skin) && skin >= 0 && skin <= 311 ? skin : 0;
    const skinUrl = `https://assets.open.mp/assets/images/skins/${skinId}.png`;
    if (image.getAttribute("src") !== skinUrl) {
      image.hidden = true;
      image.onload = () => { image.hidden = false; };
      image.onerror = () => { image.hidden = true; };
      image.src = skinUrl;
    }
    if (changed) {
      renderNotifications();
      startPolling();
      void refreshNotifications();
    }
  };
  const refresh = async () => {
    if (!window.RPS_SESSION.getToken()) { reset(); return; }
    const version = generation;
    try {
      const result = await request("/api/me");
      if (version !== generation) return;
      const samePlayer = player?.accountId === result.player.accountId;
      setPlayer(result.player);
      if (samePlayer) await refreshNotifications();
    } catch { /* Keep the saved session during temporary connection failures. */ }
  };

  trigger.addEventListener("click", () => {
    const open = menu.hidden;
    closePopovers();
    menu.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
  });
  bell.addEventListener("click", () => {
    const open = panel.hidden;
    closePopovers();
    panel.hidden = !open;
    bell.setAttribute("aria-expanded", String(open));
    if (open) { renderNotifications(); void refreshNotifications(); }
  });
  find(".account-notifications .account-close").addEventListener("click", () => { closePopovers(); bell.focus(); });
  find(".account-refresh").addEventListener("click", () => void refreshNotifications());
  readAll.addEventListener("click", () => void markRead(notifications.filter(item => !item.read).map(item => item.id)));
  find("[data-account-settings]").addEventListener("click", () => {
    closePopovers();
    find(".account-settings-player").textContent = `${player.name} · Conta #${player.accountId}`;
    find(".account-settings-status").hidden = true;
    dialog.querySelectorAll("input").forEach(input => { input.checked = preferences[input.name]; });
    dialog.showModal();
  });
  find("[data-close-settings]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
  });
  dialog.addEventListener("close", () => { if (player) trigger.focus(); });
  dialog.querySelectorAll("input").forEach(input => input.addEventListener("change", () => {
    preferences[input.name] = input.checked;
    const message = find(".account-settings-status");
    try {
      localStorage.setItem(preferenceKey(), JSON.stringify(preferences));
      message.textContent = "Preferências salvas neste aparelho.";
    } catch {
      message.textContent = "Preferência aplicada. O navegador não permitiu salvá-la neste aparelho.";
    }
    message.hidden = false;
    startPolling();
    renderNotifications();
  }));
  find(".account-logout").addEventListener("click", async event => {
    event.currentTarget.disabled = true;
    const token = window.RPS_SESSION.getToken();
    try { await request("/api/logout", { method: "POST" }); } catch { /* Always end this local session. */ }
    if (window.RPS_SESSION.getToken() && window.RPS_SESSION.getToken() !== token) return;
    window.RPS_SESSION.clearToken();
    reset();
    window.location.assign("painel.html");
  });
  document.addEventListener("click", event => { if (!host.contains(event.target)) closePopovers(); });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !dialog.open) {
      const focus = !panel.hidden ? bell : !menu.hidden ? trigger : null;
      closePopovers();
      focus?.focus();
    }
  });
  document.addEventListener("focusin", event => { if (!host.contains(event.target)) closePopovers(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void refresh(); });
  window.addEventListener("online", () => void refresh());
  window.addEventListener("pageshow", event => { if (event.persisted) void refresh(); });
  window.addEventListener("storage", event => {
    if (event.key === "rps_portal_session") { reset(); void refresh(); }
    else if (player && event.key === preferenceKey()) { const previous = player; reset(); setPlayer(previous); }
  });
  window.RPS_ACCOUNT = Object.freeze({ setPlayer, reset, refresh, refreshNotifications });
  if (host.hasAttribute("data-account-autoload")) void refresh();
})();
