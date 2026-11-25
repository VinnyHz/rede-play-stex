(() => {
  const storageKey = 'rps_store_discord_checkout';
  const callback = new URL(window.location.href);
  const returned = callback.searchParams.has('state') && (callback.searchParams.has('code') || callback.searchParams.has('error'))
    ? { state: callback.searchParams.get('state'), code: callback.searchParams.get('code'), error: callback.searchParams.get('error') } : null;
  if (returned) {
    ['state', 'code', 'error', 'error_description', 'iss'].forEach(key => callback.searchParams.delete(key));
    window.history.replaceState(null, '', callback.pathname + callback.search + callback.hash);
  }
  let api, showOrder, reportStatus, generation = 0, timer = 0, resolveWait;
  const savedCheckout = () => {
    try { return JSON.parse(sessionStorage.getItem(storageKey) || 'null'); } catch { return null; }
  };
  const stop = () => {
    ++generation;
    window.clearTimeout(timer);
    resolveWait?.();
    resolveWait = null;
  };
  const wait = () => new Promise(resolve => { resolveWait = resolve; timer = window.setTimeout(() => { resolveWait = null; resolve(); }, 2000); });
  const validTicketUrl = value => /^https:\/\/discord\.com\/channels\/\d{17,20}\/\d{17,20}$/.test(value || '');
  const track = async (orderId, ticket, attempt) => {
    for (let count = 0; count < 30 && attempt === generation; count++) {
      if (ticket?.status === 'opened') {
        if (!validTicketUrl(ticket.url)) throw new Error('O link do ticket recebido é inválido. Fale com a equipe.');
        sessionStorage.removeItem(storageKey);
        reportStatus('Ticket criado. Abrindo seu atendimento no Discord...');
        window.location.assign(ticket.url);
        return;
      }
      if (ticket?.status === 'failed') throw new Error(ticket.message || 'Não foi possível abrir o ticket no Discord. Tente novamente.');
      reportStatus('Abrindo seu ticket privado no Discord...');
      await wait();
      if (attempt !== generation) return;
      ({ ticket } = await api(`/api/store/pix-orders/${orderId}/discord`));
      if (attempt !== generation) return;
    }
    if (attempt === generation) reportStatus('O bot ainda está preparando o atendimento. Seu pedido está salvo; clique em Abrir ticket no Discord para tentar novamente.');
  };
  const open = async order => {
    if (!order || !api || ['completed', 'rejected', 'failed'].includes(order.status)) return;
    stop();
    const attempt = generation;
    reportStatus('Conectando sua compra ao Discord...');
    try {
      const result = await api(`/api/store/pix-orders/${order.orderId}/discord/start`, { method: 'POST', body: '{}' });
      if (attempt !== generation) return;
      if (result.authorizationUrl) {
        const authorization = new URL(result.authorizationUrl);
        if (authorization.origin !== 'https://discord.com' || authorization.pathname !== '/oauth2/authorize' ||
            !/^[a-f0-9]{64}$/.test(result.state || '') || authorization.searchParams.get('state') !== result.state) {
          throw new Error('Não foi possível conectar ao Discord. Tente novamente.');
        }
        sessionStorage.setItem(storageKey, JSON.stringify({ orderId: order.orderId, state: result.state }));
        window.location.assign(authorization.href);
        return;
      }
      if (!result.ticket) throw new Error('Atualize a loja e tente abrir o ticket novamente.');
      sessionStorage.setItem(storageKey, JSON.stringify({ orderId: order.orderId }));
      await track(order.orderId, result.ticket, attempt);
    } catch (error) { if (attempt === generation) reportStatus(error.message || 'Não foi possível abrir o ticket no Discord.', 'error'); }
  };
  const resume = async () => {
    const saved = savedCheckout();
    if (!returned) return;
    sessionStorage.removeItem(storageKey);
    if (!saved || !Number.isSafeInteger(saved.orderId) || saved.orderId <= 0 || saved.state !== returned.state) {
      reportStatus('A conexão com o Discord expirou. Abra seu pedido e tente novamente.', 'error');
      return;
    }
    stop();
    const attempt = generation;
    try {
      const { order } = await api(`/api/store/pix-orders/${saved.orderId}`);
      if (attempt !== generation) return;
      showOrder(order);
      if (returned.error) { reportStatus('Conexão com o Discord cancelada. Seu pedido está salvo para tentar novamente.'); return; }
      const result = await api(`/api/store/pix-orders/${saved.orderId}/discord`, {
        method: 'POST', body: JSON.stringify({ code: returned.code, state: returned.state }),
      });
      if (attempt !== generation) return;
      await track(saved.orderId, result.ticket, attempt);
    } catch (error) { if (attempt === generation) reportStatus(error.message || 'Não foi possível conectar ao Discord.', 'error'); }
  };
  window.RPS_STORE_DISCORD = Object.freeze({
    init(options) { ({ apiRequest: api, showOrder, reportStatus } = options); }, open, resume, stop,
  });
})();
