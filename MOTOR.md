# Motor de batalha do PokPok Battle

## Como as peças se encaixam
- **PokéAPI → `conversor.js` → coleção `golpes` (versão 2).** A página `sincronizar.html` busca todos os golpes, converte cada um em uma lista de *efeitos* e grava. Golpes que o motor não faz direito ficam com `suportado: false` e um `motivo`, e não aparecem para escolha.
- **`copiaPokemon` (motor.js)** congela na sala os golpes escolhidos, já com os efeitos. Golpe `suportado: false` (versão 2) impede a equipe de ser confirmada.
- **`resolverRodada` (motor.js)** aplica a rodada e devolve também `passos` (uma ação por vez, com foto do estado) para a tela reproduzir com 3 s entre as ações.
- Documentos antigos (sem `versao: 2`) continuam funcionando como antes: dano puro e golpes de status com os efeitos antigos.

## Estado guardado na sala
| Onde | O que |
|---|---|
| `s.campo` | `clima {t,n}`, `terreno {t,n}`, `sala` (Trick Room, turnos restantes) |
| `s.j[k].lado` | `rocha`, `espinhos`, `venenosa`, `teia`, telas (`reflect`, `luz`, `veu`, `vento`, `protecaoStatus`, `nevoa`), `desejo`, `futuro` |
| `s.j[k].pivo` | o jogador precisa escolher quem entra (U-turn, Baton Pass) |
| Pokémon: `hpAtual`, `cond`, `conf`, `est`, `vol` | `vol` guarda os efeitos "voláteis": `subst`, `semente`, `preso`, `provocar`, `encore`, `disable`, `carga`, `invul`, `recarga`, `furia`, `protegido`... |

## O que funciona
- **Golpes de dano:** efeitos secundários com chance (condição, estágio, recuar), dreno, recuo, vários acertos, crítico alto (estágios de crítico viram limites dos dados), sempre crítico, dano fixo (nível, valor, metade do HP, nocaute, Counter/Mirror Coat/Metal Burst, Endeavor), golpes de 2 turnos (Fly/Dig/Dive invulneráveis, Solar Beam no sol), recarga, fúria (Outrage), explosão, Weather Ball, poder dobrado por condição (Facade, Venoshock, Hex...), Stored Power, Eruption, Psyshock, Body Press, Foul Play, Future Sight.
- **Golpes de status:** estágios, condições (inclui congelamento), cura (inclui por clima), Rest, Wish, Heal Bell, Belly Drum, Pain Split, Haze/Psych Up/Swaps, Substitute, Protect e variantes com efeito de contato, Endure, Taunt/Encore/Disable/Torment, Leech Seed, Yawn, Perish Song, Destiny Bond, Aqua Ring, Ingrain, Curse, Nightmare, Mean Look.
- **Campo:** clima (chuva, sol, areia, granizo, neve), terrenos (elétrico, grama, névoa, psíquico), Trick Room, armadilhas (Stealth Rock, Spikes, Toxic Spikes, Sticky Web) com remoção (Rapid Spin, Defog), telas (Reflect, Light Screen, Aurora Veil, Safeguard, Mist, Tailwind) com quebra (Brick Break).
- **Trocas:** pivô (U-turn, Volt Switch, Flip Turn, Parting Shot, Teleport), Baton Pass, golpes que forçam troca (Roar, Whirlwind, Dragon Tail), aprisionamento.

## O que NÃO funciona (fica bloqueado com motivo)
Itens e habilidades (o jogo não tem), golpes que copiam ou escolhem outro golpe, golpes de dupla/aliado, gênero (Attract), Gravity e salas mágicas, Triple Axel/Rollout e outros de poder acumulado, Bide, Pursuit, Sky Drop, Healing Wish, etc. A lista completa está em `conversor.js` (objeto `NAO`).

## Aproximações conscientes
- **Pivô:** o Pokémon que usou U-turn continua em campo até o fim da rodada; o jogador escolhe o substituto depois (a rodada é resolvida de uma vez).
- **Contato:** a PokéAPI não informa contato; golpes físicos contam como contato (efeitos de Spiky Shield etc.).
- **Dados:** crítico = os dois dados com valor mínimo (6, 5, 4 ou 3 conforme o estágio); Protect seguido tem chance 1/3, 1/9...
- **Sem PP:** não há PP; dois Pokémon sem golpe de dano contra imunes podem ficar em impasse (saia da sala ou use o menu).

## Para acrescentar um golpe novo
1. Se a PokéAPI já descreve (estágios, condição, dreno...), o conversor cuida sozinho.
2. Se não, acrescente uma entrada em `SO` (substitui) ou `EXTRA` (soma) em `conversor.js`, usando os tipos de efeito já existentes (lista no topo do arquivo).
3. Se precisar de um tipo de efeito novo, trate-o em `aplicarEfeito` ou `usar` (motor.js) e rode `node teste-motor.mjs`.
4. Rode **Sincronizar golpes** de novo.

## Itens, megaevolução, bot, times e ranking
- **Itens (Poção e Reviver):** são uma ação da rodada (`{tipo:"pocao"|"reviver", idx}`) e acontecem antes dos golpes. Poção cura 50% do HP máximo de um Pokémon de pé; Reviver revive um derrotado com 50% (e limpa a condição). O estoque fica na conta (`usuarios/<nick>`: `pocoes`, `revives`) e é gasto na mesma transação que registra a escolha (`usarItem` em `salas.js`). Só quem joga logado usa itens.
- **Vitórias:** o vencedor chama `contabilizarVitoria` (uma vez por sala, `vitoriaContada`): +1 vitória, +1 Poção e, a cada `VITORIAS_POR_REVIVER` (20, em `usuarios.js`), +1 Reviver (`reviverGanho`). Desistência não conta (`desistiu`). Também grava `ranking/<nick>` = `{nick, vitorias}` (página `ranking.html`; a coleção `ranking` precisa estar liberada nas regras do Firestore).
- **Megaevolução:** `megas` no Pokémon (`megas.js`, via PokéAPI) → congelado em `copiaPokemon`. Escolha `{tipo:"golpe", idx, mega: n}`; acontece antes dos golpes; 1 por equipe (`megaUsada`). A mega herda o shiny; a imagem usa `slugMega`.
- **Shiny:** 10% por Pokémon, sorteado na criação da conta (`usuarios/<nick>.shiny`), só visual.
- **Bot (`botia.js`):** `s.botNivel` = `facil` (aleatório), `normal` (prefere o golpe de maior dano esperado, às vezes troca por desvantagem de tipo) ou `dificil` (quase sempre o melhor golpe, sabe finalizar, troca bem, megaevolui logo). `danoEsperado()` espelha as fórmulas do motor sem sorte nos dados. Teste de referência (jogador aleatório): o bot vence ~48% / ~84% / ~98%.
- **Times:** `usuarios/<nick>.times` = `[{id, nome, ids:[idDoPokémon...]}]` (até `MAX_TIMES`), montados na aba Times de Meus Pokémon (`meus-times.js`). Na sala só se escolhe um time (`sala-equipe.js`).
- **Sala (módulos):** `sala.js` (Firestore → telas), `salaestado.js` (estado `E`), `sala-equipe.js`, `sala-batalha.js`, `sala-menu.js`, `sala-replay.js` (rodada passo a passo, 3 s cada) e `sala-fx.js` (barra de HP animada, números de dano/cura, tremida, avisos de super efetivo/crítico/mega).
- **Visual:** `tema.css` é carregado por último em todas as páginas; as cores e fontes ficam nas variáveis do `:root`.

## Nível do jogador
- **XP:** vitória +20, derrota +5 (empate conta como derrota). Desistência não conta. Cada jogador logado recebe o seu resultado uma única vez por sala (`contabilizarResultado` em `salas.js`, guardado em `s.j[papel].resultado`); quem sai da sala logo após o fim ainda recebe (a sala espera o crédito antes de sair).
- **Níveis (`nivel.js`):** nível 0 vai de 0 a 100 XP; cada nível seguinte exige 20% mais XP que o anterior, arredondado: 100, 120, 144, 173, 207... (limites: 0, 100, 220, 364, 537...). Para mudar as regras, mexa em `XP_VITORIA`, `XP_DERROTA`, `XP_PRIMEIRO_NIVEL` e `CRESCIMENTO`. Teste: `node teste-nivel.mjs`.
- **Contas antigas:** sem o campo `xp`, começam com `vitorias × 20` XP (`xpDe`).
- **Onde aparece:** menu superior (Nv), perfil em Meus Pokémon (barra de XP), menu da batalha, tela de fim ("+20 XP · Subiu para o nível N!") e ranking (`ranking/<nick>` guarda `xp` também).

## Nível dos Pokémon (pontos de treino)

- Cada nível da **conta** rende 1 ponto de treino (`pontosLivres` em `nivel.js` = nível da conta − pontos já gastos). Um ponto sobe 1 nível de um Pokémon, de 50 até `REGRAS.nivelMax` (100).
- Níveis ficam em `usuarios/<nick>.niveis` (`{pokemonId: nivel}`; ausente = 50). `subirNivelPokemon` (transação) recusa sem ponto livre ou no nível 100.
- Os pontos gastos **não são reembolsáveis**. Contas antigas ganham pontos pelo XP retroativo (vitórias × 20).
- `copiaPokemon` usa `p.nivel` para calcular os atributos (e os das megas) com a fórmula oficial; o dano usa o nível do atacante.
- Bots ficam fixos em `NIVEL_BOT` (`bot.js`, = 50), independente da dificuldade.
- Em PvP cada jogador luta com os níveis que tem.

## Modo Torre

- Criada em `index.html` ("Subir a torre") → `criarSala(true, "normal", true)`. Exige conta (o XP vai para ela). A sala é de bot com `s.torre = {n, andar, total, fila, completa?, encerrada?}`.
- O adversário é **um Pokémon por vez** (`j["2"].equipe` tem 1 item; a tela não mostra miniaturas do time dele). A `fila` de 30 andares (cópias prontas, nível `NIVEL_BOT`, golpes aleatórios) é sorteada na criação (`filaTorre`, em `torre.js`).
- Todo andar múltiplo de `TORRE_CHEFE_A_CADA` (10) é um **chefe**: já entra megaevoluído (`slugMega`) e aparece com 👑.
- `torreAvancar(s)` roda no fim de `registrar` e `trocaForcada`: se o Pokémon do andar caiu e o jogador ainda tem time, `n++` e entra o próximo (a sala continua em `batalha`). O time do jogador **mantém o HP** entre andares; poções/Reviver (do estoque da conta) podem ser usados.
- A subida acaba quando o time cai (`vencedor "2"`), no topo (`completa`) ou ao sair pelo menu (`encerrarTorre`).
- **XP**: cada vitória vale 50% mais que a anterior (`TORRE_CRESCIMENTO = 1.5`, arredondado: 1, 2, 2, 3, 5, 8, 11…); `xpTorreTotal(n)` soma os andares. Creditado uma vez ao fim em `contabilizarResultado` (ramo `s.torre`). **Sem** vitória, poção, Reviver ou contagem de vitórias; o XP novo é espelhado no ranking só para quem já tem vitórias.
- **Nível dos adversários**: maior nível do time do jogador + 5 (chefes: + 15), no máximo 100 (`nivelNaTorre`, `reescalar` em `torre.js`). O 1º adversário é ajustado em `confirmarEquipe`; os seguintes ao entrar (`torreAvancar`), com HP cheio.
- **Megas do jogador na torre**: sem limite por equipe, mas só dá para megaevoluir outro Pokémon depois que a mega anterior cair (`megaBloqueada` em `motor.js`; fora da torre continua 1 por equipe).
- Testes: `node teste-torre.mjs` (usa um catálogo falso; precisa de stubs de firebase se rodado fora do navegador — o arquivo só importa módulos puros).

## Batalha contra o bot: nível e XP por dificuldade

- Ao confirmar o time (`confirmarEquipe`), todo o time do bot é recalculado (`reescalar`) para o nível dado por `nivelDoBot` (`nivel.js`): **fácil** = nível do seu Pokémon mais fraco, **normal** = média dos níveis do time (arredondada), **difícil** = nível do seu mais forte. Sempre entre 50 e 100.
- XP da vitória contra o bot: fácil 10, normal 20, difícil 40 (`XP_VITORIA_BOT`). Derrota continua +5 XP; PvP continua 20/5. Vitória, poção e Reviver não mudam.
- Os Pokémon do bot guardam `megasBase` (`copiaBot`, em `torre.js`) para as megas também serem recalculadas no novo nível.

## Golpe Z e Cristais Z (fase 1 do plano de caixas/habilidades/itens)

- `zmoves.js` (puro): `golpeZ(m)` transforma um golpe de **dano** com poder no golpe Z do seu tipo (18 nomes em `Z_NOMES`; `poderZ` = tabela oficial, 100 a 200). O golpe Z **sempre acerta**, não tem efeitos secundários, tem prioridade 0 e atravessa Protect com 25% do dano. Golpes de status não viram Z.
- **Regras** (validadas em `registrar`, `salas.js`): 1 golpe Z por equipe e por batalha (`j.zUsada`; na torre vale por sala/subida); não vale junto com megaevolução nem para Pokémon já megaevoluído; não vale com golpe travado (recarga, 2 turnos, fúria, Encore). Gasta **1 cristal Z da conta** (`usuarios/<nick>.zcristais`) na mesma transação que registra a escolha (`usarItem`, como a Poção); é gasto ao escolher, mesmo que o Pokémon seja derrotado antes de agir. Só para quem joga logado.
- Motor: `decidir` repassa `z`; `usar` troca o golpe pelo `golpeZ`; `pr` ignora prioridade; a proteção só é atravessada por Z (dano × 0,25).
- Tela: botão "💎 Golpe Z" (classe `z-btn`); ativado, os golpes mostram os golpes Z e a megaevolução some. Perfil e menu mostram os cristais. O nav mostra 💎.
- **Cristais**: por enquanto só vêm do admin (`admin.html` → "Dar cristais Z"). As **caixas** (1 por nível de conta, `caixasLivres` em `nivel.js`; `caixasAbertas` guarda as abertas) ficam guardadas e abrem na fase 3, junto com os itens. O bot ainda não usa golpe Z.
- Testes: `node teste-zmoves.mjs` (tabela, golpe sintético, prioridade, Protect e 600 batalhas simuladas).

## Habilidades — etapa 1: dados e escolha (sem efeito em batalha ainda)

- **Dados**: cada Pokémon do catálogo ganha `habilidades: [{id, nome, oculta}]` (PokéAPI) e cada mega `habilidade: {id, nome}`. Preenchidos pelo botão **"🧬 Buscar habilidades…"** do `admin.html` (`habilidadesapi.js`); quem já tem dados é pulado, então rodar de novo só tenta as falhas.
- **Relatórios** (o mesmo botão baixa, ao terminar): `habilidades-lista.csv` (habilidades distintas, quantos Pokémon as têm como normal/oculta/mega, mais frequentes primeiro — serve para priorizar o que implementar), `pokemons-habilidades.csv`, `golpes-por-pokemon.csv` (uma linha por Pokémon × golpe das listas de escolha) e `golpes-por-pokemon.json` (por Pokémon + golpes distintos com a contagem). Funções puras em `habilidades.js` (`relatorioHabilidades`, `relatorioGolpes`, `csv`).
- **Escolha**: todas as habilidades, inclusive a oculta, estão liberadas. Em Meus Pokémon, o editor tem um seletor (salvo na hora em `usuarios/<nick>.habilidades = {idDoPokemon: idDaHabilidade}`); sem escolha vale a 1ª habilidade normal (`habilidadeEscolhida`).
- **Batalha**: `copiaPokemon` guarda `habilidade` (e a das megas), mas **nada reage a ela ainda**. Bots/NPCs sorteiam qualquer habilidade do Pokémon (`habilidadeAleatoria`); chefes da torre usam a oculta (`habilidadeOculta`).
- Próximas etapas: motor de ganchos em `habilidades.js` (entrar em campo, antes do dano, ao ser atingido, fim da rodada, imunidades) com as habilidades mais comuns da lista, e relatório de cobertura.
- Testes: `node teste-habilidades.mjs`.

## Habilidades — etapa 2: efeitos em batalha (`habilidades.js` + ganchos no `motor.js`)
`habilidades.js` guarda as tabelas e contas puras; o `motor.js` chama nos ganchos. A habilidade em uso é `P.habilidade.id` (a mega troca pela dela ao megaevoluir).
- **Ao entrar em campo** (`aoEntrar`, também no início da batalha via `iniciarBatalha`, ao trocar, ao megaevoluir e no próximo andar da torre): Intimidate, Drought/Drizzle/Sand Stream/Snow Warning, surges de terreno, aviso do Pressure.
- **Antes do golpe**: imunidades/absorções (Levitate, Flash Fire, Water/Volt Absorb, Dry Skin, Storm Drain, Lightning Rod, Motor Drive, Sap Sipper, Soundproof, Bulletproof), Sturdy contra OHKO, Prankster/Gale Wings (prioridade), Protean/Libero, Refrigerate/Pixilate/Aerilate/Galvanize, precisão (No Guard, Compound Eyes, Hustle, Keen Eye, Sand Veil, Snow Cloak), Mold Breaker/Teravolt/Turboblaze (ignoram a habilidade do alvo só durante o golpe).
- **Dano**: atributos (Huge/Pure Power, Guts, Hustle, Solar Power, Marvel Scale, Quark Drive, Protosynthesis), poder (Technician, Iron Fist, Strong Jaw, Tough Claws, Reckless, Sheer Force, Blaze/Overgrow/Torrent/Swarm, Steelworker, Transistor, Dragon's Maw, Analytic, Flash Fire), dano final (Adaptability, Tinted Lens, Thick Fat, Heatproof, Dry Skin, Fur Coat, Ice Scales, Multiscale, Shadow Shield, Filter/Solid Rock/Prism Armor), sem crítico (Shell/Battle Armor), Scrappy, Infiltrator, Rock Head/Magic Guard (sem recuo), Serene Grace/Sheer Force/Shield Dust (chances).
- **Ao ser atingido / ao derrubar**: Rough Skin/Iron Barbs, Static/Flame Body/Poison Point (30%, só golpes de contato), Poison Touch, Weak Armor, Justified, Stamina, Anger Point, Moxie, Beast Boost. Contato = golpe físico, menos uma lista de golpes sem contato.
- **Condições e estágios**: Limber, Insomnia, Vital Spirit, Immunity, Water Veil, Magma Armor, Own Tempo, Leaf Guard (sol), Oblivious (Taunt), Synchronize; Clear Body/White Smoke/Full Metal Body/Hyper Cutter/Keen Eye bloqueiam quedas vindas do adversário; Contrary/Simple; Competitive/Defiant reagem à queda; Steadfast reage a recuar; Inner Focus não recua.
- **Fim da rodada / saída**: Speed Boost, Ice Body, Rain Dish, Dry Skin, Solar Power, Hydration, Shed Skin, Poison Heal, Magic Guard/Overcoat/Sand Veil/Snow Cloak etc. contra dano de clima; Natural Cure e Regenerator ao sair; Swift Swim/Chlorophyll/Sand Rush/Slush Rush dobram a Velocidade; Cloud Nine/Air Lock anulam o clima.
- **Cobertura** (`estadoHabilidade`): ✔ funciona · ◐ em parte · ⏳ depende de itens (Fase 3) · ∅ só dupla / sem PP · ⚠ ainda sem efeito. Aparece ao escolher a habilidade em Meus Pokémon e no botão do admin (`habilidades-cobertura.csv` + resumo no log). Para ligar uma habilidade nova: acrescente o id em `OK` (habilidades.js) e trate-o no gancho correspondente.
- Limitações conhecidas: o bot (`botia.js`) não considera habilidades ao estimar dano; Magic Bounce, Unaware, Parental Bond, Disguise etc. ainda sem efeito (lista no relatório).
- Testes: `node teste-habilidades-batalha.mjs` (cenário por gancho + 1500 batalhas aleatórias).

## Itens segurados, caixas e cristais (Fase 3) — `itens.js` + ganchos no `motor.js`
- **Catálogo**: 135 itens (`itens.js`, uma linha por item: `id|Nome|raridade|descrição`). Raridade comum/incomum/raro (60/30/10% na caixa). `Leppa Berry` (sem PP) e `Destiny Knot` (sem Attract) existem mas **não saem nas caixas** (`SEM_EFEITO`).
- **Conta**: `usuarios/<nick>.itens = {idDoItem: cópias}` e `.itensEq = {idDoPokemon: idDoItem}`. 1 item por Pokémon; um item só pode estar em tantos Pokémon quantas cópias a conta tiver. Itens de uso único (bagas, gemas, Focus Sash…) só somem **daquela batalha** (`P.item` → `P.itemUsado`); a cópia continua na conta.
- **Caixas**: cada nível da conta rende 1 (`caixasLivres`). `abrirCaixa` (transação em `usuarios.js`): 30% → 1 a 3 cristais Z; 70% → 5 itens sorteados (raridade por item). Repetido vira +1 cópia. Botão "Abrir uma caixa" no perfil de Meus Pokémon; "Meus itens" lista o estoque.
- **Equipar**: no editor do Pokémon (Meus Pokémon) só aparecem itens que a conta tem com cópia livre (`equiparItem`). A sala lê o inventário em `carregarConta` (`itemEquipado`) e `copiaPokemon` congela `item`.
- **Bots e torre**: `itemDeBot(modo)` — fácil 30% (só comuns), normal 60%, difícil sempre (qualquer raridade), torre 50%, chefes da torre sempre e mais raros.
- **Tela de batalha**: abaixo do nome aparece "🧬 habilidade · 🎒 item".
- Admin: o botão de habilidades também baixa `itens-lista.csv`.
- Testes: `node teste-itens.mjs` (cenários por item + 2500 batalhas com os 135 itens).

## Auditoria de golpes (`teste-golpes.mjs`)

`golpes-lista.json` traz os 589 golpes distintos das listas de escolha (gerado pelo botão do admin). `node teste-golpes.mjs [filtro]` confere um por um: converte como a PokéAPI faria, confere `suportado`, poder/precisão/prioridade e executa o golpe no motor verificando o efeito (estágios, condições, cura, clima, telas, armadilhas, recuo, dreno etc.). Golpes sem precisão (`precisao: null`) nunca podem errar, nem contra evasão +6.

- **Aurora Veil** nunca erra, mas só funciona com Granizo ou Neve em campo; sem eles falha com o motivo no log ("Aurora Veil só funciona com Granizo ou Neve em campo") e a dica do golpe avisa.
- Golpes que agora têm mecânica própria: Charge, Growth (dobra no sol), Dream Eater, Poltergeist, Belch, Synchronoise, Burn Up, Last Resort, False Swipe, Assurance, Smelling Salts, Wake-Up Slap, Tri Attack, Flying Press, Freeze-Dry, Chip Away, Thousand Arrows, Photon Geyser, Salt Cure, Steel Roller, Electro Shot, Grassy Glide, Expanding Force, Rising Voltage, Glaive Rush e outros (veja `conversor.js`).
- Depois de atualizar o código, rode **Sincronizar golpes** de novo para regravar a coleção `golpes`.

## Habilidades pendentes: plano em 4 partes (`HABILIDADES-PLANO.md`)

As 92 habilidades sem efeito ou parciais estão numeradas em `HABILIDADES-PLANO.md`, 23 por parte. **Partes 1, 2, 3 e 4 concluídas (as 92)** (`teste-habilidades-parte1.mjs`): Sniper, Skill Link, Mega Launcher, Sharpness, Punk Rock, Liquid Voice, Dark/Fairy Aura, Aura Break, Fluffy, Merciless, Orichalcum Pulse, Hadron Engine, Parental Bond, Piercing Drill, Sword of Ruin, Mycelium Might, Unseen Fist, Long Reach, Dragonize. Rivalry, Heavy Metal e Light Metal ficam como "não se aplica" (o jogo não tem gênero nem peso).

Parte 2 (`teste-habilidades-parte2.mjs`): Cursed Body, Aftermath, Innards Out, Gooey, Effect Spore, Mirror Armor, Anger Shell, Berserk, Wind Power, Steam Engine, Good as Gold, Magic Bounce, Liquid Ooze, Wonder Guard, Stench, Bad Dreams, Big Pecks, Damp, Super Luck, Suction Cups, Corrosion, Sand Force. Cute Charm também não se aplica (sem gênero/Attract). O botão do admin "Remover habilidades que não se aplicam" tira Rivalry, Cute Charm, Heavy Metal e Light Metal do catálogo.
- Corrigido: quem é puxado (Roar, Dragon Tail, Red Card) antes de agir perde a ação da rodada (antes usava o golpe do Pokémon que saiu).

Parte 3 (`teste-habilidades-parte3.mjs`): Quick Feet, Stall, Slow Start, Truant, Early Bird, Shadow Tag e Magnet Pull (via `podeTrocar(P, O)`), Emergency Exit, Tangled Feet, Unaware, Download, Trace, Forewarn, Anticipation, Moody, Neutralizing Gas (`habCtx.gas` liga durante cada ação do motor), Delta Stream, Disguise, Zen Mode e Stance Change (troca de atributos). Multitype, RKS System e Illusion não se aplicam (sem placas, memórias nem disfarce visual) e entraram no botão de limpeza do admin; quem tem só essa habilidade (Arceus, Silvally, Zoroark) a mantém.

Parte 4 (`teste-habilidades-parte4.mjs`): Mega Sol, Poison Puppeteer, Purifying Salt, Queenly Majesty, Soul Heart, Supersweet Syrup, Supreme Overlord, Victory Star, Aura Guard, Dauntless Shield, Intrepid Sword, Chilling Neigh, Grim Neigh, Eelevate; Quark Drive, Protosynthesis e Oblivious ficam completas para este jogo (sem Booster Energy nem Attract). Não se aplicam: Stalwart, Pressure, Run Away, Telepathy, Healer e Plus (dupla/PP/captura). Resultado final: das 221 habilidades do catálogo, 208 funcionam e 13 não se aplicam (o botão do admin as remove, exceto quando seriam a única habilidade do Pokémon).
