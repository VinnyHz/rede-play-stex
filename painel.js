const PORTAL_CONFIG = {
  apiUrl: "https://rede-play-stex-api.vinny-fernandessoares.workers.dev",
  tokenKey: "rps_portal_session",
};

const loginView = document.querySelector("[data-login-view]");
const dashboardView = document.querySelector("[data-dashboard-view]");
const loginForm = document.querySelector("[data-login-form]");
const loginButton = document.querySelector("[data-login-submit]");
const submitLabel = document.querySelector("[data-submit-label]");
const formAlert = document.querySelector("[data-form-alert]");
const logoutButton = document.querySelector("[data-logout]");

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
  const token = sessionStorage.getItem(PORTAL_CONFIG.tokenKey);
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

const renderDashboard = (player) => {
  const name = String(player.name || "Jogador_RPS");
  const firstName = name.split("_")[0].toUpperCase();
  const level = Math.max(Number(player.level) || 1, 1);
  const exp = Math.max(Number(player.exp) || 0, 0);
  const deaths = Math.max(Number(player.deaths) || 0, 0);
  const kills = Math.max(Number(player.kills) || 0, 0);
  const vipLevel = Math.max(Number(player.vipLevel) || 0, 0);
  const vip = vipPlans[vipLevel] || [`VIP Nível ${vipLevel}`, "Seu plano VIP está ativo no servidor."];

  setText("[data-player-first-name]", firstName);
  setText("[data-player-name]", name);
  setText("[data-player-initial]", name.charAt(0).toUpperCase());
  setText("[data-account-id]", `#${String(player.accountId ?? 0).padStart(4, "0")}`);
  setText("[data-job-name]", player.jobName || jobNames[player.job] || `Profissão #${player.job}`);
  setText("[data-level]", level);
  setText("[data-exp]", formatNumber(exp));
  setText("[data-cash]", formatMoney(player.cash));
  setText("[data-bank]", formatMoney(player.bank));
  setText("[data-vip-coins]", formatNumber(player.vipCoins));
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

  loginView.hidden = true;
  dashboardView.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const showLogin = () => {
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

    sessionStorage.setItem(PORTAL_CONFIG.tokenKey, result.token);
    loginForm.reset();
    renderDashboard(result.player);
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
  sessionStorage.removeItem(PORTAL_CONFIG.tokenKey);
  showLogin();
});

const restoreSession = async () => {
  const token = sessionStorage.getItem(PORTAL_CONFIG.tokenKey);
  if (!token || PORTAL_CONFIG.apiUrl.includes("SEU-SUBDOMINIO")) return;

  try {
    const result = await apiRequest("/api/me");
    renderDashboard(result.player);
  } catch {
    sessionStorage.removeItem(PORTAL_CONFIG.tokenKey);
    showLogin();
  }
};

restoreSession();
