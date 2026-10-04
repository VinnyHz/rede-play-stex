const ADMIN_CONFIG = {
  apiUrl: "https://rede-play-stex-api.vinny-fernandessoares.workers.dev",
};

const EDITABLE_FIELDS = [
  "cash",
  "bank",
  "vipCoins",
  "rpsTokens",
  "level",
  "exp",
  "skin",
  "wanted",
  "kills",
  "deaths",
  "minutes",
];

const gate = document.querySelector("[data-admin-gate]");
const gateTitle = document.querySelector("[data-gate-title]");
const gateMessage = document.querySelector("[data-gate-message]");
const gateLogin = document.querySelector("[data-gate-login]");
const gateRetry = document.querySelector("[data-gate-retry]");
const dashboard = document.querySelector("[data-admin-dashboard]");
const adminName = document.querySelector("[data-admin-name]");
const logoutButton = document.querySelector("[data-admin-logout]");
const feedback = document.querySelector("[data-admin-feedback]");
const tabs = [...document.querySelectorAll("[data-admin-tab]")];
const views = [...document.querySelectorAll("[data-admin-view]")];

const accountSearch = document.querySelector("[data-account-search]");
const refreshAccountsButton = document.querySelector("[data-refresh-accounts]");
const accountsList = document.querySelector("[data-accounts-list]");
const accountDialog = document.querySelector("[data-account-dialog]");
const accountForm = document.querySelector("[data-account-form]");
const editAccountName = document.querySelector("[data-edit-account-name]");
const editAccountId = document.querySelector("[data-edit-account-id]");

const orderFilter = document.querySelector("[data-order-filter]");
const refreshOrdersButton = document.querySelector("[data-refresh-orders]");
const ordersList = document.querySelector("[data-orders-list]");

const couponForm = document.querySelector("[data-coupon-form]");
const createCouponButton = document.querySelector("[data-create-coupon]");
const refreshCouponsButton = document.querySelector("[data-refresh-coupons]");
const couponsList = document.querySelector("[data-coupons-list]");

let activeView = "accounts";
let accounts = [];
let coupons = [];
let editingAccount = null;
let refreshTimer = 0;
let searchTimer = 0;
let loading = false;
let checkingAccess = false;

const getToken = () => window.RPS_SESSION.getToken();

const clearToken = () => {
  window.RPS_SESSION.clearToken();
};

const apiRequest = async (path, options = {}) => {
  const token = getToken();
  const response = await fetch(`${ADMIN_CONFIG.apiUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "Não foi possível concluir a solicitação.");
    error.status = response.status;
    throw error;
  }
  return data;
};

const showGate = (title, message, showLogin = false, canRetry = false) => {
  window.clearTimeout(refreshTimer);
  dashboard.hidden = true;
  gate.hidden = false;
  gate.setAttribute("aria-busy", "false");
  gateTitle.textContent = title;
  gateMessage.textContent = message;
  gateLogin.hidden = !showLogin;
  gateRetry.hidden = !canRetry;
  gateRetry.disabled = false;
};

const setFeedback = (message = "", isError = false) => {
  feedback.textContent = message;
  feedback.hidden = !message;
  feedback.classList.toggle("is-error", isError);
};

const handleAccessError = (error) => {
  if (error.status === 401) {
    clearToken();
    showGate("Seu acesso expirou", "Entre novamente na sua conta. Marque ‘Manter conectado’ para voltar sem gerar outro código enquanto o acesso estiver válido.", true);
    return true;
  }
  if (error.status === 403) {
    showGate("Acesso não autorizado", "Sua conta está conectada, mas não tem permissão para abrir a Área ADM.");
    return true;
  }
  return false;
};

const formatNumber = (value) => new Intl.NumberFormat("pt-BR").format(Number(value) || 0);

const formatPix = (cents) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((Number(cents) || 0) / 100);

const formatDate = (seconds) => {
  if (!seconds) return "--";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(Number(seconds) * 1000));
};

const formatPlayTime = (minutes) => {
  const total = Math.max(0, Number(minutes) || 0);
  return `${Math.floor(total / 60)}h ${total % 60}min`;
};

const statusLabels = {
  awaiting_payment: "Aguardando conferência",
  approved: "Aprovado",
  queued: "Aguardando jogador",
  processing: "Entregando no jogo",
  completed: "Concluído",
  rejected: "Recusado",
  failed: "Falha na entrega",
};

const setLoadingState = () => {
  refreshAccountsButton.disabled = loading;
  refreshOrdersButton.disabled = loading;
  refreshCouponsButton.disabled = loading;
  createCouponButton.disabled = loading;
  accountsList.querySelectorAll("button").forEach((button) => { button.disabled = loading; });
  ordersList.querySelectorAll("button").forEach((button) => { button.disabled = loading; });
  couponsList.querySelectorAll("button").forEach((button) => { button.disabled = loading; });
  accountForm.querySelectorAll("button, input").forEach((element) => { element.disabled = loading; });
  couponForm.querySelectorAll("button, input").forEach((element) => { element.disabled = loading; });
};

const appendField = (card, label, value, className = "") => {
  const wrap = document.createElement("div");
  if (className) wrap.className = className;
  const small = document.createElement("small");
  const strong = document.createElement("strong");
  small.textContent = label;
  strong.textContent = value;
  wrap.append(small, strong);
  card.append(wrap);
  return strong;
};

const renderAccounts = (items) => {
  accountsList.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-orders";
    empty.textContent = accountSearch.value.trim()
      ? "Nenhuma conta encontrada com esse nome."
      : "Ainda não há contas registradas pelo login do site.";
    accountsList.append(empty);
    return;
  }

  items.forEach((account) => {
    const card = document.createElement("article");
    card.className = "account-card";

    const identity = document.createElement("div");
    identity.className = "account-identity";
    const avatar = document.createElement("span");
    avatar.textContent = account.name.slice(0, 1).toUpperCase();
    const identityText = document.createElement("div");
    const player = document.createElement("strong");
    player.textContent = account.name;
    const meta = document.createElement("small");
    meta.textContent = `ID #${String(account.accountId).padStart(4, "0")} • Skin ${account.skin}`;
    identityText.append(player, meta);
    identity.append(avatar, identityText);

    const badges = document.createElement("div");
    badges.className = "account-badges";
    const online = document.createElement("span");
    online.className = account.online ? "is-online" : "is-offline";
    online.textContent = account.online ? "Online" : "Offline";
    badges.append(online);
    if (account.adminLevel > 0) {
      const adminBadge = document.createElement("span");
      adminBadge.className = "is-admin";
      adminBadge.textContent = `Admin ${account.adminLevel}`;
      badges.append(adminBadge);
    }
    identity.append(badges);
    card.append(identity);

    const stats = document.createElement("div");
    stats.className = "account-stats";
    appendField(stats, "CARTEIRA", `R$ ${formatNumber(account.cash)}`);
    appendField(stats, "BANCO", `R$ ${formatNumber(account.bank)}`);
    appendField(stats, "MOEDAS MV", formatNumber(account.vipCoins));
    appendField(stats, "FICHAS RPS", `${formatNumber(account.rpsTokens)}/100`);
    appendField(stats, "NÍVEL / XP", `${formatNumber(account.level)} / ${formatNumber(account.exp)}`);
    appendField(stats, "TEMPO", formatPlayTime(account.minutes));
    card.append(stats);

    const footer = document.createElement("div");
    footer.className = "account-footer";
    const login = document.createElement("div");
    const loginLabel = document.createElement("small");
    loginLabel.textContent = "ÚLTIMO LOGIN NO SITE";
    const loginValue = document.createElement("strong");
    loginValue.textContent = `${formatDate(account.siteLastLoginAt)} • ${formatNumber(account.loginCount)} acesso(s)`;
    login.append(loginLabel, loginValue);

    const actions = document.createElement("div");
    if (account.pendingChanges > 0) {
      const pending = document.createElement("span");
      pending.className = "pending-changes";
      pending.textContent = `${account.pendingChanges} alteração(ões) aguardando`;
      actions.append(pending);
    }
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Editar conta";
    edit.addEventListener("click", () => openAccountEditor(account));
    actions.append(edit);
    footer.append(login, actions);
    card.append(footer);

    accountsList.append(card);
  });
  setLoadingState();
};

const loadAccounts = async () => {
  window.clearTimeout(refreshTimer);
  try {
    const search = accountSearch.value.trim();
    const query = search ? `?search=${encodeURIComponent(search)}` : "";
    const result = await apiRequest(`/api/admin/accounts${query}`);
    accounts = result.accounts || [];
    renderAccounts(accounts);
    if (activeView === "accounts") refreshTimer = window.setTimeout(loadAccounts, 15000);
  } catch (error) {
    if (handleAccessError(error)) return;
    setFeedback(error.message, true);
    if (activeView === "accounts") refreshTimer = window.setTimeout(loadAccounts, 20000);
  }
};

const openAccountEditor = (account) => {
  editingAccount = account;
  editAccountName.textContent = account.name;
  editAccountId.textContent = `CONTA #${account.accountId}${account.online ? " • ONLINE" : " • OFFLINE"}`;
  EDITABLE_FIELDS.forEach((field) => {
    accountForm.elements[field].value = Number(account[field]) || 0;
  });
  if (typeof accountDialog.showModal === "function") accountDialog.showModal();
  else accountDialog.setAttribute("open", "");
};

const closeAccountEditor = () => {
  if (accountDialog.open && typeof accountDialog.close === "function") accountDialog.close();
  else accountDialog.removeAttribute("open");
  editingAccount = null;
};

const submitAccountChanges = async (event) => {
  event.preventDefault();
  if (!editingAccount || loading || !accountForm.reportValidity()) return;

  const changes = {};
  EDITABLE_FIELDS.forEach((field) => {
    const value = Number(accountForm.elements[field].value);
    if (value !== Number(editingAccount[field])) changes[field] = value;
  });
  if (!Object.keys(changes).length) {
    closeAccountEditor();
    setFeedback("Nenhum valor foi alterado.");
    return;
  }

  const confirmed = window.confirm(
    `Enviar ${Object.keys(changes).length} alteração(ões) para a conta ${editingAccount.name}?\n\nO servidor aplicará e salvará esses dados.`
  );
  if (!confirmed) return;

  loading = true;
  setLoadingState();
  try {
    const result = await apiRequest(`/api/admin/accounts/${editingAccount.accountId}/updates`, {
      method: "POST",
      body: JSON.stringify({ changes }),
    });
    closeAccountEditor();
    setFeedback(result.message || "Alterações enviadas ao servidor.");
    await loadAccounts();
  } catch (error) {
    if (!handleAccessError(error)) setFeedback(error.message, true);
  } finally {
    loading = false;
    setLoadingState();
  }
};

const isMvPixOrder = (order) => {
  const kind = String(order?.orderType ?? order?.kind ?? order?.productType ?? "").toLowerCase();
  return kind === "mv" || kind === "vip_coins" || Number(order?.mvAmount ?? order?.vipCoinsAmount) > 0;
};

const orderMvAmount = (order) => Number(order?.mvAmount ?? order?.vipCoinsAmount ?? 0) || 0;
const orderCouponCode = (order) => String(order?.couponCode ?? order?.coupon?.code ?? "").trim().toUpperCase();
const orderCouponPercent = (order) => Number(
  order?.couponPercent ?? order?.discountPercent ?? order?.coupon?.discountPercent ?? 0
) || 0;
const orderDiscountCents = (order) => Math.max(
  0,
  Number(order?.discountCents ?? order?.discountAmountCents ?? 0) || 0
);

const orderProductLabel = (order) => isMvPixOrder(order)
  ? `${formatNumber(orderMvAmount(order))} MV`
  : (order.planName || "--");

const orderCouponLabel = (order) => {
  if (!isMvPixOrder(order)) return "Não se aplica";
  const code = orderCouponCode(order);
  if (!code) return "Sem cupom";
  const percent = orderCouponPercent(order);
  const discount = orderDiscountCents(order);
  if (percent > 0) return `${code} (−${percent}%)`;
  if (discount > 0) return `${code} (−${formatPix(discount)})`;
  return code;
};

const reviewOrder = async (order, action) => {
  if (loading) return;
  let reason = "";
  if (action === "approve") {
    const delivery = isMvPixOrder(order) ? "as moedas MV" : "o plano";
    const confirmed = window.confirm(
      `Você conferiu na conta da Caixa o recebimento de ${formatPix(order.pixAmountCents)} para o pedido ${order.orderId}?\n\nAprovar vai liberar ${delivery} no jogo.`
    );
    if (!confirmed) return;
  } else {
    reason = window.prompt("Motivo da recusa:", "Pagamento não confirmado.");
    if (reason === null) return;
  }

  loading = true;
  setFeedback(action === "approve" ? "Aprovando e preparando a entrega..." : "Recusando pedido...");
  setLoadingState();
  try {
    await apiRequest(`/api/admin/pix-orders/${order.orderId}/${action}`, {
      method: "POST",
      body: JSON.stringify(action === "reject" ? { reason } : {}),
    });
    setFeedback(action === "approve" ? "Pedido aprovado. O jogador receberá quando estiver online." : "Pedido recusado.");
    await loadOrders();
  } catch (error) {
    if (!handleAccessError(error)) setFeedback(error.message, true);
  } finally {
    loading = false;
    setLoadingState();
  }
};

const renderOrders = (orders) => {
  ordersList.replaceChildren();
  if (!orders.length) {
    const empty = document.createElement("div");
    empty.className = "empty-orders";
    empty.textContent = "Nenhum pedido encontrado neste filtro.";
    ordersList.append(empty);
    return;
  }

  orders.forEach((order) => {
    const card = document.createElement("article");
    card.className = "order-card";

    const main = document.createElement("div");
    main.className = "order-main";
    const label = document.createElement("small");
    label.textContent = `PEDIDO PIX #${order.orderId}`;
    const player = document.createElement("strong");
    player.textContent = order.playerName || "Personagem desconhecido";
    const reference = document.createElement("code");
    reference.className = "order-reference";
    reference.textContent = `RPS-PIX-${String(order.orderId).padStart(6, "0")}`;
    main.append(label, player, reference);
    card.append(main);

    appendField(card, "PRODUTO", orderProductLabel(order), "order-product");
    appendField(card, "CUPOM", orderCouponLabel(order), "order-coupon");
    appendField(card, "VALOR EXATO", formatPix(order.pixAmountCents), "order-price");
    appendField(card, "CRIADO EM", formatDate(order.createdAt));
    const status = appendField(card, "STATUS", statusLabels[order.status] || order.status, "order-state");
    status.className = "order-status";
    status.dataset.status = order.status;

    if (order.status === "awaiting_payment") {
      const actions = document.createElement("div");
      actions.className = "order-actions";
      const reject = document.createElement("button");
      reject.type = "button";
      reject.className = "reject";
      reject.textContent = "Recusar";
      reject.addEventListener("click", () => reviewOrder(order, "reject"));
      const approve = document.createElement("button");
      approve.type = "button";
      approve.className = "approve";
      approve.textContent = "Aprovar Pix";
      approve.addEventListener("click", () => reviewOrder(order, "approve"));
      actions.append(reject, approve);
      card.append(actions);
    } else {
      const detail = document.createElement("div");
      detail.className = "order-actions";
      const text = document.createElement("small");
      text.textContent = order.reviewedBy ? `Revisado por ${order.reviewedBy}` : (order.failureReason || "Sem ação pendente");
      detail.append(text);
      card.append(detail);
    }

    ordersList.append(card);
  });
  setLoadingState();
};

const loadOrders = async () => {
  window.clearTimeout(refreshTimer);
  try {
    const status = orderFilter.value;
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    const result = await apiRequest(`/api/admin/pix-orders${query}`);
    renderOrders(result.orders || []);
    if (activeView === "pix") refreshTimer = window.setTimeout(loadOrders, 15000);
  } catch (error) {
    if (handleAccessError(error)) return;
    setFeedback(error.message, true);
    if (activeView === "pix") refreshTimer = window.setTimeout(loadOrders, 20000);
  }
};

const normalizeFlag = (value) => value === true || value === 1 || value === "1" || value === "true";

const normalizeCoupon = (coupon) => ({
  couponId: Number(coupon?.couponId ?? coupon?.id ?? 0) || 0,
  code: String(coupon?.code ?? "").trim().toUpperCase(),
  discountPercent: Number(coupon?.discountPercent ?? coupon?.percent ?? 0) || 0,
  expiresAt: Number(coupon?.expiresAt ?? coupon?.expires_at ?? 0) || 0,
  active: normalizeFlag(coupon?.active ?? coupon?.isActive ?? coupon?.enabled),
  createdAt: Number(coupon?.createdAt ?? coupon?.created_at ?? 0) || 0,
  useCount: Number(coupon?.useCount ?? coupon?.uses ?? coupon?.timesUsed ?? 0) || 0,
});

const renderCoupons = (items) => {
  couponsList.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-orders";
    empty.textContent = "Nenhum cupom de MV foi criado ainda.";
    couponsList.append(empty);
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  items.forEach((coupon) => {
    const expired = coupon.expiresAt > 0 && coupon.expiresAt <= now;
    const card = document.createElement("article");
    card.className = "coupon-card";

    const heading = document.createElement("div");
    heading.className = "coupon-card-heading";
    const code = document.createElement("code");
    code.className = "coupon-code";
    code.textContent = coupon.code || "SEM-CÓDIGO";
    const state = document.createElement("span");
    state.className = "coupon-state";
    if (expired) {
      state.classList.add("is-expired");
      state.textContent = "Expirado";
    } else if (!coupon.active) {
      state.classList.add("is-inactive");
      state.textContent = "Desativado";
    } else {
      state.textContent = "Ativo";
    }
    heading.append(code, state);
    card.append(heading);

    const stats = document.createElement("div");
    stats.className = "coupon-stats";
    appendField(stats, "DESCONTO", `${formatNumber(coupon.discountPercent)}%`);
    appendField(stats, "VÁLIDO ATÉ", formatDate(coupon.expiresAt));
    appendField(stats, "USOS", formatNumber(coupon.useCount));
    card.append(stats);

    const footer = document.createElement("div");
    footer.className = "coupon-card-footer";
    const created = document.createElement("small");
    created.textContent = `Criado em ${formatDate(coupon.createdAt)}`;
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "coupon-toggle";
    toggle.classList.toggle("is-enable", !coupon.active);
    toggle.textContent = coupon.active ? "Desativar cupom" : "Ativar cupom";
    toggle.disabled = loading || !coupon.couponId;
    toggle.addEventListener("click", () => toggleCoupon(coupon));
    footer.append(created, toggle);
    card.append(footer);

    couponsList.append(card);
  });
  setLoadingState();
};

const loadCoupons = async () => {
  window.clearTimeout(refreshTimer);
  try {
    const result = await apiRequest("/api/admin/mv-coupons");
    coupons = (result.coupons || []).map(normalizeCoupon);
    renderCoupons(coupons);
    if (activeView === "coupons") refreshTimer = window.setTimeout(loadCoupons, 20000);
  } catch (error) {
    if (handleAccessError(error)) return;
    setFeedback(error.message, true);
    if (activeView === "coupons") refreshTimer = window.setTimeout(loadCoupons, 25000);
  }
};

const submitCoupon = async (event) => {
  event.preventDefault();
  if (loading || !couponForm.reportValidity()) return;

  const code = String(couponForm.elements.code.value).trim().toUpperCase();
  const discountPercent = Number(couponForm.elements.discountPercent.value);
  const expiresAt = Math.floor(new Date(couponForm.elements.expiresAt.value).getTime() / 1000);
  if (!Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    setFeedback("Escolha uma data de expiração futura para o cupom.", true);
    couponForm.elements.expiresAt.focus();
    return;
  }

  loading = true;
  setFeedback(`Criando o cupom ${code}...`);
  setLoadingState();
  try {
    const result = await apiRequest("/api/admin/mv-coupons", {
      method: "POST",
      body: JSON.stringify({ code, discountPercent, expiresAt }),
    });
    couponForm.reset();
    setCouponDateBounds();
    setFeedback(result.message || `Cupom ${code} criado com sucesso.`);
    await loadCoupons();
  } catch (error) {
    if (!handleAccessError(error)) setFeedback(error.message, true);
  } finally {
    loading = false;
    setLoadingState();
  }
};

async function toggleCoupon(coupon) {
  if (loading || !coupon.couponId) return;
  const active = !coupon.active;
  const action = active ? "ativar" : "desativar";
  if (!window.confirm(`Deseja ${action} o cupom ${coupon.code}?`)) return;

  loading = true;
  setFeedback(`${active ? "Ativando" : "Desativando"} o cupom ${coupon.code}...`);
  setLoadingState();
  try {
    const result = await apiRequest(`/api/admin/mv-coupons/${coupon.couponId}/toggle`, {
      method: "POST",
      body: JSON.stringify({ active }),
    });
    setFeedback(result.message || `Cupom ${coupon.code} ${active ? "ativado" : "desativado"}.`);
    await loadCoupons();
  } catch (error) {
    if (!handleAccessError(error)) setFeedback(error.message, true);
  } finally {
    loading = false;
    setLoadingState();
  }
}

const toDatetimeLocalValue = (date) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
};

const setCouponDateBounds = () => {
  const expiresInput = couponForm.elements.expiresAt;
  const now = new Date();
  expiresInput.min = toDatetimeLocalValue(now);
  if (!expiresInput.value) {
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    expiresInput.value = toDatetimeLocalValue(nextWeek);
  }
};

const switchView = async (viewName) => {
  if (!["accounts", "pix", "coupons"].includes(viewName)) return;
  window.clearTimeout(refreshTimer);
  activeView = viewName;
  tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.adminTab === viewName));
  views.forEach((view) => { view.hidden = view.dataset.adminView !== viewName; });
  setFeedback();
  if (viewName === "accounts") await loadAccounts();
  else if (viewName === "pix") await loadOrders();
  else await loadCoupons();
};

const initializeAdmin = async () => {
  if (checkingAccess) return;
  if (!getToken()) {
    showGate("Entre na sua conta", "Faça login pela Área do Jogador. Você volta automaticamente para a Área ADM após entrar.", true);
    return;
  }

  checkingAccess = true;
  showGate("Confirmando seu acesso", "Estamos recuperando sua sessão e conferindo sua permissão.");
  gate.setAttribute("aria-busy", "true");
  gateRetry.disabled = true;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);

  try {
    const result = await apiRequest("/api/admin/me", { signal: controller.signal });
    window.clearTimeout(timeout);
    gate.setAttribute("aria-busy", "false");
    adminName.textContent = result.admin.name;
    gate.hidden = true;
    dashboard.hidden = false;
    await switchView("accounts");
  } catch (error) {
    if (!handleAccessError(error)) {
      showGate("Não foi possível conectar", "Seu acesso salvo foi preservado. Confira sua conexão e tente novamente.", false, true);
    }
  } finally {
    window.clearTimeout(timeout);
    checkingAccess = false;
  }
};

gateRetry.addEventListener("click", () => void initializeAdmin());
window.addEventListener("online", () => {
  if (!gate.hidden && !gateRetry.hidden) void initializeAdmin();
});

tabs.forEach((tab) => tab.addEventListener("click", () => switchView(tab.dataset.adminTab)));
orderFilter.addEventListener("change", loadOrders);
refreshOrdersButton.addEventListener("click", loadOrders);
refreshAccountsButton.addEventListener("click", loadAccounts);
refreshCouponsButton.addEventListener("click", loadCoupons);
accountSearch.addEventListener("input", () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(loadAccounts, 350);
});
accountForm.addEventListener("submit", submitAccountChanges);
couponForm.addEventListener("submit", submitCoupon);
couponForm.elements.code.addEventListener("input", () => {
  const input = couponForm.elements.code;
  input.value = input.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
});
document.querySelectorAll("[data-close-account-dialog]").forEach((button) => {
  button.addEventListener("click", closeAccountEditor);
});
accountDialog.addEventListener("click", (event) => {
  if (event.target === accountDialog) closeAccountEditor();
});
logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);
  try {
    await apiRequest("/api/logout", { method: "POST", signal: controller.signal });
  } catch {
    // Encerra o acesso local também quando a conexão estiver indisponível.
  } finally {
    window.clearTimeout(timeout);
    clearToken();
    window.location.replace("painel.html");
  }
});

setCouponDateBounds();
initializeAdmin();
