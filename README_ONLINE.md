# MiniBlox Online e Multiplayer MVP

Este documento cobre o backend online, catalogo de mapas e multiplayer MVP do MiniBlox.

## Alpha 0.1.7

Esta etapa adicionou o modo Tycoon ao editor/runtime e ao catalogo online. A validacao backend agora conhece objetos Tycoon, custos, IDs e referencias de compras; salas multiplayer sincronizam compras/upgrades Tycoon como eventos de mundo basicos. Dinheiro e ownership Tycoon ainda sao simples/parciais no multiplayer. Veja [docs/TYCOON.md](docs/TYCOON.md).

## Alpha 0.1.6

Esta etapa poliu o loop jogavel do runtime: HUD com modo de sessao, timer, objetivos fallback, resumo de vitoria/derrota e feedback de respawn/test mode. No multiplayer, isso aparece em salas existentes sem alterar backend, WebSocket, mensagens, validacoes server-side ou schema de mapas.

Tambem foi estabilizado o visual de personagem/arma: jogadores remotos usam o mesmo animator simples do player local, armas ficam presas ao socket da mao e ataques remotos reaproveitam `playerAttackVisual` sem adicionar mensagem nova ao protocolo.

## Alpha 0.1.5

Esta etapa fez um quality pass nos 28 templates oficiais: tags foram padronizadas, cinco templates showcase foram curados e `validate-templates` passou a validar metadata do catalogo, paridade de tags no mapa gerado, limites de posicao/escala, vida/dano de inimigos e requisitos de templates multiplayer. Nao houve mudanca intencional de gameplay, backend, protocolo multiplayer ou schema.

## Alpha 0.1.4

Esta etapa adicionou botoes discretos de Undo/Redo no editor e expandiu o historico para metadata, ambiente visual, audio, logica, objetivos e modo de jogo com commits unicos para campos continuos. Nao houve mudanca intencional de gameplay, backend, protocolo multiplayer ou schema.

## Alpha 0.1.3

Esta etapa adicionou undo/redo basico no editor com Ctrl+Z/Ctrl+Y, usando um evento de transform commit para evitar snapshots por frame durante move/rotate/scale. Propriedades entram no historico por commit controlado. Nao houve mudanca intencional de gameplay, backend, protocolo multiplayer ou schema.

## Alpha 0.1.2

Esta etapa focou estabilidade do editor: save/load/import/export foram isolados em controller, test mode e publish usam snapshot normalizado, e o publish valida erros locais obvios antes de chamar o backend. Nao houve mudanca intencional de gameplay, protocolo multiplayer, backend ou schema.

## Alpha 0.1.1

Esta etapa foi uma limpeza interna do runtime: helpers de mechanics foram extraidos, a ponte de envio multiplayer ganhou um controller pequeno e o mapa carregado pelo runtime passa por normalizacao defensiva. Nao houve mudanca intencional de protocolo, HUD ou gameplay.

## Rodando

Instale dependencias na raiz e no backend:

```bash
npm install
cd server
npm install
```

Variaveis opcionais em `server/.env`:

```env
NODE_ENV=development
PORT=3001
CORS_ORIGIN=http://localhost:5173
DATABASE_URL=file:./data/miniblox.sqlite
AUTH_TOKEN_TTL_DAYS=30
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
AUTH_RATE_LIMIT_MAX=8
LOG_LEVEL=info
MAX_PLAYERS_PER_ROOM=8
ROOM_TTL_MINUTES=60
```

Rode migrations antes do primeiro start local:

```bash
cd server
npm run db:migrate
```

Rodar tudo:

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
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/maps`
- `GET /api/maps`
- `GET /api/maps/:id`
- `PUT /api/maps/:id`
- `DELETE /api/maps/:id`
- `POST /api/maps/:id/play`
- `POST /api/maps/:id/like`

O backend guarda mapas em SQLite por padrao (`server/data/miniblox.sqlite`). Migrations criam `users`, `auth_tokens`, `maps` e `map_likes`. O JSON legado `server/data/maps.json` ainda pode existir para compatibilidade e importacao inicial, mas o caminho principal do catalogo e o banco.

Publicar, atualizar, deletar e curtir exigem `Authorization: Bearer <token>`. Listar mapas, carregar mapa e registrar play continuam publicos. A publicacao valida tamanho de JSON, quantidade de objetos, campos suspeitos, strings com `javascript:`/HTML perigoso, asset data URLs, posicao, escala, dano, vida, velocidade e valores de gameplay extremos.

Ownership real usa `owner_user_id` autenticado. Mapas antigos importados do JSON ficam com `legacy_owner_client_id`; um usuario logado pode assumir esse mapa apenas quando o request ainda envia o mesmo `clientId` legado.

## Auth rapido

Criar usuario:

```bash
curl -X POST http://localhost:3001/api/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"criador1\",\"password\":\"senha-forte-123\",\"displayName\":\"Criador 1\"}"
```

Login:

```bash
curl -X POST http://localhost:3001/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"criador1\",\"password\":\"senha-forte-123\"}"
```

Use o `token` retornado nas rotas protegidas.

## Multiplayer

Rotas:

- `POST /api/rooms`: cria sala para um `onlineMapId`.
- `GET /api/rooms`: lista salas em memoria.
- `GET /api/rooms/:id`: detalhes da sala.
- `WS /ws?roomId=:roomId&clientId=:clientId`: socket de jogo.

As salas continuam em memoria, mas agora usam `ROOM_TTL_MINUTES`, logs de create/delete/expire e heartbeat WebSocket para encerrar conexoes mortas. Reiniciar o servidor fecha salas ativas; persistencia completa de snapshot de sala fica para uma etapa futura.

Mensagens principais do cliente:

- `join`, `leave`, `playerState`, `worldEvent`, `enemyHit`, `enemyPositionUpdate`, `enemyStateRequest`
- `playerAttack`, `playerAttackVisual`, `playerDamaged`, `playerHealRequest`
- `chatMessage`, `ping`

Mensagens principais do servidor:

- `welcome`, `roomState`, `worldState`, `worldEvent`, `enemyState`, `enemyUpdated`, `enemyDefeated`
- `combatState`, `playerDamaged`, `playerHealed`, `playerDefeated`, `playerRespawned`
- `chatHistory`, `chatMessage`, `hostChanged`, `playerJoined`, `playerLeft`, `playerUpdated`, `error`, `pong`

## Validacoes Multiplayer

- `playerState` nao pode aumentar vida arbitrariamente.
- `playerHealRequest` valida jogador vivo, pickup de vida existente, distancia, valor maximo 50 e uso unico da fonte.
- `enemyHit` valida arma, cooldown, alcance, inimigo vivo e aplica dano server-side.
- `enemyPositionUpdate` e host-only e rejeita teleporte absurdo com base em tempo, distancia e velocidade configurada.
- `worldEvent` valida distancia por tipo: moedas, pickups, botoes e portas/controles de porta.
- Chat aplica trim, limite de 200 caracteres, remocao de `<`/`>`, rate limit de 1s e historico maximo de 50 mensagens.
- Payload WebSocket tem limite basico de tamanho; mensagens invalidas recebem erro sem derrubar o servidor.
- Regras de armas usadas pelo server ficam em `shared/weapon-rules.json`, a mesma fonte consumida pelo frontend.

## Estado Compartilhado

- `openedDoorIds`
- `activatedButtonIds`
- `collectedCoinObjectIds`
- `collectedItemObjectIds`
- `enemyStates`
- `playerCombatStates`
- `chatMessages`

Quem entra depois recebe `worldState`, `enemyState`, `combatState` e `chatHistory`; eventos novos chegam incrementalmente.

## Teste Manual Com Duas Abas

1. Rode `npm run dev:all`.
2. Abra `http://127.0.0.1:5173/` em duas abas.
3. Publique ou abra um mapa no catalogo online.
4. Crie uma sala na aba A e entre na mesma sala pela aba B.
5. Teste movimento/remotos, chat, PvP, morte, respawn, inimigos sincronizados e sair da sala.
6. Volte ao modo solo e confirme que mapas locais continuam jogaveis sem WebSocket.

## Validacoes Automatizadas

Frontend:

```bash
npm run build
node scripts/verify-render.mjs
node scripts/validate-templates.mjs
```

Backend:

```bash
cd server
npm run db:migrate
npm run build
node scripts/smoke-server.mjs
```

Smoke multiplayer autocontido:

```bash
node server/scripts/smoke-multiplayer.mjs
```

O smoke multiplayer publica mapa temporario, conecta clientes, testa chat, PvP, cooldown, cura server-side, movimento de inimigo, dano em inimigo, evento de mundo perto/longe, late join e migracao de host.

## Limitacoes

- Inimigos seguem host-authoritative; o servidor valida plausibilidade, mas nao roda IA completa.
- Movimento/fisica do player continuam client-side com sanity checks.
- Salas ficam em memoria.
- Catalogo usa SQLite local; Postgres esta previsto pela interface de repositorio, mas ainda nao e adapter funcional.
- Sem ranking, matchmaking ou editor colaborativo.
- O objetivo atual e estabilidade e clareza do MVP, nao anticheat completo.
