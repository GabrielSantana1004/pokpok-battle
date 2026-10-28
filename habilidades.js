// Habilidades (funções puras, sem Firebase). Nesta etapa só há DADOS: cada Pokémon do catálogo guarda
//   habilidades: [{id, nome, oculta}]            (da PokéAPI; todas podem ser escolhidas, inclusive a oculta)
//   megas[i].habilidade: {id, nome}               (a habilidade de cada forma mega)
// e cada conta guarda a escolha em usuarios/<nick>.habilidades = {idDoPokemon: idDaHabilidade}. Os efeitos em batalha chegam na etapa seguinte.

// habilidade em uso: a escolhida pela conta (se ainda existir na lista do Pokémon) ou a 1ª habilidade normal
export function habilidadeEscolhida(p, escolhas = {}) {
  const hs = p?.habilidades || [];
  const h = hs.find(x => x.id === escolhas?.[p.id]) || hs.find(x => !x.oculta) || hs[0];
  return h ? {id: h.id, nome: h.nome} : null;
}
const sorteia = a => a[Math.floor(Math.random() * a.length)];
// bots e NPCs: qualquer habilidade do Pokémon, sorteada (inclusive a oculta)
export const habilidadeAleatoria = p => { const h = p?.habilidades?.length ? sorteia(p.habilidades) : null; return h ? {id: h.id, nome: h.nome} : null; };
// chefes da torre: a habilidade oculta, quando existe
export const habilidadeOculta = p => { const h = p?.habilidades?.find(x => x.oculta); return h ? {id: h.id, nome: h.nome} : habilidadeAleatoria(p); };

// ----- relatórios (para planejar quais habilidades e golpes implementar) -----
// Lista de habilidades distintas: quantos Pokémon a têm (como habilidade normal e como oculta), mais frequentes primeiro
export function relatorioHabilidades(cat) {
  const mapa = new Map(), porPokemon = [], semDados = [];
  for (const p of cat) {
    if (!p.habilidades?.length) { semDados.push(p.nome); continue; }
    porPokemon.push({id: p.id, nome: p.nome, normais: p.habilidades.filter(h => !h.oculta).map(h => h.nome), oculta: p.habilidades.filter(h => h.oculta).map(h => h.nome),
      megas: (p.megas || []).map(m => ({nome: m.nome, habilidade: m.habilidade?.nome || null}))});
    const ver = (h, como, quem) => { const e = mapa.get(h.id) || {id: h.id, nome: h.nome, total: 0, normal: 0, oculta: 0, mega: 0, pokemons: []}; e[como]++; if (como !== "mega") e.total++; if (!e.pokemons.includes(quem)) e.pokemons.push(quem); mapa.set(h.id, e); };
    for (const h of p.habilidades) ver(h, h.oculta ? "oculta" : "normal", p.nome);
    for (const m of p.megas || []) if (m.habilidade) ver(m.habilidade, "mega", m.nome);
  }
  const distintas = [...mapa.values()].sort((a, b) => (b.total + b.mega) - (a.total + a.mega) || a.nome.localeCompare(b.nome));
  return {distintas, porPokemon, semDados};
}
// Golpes que cada Pokémon pode escolher em "Meus Pokémon" (a lista "aprende"), mais a lista de golpes distintos
export function relatorioGolpes(cat) {
  const un = new Map(), pokemons = [];
  for (const p of cat) {
    const golpes = (p.aprende || []).map(g => ({nome: g.nome, tipo: g.tipo, cat: g.cat, poder: g.poder ?? null, precisao: g.precisao ?? null, prioridade: g.prioridade || 0}));
    pokemons.push({id: p.id, nome: p.nome, total: golpes.length, golpes});
    for (const g of golpes) { const e = un.get(g.nome) || {...g, qtd: 0}; e.qtd++; un.set(g.nome, e); }
  }
  return {pokemons, unicos: [...un.values()].sort((a, b) => b.qtd - a.qtd || a.nome.localeCompare(b.nome)), totalPokemon: pokemons.length};
}
// CSV com ";" e BOM (abre direto no Excel); "linhas" é uma lista de listas
const cel = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
export const csv = (cabecalho, linhas) => "﻿" + [cabecalho, ...linhas].map(l => l.map(cel).join(";")).join("\r\n");

// ======================================================================================================
// MOTOR DE HABILIDADES (etapa 2). Aqui ficam as TABELAS e as contas puras; o motor.js chama estas funções nos ganchos da batalha:
//   ao entrar em campo · antes do golpe (precisão, prioridade, imunidades) · no cálculo do dano (atributos, poder, dano final)
//   · ao ser atingido (contato, estágios) · ao derrubar · ao receber condição/estágio · fim da rodada · ao sair de campo.
// Para ligar uma habilidade nova: acrescente o id em ESTADOS (cobertura) e trate o id na tabela/função do gancho correspondente.
// ======================================================================================================
// Neutralizing Gas: com ele em campo, as outras habilidades ficam sem efeito (o motor liga habCtx.gas durante cada ação)
export const habCtx = {gas: false};
export const habId = P => { const id = P?.habilidade?.id || null; return habCtx.gas && id && id !== "neutralizing-gas" ? null : id; };

// ----- cobertura: o que cada habilidade faz hoje (aparece em "Meus Pokémon" e no relatório do admin) -----
const lista = s => s.split(/\s+/).filter(Boolean);
const OK = new Set(lista(`mega-sol poison-puppeteer purifying-salt queenly-majesty soul-heart supersweet-syrup supreme-overlord victory-star aura-guard dauntless-shield intrepid-sword chilling-neigh grim-neigh eelevate oblivious quark-drive protosynthesis quick-feet stall slow-start truant early-bird shadow-tag magnet-pull emergency-exit tangled-feet unaware download trace forewarn anticipation moody neutralizing-gas delta-stream disguise zen-mode stance-change cursed-body aftermath innards-out gooey effect-spore mirror-armor anger-shell berserk wind-power steam-engine good-as-gold magic-bounce liquid-ooze wonder-guard stench bad-dreams big-pecks damp super-luck suction-cups corrosion sand-force sniper skill-link mega-launcher sharpness punk-rock liquid-voice dark-aura fairy-aura aura-break fluffy merciless orichalcum-pulse hadron-engine parental-bond piercing-drill sword-of-ruin mycelium-might unseen-fist long-reach dragonize intimidate levitate sturdy sheer-force shell-armor battle-armor flash-fire mold-breaker teravolt turboblaze swift-swim chlorophyll sand-rush slush-rush
  blaze overgrow torrent swarm clear-body white-smoke full-metal-body hyper-cutter keen-eye flame-body static poison-point poison-touch water-absorb volt-absorb dry-skin storm-drain
  lightning-rod motor-drive sap-sipper soundproof bulletproof weak-armor iron-fist guts ice-body rain-dish natural-cure regenerator steadfast inner-focus technician thick-fat moxie
  beast-boost rock-head magic-guard reckless hydration shed-skin synchronize anger-point justified competitive defiant limber insomnia vital-spirit sweet-veil own-tempo immunity pastel-veil
  water-veil water-bubble thermal-exchange magma-armor adaptability strong-jaw tough-claws speed-boost scrappy huge-power pure-power multiscale shadow-shield prankster gale-wings drought
  drizzle sand-stream snow-warning electric-surge grassy-surge misty-surge psychic-surge rough-skin iron-barbs protean libero serene-grace infiltrator no-guard compound-eyes hustle
  analytic contrary simple cloud-nine air-lock overcoat sand-veil snow-cloak solar-power poison-heal filter solid-rock prism-armor heatproof fur-coat marvel-scale ice-scales tinted-lens
  illuminate unnerve klutz unburden gluttony frisk ripen pickpocket magician harvest sticky-hold cheek-pouch refrigerate pixilate aerilate galvanize steelworker transistor dragons-maw stamina leaf-guard shield-dust`));
const PARCIAL = {"mind's-eye": "só ignora a Intimidação"};
const NOTA_OK = {oblivious: "protege da Intimidação e do Taunt (Attract não existe no jogo)", "quark-drive": "ativa no Terreno Elétrico (o jogo não tem Booster Energy)", protosynthesis: "ativa no sol (o jogo não tem Booster Energy)"};
const ITENS = new Set(lista(`honey-gather ball-fetch`));
const DUPLA = new Set(lista(`telepathy plus minus friend-guard healer symbiosis power-spot flower-veil aroma-veil battery steely-spirit costar`));
const PP = new Set(["pressure"]);
const NA = {stalwart: "só serve contra golpes que redirecionam, que existem só em batalha dupla", pressure: "o jogo não tem PP", "run-away": "o jogo não tem fuga de batalha selvagem", telepathy: "só vale em batalha dupla", healer: "só vale em batalha dupla", plus: "só vale em batalha dupla (precisa de um aliado)", multitype: "o jogo não tem as placas do Arceus", "rks-system": "o jogo não tem as memórias do Silvally", illusion: "o disfarce é só visual e o jogo não esconde o time", rivalry: "o jogo não tem gênero", "cute-charm": "o jogo não tem gênero nem Attract", "heavy-metal": "o jogo não tem peso", "light-metal": "o jogo não tem peso"};
export const HAB_NAO_SE_APLICAM = Object.keys(NA); // habilidades sem sentido neste jogo (sem gênero e sem peso)
export const ESTADOS = {ok: "✔ funciona em batalha", parcial: "◐ funciona em parte", itens: "⏳ depende de itens (Fase 3)", dupla: "∅ só faz efeito em batalha dupla", pp: "∅ o jogo não tem PP (só aparece o aviso)", na: "∅ não se aplica a este jogo", nao: "⚠ ainda sem efeito"};
export function estadoHabilidade(id) {
  const e = OK.has(id) ? "ok" : PARCIAL[id] ? "parcial" : ITENS.has(id) ? "itens" : NA[id] ? "na" : DUPLA.has(id) ? "dupla" : PP.has(id) ? "pp" : "nao";
  return {estado: e, texto: ESTADOS[e], nota: PARCIAL[id] || NA[id] || NOTA_OK[id] || ""};
}
export const temEfeito = id => ["ok", "parcial"].includes(estadoHabilidade(id).estado);
// marcação curta para as telas de escolha
export const marcaHabilidade = id => { const e = estadoHabilidade(id).estado; return e === "ok" ? "" : e === "parcial" ? " ◐" : e === "nao" ? " ⚠ sem efeito" : e === "itens" ? " ⏳ itens" : " ∅ sem efeito aqui"; };
// relatório de cobertura sobre o que existe no catálogo (usa o relatório de habilidades distintas)
export function relatorioCobertura(cat) {
  const h = relatorioHabilidades(cat), linhas = h.distintas.map(e => ({...e, ...estadoHabilidade(e.id)}));
  const cont = {}; for (const l of linhas) cont[l.estado] = (cont[l.estado] || 0) + 1;
  const pokes = (cat || []).filter(p => p.habilidades?.length).length;
  return {linhas, cont, total: linhas.length, pokes};
}

// ----- listas de golpes por característica -----
const ER_SOCO = /(punch|punching|fists|mash)$/, ER_MORDIDA = /(bite|crunch|fang|fangs|jaw-lock|fishious-rend)$/;
const SOM = new Set(lista(`boomburst hyper-voice sing screech supersonic snarl growl roar bug-buzz chatter echoed-voice relic-song round uproar overdrive snore disarming-voice noble-roar
  parting-shot perish-song sparkling-aria clanging-scales clangorous-soul confide metal-sound grass-whistle heal-bell howl torch-song alluring-voice psychic-noise`));
const BOLA = new Set(lista(`shadow-ball sludge-bomb energy-ball weather-ball aura-sphere focus-blast bullet-seed gyro-ball electro-ball seed-bomb egg-bomb mist-ball zap-cannon pollen-puff
  acid-spray octazooka rock-wrecker barrage beak-blast ice-ball rock-blast magnet-bomb`));
const SEM_CONTATO = new Set(lista(`earthquake rock-slide stone-edge bulldoze magnitude rock-blast bullet-seed pin-missile icicle-spear razor-leaf seed-bomb poison-sting twineedle
  thousand-arrows dragon-darts ice-shard icicle-crash diamond-storm bone-rush bonemerang fissure fling spikes-shot sky-attack petal-blizzard rock-tomb smack-down skull-bash`));
const PULSO = new Set(`aura-sphere dark-pulse dragon-pulse heal-pulse night-daze origin-pulse terrain-pulse water-pulse`.split(" "));
const CORTE = new Set(`aerial-ace air-cutter air-slash aqua-cutter behemoth-blade bitter-blade ceaseless-edge cut fury-cutter kowtow-cleave leaf-blade mighty-cleave night-slash population-bomb psyblade psycho-cut razor-leaf razor-shell sacred-sword secret-sword slash solar-blade stone-axe tachyon-cutter x-scissor`.split(" "));
const VENTO = new Set(`gust twister hurricane heat-wave bleakwind-storm blizzard icy-wind petal-blizzard sandsear-storm air-cutter fairy-wind springtide-storm wildbolt-storm razor-wind whirlwind`.split(" "));
export const ehVento = m => VENTO.has(m?.id);
export const ehPulso = m => PULSO.has(m?.id), ehCorte = m => CORTE.has(m?.id);
export const ehSoco = m => ER_SOCO.test(m?.id || ""), ehMordida = m => ER_MORDIDA.test(m?.id || ""), ehSom = m => SOM.has(m?.id), ehBola = m => BOLA.has(m?.id);
export const contatoDe = (A, m) => temContato(m) && habId(A) !== "long-reach"; // Long Reach: nenhum golpe faz contato
export const temContato = m => m?.cat === "fisico" && !SEM_CONTATO.has(m.id);

// ----- imunidades e absorções de golpe (quem é atingido) -----
const ABSORVE = {
  levitate: {tipo: "Ground", so: "dano"}, eelevate: {tipo: "Ground", so: "dano"}, "flash-fire": {tipo: "Fire", acao: "flash"},
  "water-absorb": {tipo: "Water", acao: "cura"}, "dry-skin": {tipo: "Water", acao: "cura"}, "storm-drain": {tipo: "Water", acao: "estagio", stat: "spa", n: 1},
  "volt-absorb": {tipo: "Electric", acao: "cura"}, "lightning-rod": {tipo: "Electric", acao: "estagio", stat: "spa", n: 1}, "motor-drive": {tipo: "Electric", acao: "estagio", stat: "spe", n: 1},
  "sap-sipper": {tipo: "Grass", acao: "estagio", stat: "atk", n: 1}, "earth-eater": {tipo: "Ground", acao: "cura"}
};
// devolve {acao, stat?, n?} quando a habilidade do alvo anula o golpe (tipo = tipo do golpe já com Refrigerate etc.)
export function imuneHab(h, m, tipo) {
  if (!h) return null;
  const a = ABSORVE[h];
  if (a && a.tipo === tipo && !(a.so === "dano" && m.cat === "status") && m.id !== "thousand-arrows") return {acao: a.acao || "nada", stat: a.stat, n: a.n};
  if (h === "soundproof" && ehSom(m)) return {acao: "nada"};
  if (h === "good-as-gold" && m.cat === "status") return {acao: "nada"}; // Good as Gold: imune a golpes de status dos outros
  if (h === "bulletproof" && ehBola(m)) return {acao: "nada"};
  return null;
}

// ----- tipo do golpe: Refrigerate, Pixilate, Aerilate, Galvanize (Normal vira outro tipo, ×1,2) -----
const ATE = {refrigerate: "Ice", pixilate: "Fairy", aerilate: "Flying", galvanize: "Electric", dragonize: "Dragon"};
export const tipoAte = (h, m) => h === "liquid-voice" ? (ehSom(m) && m.cat !== "status" ? "Water" : null) : ATE[h] && m.tipo === "Normal" && m.cat !== "status" ? ATE[h] : null; // Liquid Voice: golpe sonoro vira Water (sem bônus)

// ----- Mold Breaker e parecidas -----
export const quebraHabilidade = h => h === "mold-breaker" || h === "teravolt" || h === "turboblaze";

// ----- atributos: multiplicador de cada atributo conforme habilidade, clima e terreno -----
const MAIS_ALTO = P => ["atk", "def", "spa", "spd", "spe"].reduce((a, b) => P[b] > P[a] ? b : a, "atk");
export function multStat(P, stat, env = {}) {
  const h = habId(P); if (!h) return 1;
  const {clima, terreno} = env;
  switch (h) {
    case "huge-power": case "pure-power": return stat === "atk" ? 2 : 1;
    case "guts": return stat === "atk" && P.cond ? 1.5 : 1;
    case "hustle": return stat === "atk" ? 1.5 : 1;
    case "solar-power": return stat === "spa" && clima === "sol" ? 1.5 : 1;
    case "marvel-scale": return stat === "def" && P.cond ? 1.5 : 1;
    case "swift-swim": return stat === "spe" && clima === "chuva" ? 2 : 1;
    case "chlorophyll": return stat === "spe" && clima === "sol" ? 2 : 1;
    case "sand-rush": return stat === "spe" && clima === "areia" ? 2 : 1;
    case "slush-rush": return stat === "spe" && (clima === "granizo" || clima === "neve") ? 2 : 1;
    case "quark-drive": return terreno === "eletrico" && stat === MAIS_ALTO(P) ? (stat === "spe" ? 1.5 : 1.3) : 1;
    case "protosynthesis": return clima === "sol" && stat === MAIS_ALTO(P) ? (stat === "spe" ? 1.5 : 1.3) : 1;
    case "quick-feet": return stat === "spe" && P.cond ? (P.cond === "paralisia" ? 3 : 1.5) : 1; // some o corte da paralisia (x2) e ainda ganha 1,5x
    case "slow-start": return (stat === "atk" || stat === "spe") && (P.vol?.t || 0) < 5 ? 0.5 : 1; // 5 turnos de Atk e Vel pela metade
    case "orichalcum-pulse": return stat === "atk" && clima === "sol" ? 4 / 3 : 1;
    case "hadron-engine": return stat === "spa" && terreno === "eletrico" ? 4 / 3 : 1;
    case "unburden": return stat === "spe" && !P.item && P.itemUsado ? 2 : 1;
    default: return 1;
  }
}

// ----- poder do golpe (quem ataca) -----
const PINCH = {blaze: "Fire", overgrow: "Grass", torrent: "Water", swarm: "Bug"};
const TIPO_FORTE = {steelworker: ["Steel", 1.5], transistor: ["Electric", 1.5], "dragons-maw": ["Dragon", 1.5], "water-bubble": ["Water", 2]};
export function poderMult(A, m, T, x = {}) { // x: {contato, recuo, sheer, ate, flash, depois (o alvo já agiu)}
  let f = 1;
  if (x.aura && x.aura[T.tipo]) f *= x.aura[T.tipo]; // Dark Aura / Fairy Aura (Aura Break inverte): valem para todos em campo
  const h = habId(A); if (!h) return f;
  if (h === "technician" && T.poder <= 60) f *= 1.5;
  if (h === "iron-fist" && ehSoco(m)) f *= 1.2;
  if (h === "strong-jaw" && ehMordida(m)) f *= 1.5;
  if (h === "sand-force" && x.clima === "areia" && ["Rock", "Ground", "Steel"].includes(T.tipo)) f *= 1.3;
  if (h === "mega-launcher" && ehPulso(m)) f *= 1.5;
  if (h === "sharpness" && ehCorte(m)) f *= 1.5;
  if (h === "punk-rock" && ehSom(m)) f *= 1.3;
  if (h === "tough-claws" && x.contato) f *= 1.3;
  if (h === "reckless" && x.recuo) f *= 1.2;
  if (h === "sheer-force" && x.sheer) f *= 1.3;
  if (PINCH[h] === T.tipo && A.hpAtual * 3 <= A.hp) f *= 1.5;
  if (TIPO_FORTE[h]?.[0] === T.tipo) f *= TIPO_FORTE[h][1];
  if (x.flash && T.tipo === "Fire") f *= 1.5;
  if (x.ate) f *= 1.2;
  if (h === "analytic" && x.depois) f *= 1.3;
  return f;
}
// golpe com efeito secundário (Sheer Force remove o efeito e dá ×1,3; Shield Dust bloqueia)
export const efeitoSecundario = e => e.chance != null && e.chance < 100 && ["estagio", "condicao", "volatil", "recuar"].includes(e.t);

// ----- dano final: multiplicadores de quem ataca e de quem defende -----
export function danoFinalMult({A, D, hD, m, tipo, mult, fis, stab}) { // hD = habilidade do alvo (null quando o Mold Breaker a ignora)
  const hA = habId(A); let f = 1;
  if (hA === "adaptability" && stab) f *= 4 / 3;
  if (hA === "tinted-lens" && mult > 0 && mult < 1) f *= 2;
  if (hD === "thick-fat" && (tipo === "Fire" || tipo === "Ice")) f *= 0.5;
  if (hD === "heatproof" && tipo === "Fire") f *= 0.5;
  if (hD === "dry-skin" && tipo === "Fire") f *= 1.25;
  if (hD === "fur-coat" && fis) f *= 0.5;
  if (hD === "aura-guard" && temContato(m) && habId(A) !== "long-reach") f *= 0.5;
  if (hD === "purifying-salt" && tipo === "Ghost") f *= 0.5;
  if (hD === "fluffy") { if (temContato(m) && habId(A) !== "long-reach") f *= 0.5; if (tipo === "Fire") f *= 2; }
  if (hD === "punk-rock" && ehSom(m)) f *= 0.5;
  if (hD === "ice-scales" && !fis) f *= 0.5;
  if ((hD === "multiscale" || hD === "shadow-shield") && D.hpAtual === D.hp) f *= 0.5;
  if (["filter", "solid-rock", "prism-armor"].includes(hD) && mult > 1) f *= 0.75;
  return f;
}

// ----- precisão: devolve o fator sobre a precisão do golpe, ou "sempre" -----
export function precisaoHab(A, D, hD, m, clima, est) { // est: estágio de evasão do alvo
  const hA = habId(A);
  if (hA === "no-guard" || hD === "no-guard") return {sempre: true};
  let f = 1, eva = est;
  if (hA === "compound-eyes") f *= 1.3;
  if (hA === "victory-star") f *= 1.1;
  if (hD === "tangled-feet" && D.conf > 0) f *= 0.5; // Tangled Feet: confuso = mais difícil de acertar
  if (hA === "hustle" && m.cat === "fisico") f *= 0.8;
  if (hA === "keen-eye" || hA === "illuminate" || hA === "mind's-eye") eva = Math.min(0, eva);
  if ((hD === "sand-veil" && clima === "areia") || (hD === "snow-cloak" && (clima === "granizo" || clima === "neve"))) f *= 0.8;
  return {f, eva};
}

// ----- prioridade extra -----
export function bonusPrioridade(P, m) {
  const h = habId(P);
  if (h === "prankster" && m.cat === "status") return 1;
  if (h === "gale-wings" && m.tipo === "Flying" && P.hpAtual === P.hp) return 1;
  return 0;
}

// ----- condições e estágios que a habilidade bloqueia -----
const BLOQ_COND = {limber: ["paralisia"], insomnia: ["sono"], "vital-spirit": ["sono"], "sweet-veil": ["sono"], immunity: ["veneno", "veneno-grave"], "pastel-veil": ["veneno", "veneno-grave"],
  "water-veil": ["queimadura"], "water-bubble": ["queimadura"], "thermal-exchange": ["queimadura"], "magma-armor": ["congelamento"], "own-tempo": ["confusao"]};
export const bloqueiaCond = (h, c, clima) => !!h && (BLOQ_COND[h]?.includes(c) || (h === "purifying-salt" && c !== "confusao") || (h === "leaf-guard" && clima === "sol"));
export const bloqueiaQueda = (h, stat) => ["clear-body", "white-smoke", "full-metal-body"].includes(h) || (h === "hyper-cutter" && stat === "atk") || (h === "keen-eye" && stat === "prec") || (h === "big-pecks" && stat === "def");
export const imuneIntimidacao = h => ["inner-focus", "oblivious", "own-tempo", "scrappy", "guard-dog", "clear-body", "white-smoke", "full-metal-body", "hyper-cutter"].includes(h);

// ----- ao entrar em campo -----
export const CLIMA_HAB = {drought: "sol", drizzle: "chuva", "orichalcum-pulse": "sol", "sand-stream": "areia", "snow-warning": "neve"};
export const TERRENO_HAB = {"electric-surge": "eletrico", "hadron-engine": "eletrico", "grassy-surge": "grama", "misty-surge": "nevoa", "psychic-surge": "psiquico"};
