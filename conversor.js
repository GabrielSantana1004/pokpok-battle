// Conversor: transforma um golpe da PokéAPI (/move/<nome>) no documento da coleção "golpes" (versão 2).
//
// Documento: { id, nome, tipo, cat, poder, precisao, prioridade, alvoTipo, efeitos: [...], suportado, motivo, nota, versao: 2 }
//
// Tipos de efeito (campo "t"). Em golpes de dano os efeitos rodam DEPOIS do acerto; em golpes de status, no uso.
//   estagio    {stat, n, alvo:"self"|"alvo", chance}          stat: atk def spa spd spe prec eva ("aleatorio" = Acupressure)
//   condicao   {condicao, alvo, chance}                       paralisia queimadura veneno veneno-grave sono congelamento confusao
//   cura       {fracao, alvo:"self", clima?:"padrao"|"areia"}  cura % do HP máximo (clima: depende do clima, como Moonlight)
//   curarCond  {equipe?:bool}                                 Heal Bell, Aromatherapy, Refresh
//   recuar     {chance}                                       faz o alvo recuar (só se ele ainda não agiu)
//   dreno      {fracao}                                       cura quem atacou em % do dano causado
//   recuo      {fracao, base:"dano"|"hp"}                     dano de recuo (% do dano causado ou do HP máximo)
//   multi      {min, max}                                     vários acertos
//   crit       {n}  /  critSempre                              aumenta o estágio de crítico / sempre crítico
//   danofixo   {valor | nivel | metade | ohko | contra:"fisico"|"especial"|"qualquer" (mult) | emparelhar | userHp}
//   carga      {invul?:"voo"|"cavar"|"mergulho"|"fantasma", sol?:bool, antes?:[efeitos]}   golpe de 2 turnos
//   recarga    {}                                              precisa recarregar no turno seguinte
//   furia      {}                                              Outrage/Thrash: 2-3 turnos e depois confunde
//   explodir   {}                                              quem usa é derrotado
//   falhaSe    {se:"primeiroTurno"|"naoAtacando"|"levouDano"}
//   dobrar     {se:"statusUser"|"statusAlvo"|"venenoAlvo"|"hpMetadeAlvo"|"levouDano"|"agiuAntes"|"sempre", ignoraQueimadura?}
//   poderPorEstagios / poderPorHp / climaBola / usaDef / defFis / atkAlvo   variações do cálculo de dano
//   protecao   {endure?, contato?:{dano|estagio|condicao}}     Protect e parecidos
//   clima      {clima:"chuva"|"sol"|"areia"|"granizo"|"neve", turnos}
//   terreno    {terreno:"eletrico"|"grama"|"nevoa"|"psiquico", turnos}
//   sala       {sala:"trickroom", turnos}
//   armadilha  {a:"rocha"|"espinhos"|"venenosa"|"teia"}        no lado do adversário
//   tela       {tela:"reflect"|"luz"|"veu"|"vento"|"protecaoStatus"|"nevoa", turnos}   no lado de quem usa
//   limpar     {o:"armadilhas"|"telas"|"estagios", alvo:"self"|"alvo"|"ambos", antes?:bool}
//   troca      {modo:"pivo"|"forcar"|"passar"}
//   prender    {turnos:[min,max]} (0 = só impede de trocar)
//   volatil    {v, alvo}   semente substituto provocar encore disable tormento foco mira bocejo aquaring enraizar maldicao pesadelo perish destino desejo
//   descansar, belly, dividirHp, copiarEstagios, trocarEstagios {stats:[...]|"todos"}, futuro {tipo,poder,turnos}

const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
export const VERSAO = 2;
const STAT = {attack: "atk", defense: "def", "special-attack": "spa", "special-defense": "spd", speed: "spe", accuracy: "prec", evasion: "eva"};
const CLASSE = {physical: "fisico", special: "especial", status: "status"};
const AILMENT = {paralysis: "paralisia", burn: "queimadura", poison: "veneno", sleep: "sono", freeze: "congelamento", confusion: "confusao"};
const VOL_AILMENT = {"leech-seed": "semente", yawn: "bocejo", nightmare: "pesadelo", torment: "tormento", disable: "disable", "perish-song": "perish", ingrain: "enraizar"};
const PROPRIO = ["user", "user-or-ally", "users-field", "user-and-allies"];
const GRAVE = ["toxic", "poison-fang"];

// ----- golpes que a PokéAPI não descreve de forma estruturada: escritos à mão -----
const V = (v, alvo = "self") => ({t: "volatil", v, alvo});
const CL = (clima) => [{t: "clima", clima, turnos: 5}];
const TE = (terreno) => [{t: "terreno", terreno, turnos: 5}];
const AR = a => [{t: "armadilha", a}];
const TL = (tela, turnos = 5) => [{t: "tela", tela, turnos}];
const PROT = (contato) => [contato ? {t: "protecao", contato} : {t: "protecao"}];
const CARGA = (extra = {}) => [{t: "carga", ...extra}];
const RECARGA = [{t: "recarga"}], FURIA = [{t: "furia"}], EXPLODIR = [{t: "explodir"}];

// SO = substitui os efeitos genéricos; EXTRA = soma aos efeitos genéricos (estágios, condições etc. já vindos da API)
const SO = {
  "rain-dance": CL("chuva"), "sunny-day": CL("sol"), sandstorm: CL("areia"), hail: CL("granizo"), snowscape: CL("neve"),
  "chilly-reception": [...CL("neve"), {t: "troca", modo: "pivo"}],
  "electric-terrain": TE("eletrico"), "grassy-terrain": TE("grama"), "misty-terrain": TE("nevoa"), "psychic-terrain": TE("psiquico"),
  "trick-room": [{t: "sala", sala: "trickroom", turnos: 5}],
  moonlight: [{t: "cura", fracao: 0.5, alvo: "self", clima: "padrao"}], "morning-sun": [{t: "cura", fracao: 0.5, alvo: "self", clima: "padrao"}],
  synthesis: [{t: "cura", fracao: 0.5, alvo: "self", clima: "padrao"}], "shore-up": [{t: "cura", fracao: 0.5, alvo: "self", clima: "areia"}],
  rest: [{t: "descansar"}], wish: [V("desejo")],
  "stealth-rock": AR("rocha"), spikes: AR("espinhos"), "toxic-spikes": AR("venenosa"), "sticky-web": AR("teia"),
  defog: [{t: "estagio", stat: "eva", n: -1, alvo: "alvo", chance: 100}, {t: "limpar", o: "armadilhas", alvo: "ambos"}, {t: "limpar", o: "telas", alvo: "alvo"}],
  reflect: TL("reflect"), "light-screen": TL("luz"), "aurora-veil": TL("veu"), safeguard: TL("protecaoStatus"), mist: TL("nevoa"), tailwind: TL("vento", 4),
  protect: PROT(), detect: PROT(), endure: [{t: "protecao", endure: true}],
  "spiky-shield": PROT({t: "dano", fracao: 0.125}), "kings-shield": PROT({t: "estagio", stat: "atk", n: -1}),
  "baneful-bunker": PROT({t: "condicao", condicao: "veneno"}), obstruct: PROT({t: "estagio", stat: "def", n: -2}),
  "silk-trap": PROT({t: "estagio", stat: "spe", n: -1}), "burning-bulwark": PROT({t: "condicao", condicao: "queimadura"}),
  substitute: [V("substituto")],
  taunt: [V("provocar", "alvo")], encore: [V("encore", "alvo")], disable: [V("disable", "alvo")], torment: [V("tormento", "alvo")],
  "focus-energy": [V("foco")], "lock-on": [V("mira")], "mind-reader": [V("mira")], yawn: [V("bocejo", "alvo")], "perish-song": [V("perish", "ambos")],
  "destiny-bond": [V("destino")], "aqua-ring": [V("aquaring")], ingrain: [V("enraizar")], curse: [V("maldicao")],
  nightmare: [V("pesadelo", "alvo")], "leech-seed": [V("semente", "alvo")],
  "mean-look": [{t: "prender", turnos: 0, alvo: "alvo"}], block: [{t: "prender", turnos: 0, alvo: "alvo"}], "spider-web": [{t: "prender", turnos: 0, alvo: "alvo"}],
  haze: [{t: "limpar", o: "estagios", alvo: "ambos"}], "psych-up": [{t: "copiarEstagios"}],
  "heart-swap": [{t: "trocarEstagios", stats: "todos"}], "power-swap": [{t: "trocarEstagios", stats: ["atk", "spa"]}], "guard-swap": [{t: "trocarEstagios", stats: ["def", "spd"]}],
  "belly-drum": [{t: "belly"}], "pain-split": [{t: "dividirHp"}],
  "heal-bell": [{t: "curarCond", equipe: true}], aromatherapy: [{t: "curarCond", equipe: true}], refresh: [{t: "curarCond"}],
  acupressure: [{t: "estagio", stat: "aleatorio", n: 2, alvo: "self", chance: 100}],
  roar: [{t: "troca", modo: "forcar"}], whirlwind: [{t: "troca", modo: "forcar"}],
  "baton-pass": [{t: "troca", modo: "passar"}], teleport: [{t: "troca", modo: "pivo"}],
  "parting-shot": [{t: "estagio", stat: "atk", n: -1, alvo: "alvo", chance: 100}, {t: "estagio", stat: "spa", n: -1, alvo: "alvo", chance: 100}, {t: "troca", modo: "pivo"}],
  memento: [{t: "estagio", stat: "atk", n: -2, alvo: "alvo", chance: 100}, {t: "estagio", stat: "spa", n: -2, alvo: "alvo", chance: 100}, ...EXPLODIR],
  // dano fixo e parecidos
  "dragon-rage": [{t: "danofixo", valor: 40}], "sonic-boom": [{t: "danofixo", valor: 20}],
  "seismic-toss": [{t: "danofixo", nivel: true}], "night-shade": [{t: "danofixo", nivel: true}],
  "super-fang": [{t: "danofixo", metade: true}], "natures-madness": [{t: "danofixo", metade: true}], ruination: [{t: "danofixo", metade: true}],
  endeavor: [{t: "danofixo", emparelhar: true}], "final-gambit": [{t: "danofixo", userHp: true}, ...EXPLODIR],
  guillotine: [{t: "danofixo", ohko: true}], "horn-drill": [{t: "danofixo", ohko: true}], fissure: [{t: "danofixo", ohko: true}], "sheer-cold": [{t: "danofixo", ohko: true}],
  counter: [{t: "danofixo", contra: "fisico", mult: 2}], "mirror-coat": [{t: "danofixo", contra: "especial", mult: 2}], "metal-burst": [{t: "danofixo", contra: "qualquer", mult: 1.5}],
  "future-sight": [{t: "futuro", tipo: "Psychic", poder: 120, turnos: 3}], "doom-desire": [{t: "futuro", tipo: "Steel", poder: 140, turnos: 3}]
};
const EXTRA = {
  "hyper-beam": RECARGA, "giga-impact": RECARGA, "blast-burn": RECARGA, "hydro-cannon": RECARGA, "frenzy-plant": RECARGA, "roar-of-time": RECARGA,
  "rock-wrecker": RECARGA, "prismatic-laser": RECARGA, eternabeam: RECARGA, "meteor-assault": RECARGA,
  "solar-beam": CARGA({sol: true}), "solar-blade": CARGA({sol: true}), "razor-wind": CARGA(), "sky-attack": CARGA(), "freeze-shock": CARGA(), "ice-burn": CARGA(),
  "skull-bash": CARGA({antes: [{t: "estagio", stat: "def", n: 1, alvo: "self", chance: 100}]}),
  "meteor-beam": CARGA({antes: [{t: "estagio", stat: "spa", n: 1, alvo: "self", chance: 100}]}),
  fly: CARGA({invul: "voo"}), bounce: CARGA({invul: "voo"}), dig: CARGA({invul: "cavar"}), dive: CARGA({invul: "mergulho"}),
  "phantom-force": CARGA({invul: "fantasma"}), "shadow-force": CARGA({invul: "fantasma"}),
  geomancy: CARGA({}), outrage: FURIA, thrash: FURIA, "petal-dance": FURIA, "raging-fury": FURIA,
  explosion: EXPLODIR, "self-destruct": EXPLODIR, "misty-explosion": EXPLODIR,
  "mind-blown": [{t: "recuo", fracao: 0.5, base: "hp"}], "steel-beam": [{t: "recuo", fracao: 0.5, base: "hp"}], chloroblast: [{t: "recuo", fracao: 0.5, base: "hp"}],
  "fake-out": [{t: "falhaSe", se: "primeiroTurno"}], "first-impression": [{t: "falhaSe", se: "primeiroTurno"}],
  "sucker-punch": [{t: "falhaSe", se: "naoAtacando"}], thunderclap: [{t: "falhaSe", se: "naoAtacando"}], "focus-punch": [{t: "falhaSe", se: "levouDano"}],
  facade: [{t: "dobrar", se: "statusUser", ignoraQueimadura: true}], venoshock: [{t: "dobrar", se: "venenoAlvo"}], hex: [{t: "dobrar", se: "statusAlvo"}],
  brine: [{t: "dobrar", se: "hpMetadeAlvo"}], payback: [{t: "dobrar", se: "agiuAntes"}], revenge: [{t: "dobrar", se: "levouDano"}],
  avalanche: [{t: "dobrar", se: "levouDano"}], acrobatics: [{t: "dobrar", se: "sempre"}],
  "stored-power": [{t: "poderPorEstagios"}], "power-trip": [{t: "poderPorEstagios"}],
  eruption: [{t: "poderPorHp"}], "water-spout": [{t: "poderPorHp"}], "dragon-energy": [{t: "poderPorHp"}],
  "weather-ball": [{t: "climaBola"}], psyshock: [{t: "defFis"}], psystrike: [{t: "defFis"}], "secret-sword": [{t: "defFis"}],
  "body-press": [{t: "usaDef"}], "foul-play": [{t: "atkAlvo"}],
  "frost-breath": [{t: "critSempre"}], "storm-throw": [{t: "critSempre"}], "wicked-blow": [{t: "critSempre"}], "surging-strikes": [{t: "critSempre"}], "flower-trick": [{t: "critSempre"}],
  "u-turn": [{t: "troca", modo: "pivo"}], "volt-switch": [{t: "troca", modo: "pivo"}], "flip-turn": [{t: "troca", modo: "pivo"}],
  "rapid-spin": [{t: "limpar", o: "armadilhas", alvo: "self"}], "mortal-spin": [{t: "limpar", o: "armadilhas", alvo: "self"}, {t: "condicao", condicao: "veneno", alvo: "alvo", chance: 100}],
  "brick-break": [{t: "limpar", o: "telas", alvo: "alvo", antes: true}], "psychic-fangs": [{t: "limpar", o: "telas", alvo: "alvo", antes: true}],
  "raging-bull": [{t: "limpar", o: "telas", alvo: "alvo", antes: true}],
  "clear-smog": [{t: "limpar", o: "estagios", alvo: "alvo"}],
  "knock-off": [], "smack-down": [], retaliate: [], judgment: [], // dano puro (sem itens, sem bônus)
  "anchor-shot": [{t: "prender", turnos: [0, 0], alvo: "alvo"}], "spirit-shackle": [{t: "prender", turnos: [0, 0], alvo: "alvo"}]
};

// ----- golpes que NÃO funcionam (e por quê). O jogo lista só golpes com suportado = true. -----
const lote = (motivo, ...ids) => Object.fromEntries(ids.map(i => [i, motivo]));
const NAO = {
  ...lote("usa itens (o jogo não tem itens)", "fling", "natural-gift", "trick", "switcheroo", "bestow", "thief", "covet", "poltergeist", "recycle", "bug-bite", "pluck", "incinerate", "teatime", "corrosive-gas", "stuff-cheeks", "belch"),
  ...lote("copia ou escolhe outro golpe", "copycat", "mimic", "metronome", "assist", "me-first", "transform", "sketch", "mirror-move", "nature-power", "sleep-talk", "snatch", "magic-coat", "instruct", "spite", "imprison", "trump-card"),
  ...lote("só existe em batalhas em dupla ou com aliados", "follow-me", "rage-powder", "ally-switch", "helping-hand", "wide-guard", "quick-guard", "mat-block", "crafty-shield", "after-you", "quash", "decorate", "coaching", "life-dew", "heal-pulse", "pollen-puff", "spotlight", "aromatic-mist", "gear-up", "magnetic-flux", "howl"),
  ...lote("depende de gênero ou habilidades", "attract", "captivate", "skill-swap", "role-play", "entrainment", "simple-beam", "worry-seed", "gastro-acid", "core-enforcer", "soak", "magic-powder", "forests-curse", "trick-or-treat", "doodle", "camouflage", "conversion", "conversion-2", "reflect-type", "burn-up", "double-shock"),
  ...lote("efeito de campo ainda sem implementação", "gravity", "magic-room", "wonder-room", "ion-deluge", "electrify", "fairy-lock", "lucky-chant", "court-change", "tidy-up", "g-max-wildfire", "rototiller", "flower-shield", "sweet-scent-field", "mud-sport", "water-sport", "grass-pledge", "fire-pledge", "water-pledge"),
  ...lote("mecânica especial ainda sem implementação", "bide", "rollout", "ice-ball", "fury-cutter", "echoed-voice", "triple-axel", "triple-kick", "last-respects", "rage-fist", "stomping-tantrum", "round", "fusion-flare", "fusion-bolt", "pursuit", "beat-up", "spit-up", "swallow", "stockpile", "present", "uproar", "sky-drop", "dream-eater", "synchronoise", "fell-stinger", "spectral-thief", "snore", "shed-tail", "healing-wish", "lunar-dance", "hidden-power", "terrain-pulse", "misty-surge", "refresh-field", "laser-focus", "me-first", "psycho-shift", "power-split", "guard-split", "speed-swap", "tar-shot", "glaive-rush", "revival-blessing", "order-up", "triple-dive", "fillet-away", "tera-blast", "tera-starstorm", "max-guard", "jaw-lock", "no-retreat", "octolock")
};

const classe = d => CLASSE[d.damage_class?.name] || "status";
const PROPRIO_ALVO = d => PROPRIO.includes(d.target?.name);

// Efeitos que a PokéAPI descreve de forma estruturada (campo "meta" e "stat_changes")
function genericos(d, motivos) {
  const ef = [], m = d.meta || {}, cat = classe(d), dano = cat !== "status";
  const catApi = m.category?.name || "";
  for (const c of d.stat_changes || []) {
    const stat = STAT[c.stat?.name]; if (!stat) { motivos.push(`atributo ${c.stat?.name}`); continue; }
    const alvo = dano ? (catApi === "damage+raise" ? "self" : "alvo") : (PROPRIO_ALVO(d) ? "self" : "alvo");
    ef.push({t: "estagio", stat, n: c.change, alvo, chance: m.stat_chance || 100});
  }
  const a = m.ailment?.name;
  if (a && a !== "none" && a !== "unknown") {
    const chance = dano ? (m.ailment_chance || 100) : 100;
    if (AILMENT[a]) ef.push({t: "condicao", condicao: a === "poison" && GRAVE.includes(d.name) ? "veneno-grave" : AILMENT[a], alvo: "alvo", chance});
    else if (a === "trap") ef.push({t: "prender", turnos: [4, 5], alvo: "alvo", chance});
    else if (VOL_AILMENT[a]) ef.push({t: "volatil", v: VOL_AILMENT[a], alvo: a === "ingrain" ? "self" : "alvo", chance});
    else motivos.push(`condição "${a}" ainda sem implementação`);
  }
  if (m.flinch_chance > 0) ef.push({t: "recuar", chance: m.flinch_chance});
  if (m.drain > 0) ef.push({t: "dreno", fracao: m.drain / 100});
  if (m.drain < 0) ef.push({t: "recuo", fracao: -m.drain / 100, base: "dano"});
  if (m.healing > 0 && !dano) {
    if (PROPRIO_ALVO(d)) ef.push({t: "cura", fracao: m.healing / 100, alvo: "self"});
    else motivos.push("cura o alvo");
  }
  if (m.crit_rate > 0) ef.push({t: "crit", n: m.crit_rate});
  if (m.max_hits > 1) ef.push({t: "multi", min: m.min_hits || m.max_hits, max: m.max_hits});
  if (catApi === "ohko") ef.push({t: "danofixo", ohko: true});
  if (catApi === "force-switch") ef.push({t: "troca", modo: "forcar"});
  return {ef, catApi};
}

// d = resposta da PokéAPI; nomePt (opcional) = nome em português já conhecido
export function converterGolpe(d) { return JSON.parse(JSON.stringify(converter(d))); }
function converter(d) {
  const cat = classe(d), motivos = [];
  const en = d.names?.find(n => n.language?.name === "en")?.name || d.name.split("-").map(cap).join(" ");
  const doc = {id: d.name, nome: en, tipo: cap(d.type?.name), cat, poder: cat === "status" ? null : (d.power ?? null),
    precisao: d.accuracy ?? null, prioridade: d.priority || 0, alvoTipo: d.target?.name || null, efeitos: [], suportado: true, motivo: null, nota: null, versao: VERSAO};
  if (NAO[d.name]) { doc.suportado = false; doc.motivo = NAO[d.name]; return doc; }
  if (cat === "status" && !SO[d.name] && ["ally", "all-allies", "selected-pokemon-me-first", "fainting-pokemon"].includes(d.target?.name)) {
    doc.suportado = false; doc.motivo = "alvo só existe em batalhas em dupla"; return doc; // golpes que miram aliados
  }
  const {ef, catApi} = SO[d.name] ? {ef: [], catApi: d.meta?.category?.name || ""} : genericos(d, motivos);
  doc.efeitos = SO[d.name] ? SO[d.name].map(e => ({...e})) : ef;
  if (EXTRA[d.name]) doc.efeitos.push(...EXTRA[d.name].map(e => ({...e})));
  if (motivos.length) { doc.suportado = false; doc.motivo = motivos[0]; return doc; }
  const temEspecial = !!(SO[d.name] || EXTRA[d.name]);
  if (cat !== "status") {
    if (!(doc.poder > 0) && !doc.efeitos.some(e => e.t === "danofixo")) { doc.suportado = false; doc.motivo = "poder variável"; return doc; }
    if (!temEspecial && ["unique", "field-effect", "whole-field-effect"].includes(catApi)) { doc.suportado = false; doc.motivo = "efeito especial ainda sem implementação"; return doc; }
  } else if (!doc.efeitos.length) {
    doc.suportado = false; doc.motivo = "efeito não descrito em formato estruturado"; return doc;
  }
  return doc;
}

export const idsNaoSuportados = () => Object.keys(NAO);
