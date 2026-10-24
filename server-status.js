(() => {
  const card = document.querySelector("[data-server-status]");
  if (!card) return;

  const local = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname) || location.protocol === "file:";
  const endpoint = local ? SITE_CONFIG.localStatusApiUrl : SITE_CONFIG.statusApiUrl;
  const labels = { online: "ONLINE", offline: "SEM RESPOSTA", unavailable: "INDISPONÍVEL" };
  const count = card.querySelector("[data-player-count]");
  const description = card.querySelector("[data-player-description]");
  const limit = card.querySelector("[data-player-limit]");
  const progress = card.querySelector("[data-player-progress]");
  let timer;
  let pending = false;

  const render = (data) => {
    const age = Date.now() - Date.parse(data?.queriedAt);
    const fresh = Number.isFinite(age) && age >= -5_000 && age < 60_000;
    const validCount = Number.isInteger(data?.playersOnline) && Number.isInteger(data?.maxPlayers) &&
      data.playersOnline >= 0 && data.maxPlayers > 0 && data.playersOnline <= data.maxPlayers;
    const state = fresh && data?.state === "online" && validCount ? "online" :
      fresh && data?.state === "offline" ? "offline" : "unavailable";

    card.dataset.serverStatus = state;
    card.querySelector("[data-server-status-label]").textContent = labels[state];
    count.textContent = state === "online" ? String(data.playersOnline) : "—";
    description.textContent = state === "online" ?
      (data.playersOnline === 1 ? "jogador conectado" : "jogadores conectados") : "contagem indisponível";
    limit.textContent = state === "online" ? `${data.maxPlayers} slots` : "— slots";
    progress.style.width = state === "online" ? `${(data.playersOnline / data.maxPlayers) * 100}%` : "0%";
  };

  const refresh = async () => {
    clearTimeout(timer);
    if (pending || document.hidden) return;
    pending = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    try {
      const response = await fetch(endpoint, { cache: "no-store", credentials: "omit", signal: controller.signal });
      if (!response.ok) throw new Error("Status indisponível");
      render(await response.json());
    } catch {
      render(null);
    } finally {
      clearTimeout(timeout);
      pending = false;
      if (!document.hidden) timer = setTimeout(refresh, SITE_CONFIG.statusRefreshMs);
    }
  };

  document.addEventListener("visibilitychange", () => {
    clearTimeout(timer);
    if (!document.hidden) void refresh();
  });
  void refresh();
})();
