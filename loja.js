const STORE_CONFIG = {
  apiUrl: "https://rede-play-stex-api.vinny-fernandessoares.workers.dev",
  activeTabKey: "rps_store_active_tab",
  selectedPlanKey: "rps_store_selected_plan",
  activeOrderKey: "rps_store_active_order",
  activePixOrderKey: "rps_store_active_pix_order",
};

const MV_PURCHASE = {
  min: 5000,
  max: 1000000,
  step: 1000,
  mvPerReal: 1000,
};

const storeYear = document.querySelector("[data-store-year]");
const storeTabs = [...document.querySelectorAll("[data-store-tab]")];
const storePanels = [...document.querySelectorAll("[data-store-panel]")];
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
const mvForm = document.querySelector("[data-mv-form]");
const mvAmountInput = document.querySelector("[data-mv-amount]");
const mvPresets = [...document.querySelectorAll("[data-mv-preset]")];
const mvCouponInput = document.querySelector("[data-mv-coupon]");
const mvCouponButton = document.querySelector("[data-apply-mv-coupon]");
const mvCouponStatus = document.querySelector("[data-mv-coupon-status]");
const mvSummaryAmount = document.querySelector("[data-mv-summary-amount]");
const mvSubtotal = document.querySelector("[data-mv-subtotal]");
const mvDiscountRow = document.querySelector("[data-mv-discount-row]");
const mvDiscountLabel = document.querySelector("[data-mv-discount-label]");
const mvDiscount = document.querySelector("[data-mv-discount]");
const mvTotal = document.querySelector("[data-mv-total]");
const mvBuyButton = document.querySelector("[data-mv-buy]");
const mvBuyLabel = document.querySelector("[data-mv-buy-label]");
const mvStatus = document.querySelector("[data-mv-status]");
const pixModal = document.querySelector("[data-pix-modal]");
const pixPlayer = document.querySelector("[data-pix-player]");
const pixProduct = document.querySelector("[data-pix-product]");
const pixPrice = document.querySelector("[data-pix-price]");
const pixReference = document.querySelector("[data-pix-reference]");
const pixCouponSummary = document.querySelector("[data-pix-coupon-summary]");
const pixSubtotal = document.querySelector("[data-pix-subtotal]");
const pixCoupon = document.querySelector("[data-pix-coupon]");
const pixDiscount = document.querySelector("[data-pix-discount]");
const pixCopyButton = document.querySelector("[data-copy-pix-order]");
const pixCopyStatus = document.querySelector("[data-pix-copy-status]");
const pixDiscordLink = document.querySelector("[data-pix-discord]");

let connectedPlayer = null;
let currentPlan = null;
let purchaseInProgress = false;
let currentPixReference = "";
let currentPixOrder = null;
let pixPollTimer = 0;
let quoteTimer = 0;
let quoteRequestId = 0;
let currentMvQuote = null;
let appliedCouponCode = "";
let quoteInProgress = false;

const getPortalToken = () => window.RPS_SESSION.getToken();

const clearPortalToken = () => {
  window.RPS_SESSION.clearToken();
};

if (storeYear) storeYear.textContent = new Date().getFullYear();

const formatMv = (value) => `${new Intl.NumberFormat("pt-BR").format(Number(value) || 0)} MV`;
const formatReais = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0);
const formatCents = (value) => formatReais((Number(value) || 0) / 100);

const normalizedCouponCode = () => String(mvCouponInput?.value || "").trim().toUpperCase();

const validateMvAmount = () => {
  const amount = Number(mvAmountInput?.value);
  if (!Number.isInteger(amount)) return "Digite uma quantidade inteira de MV.";
  if (amount < MV_PURCHASE.min) return `A compra mínima é de ${formatMv(MV_PURCHASE.min)}.`;
  if (amount > MV_PURCHASE.max) return `A compra máxima é de ${formatMv(MV_PURCHASE.max)}.`;
  if (amount % MV_PURCHASE.step !== 0) return `Escolha um valor de ${formatMv(MV_PURCHASE.step)} em ${formatMv(MV_PURCHASE.step)}.`;
  return "";
};

const normalizeMvQuote = (payload) => {
  const quote = payload?.quote || payload || {};
  const mvAmount = Number(quote.mvAmount ?? quote.amount ?? mvAmountInput?.value) || 0;
  const baseAmountCents = Number(
    quote.baseAmountCents ?? quote.subtotalCents ?? (mvAmount / MV_PURCHASE.mvPerReal) * 100
  ) || 0;
  const discountCents = Math.max(0, Number(quote.discountCents ?? quote.discountAmountCents) || 0);
  const pixAmountCents = Math.max(
    0,
    Number(quote.pixAmountCents ?? quote.totalAmountCents ?? quote.totalCents ?? (baseAmountCents - discountCents)) || 0
  );
  const couponCode = String(quote.couponCode ?? quote.coupon?.code ?? "").trim().toUpperCase();
  const couponPercent = Math.max(
    0,
    Number(quote.couponPercent ?? quote.discountPercent ?? quote.coupon?.discountPercent) || 0
  );
  return { mvAmount, baseAmountCents, discountCents, pixAmountCents, couponCode, couponPercent };
};

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

const setMvStatus = (message = "", type = "") => {
  if (!mvStatus) return;
  mvStatus.textContent = message;
  mvStatus.hidden = !message;
  mvStatus.classList.toggle("is-success", type === "success");
  mvStatus.classList.toggle("is-error", type === "error");
};

const setCouponStatus = (message, type = "") => {
  if (!mvCouponStatus) return;
  mvCouponStatus.textContent = message;
  mvCouponStatus.classList.toggle("is-success", type === "success");
  mvCouponStatus.classList.toggle("is-error", type === "error");
};

const renderMvQuote = (quote = null) => {
  const amount = Number(mvAmountInput?.value) || 0;
  const localBaseCents = Number.isFinite(amount) ? Math.max(0, (amount / MV_PURCHASE.mvPerReal) * 100) : 0;
  const shown = quote || {
    mvAmount: amount,
    baseAmountCents: localBaseCents,
    discountCents: 0,
    pixAmountCents: localBaseCents,
    couponCode: "",
    couponPercent: 0,
  };

  if (mvSummaryAmount) mvSummaryAmount.textContent = formatMv(shown.mvAmount || amount);
  if (mvSubtotal) mvSubtotal.textContent = formatCents(shown.baseAmountCents);
  if (mvTotal) mvTotal.textContent = formatCents(shown.pixAmountCents);
  if (mvDiscount) mvDiscount.textContent = `− ${formatCents(shown.discountCents)}`;
  if (mvDiscountLabel) {
    mvDiscountLabel.textContent = shown.couponPercent > 0
      ? `Cupom (${shown.couponPercent}%)`
      : "Desconto";
  }
  if (mvDiscountRow) mvDiscountRow.hidden = shown.discountCents <= 0;
  if (mvBuyLabel) mvBuyLabel.textContent = `Comprar ${formatMv(shown.mvAmount || amount)} no Pix`;

  mvPresets.forEach((button) => {
    button.classList.toggle("is-active", Number(button.dataset.mvPreset) === amount);
  });
};

const updateMvButtons = () => {
  const disabled = purchaseInProgress || quoteInProgress;
  if (mvBuyButton) mvBuyButton.disabled = disabled;
  if (mvCouponButton) {
    mvCouponButton.disabled = disabled;
    mvCouponButton.textContent = quoteInProgress ? "Verificando..." : "Aplicar";
  }
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
  updateMvButtons();
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

const switchStoreTab = (tabName, shouldFocus = false) => {
  if (!storePanels.some((panel) => panel.dataset.storePanel === tabName)) return;
  storeTabs.forEach((tab) => {
    const selected = tab.dataset.storeTab === tabName;
    tab.classList.toggle("is-active", selected);
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && shouldFocus) tab.focus();
  });
  storePanels.forEach((panel) => {
    panel.hidden = panel.dataset.storePanel !== tabName;
  });
  sessionStorage.setItem(STORE_CONFIG.activeTabKey, tabName);
};

const requestMvQuote = async (couponCode = normalizedCouponCode(), silent = false) => {
  const amountError = validateMvAmount();
  if (amountError) {
    currentMvQuote = null;
    renderMvQuote();
    if (!silent) setCouponStatus(amountError, "error");
    else setMvStatus(amountError, "error");
    return null;
  }

  const amount = Number(mvAmountInput.value);
  const requestId = ++quoteRequestId;
  quoteInProgress = true;
  updateMvButtons();
  if (!silent) setCouponStatus(couponCode ? "Validando cupom..." : "Atualizando valor...");

  try {
    const result = await apiRequest("/api/store/mv-quote", {
      method: "POST",
      body: JSON.stringify({ amount, couponCode }),
    });
    if (requestId !== quoteRequestId) return null;
    const quote = normalizeMvQuote(result);
    currentMvQuote = quote;
    appliedCouponCode = quote.couponCode || "";
    if (mvCouponInput && appliedCouponCode) mvCouponInput.value = appliedCouponCode;
    renderMvQuote(quote);
    if (quote.couponCode && quote.discountCents > 0) {
      setCouponStatus(`Cupom ${quote.couponCode} aplicado: ${quote.couponPercent}% de desconto.`, "success");
    } else if (couponCode) {
      setCouponStatus("Cupom validado.", "success");
    } else {
      setCouponStatus("Opcional e válido somente nesta compra de MV.");
    }
    return quote;
  } catch (error) {
    if (requestId !== quoteRequestId) return null;
    currentMvQuote = null;
    appliedCouponCode = "";
    renderMvQuote();
    if (error.status === 401) {
      clearPortalToken();
      renderDisconnectedAccount();
    }
    const message = error.message || "Não foi possível calcular esta compra.";
    if (!silent) setCouponStatus(message, "error");
    else setMvStatus(message, "error");
    return null;
  } finally {
    if (requestId === quoteRequestId) {
      quoteInProgress = false;
      updateMvButtons();
    }
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

const isMvPixOrder = (order) => {
  const kind = String(order?.orderType ?? order?.kind ?? order?.productType ?? "").toLowerCase();
  return kind === "mv" || kind === "vip_coins" || Number(order?.mvAmount) > 0;
};

const orderMvAmount = (order) => Number(order?.mvAmount ?? order?.vipCoinsAmount ?? 0) || 0;
const orderCouponCode = (order) => String(order?.couponCode ?? order?.coupon?.code ?? "").trim().toUpperCase();
const orderBaseCents = (order) => Number(
  order?.baseAmountCents ?? order?.subtotalCents ?? order?.originalAmountCents ?? order?.pixAmountCents
) || 0;
const orderDiscountCents = (order) => Math.max(
  0,
  Number(order?.discountCents ?? order?.discountAmountCents) || 0
);

const renderPixOrder = (order, openModal = true) => {
  if (!order) return;
  currentPixOrder = order;
  currentPixReference = pixReferenceFor(order.orderId);
  const mvOrder = isMvPixOrder(order);
  const mvAmount = orderMvAmount(order);
  const couponCode = orderCouponCode(order);
  const baseCents = orderBaseCents(order);
  const discountCents = orderDiscountCents(order);
  if (pixPlayer) pixPlayer.textContent = order.playerName || connectedPlayer?.name || "Personagem conectado";
  if (pixProduct) {
    pixProduct.textContent = mvOrder
      ? `${formatMv(mvAmount)} para a conta`
      : (order.planName || currentPlan?.name || "Plano selecionado");
  }
  if (pixPrice) pixPrice.textContent = formatReais(Number(order.pixAmountCents) / 100);
  if (pixReference) pixReference.textContent = currentPixReference;
  if (pixCouponSummary) pixCouponSummary.hidden = !(mvOrder && couponCode && discountCents > 0);
  if (pixSubtotal) pixSubtotal.textContent = formatCents(baseCents);
  if (pixCoupon) pixCoupon.textContent = couponCode || "--";
  if (pixDiscount) pixDiscount.textContent = `− ${formatCents(discountCents)}`;

  const statusMessages = {
    awaiting_payment: "Pedido criado. Depois de pagar, envie o comprovante e este código para a administração.",
    approved: "Pagamento aprovado. A entrega está sendo preparada.",
    queued: "Pagamento aprovado. Entre no jogo e mantenha o personagem conectado para receber.",
    processing: mvOrder ? "O servidor está creditando suas moedas agora." : "O servidor está entregando seu plano agora.",
    completed: mvOrder ? "Pagamento aprovado e moedas entregues no jogo!" : "Pagamento aprovado e plano entregue no jogo!",
    rejected: order.failureReason || "O pagamento não foi confirmado pela administração.",
    failed: order.failureReason || `Não foi possível entregar ${mvOrder ? "as moedas" : "o plano"}. Fale com a administração.`,
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

  const statusType = order.status === "completed"
    ? "success"
    : (["rejected", "failed"].includes(order.status) ? "error" : "");
  if (mvOrder) setMvStatus(message, statusType);
  else setPurchaseStatus(message, statusType);
  if (order.status === "completed") refreshAccount();

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

const buyMvWithPix = async (event) => {
  event?.preventDefault();
  if (purchaseInProgress || quoteInProgress) return;

  const amountError = validateMvAmount();
  if (amountError) {
    setMvStatus(amountError, "error");
    mvAmountInput?.focus();
    return;
  }

  if (!connectedPlayer) {
    window.location.assign("painel.html?return=loja.html");
    return;
  }

  const savedPixOrderId = Number(sessionStorage.getItem(STORE_CONFIG.activePixOrderKey));
  if (Number.isInteger(savedPixOrderId) && savedPixOrderId > 0) {
    await pollPixOrder(savedPixOrderId, true);
    return;
  }

  const couponCode = normalizedCouponCode();
  setMvStatus("Conferindo o valor da compra...");
  const quote = await requestMvQuote(couponCode, true);
  if (!quote) return;

  const couponText = quote.couponCode && quote.discountCents > 0
    ? `\nCupom ${quote.couponCode}: − ${formatCents(quote.discountCents)}`
    : "";
  const confirmed = window.confirm(
    `Comprar ${formatMv(quote.mvAmount)} por ${formatCents(quote.pixAmountCents)} no Pix?${couponText}\n\nAs moedas serão liberadas após a conferência do pagamento.`
  );
  if (!confirmed) {
    setMvStatus("");
    return;
  }

  purchaseInProgress = true;
  setMvStatus("Criando seu pedido Pix seguro...");
  updateContinueButton();
  try {
    const result = await apiRequest("/api/store/mv-pix-orders", {
      method: "POST",
      body: JSON.stringify({ amount: quote.mvAmount, couponCode: quote.couponCode || "" }),
    });
    sessionStorage.setItem(STORE_CONFIG.activePixOrderKey, String(result.order.orderId));
    renderPixOrder(result.order, true);
    pollPixOrder(result.order.orderId, false);
  } catch (error) {
    if (error.status === 401) {
      clearPortalToken();
      renderDisconnectedAccount();
      setMvStatus("Sua sessão expirou. Conecte o personagem novamente.", "error");
    } else {
      setMvStatus(error.message || "Não foi possível criar o pedido de MV.", "error");
    }
  } finally {
    purchaseInProgress = false;
    updateContinueButton();
  }
};

const copyPixOrder = async () => {
  if (!connectedPlayer || !currentPixOrder || !currentPixReference) return;
  const mvOrder = isMvPixOrder(currentPixOrder);
  const couponCode = orderCouponCode(currentPixOrder);
  const discountCents = orderDiscountCents(currentPixOrder);
  const details = [
    "PEDIDO PIX - REDE PLAY STEX",
    `Personagem: ${currentPixOrder.playerName || connectedPlayer.name || "--"}`,
    mvOrder
      ? `Produto: ${formatMv(orderMvAmount(currentPixOrder))}`
      : `Plano: ${currentPixOrder.planName}`,
    ...(mvOrder && couponCode ? [`Cupom: ${couponCode}`, `Desconto: ${formatCents(discountCents)}`] : []),
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
mvForm?.addEventListener("submit", buyMvWithPix);
mvCouponButton?.addEventListener("click", () => requestMvQuote(normalizedCouponCode(), false));
mvCouponInput?.addEventListener("input", () => {
  const normalized = mvCouponInput.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  if (mvCouponInput.value !== normalized) mvCouponInput.value = normalized;
  if (normalized !== appliedCouponCode) {
    appliedCouponCode = "";
    currentMvQuote = null;
    renderMvQuote();
    setCouponStatus(normalized ? "Clique em Aplicar para validar o cupom." : "Opcional e válido somente nesta compra de MV.");
  }
});
mvAmountInput?.addEventListener("input", () => {
  window.clearTimeout(quoteTimer);
  currentMvQuote = null;
  renderMvQuote();
  setMvStatus("");
  const amountError = validateMvAmount();
  if (amountError) {
    setMvStatus(amountError, "error");
    return;
  }
  if (appliedCouponCode) {
    quoteTimer = window.setTimeout(() => requestMvQuote(appliedCouponCode, false), 400);
  }
});
mvPresets.forEach((button) => {
  button.addEventListener("click", () => {
    if (!mvAmountInput) return;
    mvAmountInput.value = button.dataset.mvPreset;
    mvAmountInput.dispatchEvent(new Event("input", { bubbles: true }));
  });
});
storeTabs.forEach((tab, index) => {
  tab.addEventListener("click", () => switchStoreTab(tab.dataset.storeTab));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + direction + storeTabs.length) % storeTabs.length;
    switchStoreTab(storeTabs[nextIndex].dataset.storeTab, true);
  });
});
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

const savedTab = sessionStorage.getItem(STORE_CONFIG.activeTabKey);
switchStoreTab(["socios", "pacotes", "mv"].includes(savedTab) ? savedTab : "socios");
renderMvQuote();

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
