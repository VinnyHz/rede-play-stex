const PORTAL_CONFIG = {
  apiUrl: "https://rede-play-stex-api.vinny-fernandessoares.workers.dev",
  tokenKey: "rps_portal_session",
  activeRewardOrderKey: "rps_active_reward_order",
};

const requestedReturn = new URLSearchParams(window.location.search).get("return");
const safeReturnPage = requestedReturn === "loja.html" ? "loja.html" : "";

const getPortalToken = () =>
  localStorage.getItem(PORTAL_CONFIG.tokenKey) || sessionStorage.getItem(PORTAL_CONFIG.tokenKey);

const savePortalToken = (token) => {
  localStorage.setItem(PORTAL_CONFIG.tokenKey, token);
  sessionStorage.removeItem(PORTAL_CONFIG.tokenKey);
};

const clearPortalToken = () => {
  localStorage.removeItem(PORTAL_CONFIG.tokenKey);
  sessionStorage.removeItem(PORTAL_CONFIG.tokenKey);
  localStorage.removeItem(PORTAL_CONFIG.activeRewardOrderKey);
};

const previousTabToken = sessionStorage.getItem(PORTAL_CONFIG.tokenKey);
if (previousTabToken && !localStorage.getItem(PORTAL_CONFIG.tokenKey)) savePortalToken(previousTabToken);

const loginView = document.querySelector("[data-login-view]");
const dashboardView = document.querySelector("[data-dashboard-view]");
const loginForm = document.querySelector("[data-login-form]");
const loginButton = document.querySelector("[data-login-submit]");
const submitLabel = document.querySelector("[data-submit-label]");
const formAlert = document.querySelector("[data-form-alert]");
const logoutButton = document.querySelector("[data-logout]");
const adminAccessButton = document.querySelector("[data-admin-access]");
const openRewardsButton = document.querySelector("[data-open-rewards]");
const rewardsModal = document.querySelector("[data-rewards-modal]");
const closeRewardsButtons = [...document.querySelectorAll("[data-close-rewards]")];
const rewardsModalBalance = document.querySelector("[data-rewards-modal-balance]");
const rewardsStatus = document.querySelector("[data-rewards-status]");
const rewardOptions = [...document.querySelectorAll("[data-reward-select]")];

let connectedPlayer = null;
let rewardOrderInProgress = false;
let rewardOrderPolling = false;

document.querySelector("[data-current-year]").textContent = new Date().getFullYear();

const setText = (selector, value) => {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
};

const formatMoney = (value) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const formatNumber = (value) => new Intl.NumberFormat("pt-BR").format(Number(value) || 0);

const formatPlayTime = (minutes) => {
  const total = Math.max(Number(minutes) || 0, 0);
  const hours = Math.floor(total / 60);
  const remainingMinutes = total % 60;
  return hours > 0 ? `${hours}h ${remainingMinutes}min` : `${remainingMinutes}min`;
};

const formatRelativeTime = (dateValue) => {
  if (!dateValue) return "agora";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "recentemente";
  const seconds = Math.max(Math.floor((Date.now() - date.getTime()) / 1000), 0);
  if (seconds < 60) return "agora";
  if (seconds < 3600) return `há ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `há ${Math.floor(seconds / 3600)}h`;
  return `há ${Math.floor(seconds / 86400)} dias`;
};

const renderPlayerSkin = (skinValue, playerName) => {
  const image = document.querySelector("[data-player-skin]");
  if (!image) return;

  const skinId = Number.parseInt(skinValue, 10);
  const safeSkinId = Number.isInteger(skinId) && skinId >= 0 && skinId <= 311 ? skinId : 0;
  const skinCard = image.closest(".character-skin");
  const fallbackUrl = "https://assets.open.mp/assets/images/skins/0.png";

  skinCard?.classList.remove("is-unavailable");
  image.hidden = false;
  image.alt = `Skin atual de ${playerName}`;
  image.onerror = () => {
    if (!image.src.endsWith("/0.png")) {
      image.src = fallbackUrl;
      return;
    }

    image.hidden = true;
    skinCard?.classList.add("is-unavailable");
  };
  image.src = `https://assets.open.mp/assets/images/skins/${safeSkinId}.png`;
};

const jobNames = {
  0: "Cidadão de San Andreas",
  1: "Caminhoneiro",
  2: "Taxista",
  3: "Mecânico",
  4: "Entregador",
  5: "Motorista de ônibus",
  6: "Lixeiro",
};

const vipPlans = {
  0: ["Nenhum plano ativo", "Conheça os benefícios exclusivos disponíveis para seu personagem."],
  1: ["VIP Comum", "Seu plano VIP está ativo e seus benefícios já estão disponíveis no jogo."],
  2: ["VIP Premium", "Benefícios premium ativos para sua experiência na cidade."],
  3: ["VIP Plus", "Uma experiência exclusiva com vantagens especiais."],
  4: ["Sócio Diamante", "Você faz parte do grupo de apoiadores Diamante da Rede Play Stex."],
  5: ["Sócio Black", "Plano Black ativo com benefícios exclusivos."],
  6: ["Sócio Comum", "Obrigado por apoiar e fazer parte da Rede Play Stex."],
  7: ["Sócio Premium", "Sua assinatura Premium está ativa."],
  8: ["Sócio Esmeralda", "Você possui um dos planos especiais da Rede Play Stex."],
  9: ["Sócio Stex", "O nível máximo de benefícios e reconhecimento na comunidade."],
};

const showAlert = (message) => {
  formAlert.textContent = message;
  formAlert.hidden = false;
};

const clearAlert = () => {
  formAlert.hidden = true;
  formAlert.textContent = "";
};

const setLoading = (loading) => {
  loginButton.disabled = loading;
  submitLabel.textContent = loading ? "Verificando conta..." : "Entrar na minha conta";
};

const apiRequest = async (path, options = {}) => {
  const token = getPortalToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${PORTAL_CONFIG.apiUrl}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "Não foi possível concluir a solicitação.");
    error.status = response.status;
    throw error;
  }

  return data;
};

const setRewardsStatus = (message = "", type = "") => {
  if (!rewardsStatus) return;
  rewardsStatus.textContent = message;
  rewardsStatus.hidden = !message;
  rewardsStatus.classList.toggle("is-error", type === "error");
  rewardsStatus.classList.toggle("is-success", type === "success");
};

const updateRewardOptions = (balance = connectedPlayer?.rpsTokens) => {
  const availableTokens = Math.min(Math.max(Number(balance) || 0, 0), 100);
  if (rewardsModalBalance) rewardsModalBalance.textContent = formatNumber(availableTokens);

  rewardOptions.forEach((button) => {
    const cost = Number(button.dataset.rewardCost) || 0;
    const unavailable = cost > availableTokens;
    button.disabled = rewardOrderInProgress || unavailable;
    button.title = rewardOrderInProgress
      ? "Aguarde a entrega do pedido atual."
      : unavailable
        ? `Faltam ${cost - availableTokens} fichas.`
        : `Trocar ${cost} fichas por ${button.dataset.rewardName}.`;
  });
};

const openRewardsModal = () => {
  if (!rewardsModal || !connectedPlayer) return;
  updateRewardOptions();
  rewardsModal.hidden = false;
  document.body.classList.add("is-modal-open");
};

const closeRewardsModal = () => {
  if (!rewardsModal) return;
  rewardsModal.hidden = true;
  document.body.classList.remove("is-modal-open");
};

const rewardFailureMessages = {
  invalid_reward: "Essa recompensa nÃ£o existe mais.",
  insufficient_tokens: "VocÃª nÃ£o possui fichas suficientes.",
  inventory_full: "Seu inventÃ¡rio estÃ¡ cheio. Libere um espaÃ§o e tente novamente.",
  save_failed: "O servidor nÃ£o conseguiu salvar a entrega. Tente novamente.",
  invalid_order: "O pedido recebido pelo servidor era invÃ¡lido.",
};

const refreshConnectedPlayer = async () => {
  const result = await apiRequest("/api/me");
  renderDashboard(result.player);
  return result.player;
};

const pollRewardOrder = async (orderId) => {
  if (rewardOrderPolling || !Number.isInteger(orderId) || orderId <= 0) return;

  rewardOrderPolling = true;
  rewardOrderInProgress = true;
  updateRewardOptions();
  setRewardsStatus("Pedido criado. Entre no servidor e mantenha seu personagem conectado para receber o item.");

  try {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const result = await apiRequest(`/api/rewards/redemptions/${orderId}`);
      const order = result.order || {};

      if (order.status === "completed") {
        localStorage.removeItem(PORTAL_CONFIG.activeRewardOrderKey);
        rewardOrderInProgress = false;
        rewardOrderPolling = false;
        await refreshConnectedPlayer();
        setRewardsStatus(`${order.planName || "Recompensa"} foi entregue no seu inventÃ¡rio!`, "success");
        return;
      }

      if (order.status === "failed") {
        localStorage.removeItem(PORTAL_CONFIG.activeRewardOrderKey);
        rewardOrderInProgress = false;
        rewardOrderPolling = false;
        await refreshConnectedPlayer();
        setRewardsStatus(
          rewardFailureMessages[order.failureReason] || "O jogo nÃ£o conseguiu entregar esse item. Tente novamente.",
          "error",
        );
        return;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 4000));
    }

    setRewardsStatus("O pedido continua salvo. Entre no servidor; o painel confirmarÃ¡ a entrega quando vocÃª voltar.");
  } catch (error) {
    setRewardsStatus(error.message || "NÃ£o foi possÃ­vel consultar a entrega agora.", "error");
  } finally {
    rewardOrderPolling = false;
    rewardOrderInProgress = false;
    updateRewardOptions();
  }
};

const redeemReward = async (button) => {
  if (!connectedPlayer || rewardOrderInProgress) return;

  const rewardId = button.dataset.rewardSelect;
  const rewardName = button.dataset.rewardName || "este item";
  const cost = Number(button.dataset.rewardCost) || 0;
  const balance = Number(connectedPlayer.rpsTokens) || 0;

  if (balance < cost) {
    setRewardsStatus(`VocÃª precisa de mais ${cost - balance} fichas para trocar por ${rewardName}.`, "error");
    return;
  }

  if (!window.confirm(`Trocar ${cost} fichas por ${rewardName}? O item serÃ¡ entregue no inventÃ¡rio do jogo.`)) return;

  rewardOrderInProgress = true;
  updateRewardOptions();
  setRewardsStatus("Criando seu pedido...");

  try {
    const result = await apiRequest("/api/rewards/redemptions", {
      method: "POST",
      body: JSON.stringify({ rewardId }),
    });
    const orderId = Number(result.order?.orderId);
    if (!Number.isInteger(orderId) || orderId <= 0) throw new Error("A API nÃ£o retornou um pedido vÃ¡lido.");

    localStorage.setItem(PORTAL_CONFIG.activeRewardOrderKey, String(orderId));
    rewardOrderInProgress = false;
    await pollRewardOrder(orderId);
  } catch (error) {
    rewardOrderInProgress = false;
    updateRewardOptions();
    setRewardsStatus(error.message || "NÃ£o foi possÃ­vel criar o pedido.", "error");
  }
};

const resumeRewardOrder = () => {
  const orderId = Number(localStorage.getItem(PORTAL_CONFIG.activeRewardOrderKey));
  if (Number.isInteger(orderId) && orderId > 0 && !rewardOrderPolling) void pollRewardOrder(orderId);
};

const refreshAdminAccess = async () => {
  adminAccessButton.hidden = true;
  if (!getPortalToken()) return;

  try {
    await apiRequest("/api/admin/me");
    adminAccessButton.hidden = false;
  } catch {
    // Jogadores sem permissao administrativa nao veem o acesso ao painel.
    adminAccessButton.hidden = true;
  }
};

const renderDashboard = (player) => {
  connectedPlayer = player;
  const name = String(player.name || "Jogador_RPS");
  const firstName = name.split("_")[0].toUpperCase();
  const level = Math.max(Number(player.level) || 1, 1);
  const exp = Math.max(Number(player.exp) || 0, 0);
  const deaths = Math.max(Number(player.deaths) || 0, 0);
  const kills = Math.max(Number(player.kills) || 0, 0);
  const vipLevel = Math.max(Number(player.vipLevel) || 0, 0);
  const rpsTokens = Math.min(Math.max(Number(player.rpsTokens) || 0, 0), 100);
  const vip = vipPlans[vipLevel] || [`VIP Nível ${vipLevel}`, "Seu plano VIP está ativo no servidor."];

  setText("[data-player-first-name]", firstName);
  setText("[data-player-name]", name);
  renderPlayerSkin(player.skin, name);
  setText("[data-account-id]", `#${String(player.accountId ?? 0).padStart(4, "0")}`);
  setText("[data-job-name]", player.jobName || jobNames[player.job] || `Profissão #${player.job}`);
  setText("[data-level]", level);
  setText("[data-exp]", formatNumber(exp));
  setText("[data-cash]", formatMoney(player.cash));
  setText("[data-bank]", formatMoney(player.bank));
  setText("[data-vip-coins]", formatNumber(player.vipCoins));
  setText("[data-rps-tokens]", formatNumber(rpsTokens));
  setText("[data-play-time]", formatPlayTime(player.minutes));
  setText("[data-kills]", formatNumber(kills));
  setText("[data-deaths]", formatNumber(deaths));
  setText("[data-kd]", (kills / Math.max(deaths, 1)).toFixed(2));
  setText("[data-wanted]", Math.max(Number(player.wanted) || 0, 0));
  setText("[data-vip-name]", vip[0]);
  setText("[data-vip-description]", vip[1]);
  setText("[data-last-login]", player.lastLogin || "não informado");
  setText("[data-last-sync]", formatRelativeTime(player.syncedAt));

  const progress = document.querySelector("[data-level-progress]");
  if (progress) progress.style.width = `${Math.min((exp % 100), 100)}%`;

  const rewardsProgress = document.querySelector("[data-rps-token-progress]");
  if (rewardsProgress) rewardsProgress.style.width = `${rpsTokens}%`;
  updateRewardOptions(rpsTokens);

  loginView.hidden = true;
  dashboardView.hidden = false;
  void refreshAdminAccess();
  resumeRewardOrder();
  window.scrollTo({ top: 0, behavior: "smooth" });
};

openRewardsButton?.addEventListener("click", openRewardsModal);
closeRewardsButtons.forEach((button) => button.addEventListener("click", closeRewardsModal));
rewardOptions.forEach((button) => button.addEventListener("click", () => void redeemReward(button)));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && rewardsModal && !rewardsModal.hidden) closeRewardsModal();
});

const finishAuthentication = (player) => {
  if (safeReturnPage) {
    window.location.replace(safeReturnPage);
    return;
  }
  renderDashboard(player);
};

const showLogin = () => {
  connectedPlayer = null;
  closeRewardsModal();
  adminAccessButton.hidden = true;
  dashboardView.hidden = true;
  loginView.hidden = false;
};

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearAlert();

  if (!loginForm.reportValidity()) return;

  if (PORTAL_CONFIG.apiUrl.includes("SEU-SUBDOMINIO")) {
    showAlert("A Área do Jogador está pronta, mas a API ainda precisa ser publicada e configurada.");
    return;
  }

  const formData = new FormData(loginForm);
  setLoading(true);

  try {
    const result = await apiRequest("/api/login", {
      method: "POST",
      body: JSON.stringify({
        character: String(formData.get("character") || "").trim(),
        code: String(formData.get("code") || "").trim().toUpperCase(),
      }),
    });

    savePortalToken(result.token);
    loginForm.reset();
    finishAuthentication(result.player);
  } catch (error) {
    if (error.status === 401) showAlert("Personagem ou código incorretos ou expirados.");
    else if (error.status === 404) showAlert("Essa conta ainda não foi sincronizada pelo servidor.");
    else if (error.status === 429) showAlert("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
    else showAlert(error.message || "A API está indisponível no momento. Tente novamente em instantes.");
  } finally {
    setLoading(false);
  }
});

logoutButton.addEventListener("click", async () => {
  try {
    await apiRequest("/api/logout", { method: "POST" });
  } catch {
    // A sessão local também deve ser encerrada se a API estiver indisponível.
  }
  clearPortalToken();
  showLogin();
});

const restoreSession = async () => {
  const token = getPortalToken();
  if (!token || PORTAL_CONFIG.apiUrl.includes("SEU-SUBDOMINIO")) return;

  try {
    const result = await apiRequest("/api/me");
    finishAuthentication(result.player);
  } catch {
    clearPortalToken();
    showLogin();
  }
};

restoreSession();
