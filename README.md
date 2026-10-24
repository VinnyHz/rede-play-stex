# Rede Play Stex — Site

Landing page responsiva para o servidor SA-MP RPG Rede Play Stex.

## Personalização rápida

Edite o objeto `SITE_CONFIG` no início de `script.js` para trocar:

- IP do servidor;
- link do Discord;
- endereço da API de status e intervalo de atualização.

Abra `index.html` no navegador para visualizar o site.

## Jogadores online reais

O painel consulta o servidor SA-MP a cada 15 segundos. A contagem e o limite de vagas vêm da resposta do jogo, inclusive quando há zero jogadores. Falhas de consulta exibem “Sem resposta”; dados ausentes, antigos ou falhas na API exibem “Indisponível”. A barra acompanha a ocupação real.

Em `localhost`, `127.0.0.1` ou ao abrir o HTML diretamente, o site consulta `http://127.0.0.1:3031/api/server/status`. O serviço `discord_bridge/server-status.mjs` usa a porta e o endereço de `server.cfg`, exige `query 1` e inicia junto da ponte existente por `start-with-server.ps1`. Ele usa Node.js, sem dependências adicionais, e não exige recompilar a gamemode. O contador já foi instalado na Gamemode local.

Na versão publicada, o navegador consulta `/api/server/status` no Worker. O serviço envia as medições usando o segredo que já existe na configuração privada da ponte. Dados sem atualização por 60 segundos deixam de ser exibidos. A pasta `Publicar-Jogadores-Online` reúne os arquivos e as instruções para publicar essa integração; o Worker e o banco em produção precisam dessa atualização.
