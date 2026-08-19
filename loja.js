const STORE_CONFIG = {
  apiUrl: "https://rede-play-stex-api.vinny-fernandessoares.workers.dev",
  tokenKey: "rps_portal_session",
  selectedPlanKey: "rps_store_selected_plan",
  activeOrderKey: "rps_store_active_order",
  activePixOrderKey: "rps_store_active_pix_order",
};

const storeYear = document.querySelector("[data-store-year]");
const planButtons = [...document.querySelectorAll("[data-plan-select]")];
const planSelection = document.querySelector("[data-plan-selection]");
const selectedPlan = document.querySelector("[data-selected-plan]");
const selectedPrice = document.querySelector("[data-selected-price]");
const continueButton = document.querySelector("[data-plan-continue]");
const continueLabel = document.querySelector("[data-plan-continue-label]");
const pixButton = document.querySelector("[data-plan-pix]");
const pixLabel = document.querySelector("[data-plan-pix-label]");
const purchaseStatus = document.querySelector("[data-purchase-status]");
const accountCard = document.querySelector("[data-store-account]");
const accountName = document.querySelector("[data-store-account-name]");
const accountBalance = document.querySelector("[data-store-account-balance]");
const accountLink = document.querySelector("[data-store-account-link]");
const pixModal = document.querySelector("[data-pix-modal]");
const pixPlayer = document.querySelector("[data-pix-player]");
const pixPlan = document.querySelector("[data-pix-plan]");
const pixPrice = document.querySelector("[data-pix-price]");
const pixReference = document.querySelector("[data-pix-reference]");
const pixCopyButton = document.querySelector("[data-copy-pix-order]");
const pixCopyStatus = document.querySelector("[data-pix-copy-status]");
const pixDiscordLink = document.querySelector("[data-pix-discord]");

let connectedPlayer = null;
let currentPlan = null;
let purchaseInProgress = false;
let currentPixReference = "";
let currentPixOrder = null;
let pixPollTimer = 0;

const previousTabToken = sessionStorage.getItem(STORE_CONFIG.tokenKey);
if (previousTabToken && !localStorage.getItem(STORE_CONFIG.tokenKey)) {
  localStorage.setItem(STORE_CONFIG.tokenKey, previousTabToken);
  sessionStorage.removeItem(STORE_CONFIG.tokenKey);
}

const getPortalToken = () =>
  localStorage.getItem(STORE_CONFIG.tokenKey) || sessionStorage.getItem(STORE_CONFIG.tokenKey);

const clearPortalToken = () => {
  localStorage.removeItem(STORE_CONFIG.tokenKey);
  sessionStorage.removeItem(STORE_CONFIG.tokenKey);
};

if (storeYear) storeYear.textContent = new Date().getFullYear();

const formatMv = (value) => `${new Intl.NumberFormat("pt-BR").format(Number(value) || 0)} MV`;
const formatReais = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0);

const apiRequest = async (path, options = {}) => {
  const token = getPortalToken();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${STORE_CONFIG.apiUrl}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "Não foi possível concluir a solicitação.");
    error.status = response.status;
    throw error;
  }
  return data;
};

const setPurchaseStatus = (message, type = "") => {
  if (!purchaseStatus) return;
  purchaseStatus.textContent = message;
  purchaseStatus.hidden = !message;
  purchaseStatus.classList.toggle("is-success", type === "success");
  purchaseStatus.classList.toggle("is-error", type === "error");
};

const updateContinueButton = () => {
  if (!continueButton || !continueLabel) return;
  continueButton.disabled = purchaseInProgress;
  if (pixButton) pixButton.disabled = purchaseInProgress;
  if (purchaseInProgress) {
    continueLabel.textContent = "Processando pedido...";
    if (pixLabel) pixLabel.textContent = "Aguarde...";
  } else if (connectedPlayer) {
    continueLabel.textContent = "Comprar com MV";
    if (pixLabel) {
      pixLabel.textContent = currentPlan ? `Pix ${formatReais(currentPlan.pixPrice)}` : "Pagar com Pix";
    }
  } else {
    continueLabel.textContent = "Conectar personagem";
    if (pixLabel) pixLabel.textContent = "Conectar para usar Pix";
  }
};

const renderDisconnectedAccount = () => {
  connectedPlayer = null;
  accountCard?.classList.remove("is-connected");
  if (accountName) accountName.textContent = "Nenhum personagem conectado";
  if (accountBalance) accountBalance.textContent = "Entre na Área do Jogador para usar seu saldo de MV.";
  if (accountLink) {
    accountLink.textContent = "Conectar personagem";
    accountLink.href = "painel.html?return=loja.html";
  }
  updateContinueButton();
};

const renderConnectedAccount = (player) => {
  connectedPlayer = player;
  accountCard?.classList.add("is-connected");
  if (accountName) accountName.textContent = player.name || "Personagem conectado";
  if (accountBalance) accountBalance.textContent = `Saldo disponível: ${formatMv(player.vipCoins)}`;
  if (accountLink) {
    accountLink.textContent = "Ver minha conta";
    accountLink.href = "painel.html";
  }
  updateContinueButton();
};

const refreshAccount = async () => {
  const token = getPortalToken();
  if (!token) {
    renderDisconnectedAccount();
    return false;
  }

  try {
    const result = await apiRequest("/api/me");
    renderConnectedAccount(result.player);
    return true;
  } catch (error) {
    if (error.status === 401) clearPortalToken();
    renderDisconnectedAccount();
    return false;
  }
};

const selectPlan = (button, shouldScroll = true) => {
  if (!button || !planSelection || !selectedPlan || !selectedPrice) return;

  planButtons.forEach((planButton) => {
    const isSelected = planButton === button;
    planButton.setAttribute("aria-pressed", String(isSelected));
    planButton.textContent = isSelected ? "Plano selecionado" : "Escolher plano";
  });

  currentPlan = {
    id: button.dataset.planId,
    name: button.dataset.planName,
    price: Number(button.dataset.planPrice) || 0,
    pixPrice: Number(button.dataset.planPixPrice) || 0,
  };

  sessionStorage.setItem(STORE_CONFIG.selectedPlanKey, JSON.stringify(currentPlan));
  selectedPlan.textContent = currentPlan.name;
  selectedPrice.textContent = `${formatMv(currentPlan.price)} ou ${formatReais(currentPlan.pixPrice)} no Pix`;
  planSelection.hidden = false;
  if (!purchaseInProgress) setPurchaseStatus("");
  updateContinueButton();

  if (shouldScroll) planSelection.scrollIntoView({ behavior: "smooth", block: "nearest" });
};

const failureMessages = {
  active_vip: "Este personagem já possui um VIP ou Sócio ativo.",
  insufficient_balance: "O saldo de MV no jogo não é suficiente para concluir a compra.",
  invalid_plan: "O plano escolhido não foi reconhecido pelo servidor.",
  invalid_order: "O pedido recebido pelo servidor é inválido.",
  apply_failed: "O servidor não conseguiu ativar o plano.",
  save_failed: "O servidor não conseguiu salvar a compra. Nenhum MV foi consumido.",
};

const pollOrder = async (orderId) => {
  purchaseInProgress = true;
  updateContinueButton();

  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const result = await apiRequest(`/api/store/purchases/${orderId}`);
      const order = result.order;

      if (order.status === "completed") {
        sessionStorage.removeItem(STORE_CONFIG.activeOrderKey);
        purchaseInProgress = false;
        setPurchaseStatus("Compra entregue no jogo com sucesso!", "success");
        await refreshAccount();
        updateContinueButton();
        return;
      }

      if (order.status === "failed") {
        sessionStorage.removeItem(STORE_CONFIG.activeOrderKey);
        purchaseInProgress = false;
        setPurchaseStatus(failureMessages[order.failureReason] || "Não foi possível entregar esta compra.", "error");
        await refreshAccount();
        updateContinueButton();
        return;
      }

      setPurchaseStatus("Pedido aguardando o servidor. Mantenha seu personagem conectado no jogo.");
    } catch (error) {
      if (error.status === 401) {
        clearPortalToken();
        renderDisconnectedAccount();
        break;
      }
      setPurchaseStatus("A entrega continua pendente. Tentando consultar novamente...");
    }

    await new Promise((resolve) => window.setTimeout(resolve, 5000));
  }

  purchaseInProgress = false;
  setPurchaseStatus("O pedido continua salvo. Entre no jogo e atualize esta página para acompanhar.");
  updateContinueButton();
};

const buySelectedPlan = async () => {
  if (!currentPlan || purchaseInProgress) return;

  if (!connectedPlayer) {
    window.location.assign("painel.html?return=loja.html");
    return;
  }

  if (Number(connectedPlayer.vipLevel) > 0 && Number(connectedPlayer.vipExpire) > 0) {
    setPurchaseStatus("Você já possui um VIP ou Sócio ativo. Aguarde o plano terminar.", "error");
    return;
  }
  if (Number(connectedPlayer.vipCoins) < currentPlan.price) {
    setPurchaseStatus(`Saldo insuficiente. Você tem ${formatMv(connectedPlayer.vipCoins)}.`, "error");
    return;
  }

  const confirmed = window.confirm(
    `Confirmar ${currentPlan.name} por ${formatMv(currentPlan.price)}? O valor será descontado no jogo.`
  );
  if (!confirmed) return;

  purchaseInProgress = true;
  setPurchaseStatus("Criando seu pedido seguro...");
  updateContinueButton();

  try {
    const result = await apiRequest("/api/store/purchases", {
      method: "POST",
      body: JSON.stringify({ planId: currentPlan.id }),
    });
    sessionStorage.setItem(STORE_CONFIG.activeOrderKey, String(result.order.orderId));
    await pollOrder(result.order.orderId);
  } catch (error) {
    purchaseInProgress = false;
    if (error.status === 401) {
      clearPortalToken();
      renderDisconnectedAccount();
      setPurchaseStatus("Sua sessão expirou. Conecte o personagem novamente.", "error");
    } else {
      setPurchaseStatus(error.message || "Não foi possível criar a compra.", "error");
    }
    updateContinueButton();
  }
};

const pixReferenceFor = (orderId) => `RPS-PIX-${String(orderId).padStart(6, "0")}`;

const renderPixOrder = (order, openModal = true) => {
  if (!order) return;
  currentPixOrder = order;
  currentPixReference = pixReferenceFor(order.orderId);
  if (pixPlayer) pixPlayer.textContent = order.playerName || connectedPlayer?.name || "Personagem conectado";
  if (pixPlan) pixPlan.textContent = order.planName || currentPlan?.name || "Plano selecionado";
  if (pixPrice) pixPrice.textContent = formatReais(Number(order.pixAmountCents) / 100);
  if (pixReference) pixReference.textContent = currentPixReference;

  const statusMessages = {
    awaiting_payment: "Pedido criado. Depois de pagar, envie o comprovante e este código para a administração.",
    approved: "Pagamento aprovado. A entrega está sendo preparada.",
    queued: "Pagamento aprovado. Entre no jogo e mantenha o personagem conectado para receber.",
    processing: "O servidor está entregando seu plano agora.",
    completed: "Pagamento aprovado e plano entregue no jogo!",
    rejected: order.failureReason || "O pagamento não foi confirmado pela administração.",
    failed: order.failureReason || "Não foi possível entregar o plano. Fale com a administração.",
  };
  const message = statusMessages[order.status] || "Acompanhando seu pedido Pix.";
  if (pixCopyStatus) {
    pixCopyStatus.textContent = message;
    pixCopyStatus.hidden = false;
  }

  if (["completed", "rejected", "failed"].includes(order.status)) {
    sessionStorage.removeItem(STORE_CONFIG.activePixOrderKey);
    window.clearTimeout(pixPollTimer);
  } else {
    sessionStorage.setItem(STORE_CONFIG.activePixOrderKey, String(order.orderId));
  }

  if (order.status === "completed") setPurchaseStatus(message, "success");
  else if (["rejected", "failed"].includes(order.status)) setPurchaseStatus(message, "error");
  else setPurchaseStatus(message);

  if (openModal && pixModal) {
    pixModal.hidden = false;
    document.body.classList.add("store-modal-open");
  }
};

const pollPixOrder = async (orderId, openModal = false) => {
  window.clearTimeout(pixPollTimer);
  try {
    const result = await apiRequest(`/api/store/pix-orders/${orderId}`);
    renderPixOrder(result.order, openModal);
    if (!["completed", "rejected", "failed"].includes(result.order.status)) {
      pixPollTimer = window.setTimeout(() => pollPixOrder(orderId, false), 10000);
    }
  } catch (error) {
    if (error.status === 401) {
      clearPortalToken();
      renderDisconnectedAccount();
      sessionStorage.removeItem(STORE_CONFIG.activePixOrderKey);
    }
  }
};

const closePixCheckout = () => {
  if (!pixModal) return;
  pixModal.hidden = true;
  document.body.classList.remove("store-modal-open");
};

const openPixCheckout = async () => {
  if (!currentPlan || !pixModal || purchaseInProgress) return;

  if (!connectedPlayer) {
    window.location.assign("painel.html?return=loja.html");
    return;
  }

  if (Number(connectedPlayer.vipLevel) > 0 && Number(connectedPlayer.vipExpire) > 0) {
    setPurchaseStatus("Você já possui um VIP ou Sócio ativo. Aguarde o plano terminar.", "error");
    return;
  }

  const savedPixOrderId = Number(sessionStorage.getItem(STORE_CONFIG.activePixOrderKey));
  if (Number.isInteger(savedPixOrderId) && savedPixOrderId > 0) {
    await pollPixOrder(savedPixOrderId, true);
    return;
  }

  purchaseInProgress = true;
  updateContinueButton();
  setPurchaseStatus("Criando seu pedido Pix seguro...");

  try {
    const result = await apiRequest("/api/store/pix-orders", {
      method: "POST",
      body: JSON.stringify({ planId: currentPlan.id }),
    });
    renderPixOrder(result.order, true);
    pollPixOrder(result.order.orderId, false);
  } catch (error) {
    if (error.status === 401) {
      clearPortalToken();
      renderDisconnectedAccount();
      setPurchaseStatus("Sua sessão expirou. Conecte o personagem novamente.", "error");
    } else {
      setPurchaseStatus(error.message || "Não foi possível criar o pedido Pix.", "error");
    }
  } finally {
    purchaseInProgress = false;
    updateContinueButton();
  }
};

const copyPixOrder = async () => {
  if (!connectedPlayer || !currentPixOrder || !currentPixReference) return;
  const details = [
    "PEDIDO PIX - REDE PLAY STEX",
    `Personagem: ${currentPixOrder.playerName || connectedPlayer.name || "--"}`,
    `Plano: ${currentPixOrder.planName}`,
    `Valor: ${formatReais(Number(currentPixOrder.pixAmountCents) / 100)}`,
    `Código: ${currentPixReference}`,
  ].join("\n");

  try {
    await navigator.clipboard.writeText(details);
    if (pixCopyStatus) {
      pixCopyStatus.textContent = "Dados copiados. Envie junto com o comprovante.";
      pixCopyStatus.hidden = false;
    }
  } catch {
    window.prompt("Copie os dados do pedido:", details);
  }
};

planButtons.forEach((button) => button.addEventListener("click", () => selectPlan(button)));
continueButton?.addEventListener("click", buySelectedPlan);
pixButton?.addEventListener("click", openPixCheckout);
pixCopyButton?.addEventListener("click", copyPixOrder);
document.querySelectorAll("[data-pix-close]").forEach((button) => {
  button.addEventListener("click", closePixCheckout);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && pixModal && !pixModal.hidden) closePixCheckout();
});

try {
  const savedPlan = JSON.parse(sessionStorage.getItem(STORE_CONFIG.selectedPlanKey) || "null");
  const savedButton = planButtons.find((button) => button.dataset.planId === savedPlan?.id);
  if (savedButton) selectPlan(savedButton, false);
} catch {
  sessionStorage.removeItem(STORE_CONFIG.selectedPlanKey);
}

const initializeStore = async () => {
  const connected = await refreshAccount();
  const activeOrderId = Number(sessionStorage.getItem(STORE_CONFIG.activeOrderKey));
  if (connected && Number.isInteger(activeOrderId) && activeOrderId > 0) {
    await pollOrder(activeOrderId);
  }
  const activePixOrderId = Number(sessionStorage.getItem(STORE_CONFIG.activePixOrderKey));
  if (connected && Number.isInteger(activePixOrderId) && activePixOrderId > 0) {
    await pollPixOrder(activePixOrderId, false);
  }
};

initializeStore();
