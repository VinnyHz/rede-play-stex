# Rede Play Stex — Site

Landing page responsiva para o servidor SA-MP RPG Rede Play Stex.

## Personalização rápida

Edite o objeto `SITE_CONFIG` no início de `script.js` para trocar:

- IP do servidor;
- link do Discord;
- endereço da API de status e intervalo de atualização.

Abra `index.html` no navegador para visualizar o site.

O ID público da conta e o RG são editáveis nos arquivos da gamemode e sincronizados com o site. A conta local `leverfall` está preparada com ambos em `0`; veja a migração necessária do banco e as orientações em [Identificação da conta](api-worker/README.md#id-da-conta-e-rg-editáveis).

A loja mantém a compra de Sócio com saldo de MV pelo site. Compras por Pix de pacote, moedas e Sócio/VIP abrem tickets privados no Discord com chave e QR Code. Os arquivos estão atualizados em `Enviar-GitHub/`; a ativação do D1, Worker, Redirect do Discord e bot está descrita em [api-worker/README.md](api-worker/README.md#compras-pix-com-ticket-no-discord).

## Jogadores online reais

O painel consulta o servidor SA-MP a cada 15 segundos. A contagem e o limite de vagas vêm da resposta do jogo, inclusive quando há zero jogadores. Falhas de consulta exibem “Sem resposta”; dados ausentes, antigos ou falhas na API exibem “Indisponível”. A barra acompanha a ocupação real.

Em `localhost`, `127.0.0.1` ou ao abrir o HTML diretamente, o site consulta `http://127.0.0.1:3031/api/server/status`. O serviço `discord_bridge/server-status.mjs` usa a porta e o endereço de `server.cfg`, exige `query 1` e inicia junto da ponte existente por `start-with-server.ps1`. Ele usa Node.js, sem dependências adicionais, e não exige recompilar a gamemode. O contador já foi instalado na Gamemode local.

Na versão publicada, o navegador consulta `/api/server/status` no Worker. O serviço envia as medições usando o segredo que já existe na configuração privada da ponte. Dados sem atualização por 60 segundos deixam de ser exibidos. A pasta `Publicar-Jogadores-Online` reúne os arquivos e as instruções para publicar essa integração; o Worker e o banco em produção precisam dessa atualização.

## Músicas para JBL

A aba **Colar link do vídeo** converte vídeos públicos em MP3 e salva o link para a JBL. O auxiliar está instalado no PC do servidor; publique a migração de conversões, o Worker e os três arquivos da página conforme [api-worker/CONVERSOR-LINKS.md](api-worker/CONVERSOR-LINKS.md). O pacote dessa atualização está em `Publicar-Conversor-JBL/`.

A página `musicas.html` permite enviar MP3/OGG e gerar links diretos para o jogo, com biblioteca por conta. A versão atual usa Workers KV no plano gratuito, com limite global de 512 MiB, sem assinatura R2. A publicação precisa do vínculo `MUSIC_FILES` e da migração descritos em [api-worker/MUSICAS-JBL.md](api-worker/MUSICAS-JBL.md). O pacote completo está em `Publicar-Musicas-JBL/`.

