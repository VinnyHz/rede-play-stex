(() => {
  'use strict';
  const api = 'https://rede-play-stex-api.vinny-fernandessoares.workers.dev';
  const $ = selector => document.querySelector(selector);
  const headerLogin = $('[data-account-header] .account-login');
  if (headerLogin) headerLogin.href = 'painel.html?return=musicas.html';
  const token = () => window.RPS_SESSION.getToken();
  const form = $('#music-form'), fileInput = $('#music-file'), drop = $('#music-drop');
  const uploadButton = $('#upload-button'), status = $('#music-status'), libraryStatus = $('#library-status');
  let file = null, localUrl = null, serviceAvailable = false, busy = false, xhr = null, generation = 0;
  let limits = { maxFileBytes: 20 * 1024 * 1024, maxTracks: 10, maxTotalBytes: 100 * 1024 * 1024 };
  const mb = bytes => `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
  function message(node, text, error = false) { node.textContent = text; node.dataset.error = String(error); }
  function updateButton() { uploadButton.disabled = !file || !token() || !serviceAvailable || busy; fileInput.disabled = busy; $('#music-name').disabled = busy; }
  function sessionView() { $('#music-session').hidden = !!token(); $('#refresh-library').hidden = !token(); updateButton(); }
  function resetLibrary() { $('#music-tracks').replaceChildren(); $('#library-empty').hidden = false; $('#library-usage').textContent = 'Até 10 músicas e 100 MB por conta. Seus links ficam reunidos aqui.'; }
  async function apiRequest(path, options = {}) {
    const response = await fetch(`${api}${path}`, { ...options, headers: { Authorization: `Bearer ${token()}`, ...options.headers } });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) { window.RPS_SESSION.clearToken(); window.dispatchEvent(new CustomEvent('rps:session-expired')); }
    if (!response.ok) throw new Error(data.message || 'Não foi possível concluir. Tente novamente.');
    return data;
  }
  async function refreshLibrary() {
    const version = ++generation;
    sessionView();
    if (!token()) { serviceAvailable = false; resetLibrary(); message(libraryStatus, ''); return; }
    $('#refresh-library').disabled = true;
    message(libraryStatus, 'Carregando suas músicas…');
    try {
      const data = await apiRequest('/api/music');
      if (version !== generation || !token()) return;
      serviceAvailable = data.available;
      limits = data.limits;
      renderTracks(data.tracks);
      message(libraryStatus, data.available ? '' : 'O envio de músicas ainda não está disponível. Volte em breve.');
      message(status, data.available ? '' : 'O envio de músicas ainda não está disponível.');
    } catch (error) {
      if (version !== generation) return;
      serviceAvailable = false;
      message(libraryStatus, error.message, true);
    } finally {
      if (version === generation) { $('#refresh-library').disabled = false; sessionView(); }
    }
  }
  function selectFile(selected) {
    if (busy || !selected) return;
    message(status, '');
    $('#music-result').hidden = true;
    file = null;
    $('#local-preview').pause();
    $('#local-preview').removeAttribute('src');
    if (localUrl) { URL.revokeObjectURL(localUrl); localUrl = null; }
    $('#selected-file').hidden = true;
    $('#file-label').textContent = 'Escolha ou arraste sua música';
    updateButton();
    if (!/\.(mp3|ogg)$/i.test(selected.name)) { message(status, 'Escolha uma música em MP3 ou OGG (Vorbis).', true); return; }
    if (!selected.size || selected.size > limits.maxFileBytes) { message(status, 'Escolha uma música de até 20 MB.', true); return; }
    file = selected;
    const preview = $('#local-preview');
    preview.pause();
    if (localUrl) URL.revokeObjectURL(localUrl);
    localUrl = URL.createObjectURL(file);
    preview.src = localUrl;
    $('#music-name').value = file.name.replace(/\.[^.]+$/, '').slice(0, 80);
    $('#file-label').textContent = file.name;
    $('#file-details').textContent = `${mb(file.size)} · ${file.name.split('.').pop().toUpperCase()} · confira o áudio antes de enviar`;
    $('#selected-file').hidden = false;
    updateButton();
  }
  fileInput.addEventListener('change', () => selectFile(fileInput.files[0]));
  for (const type of ['dragenter', 'dragover']) drop.addEventListener(type, event => { event.preventDefault(); if (!busy) drop.classList.add('dragging'); });
  for (const type of ['dragleave', 'drop']) drop.addEventListener(type, event => { event.preventDefault(); drop.classList.remove('dragging'); });
  drop.addEventListener('drop', event => { if (!busy) selectFile(event.dataTransfer.files[0]); });
  $('#local-preview').addEventListener('error', () => { if (file) message(status, 'Seu navegador não conseguiu reproduzir a prévia. Confira se o arquivo é MP3 ou OGG (Vorbis).', true); });

  function upload(selected, title, bearer) {
    return new Promise((resolve, reject) => {
      xhr = new XMLHttpRequest();
      const params = new URLSearchParams({ name: selected.name, title });
      xhr.open('POST', `${api}/api/music?${params}`);
      xhr.setRequestHeader('Authorization', `Bearer ${bearer}`);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.timeout = 180000;
      xhr.upload.onprogress = event => {
        if (!event.lengthComputable) return;
        const percent = Math.round(event.loaded / event.total * 100);
        $('#upload-progress progress').value = percent;
        $('#progress-label').textContent = percent === 100 ? 'Conferindo o áudio e preparando seu link…' : `Enviando sua música… ${percent}%`;
      };
      xhr.onload = () => {
        let data;
        try { data = JSON.parse(xhr.responseText); } catch { data = {}; }
        if (xhr.status === 401) { window.RPS_SESSION.clearToken(); window.dispatchEvent(new CustomEvent('rps:session-expired')); }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.message || 'Não foi possível enviar. Atualize sua biblioteca antes de tentar novamente.'));
      };
      xhr.onerror = () => reject(new Error('A conexão caiu. Atualize sua biblioteca para conferir se a música foi salva.'));
      xhr.ontimeout = () => reject(new Error('O envio demorou mais que o esperado. Atualize sua biblioteca antes de tentar novamente.'));
      xhr.onabort = () => reject(new Error('Envio interrompido. Entre na sua conta para continuar.'));
      xhr.send(selected);
    });
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!file || !token() || !serviceAvailable || busy) return;
    const title = $('#music-name').value.trim();
    if (!title) { message(status, 'Dê um nome para sua música.', true); $('#music-name').focus(); return; }
    const bearer = token();
    busy = true; updateButton();
    message(status, '');
    $('#music-result').hidden = true;
    $('#upload-progress').hidden = false;
    $('#upload-progress progress').value = 0;
    $('#progress-label').textContent = 'Iniciando envio…';
    try {
      const data = await upload(file, title, bearer);
      if (token() !== bearer) return;
      $('#generated-link').value = data.track.url;
      $('#music-result').hidden = false;
      $('#local-preview').pause();
      message(status, 'Música enviada! Copie o link abaixo e use na sua JBL.');
      await refreshLibrary();
      message(status, 'Música enviada! Copie o link abaixo e use na sua JBL.');
      $('#copy-result').focus();
    } catch (error) { message(status, error.message, true); }
    finally { busy = false; xhr = null; $('#upload-progress').hidden = true; sessionView(); }
  });

  async function copyLink(url, target) {
    try {
      await navigator.clipboard.writeText(url);
      message(target, 'Link copiado! Agora é só colar na JBL.');
    } catch {
      $('#generated-link').value = url;
      $('#music-result').hidden = false;
      $('#generated-link').focus(); $('#generated-link').select();
      message(target, 'Selecione e copie o link no campo acima.');
    }
  }
  $('#copy-result').addEventListener('click', () => void copyLink($('#generated-link').value, status));
  function node(tag, className, text) { const element = document.createElement(tag); if (className) element.className = className; if (text) element.textContent = text; return element; }
  function renderTracks(tracks) {
    const list = $('#music-tracks');
    list.querySelectorAll('audio').forEach(audio => audio.pause());
    list.replaceChildren();
    $('#library-empty').hidden = tracks.length > 0;
    $('#library-empty p').textContent = 'Envie sua primeira música e deixe tudo pronto para tocar no servidor.';
    $('#library-usage').textContent = `${tracks.length} de ${limits.maxTracks} músicas · ${mb(tracks.reduce((sum, track) => sum + track.bytes, 0))} de ${mb(limits.maxTotalBytes)} usados`;
    for (const track of tracks) {
      const card = node('article', 'music-track');
      const heading = node('div', 'music-track-title');
      heading.append(node('span', '', '♪'), node('h3', '', track.title));
      const detail = node('p', '', `${mb(track.bytes)} · ${new Date(track.createdAt * 1000).toLocaleDateString('pt-BR')}`);
      card.append(heading, detail);
      const actions = node('div', 'music-track-actions');
      if (track.status === 'ready') {
        const audio = node('audio'); audio.controls = true; audio.preload = 'none'; audio.src = track.url; audio.setAttribute('aria-label', `Ouvir ${track.title}`);
        card.append(audio);
        const copy = node('button', 'music-primary', 'Copiar link'); copy.type = 'button'; copy.addEventListener('click', () => void copyLink(track.url, libraryStatus));
        const open = node('a', 'music-secondary', 'Abrir ↗'); open.href = track.url; open.target = '_blank'; open.rel = 'noopener'; open.setAttribute('aria-label', `Abrir áudio de ${track.title}`);
        actions.append(copy, open);
      } else card.append(node('p', 'music-track-status', track.status === 'deleting' ? 'Exclusão pendente. Tente excluir novamente.' : 'Envio não concluído. Se necessário, exclua após 15 minutos.'));
      const remove = node('button', 'music-delete', 'Excluir'); remove.type = 'button'; remove.setAttribute('aria-label', `Excluir ${track.title}`);
      let confirming = false, confirmTimer;
      remove.addEventListener('click', async () => {
        if (!confirming) {
          confirming = true; remove.textContent = 'Confirmar exclusão'; remove.classList.add('confirming');
          confirmTimer = setTimeout(() => { confirming = false; remove.textContent = 'Excluir'; remove.classList.remove('confirming'); }, 5000);
          return;
        }
        clearTimeout(confirmTimer); remove.disabled = true;
        if ($('#generated-link').value === track.url) $('#music-result').hidden = true;
        try {
          await apiRequest(`/api/music/${track.id}/delete`, { method: 'POST' });
          if ($('#generated-link').value === track.url) $('#music-result').hidden = true;
          await refreshLibrary(); message(libraryStatus, 'Música excluída. O link deixou de funcionar.');
        } catch (error) { await refreshLibrary(); message(libraryStatus, error.message, true); remove.disabled = false; }
      });
      actions.append(remove); card.append(actions); list.append(card);
    }
  }
  $('#refresh-library').addEventListener('click', () => void refreshLibrary());
  document.addEventListener('play', event => { if (event.target instanceof HTMLAudioElement) document.querySelectorAll('audio').forEach(audio => { if (audio !== event.target) audio.pause(); }); }, true);
  window.addEventListener('rps:session-expired', () => { ++generation; xhr?.abort(); serviceAvailable = false; resetLibrary(); $('#music-result').hidden = true; sessionView(); message(libraryStatus, 'Sua sessão terminou. Entre novamente para acessar suas músicas.'); });
  window.addEventListener('storage', event => { if (event.key === 'rps_portal_session') { xhr?.abort(); resetLibrary(); $('#music-result').hidden = true; void refreshLibrary(); } });
  window.addEventListener('pagehide', () => { document.querySelectorAll('audio').forEach(audio => audio.pause()); });
  window.addEventListener('pageshow', event => { if (event.persisted) void refreshLibrary(); });
  void refreshLibrary();
})();
