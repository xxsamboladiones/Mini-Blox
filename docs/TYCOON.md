# Modo Tycoon

O modo Tycoon permite criar mapas de progressao economica dentro do editor do MiniBlox. O jogador reivindica uma base, coleta dinheiro produzido por geradores, compra botoes, libera objetos bloqueados, aplica upgrades e vence ao completar as compras principais.

## Objetos

- `tycoonOwnerClaim`: area de reivindicacao da base. Em solo, pode reivindicar automaticamente com `autoClaimInSolo`.
- `tycoonGenerator`: maquina que gera dinheiro por ciclo. Pode comecar ativa ou exigir uma compra.
- `tycoonCollector`: area que transfere o dinheiro pendente para o saldo do jogador.
- `tycoonBuyButton`: botao que cobra dinheiro e conclui um `purchaseId`.
- `tycoonUnlockable`: objeto que nasce bloqueado/invisivel e aparece quando a compra ou grupo e liberado.
- `tycoonUpgrade`: compra especial que aumenta geracao, reduz intervalo ou melhora capacidade.
- `tycoonBarrier`: barreira visual/colisiva que desbloqueia quando seu `purchaseId` e comprado.

## Criando Um Tycoon Basico

1. Escolha o modo de jogo `Tycoon` no painel de modos.
2. Adicione um `Owner Claim` com o mesmo `Tycoon ID` usado nos outros objetos.
3. Adicione um `Collector` e defina um `Collector ID`.
4. Adicione um ou mais `Generator` apontando para o `Collector ID`.
5. Adicione `Buy Button` com `Purchase ID`, `Cost` e objetos/grupos que ele libera.
6. Use `Unlockable` ou `Barrier` com o mesmo `Purchase ID` ou `Group ID`.
7. Configure a vitoria com `completeTycoon` ou `winPurchaseIds`.

## Dinheiro E Compras

Geradores somam dinheiro no coletor quando possuem `targetCollectorId`. Sem coletor, o dinheiro pode ir direto para o saldo local. Ao passar pelo coletor, o saldo aumenta e o HUD mostra dinheiro atual, dinheiro pendente e progresso de compras.

Compras verificam saldo e prerequisitos em `requiredPurchaseIds`. Se houver dinheiro suficiente, o valor e descontado, o `purchaseId` e marcado como comprado e os alvos sao liberados. Se faltar dinheiro, o HUD mostra uma mensagem curta.

## Upgrades

Upgrades usam `upgradeId` como compra propria. Eles podem apontar para geradores com `targetGeneratorIds` e aplicar `incomeMultiplier`, `intervalMultiplier` e `collectorCapacityBonus`. O nivel fica disponivel para condicoes de logica visual.

## Objetivos E Logica

Objetivos novos:

- `collectTycoonCash`
- `purchaseTycoonItem`
- `completeTycoon`

Eventos de logica visual:

- `onTycoonClaimed`
- `onTycoonCashCollected`
- `onTycoonPurchaseCompleted`
- `onTycoonUpgradePurchased`
- `onTycoonCompleted`

Condicoes e acoes permitem consultar dinheiro, compras, upgrades e liberar grupos ou compras por regra visual.

## Template Oficial

O template `Tycoon Basico` cria uma mini fabrica com base, coletor, tres geradores, botoes de compra, paredes desbloqueaveis, upgrade de renda, barreira final, trofeu e objetivos guiados.

## Multiplayer

O suporte multiplayer e basico. Compras e upgrades sao sincronizados como eventos de mundo para evitar que late joiners vejam objetos em estado errado. O servidor valida se o objeto e o `purchaseId` ou `upgradeId` existem e se o jogador esta perto do objeto. Dinheiro, coletores e ownership ainda sao controlados de forma local/simples, entao Tycoon competitivo ou anticheat completo ainda fica para uma etapa futura.

## Validacao

O editor e o backend validam campos principais:

- `tycoonId`, `purchaseId`, `generatorId`, `collectorId` e `upgradeId` obrigatorios onde aplicavel.
- custos nao negativos.
- `tickInterval` e raios positivos.
- referencias para objetos, geradores, coletores e compras existentes.
- limites de tamanho e quantidade para publicacao online.

Use `node scripts/validate-templates.mjs` para validar o template oficial e `npm run check` para validar typecheck e templates.
