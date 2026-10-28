// Auditoria de golpes: confere UM POR UM os golpes das listas de escolha (golpes-lista.json, gerado pelo botão do admin).
//   node teste-golpes.mjs            roda tudo
//   node teste-golpes.mjs aurora     só os golpes cujo nome contém "aurora"
// Para cada golpe: (1) converte como a PokéAPI faria e confere que ficou "suportado"; (2) confere poder/precisão/prioridade;
// (3) executa o golpe no motor e confere o efeito; (4) mede erros de precisão (precisão null = nunca erra, mesmo contra evasão +6).
// Os dados "secundários" (o que a PokéAPI descreve no campo meta) estão nas tabelas STATUS e DANO abaixo.
import fs from "fs";
import { converterGolpe } from "./conversor.js";
import * as M from "./motor.js";
const {copiaPokemon, resolverRodada, ativoDe, enviar} = M;

const LISTA = JSON.parse(fs.readFileSync(new URL("./golpes-lista.json", import.meta.url), "utf8"));
const filtro = (process.argv[2] || "").toLowerCase();
const slug = n => n.toLowerCase().replace(/['’.]/g, "").trim().replace(/\s+/g, "-");

// ---------- o que a PokéAPI diz sobre cada golpe (campo meta / stat_changes / target) ----------
// formato: "self atk+2 spa+1" | "opp def-1" | "opp slp" | "self heal50" | damage: "opp spe-1@100", "self atk-1@100", "par10", "drain50", "recoil33", "multi2-5", "crit1", "flinch30", "trap", "fswitch"
const NOME_STAT = {atk: "attack", def: "defense", spa: "special-attack", spd: "special-defense", spe: "speed", prec: "accuracy", eva: "evasion"};
const AIL = {slp: "sleep", par: "paralysis", brn: "burn", psn: "poison", tox: "poison", conf: "confusion", frz: "freeze"};
const STATUS = {
  toxic: "opp tox", "double-team": "self eva+1", swagger: "opp atk+2 conf", confide: "opp spa-1", "scary-face": "opp spe-2", "swords-dance": "self atk+2", "thunder-wave": "opp par",
  "iron-defense": "self def+2", agility: "self spe+2", "work-up": "self atk+1 spa+1", flash: "opp prec-1", "calm-mind": "self spa+1 spd+1", leer: "opp def-1", "hone-claws": "self atk+1 prec+1",
  "bulk-up": "self atk+1 def+1", screech: "opp def-2", "confuse-ray": "opp conf", "will-o-wisp": "opp brn", charm: "opp atk-2", growl: "opp atk-1", "defense-curl": "self def+1", roost: "self heal50",
  "nasty-plot": "self spa+2", "dragon-dance": "self atk+1 spe+1", "rock-polish": "self spe+2", "fake-tears": "opp spd-2", "metal-sound": "opp spd-2", amnesia: "self spd+2", "sand-attack": "opp prec-1",
  "tail-whip": "opp def-1", harden: "self def+1", recover: "self heal50", "eerie-impulse": "opp spa-2", tickle: "opp atk-1 def-1", "baby-doll-eyes": "opp atk-1", hypnosis: "opp slp",
  "sweet-scent": "opp eva-2", "feather-dance": "opp atk-2", supersonic: "opp conf", withdraw: "self def+1", "cosmic-power": "self def+1 spd+1", flatter: "opp spa+1 conf", "string-shot": "opp spe-2",
  "acid-armor": "self def+2", "noble-roar": "opp atk-1 spa-1", "poison-gas": "opp psn", sing: "opp slp", smokescreen: "opp prec-1", barrier: "self def+2", "play-nice": "opp atk-1",
  "shell-smash": "self atk+2 spa+2 spe+2 def-1 spd-1", autotomize: "self spe+2", "poison-powder": "opp psn", "stun-spore": "opp par", glare: "opp par", "sweet-kiss": "opp conf", coil: "self atk+1 def+1 prec+1",
  minimize: "self eva+2", "sleep-powder": "opp slp", "cotton-guard": "self def+3", "grass-whistle": "opp slp", meditate: "self atk+1", "quiver-dance": "self spa+1 spd+1 spe+1", "shift-gear": "self atk+1 spe+2",
  "slack-off": "self heal50", "tearful-look": "opp atk-1 spa-1", "cotton-spore": "opp spe-2", sharpen: "self atk+1", "soft-boiled": "self heal50", spore: "opp slp", "tail-glow": "self spa+3",
  "teeter-dance": "opp conf", "dark-void": "opp slp", kinesis: "opp prec-1", geomancy: "self spa+2 spd+2 spe+2",
  // golpes de status que o conversor escreve à mão (SO) mas que também têm efeito genérico simples
  "venom-drench": "opp atk-1 spa-1 spe-1", "clangorous-soul": "self atk+1 def+1 spa+1 spd+1 spe+1", charge: "self spd+1", growth: "self atk+1 spa+1"
};
const DANO = {
  thunderbolt: "par10", "ice-beam": "frz10", flamethrower: "brn10", "fire-blast": "brn10", thunder: "par30", blizzard: "frz10", "thunder-punch": "par10", "fire-punch": "brn10", "ice-punch": "frz10",
  "poison-jab": "psn30", "sludge-bomb": "psn30", "gunk-shot": "psn30", sludge: "psn30", "sludge-wave": "psn10", "poison-sting": "psn30", smog: "psn40", "poison-tail": "psn10 crit1", "cross-poison": "psn10 crit1",
  "poison-fang": "tox50", "shadow-ball": "opp spd-1@20", psychic: "opp spd-1@10", "energy-ball": "opp spd-1@10", "flash-cannon": "opp spd-1@10", "focus-blast": "opp spd-1@10", "earth-power": "opp spd-1@10",
  "bug-buzz": "opp spd-1@10", "dark-pulse": "flinch20", "iron-head": "flinch30", "zen-headbutt": "flinch20", headbutt: "flinch30", "rock-slide": "flinch30", stomp: "flinch30", bite: "flinch30",
  waterfall: "flinch20", "air-slash": "flinch30", "dragon-rush": "flinch20", twister: "flinch20", extrasensory: "flinch10", astonish: "flinch30", "icicle-crash": "flinch30", "needle-arm": "flinch30", "hyper-fang": "flinch10",
  "steel-wing": "self def+1@10", crunch: "opp def-1@20", "rock-smash": "opp def-1@50", "iron-tail": "opp def-1@30", "crush-claw": "opp def-1@50", "fire-fang": "brn10 flinch10", "ice-fang": "frz10 flinch10",
  "thunder-fang": "par10 flinch10", "bubble-beam": "opp spe-1@10", bubble: "opp spe-1@10", constrict: "opp spe-1@10", "mud-shot": "opp spe-1@100", "icy-wind": "opp spe-1@100", bulldoze: "opp spe-1@100",
  electroweb: "opp spe-1@100", "low-sweep": "opp spe-1@100", snarl: "opp spa-1@100", "struggle-bug": "opp spa-1@100", acid: "opp spd-1@10", "acid-spray": "opp spd-2@100", "aurora-beam": "opp atk-1@10",
  "play-rough": "opp atk-1@10", moonblast: "opp spa-1@30", "mystical-fire": "opp spa-1@100", "trop-kick": "opp atk-1@100", "breaking-swipe": "opp atk-1@100", lunge: "opp atk-1@100", "chilling-water": "opp atk-1@100",
  "spirit-break": "opp spa-1@100", "skitter-smack": "opp spa-1@100", "apple-acid": "opp spd-1@100", "grav-apple": "opp def-1@100", "fire-lash": "opp def-1@100", "mud-slap": "opp prec-1@100", "mirror-shot": "opp prec-1@30",
  "razor-shell": "opp def-1@50", "leaf-tornado": "opp prec-1@50", "night-daze": "opp prec-1@40", "muddy-water": "opp prec-1@30", "mud-bomb": "opp prec-1@30", pounce: "opp spe-1@100", glaciate: "opp spe-1@100",
  "flame-charge": "self spe+1@100", "power-up-punch": "self atk+1@100", "charge-beam": "self spa+1@70", trailblaze: "self spe+1@100", "meteor-mash": "self atk+1@20", "metal-claw": "self atk+1@10",
  "ancient-power": "self atk+1@10 def+1@10 spa+1@10 spd+1@10 spe+1@10", "silver-wind": "self atk+1@10 def+1@10 spa+1@10 spd+1@10 spe+1@10", "ominous-wind": "self atk+1@10 def+1@10 spa+1@10 spd+1@10 spe+1@10",
  "fiery-dance": "self spa+1@50", "torch-song": "self spa+1@100", "psycho-boost": "self spa-2@100", overheat: "self spa-2@100", "draco-meteor": "self spa-2@100", "leaf-storm": "self spa-2@100", "fleur-cannon": "self spa-2@100",
  "close-combat": "self def-1@100 spd-1@100", superpower: "self atk-1@100 def-1@100", "hammer-arm": "self spe-1@100", "v-create": "self def-1@100 spd-1@100 spe-1@100", "make-it-rain": "self spa-1@100",
  "armor-cannon": "self def-1@100 spd-1@100", "clanging-scales": "self def-1@100", "dragon-ascent": "self def-1@100 spd-1@100", "spin-out": "self spe-2@100", "ice-hammer": "self spe-1@100", "mystical-power": "self spa+1@100",
  "scale-shot": "self spe+1@100 def-1@100 multi2-5", "drain-punch": "drain50", "giga-drain": "drain50", "mega-drain": "drain50", absorb: "drain50", "leech-life": "drain50", "horn-leech": "drain50",
  "draining-kiss": "drain75", "parabolic-charge": "drain50", "bitter-blade": "drain50", "oblivion-wing": "drain75", "take-down": "recoil25", "double-edge": "recoil33", "brave-bird": "recoil33", "flare-blitz": "recoil33 brn10",
  "wild-charge": "recoil25", "wood-hammer": "recoil33", "head-smash": "recoil50", "volt-tackle": "recoil33 par10", submission: "recoil25", "wave-crash": "recoil33", "flame-wheel": "brn10", "blaze-kick": "brn10 crit1",
  "sacred-fire": "brn50", scald: "brn30", "lava-plume": "brn30", inferno: "brn100", "heat-wave": "brn10", ember: "brn10", "searing-shot": "brn30", "blue-flare": "brn20", "pyro-ball": "brn10", "powder-snow": "frz10",
  spark: "par30", discharge: "par30", "zap-cannon": "par100", nuzzle: "par100", "bolt-strike": "par20", "thunder-shock": "par10", "dynamic-punch": "conf100", hurricane: "conf30", "dizzy-punch": "conf20", confusion: "conf10",
  psybeam: "conf10", "signal-beam": "conf10", "rock-climb": "conf20", "water-pulse": "conf20", "body-slam": "par30", lick: "par30", "force-palm": "par30", "dragon-breath": "par30",
  "fire-spin": "trap", "sand-tomb": "trap", whirlpool: "trap", wrap: "trap", bind: "trap", clamp: "trap", infestation: "trap", "thunder-cage": "trap", "dragon-tail": "fswitch", "circle-throw": "fswitch",
  "double-kick": "multi2-2", "dual-chop": "multi2-2", "double-hit": "multi2-2", "dual-wingbeat": "multi2-2", bonemerang: "multi2-2", "double-iron-bash": "multi2-2 flinch30", "dragon-darts": "multi2-2", "twin-beam": "multi2-2",
  twineedle: "multi2-2 psn20", "fury-swipes": "multi2-5", "fury-attack": "multi2-5", "pin-missile": "multi2-5", "bone-rush": "multi2-5", "icicle-spear": "multi2-5", "rock-blast": "multi2-5", "bullet-seed": "multi2-5",
  "arm-thrust": "multi2-5", "spike-cannon": "multi2-5", barrage: "multi2-5", "comet-punch": "multi2-5", "double-slap": "multi2-5", "tail-slap": "multi2-5", "water-shuriken": "multi2-5",
  slash: "crit1", "razor-leaf": "crit1", "night-slash": "crit1", "stone-edge": "crit1", "shadow-claw": "crit1", "cross-chop": "crit1", "karate-chop": "crit1", crabhammer: "crit1", "leaf-blade": "crit1",
  "psycho-cut": "crit1", "air-cutter": "crit1", "spacial-rend": "crit1", aeroblast: "crit1", "drill-run": "crit1"
};
// dados do golpe como a PokéAPI entregaria
function api(g) {
  const id = slug(g.nome), cls = {fisico: "physical", especial: "special", status: "status"}[g.cat];
  const txt = (g.cat === "status" ? STATUS[id] : DANO[id]) || "";
  const meta = {ailment: {name: "none"}, category: {name: g.cat === "status" ? "net-good-stats" : "damage"}, min_hits: null, max_hits: null, min_turns: null, max_turns: null, drain: 0, healing: 0, crit_rate: 0, ailment_chance: 0, flinch_chance: 0, stat_chance: 0};
  const sc = [], o = {target: g.cat === "status" ? "selected-pokemon" : "selected-pokemon"};
  let alvo = "opp";
  for (const t of txt.split(/\s+/).filter(Boolean)) {
    let m;
    if (t === "opp" || t === "self") { alvo = t; if (t === "self" && g.cat === "status") o.target = "user"; }
    else if ((m = t.match(/^(atk|def|spa|spd|spe|prec|eva)([+-]\d)(?:@(\d+))?$/))) { sc.push({stat: {name: NOME_STAT[m[1]]}, change: +m[2]}); if (m[3]) meta.stat_chance = +m[3]; if (alvo === "self" && g.cat !== "status") meta.category = {name: "damage+raise"}; else if (g.cat !== "status") meta.category = {name: "damage+lower"}; }
    else if ((m = t.match(/^heal(\d+)$/))) { meta.healing = +m[1]; meta.category = {name: "heal"}; o.target = "user"; }
    else if ((m = t.match(/^(slp|par|brn|psn|tox|conf|frz)(\d*)$/))) { meta.ailment = {name: AIL[m[1]]}; meta.ailment_chance = m[2] ? +m[2] : 0; meta.category = {name: g.cat === "status" ? "ailment" : "damage+ailment"}; if (m[1] === "tox") api.grave = id; }
    else if ((m = t.match(/^flinch(\d+)$/))) meta.flinch_chance = +m[1];
    else if ((m = t.match(/^drain(\d+)$/))) { meta.drain = +m[1]; meta.category = {name: "damage+heal"}; }
    else if ((m = t.match(/^recoil(\d+)$/))) meta.drain = -m[1];
    else if ((m = t.match(/^multi(\d)-(\d)$/))) { meta.min_hits = +m[1]; meta.max_hits = +m[2]; }
    else if ((m = t.match(/^crit(\d)$/))) meta.crit_rate = +m[1];
    else if (t === "trap") { meta.ailment = {name: "trap"}; meta.ailment_chance = 100; meta.category = {name: "damage+ailment"}; }
    else if (t === "fswitch") meta.category = {name: "force-switch"};
    else throw new Error("tabela: não entendi '" + t + "' em " + id);
  }
  return {name: id, names: [{language: {name: "en"}, name: g.nome}], type: {name: g.tipo.toLowerCase()}, damage_class: {name: cls}, power: g.poder, accuracy: g.precisao, priority: g.prioridade,
    target: {name: o.target}, meta, stat_changes: sc};
}
const TIPO_DOC = g => g.tipo;

// ---------- documentos ----------
const DOCS = {}, porId = {}, mapa = {};
for (const g of LISTA) { const id = slug(g.nome); const d = converterGolpe(api(g)); DOCS[id] = d; if (d.suportado) { porId[id] = d; mapa[d.nome] = d; } }
// "tackle" e "withdraw" precisam existir para os cenários
for (const id of ["tackle", "focus-energy", "quick-attack"]) if (!porId[id]) throw new Error("falta " + id);

let falhas = 0, avisos = 0; const problemas = [];
const bad = (id, msg) => { falhas++; problemas.push(`✗ ${id}: ${msg}`); };

// ---------- ferramentas ----------
const pk = (nome, tipos, ids, spe = 100, extra = {}) => copiaPokemon({id: nome, nome, tipos, hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe, mv: ids.map(n => { const d = porId[n] || DOCS[n]; if (!d) throw new Error("golpe de teste inexistente: " + n); return {nome: d.nome, tipo: d.tipo, cat: d.cat, poder: d.poder, precisao: d.precisao, prioridade: d.prioridade}; }), ...extra}, mapa);
const sala = (e1, e2) => ({fase: "batalha", rodada: 1, j: {"1": {equipe: e1, ativo: 0}, "2": {equipe: e2, ativo: 0}}, escolhas: {"1": null, "2": null}, log: []});
const idx = (s, k, id) => ativoDe(s.j[k]).mv.findIndex(m => m.id === id);
const golpe = (s, k, id) => { const i = idx(s, k, id); if (i < 0) throw new Error("golpe " + id + " não está na lista do J" + k); return {tipo: "golpe", idx: i}; };
const rodada = (s, a, b) => { s.escolhas = {"1": a, "2": b}; s.log = []; resolverRodada(s); return s.log.join("\n"); };
const NEUTRO = ["???"]; // sem fraquezas, sem imunidades, sem STAB
// monta um cenário padrão: A (J1, rápido) usa o golpe; D (J2, lento, bastante HP) fica parado usando Withdraw (ou o golpe indicado em opp)
function cena(id, o = {}) {
  const A = pk("Atacante", o.tiposA || NEUTRO, [id, ...(o.extraA || []), "tackle"], o.speA ?? 200, o.extraPkA), D = pk("Alvo", o.tiposD || NEUTRO, ["focus-energy", ...(o.opp && o.opp !== "tackle" ? [o.opp] : []), "tackle"], o.speD ?? 50, {hp: 255, def: 150, spd: 150, ...(o.extraPkD || {})});
  const eqA = [A, ...(o.bancoA ? [pk("ReservaA", NEUTRO, ["tackle"])] : [])], eqD = [D, ...(o.bancoD ? [pk("ReservaD", NEUTRO, ["tackle"])] : [])];
  const s = sala(eqA, eqD);
  if (!o.precisao) A.mv.find(m => m.id === id).precisao = null; // cenário determinístico: nunca erra (a precisão tem teste próprio)
  if (o.opp) D.mv.find(m => m.id === o.opp).precisao = null;
  return {s, A, D};
}
const alvoIdle = s => golpe(s, "2", "focus-energy");

// ---------- 1. conversão: tudo que está nas listas precisa ser "suportado" ----------
const lista = LISTA.filter(g => !filtro || g.nome.toLowerCase().includes(filtro));
for (const g of lista) {
  const id = slug(g.nome), d = DOCS[id];
  if (!d.suportado) { bad(id, `NÃO SUPORTADO: ${d.motivo}`); continue; }
  if ((d.poder ?? null) !== (g.cat === "status" ? null : g.poder) && !d.efeitos.some(e => e.t === "danofixo")) bad(id, `poder ${d.poder} ≠ ${g.poder}`);
  if ((d.precisao ?? null) !== (g.precisao ?? null)) bad(id, `precisão ${d.precisao} ≠ ${g.precisao}`);
  if ((d.prioridade || 0) !== (g.prioridade || 0)) bad(id, `prioridade ${d.prioridade} ≠ ${g.prioridade}`);
  if (g.cat === "status" && !d.efeitos.length) bad(id, "golpe de status sem nenhum efeito");
}

// ---------- 2. verificações específicas (golpes escritos à mão e mecânicas especiais) ----------
const VER = {}; // id -> () => string|null (null = ok)
const T = (id, fn) => { VER[id] = fn; };
const hpPct = (P, f) => { P.hpAtual = Math.max(1, Math.floor(P.hp * f)); };
const dano = P => P.hp - P.hpAtual;

// clima, terreno, salas
for (const [id, cl] of [["rain-dance", "chuva"], ["sunny-day", "sol"], ["sandstorm", "areia"], ["hail", "granizo"], ["snowscape", "neve"]])
  T(id, () => { const {s} = cena(id); rodada(s, golpe(s, "1", id), alvoIdle(s)); return s.campo?.clima?.t === cl ? null : "clima não mudou para " + cl; });
for (const [id, te] of [["electric-terrain", "eletrico"], ["grassy-terrain", "grama"], ["misty-terrain", "nevoa"], ["psychic-terrain", "psiquico"]])
  T(id, () => { const {s} = cena(id); rodada(s, golpe(s, "1", id), alvoIdle(s)); return s.campo?.terreno?.t === te ? null : "terreno não mudou"; });
T("trick-room", () => { const {s} = cena("trick-room"); rodada(s, golpe(s, "1", "trick-room"), alvoIdle(s)); return s.campo.sala > 0 ? null : "sala não ativou"; });
T("chilly-reception", () => null);
// telas
for (const [id, tela] of [["reflect", "reflect"], ["light-screen", "luz"], ["safeguard", "protecaoStatus"], ["mist", "nevoa"], ["tailwind", "vento"]])
  T(id, () => { const {s} = cena(id); rodada(s, golpe(s, "1", id), alvoIdle(s)); return s.j["1"].lado?.[tela] > 0 ? null : "tela não subiu"; });
T("aurora-veil", () => {
  { const {s} = cena("aurora-veil"); const log = rodada(s, golpe(s, "1", "aurora-veil"), alvoIdle(s)); if (s.j["1"].lado?.veu > 0) return "subiu sem granizo/neve"; if (!/Granizo ou Neve/.test(log)) return "falhou sem explicar o motivo"; }
  for (const cl of ["granizo", "neve"]) { const {s} = cena("aurora-veil"); s.campo = {clima: {t: cl, n: 5}, terreno: null, sala: 0}; const log = rodada(s, golpe(s, "1", "aurora-veil"), alvoIdle(s)); if (!(s.j["1"].lado?.veu > 0)) return `não subiu com ${cl}: ${log}`; }
  { // reduz dano físico e especial: o mesmo golpe, com e sem o véu, num cenário idêntico (médias de várias rodadas)
    const med = (veu, id) => { let t = 0; const N = 150; for (let i = 0; i < N; i++) { const x = cena("aurora-veil", {opp: id, speD: 10, tiposA: ["Ice"]}); x.s.campo = {clima: {t: "granizo", n: 5}, terreno: null, sala: 0}; M.entrarEmCampo(x.s, "1", []); M.entrarEmCampo(x.s, "2", []);
      if (veu) x.s.j["1"].lado.veu = 5; x.A.hpAtual = x.A.hp; x.s.escolhas = {"1": golpe(x.s, "1", "tackle"), "2": golpe(x.s, "2", id)}; resolverRodada(x.s); t += x.A.hp - x.A.hpAtual; } return t / N; };
    for (const id of ["tackle", "swift"]) { const sem = med(false, id), com = med(true, id); if (!(com < sem * 0.6 && com > sem * 0.4)) return `Aurora Veil não corta o dano de ${id} pela metade (com ${com.toFixed(1)} × sem ${sem.toFixed(1)})`; }
  }
  return null;
});
// armadilhas
for (const [id, k] of [["stealth-rock", "rocha"], ["spikes", "espinhos"], ["toxic-spikes", "venenosa"], ["sticky-web", "teia"]])
  T(id, () => { const {s} = cena(id); rodada(s, golpe(s, "1", id), alvoIdle(s)); return s.j["2"].lado?.[k] ? null : "não ficou no lado adversário"; });
T("defog", () => { const {s} = cena("defog"); s.j["1"].lado = {rocha: true, espinhos: 2, venenosa: 0, teia: false, reflect: 0, luz: 0, veu: 0, vento: 0, protecaoStatus: 0, nevoa: 0}; s.j["2"].lado = {rocha: true, espinhos: 0, venenosa: 0, teia: false, reflect: 5, luz: 0, veu: 0, vento: 0, protecaoStatus: 0, nevoa: 0};
  rodada(s, golpe(s, "1", "defog"), alvoIdle(s)); const a = s.j["1"].lado, b = s.j["2"].lado; return !a.rocha && !a.espinhos && !b.rocha && !b.reflect && ativoDe(s.j["2"]).est.eva === -1 ? null : "não limpou tudo / não baixou a evasão"; });
// proteção
for (const id of ["protect", "detect", "kings-shield", "spiky-shield", "baneful-bunker"])
  T(id, () => { const c = cena(id, {opp: "tackle", speD: 50}); const hp = c.A.hpAtual; const log = rodada(c.s, golpe(c.s, "1", id), golpe(c.s, "2", "tackle")); return c.A.hpAtual === hp && /protegeu/.test(log) ? null : "não bloqueou o golpe: " + log; });
T("endure", () => { const c = cena("endure", {opp: "tackle"}); c.A.hpAtual = 3; rodada(c.s, golpe(c.s, "1", "endure"), golpe(c.s, "2", "tackle")); return c.A.hpAtual === 1 ? null : "não sobreviveu com 1 HP (" + c.A.hpAtual + ")"; });
T("rest", () => { const c = cena("rest"); hpPct(c.A, 0.3); rodada(c.s, golpe(c.s, "1", "rest"), alvoIdle(c.s)); return c.A.hpAtual === c.A.hp && c.A.cond === "sono" ? null : "não curou tudo e dormiu"; });
T("substitute", () => { const c = cena("substitute"); rodada(c.s, golpe(c.s, "1", "substitute"), alvoIdle(c.s)); return c.A.vol.subst > 0 && c.A.hpAtual === c.A.hp - Math.floor(c.A.hp / 4) ? null : "substituto não criado"; });
T("curse", () => { const c = cena("curse"); rodada(c.s, golpe(c.s, "1", "curse"), alvoIdle(c.s)); return c.A.est.atk === 1 && c.A.est.def === 1 && c.A.est.spe === -1 ? null : "estágios errados"; });
// voláteis no alvo
const volAlvo = (id, chave, pre) => T(id, () => { const c = cena(id, {opp: "tackle", speD: 50}); if (pre) pre(c); const log = rodada(c.s, golpe(c.s, "1", id), golpe(c.s, "2", "tackle")); return c.D.vol[chave] ? null : `D.vol.${chave} não foi criado: ${log}`; });
volAlvo("taunt", "provocar"); volAlvo("torment", "tormento"); volAlvo("yawn", "bocejo"); volAlvo("leech-seed", "semente"); volAlvo("nightmare", "pesadelo", c => { c.D.cond = "sono"; c.D.sonoRest = 3; });
volAlvo("salt-cure", "salgado");
for (const id of ["encore", "disable"]) T(id, () => { const c = cena(id, {opp: "tackle", speD: 50}); rodada(c.s, golpe(c.s, "1", "tackle"), golpe(c.s, "2", "tackle")); rodada(c.s, golpe(c.s, "1", id), golpe(c.s, "2", "tackle")); return c.D.vol[id] ? null : "não prendeu o último golpe"; });
for (const id of ["mean-look", "block", "spider-web"]) T(id, () => { const c = cena(id, {bancoD: true}); rodada(c.s, golpe(c.s, "1", id), alvoIdle(c.s)); return c.D.vol.naoFugir || c.D.vol.preso > 0 ? null : "alvo ainda pode sair"; });
for (const [id, v] of [["focus-energy", "foco"], ["lock-on", "mira"], ["mind-reader", "mira"], ["destiny-bond", "destino"], ["aqua-ring", "aquaring"], ["ingrain", "enraizado"]])
  T(id, () => { const c = cena(id); rodada(c.s, golpe(c.s, "1", id), alvoIdle(c.s)); return c.A.vol[v] ? null : `A.vol.${v} não foi criado`; });
T("perish-song", () => { const c = cena("perish-song"); rodada(c.s, golpe(c.s, "1", "perish-song"), alvoIdle(c.s)); return c.A.vol.perish > 0 && c.D.vol.perish > 0 ? null : "não marcou os dois"; });
T("wish", () => { const c = cena("wish"); rodada(c.s, golpe(c.s, "1", "wish"), alvoIdle(c.s)); return c.s.j["1"].lado?.desejo ? null : "desejo não criado"; });
// cura
for (const id of ["synthesis", "morning-sun", "moonlight"]) T(id, () => { const c = cena(id); hpPct(c.A, 0.2); const h = c.A.hpAtual; rodada(c.s, golpe(c.s, "1", id), alvoIdle(c.s)); return c.A.hpAtual - h === Math.floor(c.A.hp / 2) ? null : "cura " + (c.A.hpAtual - h); });
for (const id of ["heal-bell", "aromatherapy"]) T(id, () => { const c = cena(id, {bancoA: true}); c.A.cond = "queimadura"; c.s.j["1"].equipe[1].cond = "paralisia"; rodada(c.s, golpe(c.s, "1", id), alvoIdle(c.s)); return !c.A.cond && !c.s.j["1"].equipe[1].cond ? null : "não curou a equipe"; });
T("refresh", () => { const c = cena("refresh"); c.A.cond = "queimadura"; rodada(c.s, golpe(c.s, "1", "refresh"), alvoIdle(c.s)); return !c.A.cond ? null : "não curou"; });
T("belly-drum", () => { const c = cena("belly-drum"); rodada(c.s, golpe(c.s, "1", "belly-drum"), alvoIdle(c.s)); return c.A.est.atk === 6 && c.A.hpAtual === c.A.hp - Math.floor(c.A.hp / 2) ? null : "atk " + c.A.est.atk + " hp " + c.A.hpAtual; });
T("pain-split", () => { const c = cena("pain-split"); hpPct(c.A, 0.2); const m = Math.floor((c.A.hpAtual + c.D.hpAtual) / 2); rodada(c.s, golpe(c.s, "1", "pain-split"), alvoIdle(c.s)); return c.A.hpAtual === Math.min(c.A.hp, m) && c.D.hpAtual === Math.min(c.D.hp, m) ? null : "HP não dividido"; });
T("haze", () => { const c = cena("haze"); c.A.est.atk = 3; c.D.est.def = -2; rodada(c.s, golpe(c.s, "1", "haze"), alvoIdle(c.s)); return c.A.est.atk === 0 && c.D.est.def === 0 ? null : "estágios não zerados"; });
T("psych-up", () => { const c = cena("psych-up"); c.D.est.atk = 2; rodada(c.s, golpe(c.s, "1", "psych-up"), alvoIdle(c.s)); return c.A.est.atk === 2 ? null : "não copiou"; });
T("heart-swap", () => { const c = cena("heart-swap"); c.A.est.atk = 2; c.D.est.def = 3; rodada(c.s, golpe(c.s, "1", "heart-swap"), alvoIdle(c.s)); return c.A.est.def === 3 && c.D.est.atk === 2 ? null : "não trocou"; });
T("power-swap", () => { const c = cena("power-swap"); c.A.est.atk = 2; c.D.est.spa = 3; rodada(c.s, golpe(c.s, "1", "power-swap"), alvoIdle(c.s)); return c.A.est.spa === 3 && c.D.est.atk === 2 ? null : "não trocou"; });
T("guard-swap", () => { const c = cena("guard-swap"); c.A.est.def = 2; c.D.est.spd = 3; rodada(c.s, golpe(c.s, "1", "guard-swap"), alvoIdle(c.s)); return c.A.est.spd === 3 && c.D.est.def === 2 ? null : "não trocou"; });
T("acupressure", () => { const c = cena("acupressure"); rodada(c.s, golpe(c.s, "1", "acupressure"), alvoIdle(c.s)); return Object.values(c.A.est).some(v => v === 2) ? null : "nenhum atributo subiu"; });
// trocas
for (const id of ["baton-pass", "teleport"]) T(id, () => { const c = cena(id, {bancoA: true}); c.A.est.atk = 2; rodada(c.s, golpe(c.s, "1", id), alvoIdle(c.s)); return c.s.j["1"].pivo ? null : "não pediu troca"; });
for (const id of ["roar", "whirlwind"]) T(id, () => { const c = cena(id, {bancoD: true}); rodada(c.s, golpe(c.s, "1", id), alvoIdle(c.s)); return c.s.j["2"].ativo === 1 ? null : "não forçou a troca"; });
T("memento", () => { const c = cena("memento"); rodada(c.s, golpe(c.s, "1", "memento"), alvoIdle(c.s)); return c.A.hpAtual === 0 && c.D.est.atk === -2 && c.D.est.spa === -2 ? null : "memento errado"; });
T("parting-shot", () => { const c = cena("parting-shot", {bancoA: true}); rodada(c.s, golpe(c.s, "1", "parting-shot"), alvoIdle(c.s)); return c.D.est.atk === -1 && c.D.est.spa === -1 && c.s.j["1"].pivo ? null : "efeito errado"; });
T("future-sight", () => { const c = cena("future-sight"); rodada(c.s, golpe(c.s, "1", "future-sight"), alvoIdle(c.s)); if (c.D.hpAtual !== c.D.hp || !c.s.j["2"].lado?.futuro) return "deveria agendar sem dano"; for (let i = 0; i < 2; i++) rodada(c.s, golpe(c.s, "1", "tackle"), alvoIdle(c.s)); return c.s.j["2"].lado.futuro === null ? null : "o ataque futuro nunca chegou"; });
T("doom-desire", () => { const c = cena("doom-desire"); rodada(c.s, golpe(c.s, "1", "doom-desire"), alvoIdle(c.s)); if (!c.s.j["2"].lado?.futuro) return "não agendou"; for (let i = 0; i < 2; i++) rodada(c.s, golpe(c.s, "1", "tackle"), alvoIdle(c.s)); return c.s.j["2"].lado.futuro === null ? null : "nunca chegou"; });
// dano fixo
const fixo = (id, esperado, pre) => T(id, () => { const c = cena(id); if (pre) pre(c); const h = c.D.hpAtual; rodada(c.s, golpe(c.s, "1", id), alvoIdle(c.s)); const d = h - c.D.hpAtual; const e = typeof esperado === "function" ? esperado(c, h) : esperado; return d === e ? null : `dano ${d}, esperado ${e}`; });
fixo("dragon-rage", 40); fixo("sonic-boom", 20); fixo("seismic-toss", 50); fixo("night-shade", 50);
fixo("super-fang", (c, h) => Math.floor(h / 2)); fixo("natures-madness", (c, h) => Math.floor(h / 2)); fixo("ruination", (c, h) => Math.floor(h / 2));
fixo("endeavor", (c, h) => h - c.A.hpAtual, c => hpPct(c.A, 0.3)); fixo("final-gambit", (c, h) => c.vida, c => { hpPct(c.A, 0.3); c.vida = c.A.hpAtual; });
for (const id of ["guillotine", "horn-drill", "fissure", "sheer-cold"]) fixo(id, (c, h) => h);
for (const [id, cat] of [["counter", "fisico"], ["mirror-coat", "especial"], ["metal-burst", "fisico"], ["comeuppance", "fisico"]])
  T(id, () => { const c = cena(id, {opp: "tackle", speD: 250, speA: 100}); if (cat === "especial") { const sp = pk("S", NEUTRO, ["swift"], 250); c.s.j["2"].equipe[0] = sp; c.D = sp; }
    const alvoGolpe = cat === "especial" ? "swift" : "tackle"; const h = c.s.j["2"].equipe[0].hpAtual; const h0 = c.A.hpAtual;
    rodada(c.s, golpe(c.s, "1", id), golpe(c.s, "2", alvoGolpe)); const levou = h0 - c.A.hpAtual, devolveu = h - c.s.j["2"].equipe[0].hpAtual;
    const mult = id === "metal-burst" || id === "comeuppance" ? 1.5 : 2; return devolveu === Math.floor(levou * mult) && levou > 0 ? null : `levou ${levou}, devolveu ${devolveu}`; });
// golpes com requisito
T("dream-eater", () => { const c = cena("dream-eater"); const log = rodada(c.s, golpe(c.s, "1", "dream-eater"), alvoIdle(c.s)); if (c.D.hpAtual !== c.D.hp) return "bateu em alvo acordado";
  const d = cena("dream-eater"); d.D.cond = "sono"; d.D.sonoRest = 3; hpPct(d.A, 0.3); const h = d.A.hpAtual; rodada(d.s, golpe(d.s, "1", "dream-eater"), alvoIdle(d.s)); return dano(d.D) > 0 && d.A.hpAtual > h ? null : "não bateu/drenou no alvo dormindo"; });
T("poltergeist", () => { const c = cena("poltergeist"); rodada(c.s, golpe(c.s, "1", "poltergeist"), alvoIdle(c.s)); if (c.D.hpAtual !== c.D.hp) return "bateu em alvo sem item";
  const d = cena("poltergeist", {extraPkD: {item: {id: "leftovers", nome: "Leftovers"}}}); rodada(d.s, golpe(d.s, "1", "poltergeist"), alvoIdle(d.s)); return d.D.hpAtual < d.D.hp ? null : "não bateu em alvo com item"; });
T("belch", () => { const c = cena("belch"); rodada(c.s, golpe(c.s, "1", "belch"), alvoIdle(c.s)); if (c.D.hpAtual !== c.D.hp) return "usou sem ter comido baga";
  const d = cena("belch"); d.A.comeuBaga = true; rodada(d.s, golpe(d.s, "1", "belch"), alvoIdle(d.s)); return d.D.hpAtual < d.D.hp ? null : "não funcionou depois de comer baga"; });
T("burn-up", () => { const c = cena("burn-up"); rodada(c.s, golpe(c.s, "1", "burn-up"), alvoIdle(c.s)); if (c.D.hpAtual !== c.D.hp) return "bateu sem ser Fire";
  const d = cena("burn-up", {tiposA: ["Fire", "Flying"]}); rodada(d.s, golpe(d.s, "1", "burn-up"), alvoIdle(d.s)); return d.D.hpAtual < d.D.hp && !d.A.tipos.includes("Fire") && d.A.tipos.includes("Flying") ? null : "não bateu/não perdeu o tipo Fire: " + d.A.tipos; });
T("synchronoise", () => { const c = cena("synchronoise", {tiposA: ["Fire"], tiposD: ["Water"]}); rodada(c.s, golpe(c.s, "1", "synchronoise"), alvoIdle(c.s)); if (c.D.hpAtual !== c.D.hp) return "bateu sem dividir tipo";
  const d = cena("synchronoise", {tiposA: ["Fire", "Psychic"], tiposD: ["Water", "Psychic"]}); rodada(d.s, golpe(d.s, "1", "synchronoise"), alvoIdle(d.s)); return d.D.hpAtual < d.D.hp ? null : "não bateu com tipo em comum"; });
T("glaive-rush", () => { const c = cena("glaive-rush", {opp: "tackle", speD: 50}); rodada(c.s, golpe(c.s, "1", "glaive-rush"), golpe(c.s, "2", "tackle")); if (!c.A.vol.glaive) return "não ficou exposto";
  const hp = c.A.hpAtual; rodada(c.s, golpe(c.s, "1", "tackle"), golpe(c.s, "2", "tackle")); return c.A.vol.glaive === false ? null : "continua exposto depois de agir"; });
T("round", () => null); T("core-enforcer", () => null);
T("last-resort", () => { const c = cena("last-resort"); rodada(c.s, golpe(c.s, "1", "last-resort"), alvoIdle(c.s)); if (c.D.hpAtual !== c.D.hp) return "funcionou sem usar os outros golpes";
  const d = cena("last-resort"); d.A.mv.forEach((m, i) => { if (m.id !== "last-resort") d.A.vol.usados = [...(d.A.vol.usados || []), i]; }); rodada(d.s, golpe(d.s, "1", "last-resort"), alvoIdle(d.s)); return d.D.hpAtual < d.D.hp ? null : "não funcionou depois dos outros"; });
T("false-swipe", () => { const c = cena("false-swipe"); c.D.hpAtual = 5; rodada(c.s, golpe(c.s, "1", "false-swipe"), alvoIdle(c.s)); return c.D.hpAtual === 1 ? null : "deixou " + c.D.hpAtual; });
T("assurance", () => { let a = 0, b = 0; for (let i = 0; i < 25; i++) { const p = cena("assurance"); const h = p.D.hpAtual; rodada(p.s, golpe(p.s, "1", "assurance"), alvoIdle(p.s)); a += h - p.D.hpAtual;
    const q = cena("assurance", {opp: "double-edge", speD: 300}); q.D.mv.find(m => m.id === "double-edge").precisao = null; const h2 = q.D.hpAtual; rodada(q.s, golpe(q.s, "1", "assurance"), golpe(q.s, "2", "double-edge")); b += +(q.s.log.join("\n").match(/usou Assurance[^\n]*?: (\d+) de dano/)?.[1] || 0); } return b > a * 1.6 ? null : `não dobrou (${a} → ${b})`; });
for (const [id, cond] of [["smelling-salts", "paralisia"], ["wake-up-slap", "sono"]]) T(id, () => { let a = 0, b = 0, curou = true;
  for (let i = 0; i < 20; i++) { const p = cena(id); const h = p.D.hpAtual; rodada(p.s, golpe(p.s, "1", id), alvoIdle(p.s)); a += h - p.D.hpAtual;
    const q = cena(id); q.D.cond = cond; q.D.sonoRest = 3; const h2 = q.D.hpAtual; rodada(q.s, golpe(q.s, "1", id), alvoIdle(q.s)); b += h2 - q.D.hpAtual; if (q.D.cond) curou = false; }
  return b > a * 1.6 && curou ? null : `dobrar/curar falhou (${a} → ${b}, curou ${curou})`; });
T("sparkling-aria", () => { const c = cena("sparkling-aria"); c.D.cond = "queimadura"; rodada(c.s, golpe(c.s, "1", "sparkling-aria"), alvoIdle(c.s)); return !c.D.cond ? null : "não curou a queimadura"; });
T("upper-hand", () => { const c = cena("upper-hand"); rodada(c.s, golpe(c.s, "1", "upper-hand"), alvoIdle(c.s)); if (c.D.hpAtual !== c.D.hp) return "funcionou sem o alvo usar golpe de prioridade";
  const d = cena("upper-hand", {opp: "quick-attack"}); rodada(d.s, golpe(d.s, "1", "upper-hand"), golpe(d.s, "2", "quick-attack")); return d.D.hpAtual < d.D.hp ? null : "não funcionou contra Quick Attack"; });
T("shell-trap", () => { const c = cena("shell-trap"); rodada(c.s, golpe(c.s, "1", "shell-trap"), alvoIdle(c.s)); if (c.D.hpAtual !== c.D.hp) return "funcionou sem apanhar";
  const d = cena("shell-trap", {opp: "tackle", speD: 300}); rodada(d.s, golpe(d.s, "1", "shell-trap"), golpe(d.s, "2", "tackle")); return d.D.hpAtual < d.D.hp ? null : "não funcionou depois de apanhar de um golpe físico"; });
T("gigaton-hammer", () => { const c = cena("gigaton-hammer"); rodada(c.s, golpe(c.s, "1", "gigaton-hammer"), alvoIdle(c.s)); const h = c.D.hpAtual; rodada(c.s, golpe(c.s, "1", "gigaton-hammer"), alvoIdle(c.s)); return c.D.hpAtual === h ? null : "usou duas vezes seguidas"; });
for (const id of ["bolt-beak", "fishious-rend"]) T(id, () => { let a = 0, b = 0; for (let i = 0; i < 20; i++) { const p = cena(id); const h = p.D.hpAtual; rodada(p.s, golpe(p.s, "1", id), alvoIdle(p.s)); a += h - p.D.hpAtual; const q = cena(id, {opp: "tackle", speD: 300}); const h2 = q.D.hpAtual; rodada(q.s, golpe(q.s, "1", id), golpe(q.s, "2", "tackle")); b += h2 - q.D.hpAtual; } return a > b * 1.6 ? null : `não dobrou quando age antes (${a} × ${b})`; });
for (const id of ["collision-course", "electro-drift"]) T(id, () => { let a = 0, b = 0; for (let i = 0; i < 20; i++) { const p = cena(id); const q = cena(id, {tiposD: [id === "collision-course" ? "Normal" : "Water"]}); const h = p.D.hpAtual, h2 = q.D.hpAtual; rodada(p.s, golpe(p.s, "1", id), alvoIdle(p.s)); rodada(q.s, golpe(q.s, "1", id), alvoIdle(q.s)); a += h - p.D.hpAtual; b += h2 - q.D.hpAtual; } return b > a * 2.4 ? null : `super efetivo sem o bônus (${a} → ${b})`; });
T("fickle-beam", () => { let max = 0, min = 1e9; for (let i = 0; i < 60; i++) { const c = cena("fickle-beam"); rodada(c.s, golpe(c.s, "1", "fickle-beam"), alvoIdle(c.s)); max = Math.max(max, dano(c.D)); min = Math.min(min, dano(c.D)); } return max > min * 1.7 ? null : "nunca dobrou o poder"; });
T("lash-out", () => { const c = cena("lash-out"); const d = cena("lash-out"); d.A.est.atk = -1; let a = 0, b = 0; for (let i = 0; i < 20; i++) { const p = cena("lash-out"); rodada(p.s, golpe(p.s, "1", "lash-out"), alvoIdle(p.s)); a += dano(p.D); const q = cena("lash-out"); q.A.est.def = -1; rodada(q.s, golpe(q.s, "1", "lash-out"), alvoIdle(q.s)); b += dano(q.D); } return b > a * 1.6 ? null : `não dobrou (${a} → ${b})`; });
T("tri-attack", () => { const vistos = new Set(); for (let i = 0; i < 400; i++) { const c = cena("tri-attack"); rodada(c.s, golpe(c.s, "1", "tri-attack"), alvoIdle(c.s)); if (c.D.cond) vistos.add(c.D.cond); } return vistos.size === 3 ? null : "condições vistas: " + [...vistos]; });
T("dire-claw", () => { const vistos = new Set(); for (let i = 0; i < 300; i++) { const c = cena("dire-claw"); rodada(c.s, golpe(c.s, "1", "dire-claw"), alvoIdle(c.s)); if (c.D.cond) vistos.add(c.D.cond); } return vistos.size === 3 ? null : "condições vistas: " + [...vistos]; });
T("secret-power", () => { let n = 0; for (let i = 0; i < 300; i++) { const c = cena("secret-power"); rodada(c.s, golpe(c.s, "1", "secret-power"), alvoIdle(c.s)); if (c.D.cond === "paralisia") n++; } return n > 50 && n < 130 ? null : "paralisia em " + n + "/300"; });
T("burning-jealousy", () => { const c = cena("burning-jealousy"); rodada(c.s, golpe(c.s, "1", "burning-jealousy"), alvoIdle(c.s)); if (c.D.cond) return "queimou sem atributos elevados"; const d = cena("burning-jealousy"); d.D.est.atk = 2; rodada(d.s, golpe(d.s, "1", "burning-jealousy"), alvoIdle(d.s)); return d.D.cond === "queimadura" ? null : "não queimou alvo elevado"; });
T("alluring-voice", () => { const c = cena("alluring-voice"); rodada(c.s, golpe(c.s, "1", "alluring-voice"), alvoIdle(c.s)); if (c.D.conf > 0) return "confundiu sem atributos elevados"; const d = cena("alluring-voice"); d.D.est.atk = 2; rodada(d.s, golpe(d.s, "1", "alluring-voice"), alvoIdle(d.s)); return d.D.conf > 0 ? null : "não confundiu alvo elevado"; });
T("flying-press", () => { let x = 0, y = 0, z = 0; for (let i = 0; i < 20; i++) { const c = cena("flying-press", {tiposD: ["Bug"]}), d = cena("flying-press", {tiposD: ["Normal"]}), e = cena("flying-press", {tiposD: ["Ghost"]}); rodada(c.s, golpe(c.s, "1", "flying-press"), alvoIdle(c.s)); rodada(d.s, golpe(d.s, "1", "flying-press"), alvoIdle(d.s)); rodada(e.s, golpe(e.s, "1", "flying-press"), alvoIdle(e.s)); x += dano(c.D); y += dano(d.D); z += dano(e.D); }
  return z === 0 && x > y * 0.4 && x < y * 0.6 ? null : `Bug deveria levar x1 (Fighting x0.5 × Flying x2) e Normal x2: ${x} × ${y}; Ghost imune: ${z}`; });
T("geomancy", () => { const c = cena("geomancy"); rodada(c.s, golpe(c.s, "1", "geomancy"), alvoIdle(c.s)); if (c.A.est.spa !== 0) return "subiu antes da hora"; rodada(c.s, golpe(c.s, "1", "geomancy"), alvoIdle(c.s)); return c.A.est.spa === 2 && c.A.est.spd === 2 && c.A.est.spe === 2 ? null : "estágios do turno 2 errados"; });
T("freeze-dry", () => { const c = cena("freeze-dry", {tiposD: ["Water"]}); const d = cena("freeze-dry", {tiposD: ["Normal"]}); rodada(c.s, golpe(c.s, "1", "freeze-dry"), alvoIdle(c.s)); rodada(d.s, golpe(d.s, "1", "freeze-dry"), alvoIdle(d.s)); return dano(c.D) > dano(d.D) * 1.7 ? null : `Water deveria levar x2 (${dano(c.D)} × ${dano(d.D)})`; });
for (const id of ["chip-away", "sacred-sword", "darkest-lariat"]) T(id, () => { let a = 0, b = 0; for (let i = 0; i < 20; i++) { const p = cena(id); p.D.est.def = 4; rodada(p.s, golpe(p.s, "1", id), alvoIdle(p.s)); a += dano(p.D); const q = cena(id); rodada(q.s, golpe(q.s, "1", id), alvoIdle(q.s)); b += dano(q.D); } return a >= b * 0.9 ? null : `não ignorou a Defesa +4 (${a} × ${b})`; });
T("photon-geyser", () => { const c = cena("photon-geyser", {extraPkA: {atk: 400, spa: 50}}); const d = cena("photon-geyser", {extraPkA: {atk: 50, spa: 400}}); rodada(c.s, golpe(c.s, "1", "photon-geyser"), alvoIdle(c.s)); rodada(d.s, golpe(d.s, "1", "photon-geyser"), alvoIdle(d.s)); return dano(c.D) > 0 && Math.abs(dano(c.D) - dano(d.D)) < dano(c.D) * 0.5 ? null : `usa o atributo errado (${dano(c.D)} × ${dano(d.D)})`; });
T("thousand-arrows", () => { const c = cena("thousand-arrows", {tiposD: ["Flying"]}); rodada(c.s, golpe(c.s, "1", "thousand-arrows"), alvoIdle(c.s)); return c.D.hpAtual < c.D.hp ? null : "não acerta voador"; });
T("steel-roller", () => { const c = cena("steel-roller"); rodada(c.s, golpe(c.s, "1", "steel-roller"), alvoIdle(c.s)); if (c.D.hpAtual !== c.D.hp) return "funcionou sem terreno"; const d = cena("steel-roller"); d.s.campo = {clima: null, terreno: {t: "grama", n: 5}, sala: 0}; rodada(d.s, golpe(d.s, "1", "steel-roller"), alvoIdle(d.s)); return d.D.hpAtual < d.D.hp && !d.s.campo.terreno ? null : "não acertou/limpou o terreno"; });
T("ice-spinner", () => { const d = cena("ice-spinner"); d.s.campo = {clima: null, terreno: {t: "grama", n: 5}, sala: 0}; rodada(d.s, golpe(d.s, "1", "ice-spinner"), alvoIdle(d.s)); return d.D.hpAtual < d.D.hp && !d.s.campo.terreno ? null : "não limpou o terreno"; });
T("grassy-glide", () => { const d = cena("grassy-glide", {opp: "tackle", speD: 300}); d.s.campo = {clima: null, terreno: {t: "grama", n: 5}, sala: 0}; const log = rodada(d.s, golpe(d.s, "1", "grassy-glide"), golpe(d.s, "2", "tackle")); return log.indexOf("usou Grassy Glide") < log.indexOf("usou Tackle") ? null : "não ganhou prioridade no Terreno de Grama"; });
T("expanding-force", () => { const a = cena("expanding-force"), b = cena("expanding-force"); b.s.campo = {clima: null, terreno: {t: "psiquico", n: 5}, sala: 0}; let x = 0, y = 0; for (let i = 0; i < 80; i++) { const p = cena("expanding-force"); p.s.campo = {clima: null, terreno: null, sala: 0}; rodada(p.s, golpe(p.s, "1", "expanding-force"), alvoIdle(p.s)); x += dano(p.D); const q = cena("expanding-force"); q.s.campo = {clima: null, terreno: {t: "psiquico", n: 5}, sala: 0}; rodada(q.s, golpe(q.s, "1", "expanding-force"), alvoIdle(q.s)); y += dano(q.D); } return y > x * 1.6 ? null : `sem bônus no Terreno Psíquico (${x} → ${y})`; });
T("rising-voltage", () => { let x = 0, y = 0; for (let i = 0; i < 80; i++) { const p = cena("rising-voltage"); rodada(p.s, golpe(p.s, "1", "rising-voltage"), alvoIdle(p.s)); x += dano(p.D); const q = cena("rising-voltage"); q.s.campo = {clima: null, terreno: {t: "eletrico", n: 5}, sala: 0}; rodada(q.s, golpe(q.s, "1", "rising-voltage"), alvoIdle(q.s)); y += dano(q.D); } return y > x * 1.6 ? null : `sem bônus no Terreno Elétrico (${x} → ${y})`; });
T("misty-explosion", () => { const c = cena("misty-explosion"); rodada(c.s, golpe(c.s, "1", "misty-explosion"), alvoIdle(c.s)); return c.A.hpAtual === 0 && c.D.hpAtual < c.D.hp ? null : "não explodiu/não causou dano"; });
T("electro-shot", () => { const c = cena("electro-shot"); rodada(c.s, golpe(c.s, "1", "electro-shot"), alvoIdle(c.s)); if (c.D.hpAtual !== c.D.hp || c.A.est.spa !== 1) return "turno 1 deveria só carregar (+1 Atq Esp)"; rodada(c.s, golpe(c.s, "1", "electro-shot"), alvoIdle(c.s)); if (!(c.D.hpAtual < c.D.hp)) return "turno 2 não atacou";
  const d = cena("electro-shot"); d.s.campo = {clima: {t: "chuva", n: 5}, terreno: null, sala: 0}; rodada(d.s, golpe(d.s, "1", "electro-shot"), alvoIdle(d.s)); return d.D.hpAtual < d.D.hp ? null : "não saiu na hora na chuva"; });
T("charge", () => { let x = 0, y = 0; for (let i = 0; i < 60; i++) { const p = cena("charge", {extraA: ["thunder-shock"]}); rodada(p.s, golpe(p.s, "1", "thunder-shock"), alvoIdle(p.s)); x += dano(p.D); const q = cena("charge", {extraA: ["thunder-shock"]}); rodada(q.s, golpe(q.s, "1", "charge"), alvoIdle(q.s)); if (q.A.est.spd !== 1 || !q.A.vol.carregado) return "Charge não preparou"; q.D.hpAtual = q.D.hp; rodada(q.s, golpe(q.s, "1", "thunder-shock"), alvoIdle(q.s)); y += dano(q.D); } return y > x * 1.6 ? null : `Thunder Shock não dobrou (${x} → ${y})`; });
T("growth", () => { const c = cena("growth"); rodada(c.s, golpe(c.s, "1", "growth"), alvoIdle(c.s)); const d = cena("growth"); d.s.campo = {clima: {t: "sol", n: 5}, terreno: null, sala: 0}; rodada(d.s, golpe(d.s, "1", "growth"), alvoIdle(d.s)); return c.A.est.atk === 1 && c.A.est.spa === 1 && d.A.est.atk === 2 && d.A.est.spa === 2 ? null : "estágios errados (sem sol / com sol)"; });
T("clangorous-soul", () => { const c = cena("clangorous-soul"); rodada(c.s, golpe(c.s, "1", "clangorous-soul"), alvoIdle(c.s)); const todos = ["atk", "def", "spa", "spd", "spe"].every(k => c.A.est[k] === 1); const d = cena("clangorous-soul"); d.A.hpAtual = Math.floor(d.A.hp / 4); rodada(d.s, golpe(d.s, "1", "clangorous-soul"), alvoIdle(d.s)); return todos && c.A.hpAtual === c.A.hp - Math.floor(c.A.hp / 3) && d.A.est.atk === 0 ? null : "custo de HP / estágios errados"; });
T("strength-sap", () => { const c = cena("strength-sap"); hpPct(c.A, 0.2); const h = c.A.hpAtual; rodada(c.s, golpe(c.s, "1", "strength-sap"), alvoIdle(c.s)); return c.D.est.atk === -1 && c.A.hpAtual > h ? null : "não curou/não baixou o Ataque"; });
T("venom-drench", () => { const c = cena("venom-drench"); rodada(c.s, golpe(c.s, "1", "venom-drench"), alvoIdle(c.s)); if (c.D.est.atk !== 0) return "funcionou em alvo sem veneno"; const d = cena("venom-drench"); d.D.cond = "veneno"; rodada(d.s, golpe(d.s, "1", "venom-drench"), alvoIdle(d.s)); return d.D.est.atk === -1 && d.D.est.spa === -1 && d.D.est.spe === -1 ? null : "não baixou os 3"; });
// golpes de dois turnos, recarga, fúria, explosão
for (const id of ["fly", "bounce", "dig", "dive", "phantom-force", "shadow-force", "solar-beam", "solar-blade", "sky-attack", "razor-wind", "freeze-shock", "ice-burn", "skull-bash", "meteor-beam"])
  T(id, () => { const c = cena(id); rodada(c.s, golpe(c.s, "1", id), alvoIdle(c.s)); if (c.D.hpAtual !== c.D.hp) return "causou dano no turno de carga"; if (c.A.vol.carga == null) return "não entrou em carga"; rodada(c.s, golpe(c.s, "1", id), alvoIdle(c.s)); return c.D.hpAtual < c.D.hp && c.A.vol.carga == null ? null : "turno 2 não atacou"; });
for (const id of ["hyper-beam", "giga-impact", "blast-burn", "hydro-cannon", "frenzy-plant", "roar-of-time", "rock-wrecker", "prismatic-laser", "eternabeam", "meteor-assault"])
  T(id, () => { const c = cena(id); rodada(c.s, golpe(c.s, "1", id), alvoIdle(c.s)); if (!(c.D.hpAtual < c.D.hp)) return "não causou dano"; if (!c.A.vol.recarga) return "não exige recarga"; const h = c.D.hpAtual; rodada(c.s, golpe(c.s, "1", id), alvoIdle(c.s)); return c.D.hpAtual === h ? null : "atacou no turno de recarga"; });
for (const id of ["outrage", "thrash", "petal-dance", "raging-fury"]) T(id, () => { const c = cena(id); rodada(c.s, golpe(c.s, "1", id), alvoIdle(c.s)); return c.A.vol.furia && c.D.hpAtual < c.D.hp ? null : "não entrou em fúria"; });
for (const id of ["explosion", "self-destruct", "misty-explosion"]) T(id, () => { const c = cena(id); rodada(c.s, golpe(c.s, "1", id), alvoIdle(c.s)); return c.A.hpAtual === 0 && c.D.hpAtual < c.D.hp ? null : "não explodiu"; });
for (const id of ["mind-blown", "steel-beam", "chloroblast"]) T(id, () => { const c = cena(id); rodada(c.s, golpe(c.s, "1", id), alvoIdle(c.s)); return c.A.hpAtual === c.A.hp - Math.floor(c.A.hp / 2) && c.D.hpAtual < c.D.hp ? null : "recuo de 50% do HP errado: " + c.A.hpAtual; });
for (const id of ["fake-out", "first-impression"]) T(id, () => { const c = cena(id); rodada(c.s, golpe(c.s, "1", id), alvoIdle(c.s)); if (!(c.D.hpAtual < c.D.hp)) return "falhou no primeiro turno"; if (id === "fake-out" && !c.D.vol.recuar && !/recuou/.test(c.s.log.join(""))) { /* o recuo é consumido na rodada */ } const h = c.D.hpAtual; rodada(c.s, golpe(c.s, "1", id), alvoIdle(c.s)); return c.D.hpAtual === h ? null : "funcionou fora do primeiro turno"; });
for (const id of ["sucker-punch", "thunderclap"]) T(id, () => { const c = cena(id); rodada(c.s, golpe(c.s, "1", id), alvoIdle(c.s)); if (c.D.hpAtual !== c.D.hp) return "funcionou sem o alvo atacar"; const d = cena(id, {opp: "tackle"}); rodada(d.s, golpe(d.s, "1", id), golpe(d.s, "2", "tackle")); return d.D.hpAtual < d.D.hp ? null : "falhou contra um golpe de dano"; });
T("focus-punch", () => { const c = cena("focus-punch"); rodada(c.s, golpe(c.s, "1", "focus-punch"), alvoIdle(c.s)); if (!(c.D.hpAtual < c.D.hp)) return "falhou sem ninguém atacar"; const d = cena("focus-punch", {opp: "tackle", speD: 300}); rodada(d.s, golpe(d.s, "1", "focus-punch"), golpe(d.s, "2", "tackle")); return d.D.hpAtual === d.D.hp ? null : "deveria falhar depois de levar dano"; });
for (const [id, pre, esperado] of [["facade", c => { c.A.cond = "queimadura"; }, 1.8], ["venoshock", c => { c.D.cond = "veneno"; }, 1.8], ["hex", c => { c.D.cond = "paralisia"; }, 1.8], ["brine", c => hpPct(c.D, 0.4), 1.8], ["acrobatics", c => {}, 1.8]])
  T(id, () => { let a = 0, b = 0; for (let i = 0; i < 25; i++) { const p = cena(id); rodada(p.s, golpe(p.s, "1", id), alvoIdle(p.s)); a += dano(p.D); const q = cena(id); const h0 = q.D.hpAtual; pre(q); const h = q.D.hpAtual; rodada(q.s, golpe(q.s, "1", id), alvoIdle(q.s)); b += h - q.D.hpAtual; }
    if (id === "acrobatics") return a > 0 ? null : "sem dano"; if (id === "facade") return b > a * 0.9 ? null : "Facade queimado perdeu o poder dobrado (" + a + " × " + b + ")"; return b > a * 1.6 ? null : `não dobrou (${a} → ${b})`; });
for (const id of ["payback", "revenge", "avalanche"]) T(id, () => { let a = 0, b = 0; for (let i = 0; i < 25; i++) { const p = cena(id, {opp: "tackle", speD: 300}); const h = p.D.hpAtual; rodada(p.s, golpe(p.s, "1", id), golpe(p.s, "2", "tackle")); b += h - p.D.hpAtual; const q = cena(id); rodada(q.s, golpe(q.s, "1", id), alvoIdle(q.s)); a += dano(q.D); } return b > a * 1.5 ? null : `não dobrou depois de agir/ser atingido (${a} → ${b})`; });
for (const id of ["eruption", "water-spout", "dragon-energy"]) T(id, () => { let a = 0, b = 0; for (let i = 0; i < 40; i++) { const c = cena(id); rodada(c.s, golpe(c.s, "1", id), alvoIdle(c.s)); a += dano(c.D); const d = cena(id); hpPct(d.A, 0.3); rodada(d.s, golpe(d.s, "1", id), alvoIdle(d.s)); b += dano(d.D); } return a > b * 2 ? null : `poder não depende do HP (${a} × ${b})`; });
for (const id of ["stored-power", "power-trip"]) T(id, () => { const c = cena(id); const d = cena(id); d.A.est.atk = 2; d.A.est.spa = 2; rodada(c.s, golpe(c.s, "1", id), alvoIdle(c.s)); rodada(d.s, golpe(d.s, "1", id), alvoIdle(d.s)); return dano(d.D) > dano(c.D) * 3 ? null : `poder não sobe com estágios (${dano(c.D)} × ${dano(d.D)})`; });
T("weather-ball", () => { const c = cena("weather-ball", {tiposD: ["Grass"]}); c.s.campo = {clima: {t: "sol", n: 5}, terreno: null, sala: 0}; const d = cena("weather-ball", {tiposD: ["Grass"]}); rodada(c.s, golpe(c.s, "1", "weather-ball"), alvoIdle(c.s)); rodada(d.s, golpe(d.s, "1", "weather-ball"), alvoIdle(d.s)); return dano(c.D) > dano(d.D) * 3 ? null : `não mudou de tipo/poder no sol (${dano(c.D)} × ${dano(d.D)})`; });
for (const id of ["psyshock", "psystrike", "secret-sword"]) T(id, () => { const c = cena(id, {extraPkD: {def: 40, spd: 300}}); rodada(c.s, golpe(c.s, "1", id), alvoIdle(c.s)); const d = cena("tackle", {extraPkD: {def: 40, spd: 300}}); rodada(d.s, golpe(d.s, "1", "tackle"), alvoIdle(d.s)); return dano(c.D) > 0 ? null : "sem dano"; });
T("body-press", () => { const c = cena("body-press", {extraPkA: {def: 400, atk: 20}}); rodada(c.s, golpe(c.s, "1", "body-press"), alvoIdle(c.s)); return dano(c.D) > 30 ? null : "não usa a Defesa: " + dano(c.D); });
T("foul-play", () => { const c = cena("foul-play", {extraPkA: {atk: 20}, extraPkD: {atk: 400}}); rodada(c.s, golpe(c.s, "1", "foul-play"), alvoIdle(c.s)); return dano(c.D) > 30 ? null : "não usa o Ataque do alvo: " + dano(c.D); });
for (const id of ["frost-breath", "storm-throw", "wicked-blow", "surging-strikes", "flower-trick"]) T(id, () => { const c = cena(id); const log = rodada(c.s, golpe(c.s, "1", id), alvoIdle(c.s)); return /crítico/.test(log) ? null : "não deu crítico: " + log.split("\n").pop(); });
for (const id of ["u-turn", "volt-switch", "flip-turn"]) T(id, () => { const c = cena(id, {bancoA: true}); rodada(c.s, golpe(c.s, "1", id), alvoIdle(c.s)); return c.D.hpAtual < c.D.hp && c.s.j["1"].pivo ? null : "não bateu e trocou"; });
for (const id of ["rapid-spin", "mortal-spin"]) T(id, () => { const c = cena(id); c.s.j["1"].lado = {rocha: true, espinhos: 2, venenosa: 1, teia: true, reflect: 0, luz: 0, veu: 0, vento: 0, protecaoStatus: 0, nevoa: 0}; rodada(c.s, golpe(c.s, "1", id), alvoIdle(c.s)); const l = c.s.j["1"].lado; return !l.rocha && !l.espinhos && !l.venenosa && !l.teia && c.D.hpAtual < c.D.hp ? null : "não limpou as armadilhas"; });
for (const id of ["brick-break", "psychic-fangs", "raging-bull"]) T(id, () => { const c = cena(id); c.s.j["2"].lado = {rocha: false, espinhos: 0, venenosa: 0, teia: false, reflect: 5, luz: 5, veu: 0, vento: 0, protecaoStatus: 0, nevoa: 0}; const log = rodada(c.s, golpe(c.s, "1", id), alvoIdle(c.s)); return !c.s.j["2"].lado.reflect && !c.s.j["2"].lado.luz && c.D.hpAtual < c.D.hp ? null : "não quebrou as telas"; });
T("clear-smog", () => { const c = cena("clear-smog"); c.D.est.def = 3; rodada(c.s, golpe(c.s, "1", "clear-smog"), alvoIdle(c.s)); return c.D.est.def === 0 && c.D.hpAtual < c.D.hp ? null : "não limpou os estágios"; });
for (const id of ["anchor-shot", "spirit-shackle"]) T(id, () => { const c = cena(id, {bancoD: true}); rodada(c.s, golpe(c.s, "1", id), alvoIdle(c.s)); return c.D.hpAtual < c.D.hp && (c.D.vol.naoFugir || c.D.vol.preso > 0) ? null : "não prendeu"; });
// dano comum no golpe de sinal de prioridade
for (const [id, ordem] of [["quick-attack", true], ["extreme-speed", true], ["mach-punch", true], ["bullet-punch", true], ["aqua-jet", true], ["shadow-sneak", true], ["ice-shard", true], ["accelerock", true], ["vacuum-wave", true], ["water-shuriken", true]])
  T(id, () => { const c = cena(id, {opp: "tackle", speA: 10, speD: 300}); const log = rodada(c.s, golpe(c.s, "1", id), golpe(c.s, "2", "tackle")); return log.indexOf("usou " + c.A.mv.find(m => m.id === id).nome) < log.indexOf("usou Tackle") ? null : "não agiu primeiro apesar da prioridade"; });
for (const [id, nome] of [["dragon-tail", "força a troca"], ["circle-throw", "força a troca"]]) T(id, () => { const c = cena(id, {bancoD: true}); rodada(c.s, golpe(c.s, "1", id), alvoIdle(c.s)); return c.D.hpAtual < c.D.hp && c.s.j["2"].ativo === 1 ? null : "não forçou a troca"; });

// ---------- 3. execução genérica: tudo que não tem verificação própria ----------
function verificaGenerico(g, id, d) {
  if (g.cat === "status") {
    const txt = STATUS[id]; if (!txt) return "sem expectativa cadastrada";
    const c = cena(id, {bancoA: true}); hpPct(c.A, 0.5); const antes = JSON.stringify([c.A.est, c.D.est, c.A.cond, c.D.cond, c.A.conf, c.D.conf, c.A.hpAtual]);
    const log = rodada(c.s, golpe(c.s, "1", id), alvoIdle(c.s)); let alvo = "opp";
    for (const t of txt.split(/\s+/)) {
      let m;
      if (t === "opp" || t === "self") alvo = t;
      else if ((m = t.match(/^(atk|def|spa|spd|spe|prec|eva)([+-]\d)$/))) { const P = alvo === "self" ? c.A : c.D, v = P.est[m[1]]; if (v !== +m[2]) return `${m[1]} ${alvo}: esperado ${m[2]}, ficou ${v}`; }
      else if ((m = t.match(/^heal(\d+)$/))) { if (c.A.hpAtual !== Math.min(c.A.hp, Math.floor(c.A.hp * 0.5) + Math.floor(c.A.hp * m[1] / 100))) return "cura errada: " + c.A.hpAtual; }
      else if (t === "conf") { if (!(c.D.conf > 0)) return "não confundiu: " + log.split("\n").slice(-2).join(" / "); }
      else { const e = {slp: "sono", par: "paralisia", brn: "queimadura", psn: "veneno", tox: "veneno-grave"}[t]; if (c.D.cond !== e) return `condição esperada ${e}, ficou ${c.D.cond}: ${log.split("\n").slice(-2).join(" / ")}`; }
    }
    return null;
  }
  const txt = DANO[id] || "";
  const c = cena(id), h = c.D.hpAtual; const log = rodada(c.s, golpe(c.s, "1", id), alvoIdle(c.s));
  if (!(h - c.D.hpAtual > 0)) return "não causou dano (" + log.split("\n").slice(-1) + ")";
  return null;
}
const extras = {}; // verificações de efeitos secundários com chance (frequência) para golpes de dano
function verificaSecundarios(id) {
  const txt = DANO[id]; if (!txt) return null; let alvo = "opp";
  for (const t of txt.split(/\s+/)) {
    let m; const N = 300;
    if (t === "opp" || t === "self") { alvo = t; continue; }
    if ((m = t.match(/^(atk|def|spa|spd|spe|prec|eva)([+-]\d)@(\d+)$/))) {
      let n = 0; for (let i = 0; i < N; i++) { const c = cena(id); rodada(c.s, golpe(c.s, "1", id), alvoIdle(c.s)); const P = alvo === "self" ? c.A : c.D; if (P.est[m[1]] === +m[2] || (m[2][0] === "-" && alvo === "self" && P.est[m[1]] === +m[2])) n++; }
      const p = n / N * 100; if (Math.abs(p - +m[3]) > Math.max(8, +m[3] * 0.35)) return `${m[1]}${m[2]} ${alvo}: aplicou em ${p.toFixed(0)}% (esperado ${m[3]}%)`;
    } else if ((m = t.match(/^(par|brn|psn|tox|frz|conf)(\d+)$/))) {
      const e = {par: "paralisia", brn: "queimadura", psn: "veneno", tox: "veneno-grave", frz: "congelamento"}[m[1]]; let n = 0;
      for (let i = 0; i < N; i++) { const c = cena(id); rodada(c.s, golpe(c.s, "1", id), alvoIdle(c.s)); if (m[1] === "conf" ? c.D.conf > 0 : c.D.cond === e) n++; }
      const p = n / N * 100; if (Math.abs(p - +m[2]) > Math.max(8, +m[2] * 0.35)) return `${m[1]}: aplicou em ${p.toFixed(0)}% (esperado ${m[2]}%)`;
    } else if ((m = t.match(/^flinch(\d+)$/))) {
      let n = 0; for (let i = 0; i < N; i++) { const c = cena(id, {opp: "tackle", speD: 10}); const log = rodada(c.s, golpe(c.s, "1", id), golpe(c.s, "2", "tackle")); if (/recuou/.test(log)) n++; }
      const p = n / N * 100; if (Math.abs(p - +m[1]) > Math.max(8, +m[1] * 0.35)) return `recuo em ${p.toFixed(0)}% (esperado ${m[1]}%)`;
    } else if ((m = t.match(/^drain(\d+)$/))) {
      const c = cena(id); hpPct(c.A, 0.3); const h = c.A.hpAtual, hd = c.D.hpAtual; const lg = rodada(c.s, golpe(c.s, "1", id), alvoIdle(c.s)); const d = +(lg.match(/: (\d+) de dano em/)?.[1] || 0), ganho = c.A.hpAtual - h;
      if (Math.abs(ganho - Math.floor(d * m[1] / 100)) > 1) return `dreno: ganhou ${ganho} para ${d} de dano (esperado ${m[1]}%)`;
    } else if ((m = t.match(/^recoil(\d+)$/))) {
      const c = cena(id); const h = c.A.hpAtual, hd = c.D.hpAtual; const lg = rodada(c.s, golpe(c.s, "1", id), alvoIdle(c.s)); const d = +(lg.match(/: (\d+) de dano em/)?.[1] || 0), perdeu = h - c.A.hpAtual;
      if (Math.abs(perdeu - Math.floor(d * m[1] / 100)) > 1) return `recuo: perdeu ${perdeu} para ${d} de dano (esperado ${m[1]}%)`;
    } else if ((m = t.match(/^multi(\d)-(\d)$/))) {
      const vistos = new Set(); for (let i = 0; i < 200; i++) { const c = cena(id); const log = rodada(c.s, golpe(c.s, "1", id), alvoIdle(c.s)); const k = log.match(/\((\d) golpes?\)/); vistos.add(k ? +k[1] : 1); }
      const min = Math.min(...vistos), max = Math.max(...vistos); if (min < +m[1] || max > +m[2] || (m[2] > m[1] && max === min)) return `golpes por uso: ${[...vistos]} (esperado ${m[1]}-${m[2]})`;
    } else if (t === "trap") { const c = cena(id); rodada(c.s, golpe(c.s, "1", id), alvoIdle(c.s)); if (!(c.D.vol.preso > 0)) return "não prendeu"; }
  }
  return null;
}

// ---------- 4. precisão: null nunca erra; os outros erram na taxa certa ----------
function taxaDeErro(id, eva, prec) {
  let erros = 0, N = 400; for (let i = 0; i < N; i++) {
    const c = cena(id, {precisao: true, bancoD: true, bancoA: true}); c.D.est.eva = eva; c.A.est.prec = prec; c.s.j["1"].equipe[0].mv.forEach(m => { if (m.id === id) m.precisao = DOCS[id].precisao; });
    if (id === "aurora-veil") c.s.campo = {clima: {t: "granizo", n: 5}, terreno: null, sala: 0};
    if (id === "poltergeist") c.D.item = {id: "leftovers", nome: "Leftovers"}; if (id === "belch") c.A.comeuBaga = true;
    let errou = false; for (let r = 0; r < 2; r++) { const log = rodada(c.s, golpe(c.s, "1", id), alvoIdle(c.s)); if (/errou!/.test(log.split("\n").find(l => l.includes("usou " + DOCS[id].nome)) || "")) errou = true; if (c.A.vol.carga == null) break; }
    if (errou) erros++; }
  return erros / N;
}

let verificados = 0, semVerificacao = [];
for (const g of lista) {
  const id = slug(g.nome), d = DOCS[id]; if (!d.suportado) continue;
  try {
    let r;
    if (VER[id]) r = VER[id](); else { r = verificaGenerico(g, id, d); if (!r) r = verificaSecundarios(id); }
    if (r) bad(id, r); else verificados++;
    // precisão
    if (g.precisao == null) {
      const e = taxaDeErro(id, 6, -6); if (e > 0) bad(id, `precisão null (nunca erra), mas errou ${(e * 100).toFixed(1)}% contra evasão +6`);
    } else {
      const e = taxaDeErro(id, 0, 0), esperado = 1 - Math.min(100, g.precisao) / 100;
      if (Math.abs(e - esperado) > 0.09) bad(id, `precisão ${g.precisao}%: errou ${(e * 100).toFixed(0)}% (esperado ${(esperado * 100).toFixed(0)}%)`);
    }
  } catch (err) { bad(id, "EXCEÇÃO: " + err.message.split("\n")[0]); }
}
console.log(`${lista.length} golpes distintos conferidos; ${verificados} com o efeito confirmado em execução.`);
for (const p of problemas) console.log(p);
console.log(falhas ? `${falhas} PROBLEMA(S)` : "TUDO CERTO (golpes)");
process.exit(falhas ? 1 : 0);
