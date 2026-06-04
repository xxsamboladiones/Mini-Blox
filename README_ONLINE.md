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

- Cliente: `join`, `leave`, `playerState`, `worldEvent`, `enemyHit`, `enemyPositionUpdate`, `enemyStateRequest`, `playerAttack`, `playerDamaged`, `chatMessage`, `ping`.
- Servidor: `welcome`, `roomState`, `worldState`, `enemyState`, `enemyUpdated`, `enemyDefeated`, `combatState`, `playerDamaged`, `playerDefeated`, `playerRespawned`, `chatHistory`, `chatMessage`, `hostChanged`, `playerJoined`, `playerLeft`, `playerUpdated`, `error`, `pong`.

Estado compartilhado da sala:

- `openedDoorIds`: portas abertas.
- `activatedButtonIds`: botoes ativados.
- `collectedCoinObjectIds`: moedas coletadas.
- `collectedItemObjectIds`: pickups simples coletados.
- `enemyStates`: vida, posicao, estado e morte dos inimigos da sala.
- `playerCombatStates`: vida autoritativa basica dos jogadores.
- `chatMessages`: ultimas 50 mensagens da sala.

O estado fica apenas em memoria, dentro da sala. Quem entra depois recebe `worldState`, `enemyState`, `combatState` e `chatHistory`; eventos novos sao enviados por mensagens incrementais.

### Inimigos Sincronizados

Ao criar uma sala, o servidor carrega o mapa online e cria `enemyStates` a partir dos objetos `enemy`. Vida, morte e hits sao aplicados no servidor. O movimento ainda e MVP host-authoritative: o primeiro jogador da sala e `hostPlayerId`, calcula a IA local dos inimigos e envia `enemyPositionUpdate` em baixa frequencia. Se o host sai, o servidor escolhe o proximo jogador e envia `hostChanged`.

Clientes nao-host renderizam/interpolam `enemyState`/`enemyUpdated` e nao matam inimigos localmente. Hits usam `enemyHit`; o servidor valida `enemyObjectId`, dano maximo e inimigo vivo antes de propagar `enemyUpdated` ou `enemyDefeated`.

### PvP e Respawn

PvP fica desligado por padrao. Mapas podem habilitar:

```json
{
  "multiplayerSettings": {
    "pvpEnabled": true,
    "friendlyFire": false
  }
}
```

O cliente envia `playerAttack`; o servidor valida arma conhecida, cooldown, dano maximo, range maximo, alvo existente, distancia aproximada e friendly fire. Dano confirmado chega como `playerDamaged`. Ao morrer, o jogador recebe `playerDefeated` e depois `playerRespawned`; o respawn usa team spawn quando houver, senao `spawnPoint`, com vida 100.

### Chat e Lobby Social

O lobby lista salas, host e jogadores atuais. Dentro da sala, o runtime mostra chat colapsavel; `Enter` foca o campo. O servidor aplica trim, limite de 200 caracteres, rate limit de 1 mensagem por segundo por jogador e historico maximo de 50 mensagens. Mensagens de sistema avisam entrada, saida e derrotas.

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
8. Pressione `Enter`, envie uma mensagem no chat da aba A e confirme na aba B.
9. Em `Arena Multiplayer PvP`, ataque o outro time e confirme perda de vida/respawn.
10. Em `Arena Coop Inimigos`, ataque inimigo em A e confirme vida/morte em B.
11. Na aba A, ative um botao que abre uma porta e confirme a porta aberta na aba B.
12. Na aba A, colete uma moeda e confirme que ela desaparece na aba B.
13. Abra uma terceira aba, entre na mesma sala e confirme que ela ja recebe porta/moeda/inimigo derrotado.
14. Feche o host e confirme que outro jogador vira host.
15. Volte ao modo solo e abra um mapa local para confirmar que nao ha WebSocket no modo offline.

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

O smoke multiplayer cria servidor em porta temporaria, publica um mapa de teste, conecta clientes, valida `chatMessage`, `playerAttack`/`playerDamaged`, `enemyHit`/`enemyDefeated`, `worldEvent`, rejeicao silenciosa de evento invalido, `pong` depois de `playerState` absurdo, late join com `enemyState`/`worldState`, migracao de host e encerra WebSockets/HTTP sem `process.exit` agressivo.

## Limitacoes Atuais do Multiplayer

- Inimigos sincronizados sao MVP host-authoritative; ainda nao ha IA server-side perfeita.
- Fisica e movimento do jogador continuam client-side com validacoes generosas no servidor.
- Nao sincroniza objetivos completos como estado proprio.
- Mecanicas avancadas do mapa ainda podem ser locais por cliente.
- PvP e parcialmente server-authoritative, mas nao e anticheat completo.
- Hit detection e aproximado.
- Sem matchmaking, ranking global, login real ou editor colaborativo.
- Salas ficam apenas em memoria.
- Chat nao tem moderacao avancada.
- Salas vazias sao removidas por limpeza periodica.
- Objetivo atual: multiplayer jogavel basico com presenca, mundo compartilhado, inimigos sincronizados, PvP simples e chat de sala.

## Troubleshooting

- Backend offline: a aba Online mostra erro e o modo local continua funcionando.
- Sala cheia: o lobby desabilita entrada quando `playerCount >= maxPlayers`.
- CORS: ajuste `CORS_ORIGIN` para a URL do frontend.
- WebSocket: confira se frontend e backend usam a mesma porta configurada em `VITE_API_URL` ou no padrao `http://localhost:3001`.
