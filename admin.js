const ADMIN_CONFIG = {
  apiUrl: "https://rede-play-stex-api.vinny-fernandessoares.workers.dev",
  tokenKey: "rps_portal_session",
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

let activeView = "accounts";
let accounts = [];
let editingAccount = null;
let refreshTimer = 0;
let searchTimer = 0;
let loading = false;

const getToken = () =>
  localStorage.getItem(ADMIN_CONFIG.tokenKey) || sessionStorage.getItem(ADMIN_CONFIG.tokenKey);

const clearToken = () => {
  localStorage.removeItem(ADMIN_CONFIG.tokenKey);
  sessionStorage.removeItem(ADMIN_CONFIG.tokenKey);
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

const showGate = (title, message, showLogin = false) => {
  window.clearTimeout(refreshTimer);
  dashboard.hidden = true;
  gate.hidden = false;
  gateTitle.innerHTML = `${title}<br /><span>RESTRITO.</span>`;
  gateMessage.textContent = message;
  gateLogin.hidden = !showLogin;
};

const setFeedback = (message = "", isError = false) => {
  feedback.textContent = message;
  feedback.hidden = !message;
  feedback.classList.toggle("is-error", isError);
};

const handleAccessError = (error) => {
  if (error.status === 401) {
    clearToken();
    showGate("SESSÃO", "Sua sessão expirou. Entre novamente usando o comando /painel dentro do jogo.", true);
    return true;
  }
  if (error.status === 403) {
    showGate("ACESSO", "Esta página não está disponível para esta conta.");
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
  accountsList.querySelectorAll("button").forEach((button) => { button.disabled = loading; });
  ordersList.querySelectorAll("button").forEach((button) => { button.disabled = loading; });
  accountForm.querySelectorAll("button, input").forEach((element) => { element.disabled = loading; });
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

const reviewOrder = async (order, action) => {
  if (loading) return;
  let reason = "";
  if (action === "approve") {
    const confirmed = window.confirm(
      `Você conferiu na conta da Caixa o recebimento de ${formatPix(order.pixAmountCents)} para o pedido ${order.orderId}?\n\nAprovar vai liberar o plano no jogo.`
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

    appendField(card, "PLANO", order.planName || "--");
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

const switchView = async (viewName) => {
  if (!['accounts', 'pix'].includes(viewName)) return;
  window.clearTimeout(refreshTimer);
  activeView = viewName;
  tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.adminTab === viewName));
  views.forEach((view) => { view.hidden = view.dataset.adminView !== viewName; });
  setFeedback();
  if (viewName === "accounts") await loadAccounts();
  else await loadOrders();
};

const initializeAdmin = async () => {
  if (!getToken()) {
    showGate("SESSÃO", "Entre primeiro com sua conta do jogo. Depois volte a este endereço.", true);
    return;
  }

  try {
    const result = await apiRequest("/api/admin/me");
    adminName.textContent = result.admin.name;
    gate.hidden = true;
    dashboard.hidden = false;
    await switchView("accounts");
  } catch (error) {
    if (!handleAccessError(error)) showGate("ACESSO", "Esta página não está disponível para esta conta.");
  }
};

tabs.forEach((tab) => tab.addEventListener("click", () => switchView(tab.dataset.adminTab)));
orderFilter.addEventListener("change", loadOrders);
refreshOrdersButton.addEventListener("click", loadOrders);
refreshAccountsButton.addEventListener("click", loadAccounts);
accountSearch.addEventListener("input", () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(loadAccounts, 350);
});
accountForm.addEventListener("submit", submitAccountChanges);
document.querySelectorAll("[data-close-account-dialog]").forEach((button) => {
  button.addEventListener("click", closeAccountEditor);
});
accountDialog.addEventListener("click", (event) => {
  if (event.target === accountDialog) closeAccountEditor();
});
logoutButton.addEventListener("click", () => {
  clearToken();
  window.location.replace("painel.html");
});

initializeAdmin();
