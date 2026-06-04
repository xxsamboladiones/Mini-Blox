# MiniBlox Online e Multiplayer MVP

Este documento cobre o backend online do MiniBlox, publicacao de mapas, catalogo online e o multiplayer MVP via WebSocket.

## Rodando

Instale as dependencias na raiz e no backend:

```bash
npm install
cd server
npm install
```

Variaveis opcionais em `server/.env`:

```env
PORT=3001
CORS_ORIGIN=http://localhost:5173
MAX_PLAYERS_PER_ROOM=8
```

Rodar frontend e backend juntos:

```bash
npm run dev:all
```

Rodar separado:

```bash
npm run dev
cd server
npm run dev
```

## API Online

- `GET /health`
- `POST /api/maps`
- `GET /api/maps`
- `GET /api/maps/:id`
- `PUT /api/maps/:id`
- `DELETE /api/maps/:id`
- `POST /api/maps/:id/play`
- `POST /api/maps/:id/like`

O backend armazena mapas em `server/data/maps.json`, grava por arquivo temporario e nao executa dados do mapa. O JSON publicado passa por validacao de tamanho, campos suspeitos e limites de conteudo.

## Publicacao Online

1. Rode o backend.
2. Abra o editor.
3. Clique em `Publicar Online`.
4. Abra o catalogo, aba `Online`.
5. Use `Jogar Solo`, `Curtir` ou `Salvar copia local`.

Se o backend estiver desligado, a aba Online mostra erro amigavel e mapas locais continuam funcionando offline.

## Multiplayer MVP

O multiplayer usa o mesmo servidor HTTP do Express. Em `server/src/index.ts`, o backend cria `createServer(app)` e anexa o `MultiplayerServer` no path `/ws`.

Rotas:

- `POST /api/rooms`: cria sala para um `onlineMapId`.
- `GET /api/rooms`: lista salas em memoria.
- `GET /api/rooms/:id`: mostra detalhes da sala.
- `WS /ws?roomId=:roomId&clientId=:clientId`: socket de jogo.

Mensagens principais:

- Cliente: `join`, `leave`, `playerState`, `ping`.
- Servidor: `welcome`, `roomState`, `playerJoined`, `playerLeft`, `playerUpdated`, `error`, `pong`.

### Criar Sala

1. Rode `npm run dev:all`.
2. Abra o catalogo.
3. Entre na aba `Online`.
4. Clique em `Multiplayer` em um mapa publicado.
5. Clique em `Criar Sala`.
6. O jogo abre com o HUD mostrando o `roomId`.

### Entrar em Sala

1. Abra o mesmo mapa publicado na aba `Online`.
2. Clique em `Multiplayer`.
3. Escolha uma sala disponivel.
4. Clique em `Entrar`.

### Sair da Sala

Use `Sair da Sala` no HUD do runtime. O cliente envia `leave`, fecha o WebSocket e remove os avatares remotos. Se uma aba fechar direto, o backend remove o jogador no evento `close` e envia `playerLeft` para a sala.

## Teste Manual Com Duas Abas

1. Rode `npm run dev:all`.
2. Abra `http://127.0.0.1:5173/` em duas abas.
3. Na aba A, abra `Catalogo > Online`.
4. Crie uma sala multiplayer em um mapa publicado.
5. Na aba B, abra o mesmo mapa em `Online > Multiplayer` e entre na sala.
6. Mova o jogador na aba A e confirme o avatar remoto na aba B.
7. Mova o jogador na aba B e confirme o avatar remoto na aba A.
8. Saia da sala em uma aba e confirme que o avatar desaparece na outra.
9. Volte ao modo solo e abra um mapa local para confirmar que nao ha WebSocket no modo offline.

## Validacoes

Frontend:

```bash
npm run build
npm run dev
node scripts/verify-render.mjs
node scripts/validate-templates.mjs
```

`verify-render` acessa `http://127.0.0.1:5173/`, entao o Vite precisa estar rodando.

Backend:

```bash
cd server
npm run build
npm run start
node scripts/smoke-server.mjs
```

Smoke multiplayer autocontido:

```bash
cd server
npm run build
node scripts/smoke-multiplayer.mjs
```

Tambem existe wrapper na raiz:

```bash
node smoke-multiplayer.mjs
```

O smoke multiplayer cria servidor em porta temporaria, conecta dois clientes, valida `roomState`, `playerUpdated`, `playerLeft` e encerra WebSockets/HTTP sem `process.exit` agressivo.

## Limitacoes Atuais do Multiplayer

- Nao sincroniza inimigos.
- Nao sincroniza portas, moedas, objetivos ou estado de mecanicas.
- Nao e server-authoritative.
- Nao tem PvP.
- Nao tem chat.
- Nao tem editor colaborativo.
- Salas ficam apenas em memoria.
- Salas vazias sao removidas por limpeza periodica.
- Objetivo atual: ver jogadores no mesmo mapa e sincronizar posicao/rotacao.

## Troubleshooting

- Backend offline: a aba Online mostra erro e o modo local continua funcionando.
- Sala cheia: o lobby desabilita entrada quando `playerCount >= maxPlayers`.
- CORS: ajuste `CORS_ORIGIN` para a URL do frontend.
- WebSocket: confira se frontend e backend usam a mesma porta configurada em `VITE_API_URL` ou no padrao `http://localhost:3001`.
