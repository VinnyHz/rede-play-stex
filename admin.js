const ADMIN_CONFIG = {
  apiUrl: "https://rede-play-stex-api.vinny-fernandessoares.workers.dev",
  tokenKey: "rps_portal_session",
};

const gate = document.querySelector("[data-admin-gate]");
const gateTitle = document.querySelector("[data-gate-title]");
const gateMessage = document.querySelector("[data-gate-message]");
const gateLogin = document.querySelector("[data-gate-login]");
const dashboard = document.querySelector("[data-admin-dashboard]");
const adminName = document.querySelector("[data-admin-name]");
const filter = document.querySelector("[data-order-filter]");
const refreshButton = document.querySelector("[data-refresh-orders]");
const logoutButton = document.querySelector("[data-admin-logout]");
const feedback = document.querySelector("[data-admin-feedback]");
const ordersList = document.querySelector("[data-orders-list]");

let refreshTimer = 0;
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

const statusLabels = {
  awaiting_payment: "Aguardando conferência",
  approved: "Aprovado",
  queued: "Aguardando jogador",
  processing: "Entregando no jogo",
  completed: "Concluído",
  rejected: "Recusado",
  failed: "Falha na entrega",
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
  renderLoadingState();
  try {
    await apiRequest(`/api/admin/pix-orders/${order.orderId}/${action}`, {
      method: "POST",
      body: JSON.stringify(action === "reject" ? { reason } : {}),
    });
    setFeedback(action === "approve" ? "Pedido aprovado. O jogador receberá quando estiver online." : "Pedido recusado.");
    await loadOrders();
  } catch (error) {
    setFeedback(error.message, true);
  } finally {
    loading = false;
    renderLoadingState();
  }
};

const renderLoadingState = () => {
  refreshButton.disabled = loading;
  ordersList.querySelectorAll("button").forEach((button) => { button.disabled = loading; });
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
  renderLoadingState();
};

const loadOrders = async () => {
  window.clearTimeout(refreshTimer);
  try {
    const status = filter.value;
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    const result = await apiRequest(`/api/admin/pix-orders${query}`);
    renderOrders(result.orders || []);
    refreshTimer = window.setTimeout(loadOrders, 15000);
  } catch (error) {
    if (error.status === 401) {
      clearToken();
      showGate("SESSÃO", "Sua sessão expirou. Entre novamente usando o código criado com /painel dentro do jogo.", true);
      return;
    }
    if (error.status === 403) {
      showGate("ACESSO", "Esta página não está disponível para esta conta.");
      return;
    }
    setFeedback(error.message, true);
    refreshTimer = window.setTimeout(loadOrders, 20000);
  }
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
    await loadOrders();
  } catch (error) {
    if (error.status === 401) {
      clearToken();
      showGate("SESSÃO", "Sua sessão expirou. Entre novamente usando o comando /painel.", true);
    } else {
      showGate("ACESSO", "Esta página não está disponível para esta conta.");
    }
  }
};

filter.addEventListener("change", loadOrders);
refreshButton.addEventListener("click", loadOrders);
logoutButton.addEventListener("click", () => {
  clearToken();
  window.location.replace("painel.html");
});

initializeAdmin();
