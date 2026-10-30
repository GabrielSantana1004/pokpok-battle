// Testes dos itens segurados e das caixas (sem Firebase): um cenário por gancho + simulação aleatória com todos os itens.
import assert from "node:assert/strict";
import { copiaPokemon, resolverRodada, ativoDe, vivos, precisaTrocar, enviar, fimDeBatalha, iniciarBatalha } from "./motor.js";
import { ITENS, itemPorId, itensDeCaixa, sortearCaixa, sortearItem, itemDeBot, copiasLivres, itemEquipado, contarEquipados, CAIXA } from "./itens.js";

const E = (t, o) => ({t, ...o});
const G = {
  tackle: {id: "tackle", nome: "Tackle", tipo: "Normal", cat: "fisico", poder: 40, precisao: 100},
  strong: {id: "strong", nome: "Strong", tipo: "Normal", cat: "fisico", poder: 80, precisao: 100},
  swift: {id: "swift", nome: "Swift", tipo: "Normal", cat: "especial", poder: 60, precisao: null},
  ember: {id: "ember", nome: "Ember", tipo: "Fire", cat: "especial", poder: 40, precisao: 100},
  flamethrower: {id: "flamethrower", nome: "Flamethrower", tipo: "Fire", cat: "especial", poder: 90, precisao: 100, efeitos: [E("condicao", {condicao: "queimadura", alvo: "alvo", chance: 10})]},
  surf: {id: "surf", nome: "Surf", tipo: "Water", cat: "especial", poder: 90, precisao: 100},
  thunderbolt: {id: "thunderbolt", nome: "Thunderbolt", tipo: "Electric", cat: "especial", poder: 90, precisao: 100},
  vine: {id: "vine", nome: "Vine", tipo: "Grass", cat: "fisico", poder: 45, precisao: 100},
  bark: {id: "bark", nome: "Bark", tipo: "Dark", cat: "fisico", poder: 60, precisao: 100},
  earthquake: {id: "earthquake", nome: "Earthquake", tipo: "Ground", cat: "fisico", poder: 100, precisao: 100},
  slash: {id: "slash", nome: "Slash", tipo: "Normal", cat: "fisico", poder: 70, precisao: 100, efeitos: [E("crit", {n: 1})]},
  lowacc: {id: "lowacc", nome: "Lowacc", tipo: "Normal", cat: "fisico", poder: 40, precisao: 60},
  fissure: {id: "fissure", nome: "Fissure", tipo: "Ground", cat: "fisico", poder: null, precisao: 30, efeitos: [E("danofixo", {ohko: true})]},
  closecombat: {id: "closecombat", nome: "Close Combat", tipo: "Fighting", cat: "fisico", poder: 120, precisao: 100, efeitos: [E("estagio", {stat: "def", n: -1, alvo: "self"})]},
  growl: {id: "growl", nome: "Growl", tipo: "Normal", cat: "status", poder: null, precisao: 100, efeitos: [E("estagio", {stat: "atk", n: -1, alvo: "alvo"})]},
  twave: {id: "twave", nome: "Thunder Wave", tipo: "Electric", cat: "status", poder: null, precisao: 100, efeitos: [E("condicao", {condicao: "paralisia", alvo: "alvo"})]},
  wisp: {id: "wisp", nome: "Will-O-Wisp", tipo: "Fire", cat: "status", poder: null, precisao: 100, efeitos: [E("condicao", {condicao: "queimadura", alvo: "alvo"})]},
  spore: {id: "spore", nome: "Spore", tipo: "Grass", cat: "status", poder: null, precisao: 100, efeitos: [E("condicao", {condicao: "sono", alvo: "alvo"})]},
  toxic: {id: "toxic", nome: "Toxic", tipo: "Poison", cat: "status", poder: null, precisao: 100, efeitos: [E("condicao", {condicao: "veneno-grave", alvo: "alvo"})]},
  rain: {id: "rain-dance", nome: "Rain Dance", tipo: "Water", cat: "status", poder: null, precisao: null, efeitos: [E("clima", {clima: "chuva", alvo: "campo"})]},
  sand: {id: "sandstorm", nome: "Sandstorm", tipo: "Rock", cat: "status", poder: null, precisao: null, efeitos: [E("clima", {clima: "areia", alvo: "campo"})]},
  swords: {id: "swords-dance", nome: "Swords Dance", tipo: "Normal", cat: "status", poder: null, precisao: null, efeitos: [E("estagio", {stat: "atk", n: 2, alvo: "self"})]},
  recover: {id: "recover", nome: "Recover", tipo: "Normal", cat: "status", poder: null, precisao: null, efeitos: [E("cura", {fracao: 0.5, alvo: "self"})]},
  splash: {id: "splash", nome: "Splash", tipo: "Normal", cat: "status", poder: null, precisao: null, efeitos: []},
  burner: {id: "burner", nome: "Burner", tipo: "Fire", cat: "especial", poder: 40, precisao: 100, efeitos: [E("condicao", {condicao: "queimadura", alvo: "alvo", chance: 100})]},
  hypervoice: {id: "hyper-voice", nome: "Hyper Voice", tipo: "Normal", cat: "especial", poder: 90, precisao: 100},
  leech: {id: "drain-punch", nome: "Drain Punch", tipo: "Fighting", cat: "fisico", poder: 75, precisao: 100, efeitos: [E("dreno", {fracao: 0.5})]},
  fury: {id: "fury-swipes", nome: "Fury Swipes", tipo: "Normal", cat: "fisico", poder: 18, precisao: 100, efeitos: [E("multi", {min: 2, max: 5})]},
  reflect: {id: "reflect", nome: "Reflect", tipo: "Psychic", cat: "status", poder: null, precisao: null, efeitos: [E("tela", {tela: "reflect"})]},
  trick: {id: "trick-room", nome: "Trick Room", tipo: "Psychic", cat: "status", poder: null, precisao: null, prioridade: -7, efeitos: [E("sala", {})]},
  firespin: {id: "fire-spin", nome: "Fire Spin", tipo: "Fire", cat: "especial", poder: 35, precisao: 100, efeitos: [E("prender", {turnos: [4, 5]})]},
  solar: {id: "solar-beam", nome: "Solar Beam", tipo: "Grass", cat: "especial", poder: 120, precisao: 100, efeitos: [E("carga", {})]},
  mysteel: {id: "mysteel", nome: "Mysteel", tipo: "Steel", cat: "fisico", poder: 40, precisao: 100},
  taunt: {id: "taunt", nome: "Taunt", tipo: "Dark", cat: "status", poder: null, precisao: 100, efeitos: [E("volatil", {v: "provocar", alvo: "alvo"})]},
  quick: {id: "quick", nome: "Quick", tipo: "Normal", cat: "fisico", poder: 40, precisao: 100, prioridade: 1},
};
const mapa = Object.fromEntries(Object.values(G).map(g => [g.nome, {prioridade: 0, efeitos: [], ...g, suportado: true, versao: 2}]));
const pk = (nome, tipos, hab, mvs, o = {}) => copiaPokemon({id: nome, nome, tipos, hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 80, nivel: 50, megas: [],
  habilidade: hab ? {id: hab, nome: hab} : null, mv: mvs.map(n => ({nome: G[n].nome, tipo: G[n].tipo, cat: G[n].cat, poder: G[n].poder, precisao: G[n].precisao})), ...o}, mapa);
const sala = (a, b, extra = {}) => { const s = {fase: "batalha", rodada: 1, log: [], vencedor: null, escolhas: {"1": null, "2": null}, campo: {}, ...extra,
  j: {"1": {equipe: [a, pk("res1", ["Normal"], null, ["tackle"])], ativo: 0}, "2": {equipe: [b, pk("res2", ["Normal"], null, ["tackle"])], ativo: 0}}}; iniciarBatalha(s, s.log); return s; };
const A = s => ativoDe(s.j["1"]), B = s => ativoDe(s.j["2"]);
const mv = (P, id) => P.mv.findIndex(m => m.id === id);
const go = (s, g1, g2, z = {}) => { s.escolhas = {"1": g1 == null ? {tipo: "golpe", idx: 0} : {tipo: "golpe", idx: mv(A(s), g1), ...(z.a || {})}, "2": g2 == null ? {tipo: "golpe", idx: 0} : {tipo: "golpe", idx: mv(B(s), g2)}}; return resolverRodada(s); };
const fixo = (v, f) => { const o = Math.random; Math.random = () => v; try { return f(); } finally { Math.random = o; } }; // dados fixos: 0,5 = sem crítico, 0,99 = crítico
const dano = (s, k) => ativoDe(s.j[k]).hp - ativoDe(s.j[k]).hpAtual;
const log = s => s.log.join("\n");
let n = 0; const t = (nome, f) => { f(); n++; };
const duelo = (ha, hb, ma, mb, tA = ["Normal"], tB = ["Normal"], oa = {}, ob = {}) => sala(pk("A", tA, ha, ma, oa), pk("B", tB, hb, mb, ob));
const danoAtk = (ha, hb, g, tA, tB, oa, ob) => fixo(0.5, () => { const s = duelo(ha, hb, [g], ["splash"], tA, tB, oa, ob); go(s, g, "splash"); return dano(s, "2"); });

const it = id => { const i = itemPorId(id); assert.ok(i, "item inexistente " + id); return {id, nome: i.nome}; };
const com = (id) => ({item: it(id)}); // opções do pk
const base = (g, ...a) => danoAtk(null, null, g, ...a);
const comItem = (id, g, tA, tB, oB) => danoAtk(null, null, g, tA, tB, com(id), oB);
const razao = (id, g, tA, tB) => comItem(id, g, tA, tB) / base(g, tA, tB);
const perto = (v, alvo, tol = 0.08, msg = "") => assert.ok(Math.abs(v - alvo) <= tol, `${msg} ${v.toFixed(3)} ≠ ${alvo}`);

t("Catálogo", () => {
  assert.equal(ITENS.length, 135); assert.equal(new Set(ITENS.map(i => i.id)).size, 135);
  assert.ok(ITENS.every(i => i.nome && i.desc && ["comum", "incomum", "raro"].includes(i.tier)));
  assert.equal(itensDeCaixa.length, 133); assert.ok(!itensDeCaixa.some(i => i.semEfeito)); assert.equal(itemPorId("leppa-berry").semEfeito, "o jogo não tem PP");
  assert.ok(itemPorId("life-orb").tier === "raro" && itemPorId("charcoal").tier === "comum");
});
t("Dano: Life Orb, Choice, Expert Belt, Muscle Band, Wise Glasses, tipo, Punching Glove", () => {
  perto(razao("life-orb", "tackle"), 1.3, 0.05, "Life Orb"); perto(razao("choice-band", "tackle"), 1.5, 0.07, "Choice Band");
  perto(razao("choice-specs", "swift"), 1.5, 0.07, "Choice Specs"); perto(razao("muscle-band", "tackle"), 1.1, 0.05); perto(razao("wise-glasses", "swift"), 1.1, 0.05);
  perto(razao("wise-glasses", "tackle"), 1, 0.01); perto(razao("expert-belt", "ember", ["Normal"], ["Grass"]), 1.2, 0.05); perto(razao("expert-belt", "tackle"), 1, 0.01);
  perto(razao("charcoal", "ember"), 1.2, 0.05); perto(razao("charcoal", "tackle"), 1, 0.01); perto(razao("silk-scarf", "tackle"), 1.2, 0.05);
  perto(razao("fire-gem", "ember"), 1.3, 0.06); perto(razao("normal-gem", "ember"), 1, 0.01);
  const sem = danoAtk(null, null, "ember", ["Normal"], ["Normal"], {}, {item: it("assault-vest")}); assert.ok(sem < base("ember") * 0.75, "Assault Vest reduz dano especial");
});
t("Life Orb: perde HP; Sheer Force não", () => {
  let s = duelo(null, null, ["tackle"], ["splash"], ["Normal"], ["Normal"], com("life-orb")); go(s, "tackle", "splash"); assert.equal(dano(s, "1"), Math.floor(A(s).hp / 10));
  s = duelo(null, null, ["splash"], ["splash"], ["Normal"], ["Normal"], com("life-orb")); go(s, "splash", "splash"); assert.equal(dano(s, "1"), 0, "sem golpe de dano não perde HP");
  s = duelo("sheer-force", null, ["flamethrower"], ["splash"], ["Normal"], ["Normal"], com("life-orb")); go(s, "flamethrower", "splash"); assert.equal(dano(s, "1"), 0, "Sheer Force: sem recuo da Life Orb");
});
t("Gema: só no primeiro golpe e some", () => {
  const s = duelo(null, null, ["ember"], ["splash"], ["Normal"], ["Normal"], com("fire-gem")); fixo(0.5, () => go(s, "ember", "splash")); assert.equal(A(s).item, null); assert.equal(A(s).itemUsado, "fire-gem"); assert.match(log(s), /Fire Gem/);
  const d1 = dano(s, "2"); B(s).hpAtual = B(s).hp; fixo(0.5, () => go(s, "ember", "splash")); assert.ok(dano(s, "2") < d1, "segundo golpe sem reforço");
});
t("Choice: preso ao golpe; Scarf; Assault Vest", () => {
  let s = duelo(null, null, ["tackle", "swift"], ["splash"], ["Normal"], ["Normal"], com("choice-band")); go(s, "tackle", "splash"); s.log = [];
  s.escolhas = {"1": {tipo: "golpe", idx: mv(A(s), "swift")}, "2": {tipo: "golpe", idx: 0}}; resolverRodada(s); assert.match(log(s), /usou Tackle/); assert.doesNotMatch(log(s), /usou Swift/);
  s = duelo(null, null, ["tackle"], ["tackle"], ["Normal"], ["Normal"], {spe: 50, ...com("choice-scarf")}, {spe: 60}); go(s, "tackle", "tackle"); assert.match(s.log.find(x => /usou/.test(x)), /^A /, "Scarf passa na frente");
  s = duelo(null, null, ["tackle", "growl"], ["splash"], ["Normal"], ["Normal"], com("assault-vest")); s.escolhas = {"1": {tipo: "golpe", idx: mv(A(s), "growl")}, "2": {tipo: "golpe", idx: 0}}; resolverRodada(s);
  assert.match(log(s), /não pode usar Growl/); assert.equal(B(s).est.atk, 0);
  s = duelo(null, null, ["splash"], ["splash"], ["Normal"], ["Normal"], com("choice-band")); enviar(s, "1", 1, []); enviar(s, "1", 0, []); assert.equal(A(s).vol.escolha, undefined, "trocar solta a trava");
});
t("Metronome, Loaded Dice, Big Root", () => {
  const s = duelo(null, null, ["tackle"], ["splash"], ["Normal"], ["Normal"], com("metronome")); const ds = [];
  for (let i = 0; i < 4; i++) { B(s).hpAtual = B(s).hp; fixo(0.5, () => go(s, "tackle", "splash")); ds.push(dano(s, "2")); }
  assert.ok(ds[1] > ds[0] && ds[2] > ds[1] && ds[3] > ds[2], "Metronome sobe a cada uso: " + ds); perto(ds[3] / ds[0], 1.6, 0.1);
  let min = 9; for (let i = 0; i < 200; i++) { const x = duelo(null, null, ["fury"], ["splash"], ["Normal"], ["Normal"], com("loaded-dice")); go(x, "fury-swipes", "splash"); const h = +(log(x).match(/\((\d) golpes?\)/)?.[1] || 0); min = Math.min(min, h); } assert.ok(min >= 4, "Loaded Dice: mínimo 4 golpes, deu " + min);
  let sem = 9; for (let i = 0; i < 200; i++) { const x = duelo(null, null, ["fury"], ["splash"]); go(x, "fury-swipes", "splash"); sem = Math.min(sem, +(log(x).match(/\((\d) golpes?\)/)?.[1] || 9)); } assert.ok(sem < 4);
  const dr = (item) => fixo(0.5, () => { const x = duelo(null, null, ["leech"], ["splash"], ["Normal"], ["Normal"], item ? com(item) : {}); A(x).hpAtual = 20; go(x, "drain-punch", "splash"); return A(x).hpAtual - 20; });
  assert.ok(dr("big-root") > dr(null), "Big Root cura mais");
});
t("Rocky Helmet, Heavy-Duty Boots, Air Balloon, Protective Pads, Punching Glove", () => {
  let s = duelo(null, null, ["tackle"], ["splash"], ["Normal"], ["Normal"], {}, com("rocky-helmet")); go(s, "tackle", "splash"); assert.equal(dano(s, "1"), Math.floor(A(s).hp / 6));
  s = duelo(null, null, ["tackle"], ["splash"], ["Normal"], ["Normal"], com("protective-pads"), com("rocky-helmet")); go(s, "tackle", "splash"); assert.equal(dano(s, "1"), 0);
  s = duelo(null, null, ["swift"], ["splash"], ["Normal"], ["Normal"], {}, com("rocky-helmet")); go(s, "swift", "splash"); assert.equal(dano(s, "1"), 0, "especial não é contato");
  s = duelo(null, null, ["splash"], ["splash"]); s.j["1"].lado = {rocha: true, espinhos: 3, venenosa: 0, teia: true}; s.j["1"].equipe[1] = pk("Bota", ["Normal"], null, ["tackle"], com("heavy-duty-boots")); enviar(s, "1", 1, []); assert.equal(A(s).hpAtual, A(s).hp);
  s = duelo(null, null, ["splash"], ["splash"]); s.j["1"].lado = {rocha: true, espinhos: 0, venenosa: 0, teia: false}; enviar(s, "1", 1, []); assert.ok(A(s).hpAtual < A(s).hp, "sem botas leva dano");
  s = duelo(null, null, ["earthquake"], ["splash"], ["Normal"], ["Normal"], {}, com("air-balloon")); go(s, "earthquake", "splash"); assert.equal(dano(s, "2"), 0); assert.match(log(s), /Air Balloon/);
  s = duelo(null, null, ["tackle", "earthquake"], ["splash"], ["Normal"], ["Normal"], {}, com("air-balloon")); go(s, "tackle", "splash"); assert.equal(B(s).item, null); assert.match(log(s), /estourou/); go(s, "earthquake", "splash"); assert.ok(dano(s, "2") > 0);
});
t("Clear Amulet, Covert Cloak, Ability Shield, Safety Goggles", () => {
  let s = duelo(null, null, ["growl"], ["splash"], ["Normal"], ["Normal"], {}, com("clear-amulet")); go(s, "growl", "splash"); assert.equal(B(s).est.atk, 0);
  s = duelo(null, null, ["burner"], ["splash"], ["Normal"], ["Normal"], {}, com("covert-cloak")); go(s, "burner", "splash"); assert.equal(B(s).cond, null); assert.ok(dano(s, "2") > 0);
  s = duelo(null, null, ["burner"], ["splash"]); go(s, "burner", "splash"); assert.equal(B(s).cond, "queimadura");
  s = duelo("mold-breaker", "levitate", ["earthquake"], ["splash"], ["Normal"], ["Normal"], {}, com("ability-shield")); go(s, "earthquake", "splash"); assert.equal(dano(s, "2"), 0);
  s = duelo(null, null, ["splash"], ["splash"], ["Normal"], ["Normal"], com("safety-goggles")); s.campo.clima = {t: "areia", n: 5}; go(s, "splash", "splash"); assert.equal(A(s).hpAtual, A(s).hp);
  s = duelo(null, null, ["spore"], ["splash"], ["Normal"], ["Normal"], {}, com("safety-goggles")); go(s, "spore", "splash"); assert.equal(B(s).cond, null);
});
t("Throat Spray, Weakness Policy, White Herb, Mental Herb", () => {
  let s = duelo(null, null, ["hypervoice"], ["splash"], ["Normal"], ["Normal"], com("throat-spray")); go(s, "hyper-voice", "splash"); assert.equal(A(s).est.spa, 1); assert.equal(A(s).item, null);
  s = duelo(null, null, ["ember"], ["splash"], ["Normal"], ["Grass"], {}, com("weakness-policy")); go(s, "ember", "splash"); assert.deepEqual([B(s).est.atk, B(s).est.spa], [2, 2]); assert.equal(B(s).item, null);
  s = duelo(null, null, ["tackle"], ["splash"], ["Normal"], ["Normal"], {}, com("weakness-policy")); go(s, "tackle", "splash"); assert.equal(B(s).est.atk, 0, "só super efetivo");
  s = duelo(null, null, ["growl"], ["splash"], ["Normal"], ["Normal"], {}, com("white-herb")); go(s, "growl", "splash"); assert.equal(B(s).est.atk, 0); assert.equal(B(s).item, null); assert.match(log(s), /voltaram ao normal/);
  s = duelo(null, null, ["taunt"], ["splash"], ["Normal"], ["Normal"], {}, com("mental-herb")); go(s, "taunt", "splash"); assert.ok(!(B(s).vol.provocar > 0)); assert.equal(B(s).item, null);
});
t("Focus Sash, Focus Band", () => {
  let s = duelo(null, null, ["strong"], ["splash"], ["Normal"], ["Normal"], {atk: 900}, com("focus-sash")); fixo(0.5, () => go(s, "strong", "splash")); assert.equal(B(s).hpAtual, 1); assert.equal(B(s).item, null);
  s = duelo(null, null, ["strong"], ["splash"], ["Normal"], ["Normal"], {atk: 900}, com("focus-sash")); B(s).hpAtual = B(s).hp - 1; fixo(0.5, () => go(s, "strong", "splash")); assert.equal(B(s).hpAtual, 0, "só com HP cheio");
  let vivo = 0; for (let i = 0; i < 1000; i++) { const x = duelo(null, null, ["strong"], ["splash"], ["Normal"], ["Normal"], {atk: 900}, com("focus-band")); go(x, "strong", "splash"); if (B(x).hpAtual === 1) vivo++; } assert.ok(vivo > 60 && vivo < 150, "Focus Band ~10%: " + vivo);
});
t("Bagas de HP, status e atributos", () => {
  const baixo = (id, f, extra = {}) => { const s = duelo(null, null, ["splash"], ["splash"], ["Normal"], ["Normal"], com(id)); A(s).hpAtual = Math.floor(A(s).hp * f); Object.assign(A(s), extra); go(s, "splash", "splash"); return s; };
  let s = baixo("sitrus-berry", 0.4); assert.ok(A(s).hpAtual >= Math.floor(A(s).hp * 0.4) + Math.floor(A(s).hp / 4) - 1); assert.equal(A(s).item, null);
  s = baixo("sitrus-berry", 0.9); assert.ok(A(s).item); s = baixo("oran-berry", 0.4); assert.equal(A(s).hpAtual, Math.floor(A(s).hp * 0.4) + 10);
  s = baixo("figy-berry", 0.4); assert.ok(A(s).item, "Figy só com 25%"); s = baixo("figy-berry", 0.2); assert.equal(A(s).item, null);
  s = duelo("gluttony", null, ["splash"], ["splash"], ["Normal"], ["Normal"], com("figy-berry")); A(s).hpAtual = Math.floor(A(s).hp * 0.4); go(s, "splash", "splash"); assert.equal(A(s).item, null, "Gluttony: 50%");
  s = duelo("ripen", null, ["splash"], ["splash"], ["Normal"], ["Normal"], com("oran-berry")); A(s).hpAtual = 10; go(s, "splash", "splash"); assert.equal(A(s).hpAtual, 30);
  s = duelo("cheek-pouch", null, ["splash"], ["splash"], ["Normal"], ["Normal"], com("oran-berry")); A(s).hpAtual = 10; go(s, "splash", "splash"); assert.ok(A(s).hpAtual > 30, "Cheek Pouch");
  s = baixo("lum-berry", 1, {cond: "queimadura"}); assert.equal(A(s).cond, null); assert.equal(A(s).item, null);
  s = baixo("lum-berry", 1, {conf: 3}); assert.equal(A(s).conf, 0); s = baixo("cheri-berry", 1, {cond: "paralisia"}); assert.equal(A(s).cond, null);
  s = baixo("cheri-berry", 1, {cond: "queimadura"}); assert.equal(A(s).cond, "queimadura", "baga errada não cura"); s = baixo("pecha-berry", 1, {cond: "veneno-grave"}); assert.equal(A(s).cond, null);
  s = baixo("persim-berry", 1, {conf: 3}); assert.equal(A(s).conf, 0);
  for (const [b, st] of [["liechi-berry", "atk"], ["ganlon-berry", "def"], ["salac-berry", "spe"], ["petaya-berry", "spa"], ["apicot-berry", "spd"]]) { s = baixo(b, 0.2); assert.equal(A(s).est[st], 1, b); }
  s = baixo("starf-berry", 0.2); assert.equal(Object.values(A(s).est).reduce((a, b) => a + b, 0), 2); s = baixo("lansat-berry", 0.2); assert.equal(A(s).vol.foco, true);
  s = baixo("micle-berry", 0.2); assert.equal(A(s).vol.micle, true);
  s = duelo(null, "unnerve", ["splash"], ["splash"], ["Normal"], ["Normal"], com("sitrus-berry")); A(s).hpAtual = 10; go(s, "splash", "splash"); assert.ok(A(s).item, "Unnerve impede a baga");
  s = duelo(null, "frisk", ["splash"], ["splash"], ["Normal"], ["Normal"], com("sitrus-berry")); assert.match(log(s), /Frisk/);
});
t("Bagas de resistência, Enigma, Jaboca, Rowap", () => {
  const sem = base("ember", ["Normal"], ["Grass"]), com1 = danoAtk(null, null, "ember", ["Normal"], ["Grass"], {}, com("occa-berry")); perto(com1 / sem, 0.5, 0.06, "Occa");
  const neutro = danoAtk(null, null, "ember", ["Normal"], ["Normal"], {}, com("occa-berry")); perto(neutro / base("ember"), 1, 0.01, "Occa só em super efetivo");
  perto(danoAtk(null, null, "tackle", ["Normal"], ["Normal"], {}, com("chilan-berry")) / base("tackle"), 0.5, 0.06, "Chilan");
  const s = duelo(null, null, ["ember"], ["splash"], ["Normal"], ["Grass"], {}, com("occa-berry")); fixo(0.5, () => go(s, "ember", "splash")); assert.equal(B(s).item, null);
  let x = duelo(null, null, ["swift"], ["splash"], ["Normal"], ["Normal"], {}, com("enigma-berry")); x = duelo(null, null, ["ember"], ["splash"], ["Normal"], ["Grass"], {}, com("enigma-berry")); B(x).hpAtual = B(x).hp; go(x, "ember", "splash"); assert.equal(B(x).item, null, "Enigma consumida");
  x = duelo(null, null, ["tackle"], ["splash"], ["Normal"], ["Normal"], {}, com("jaboca-berry")); go(x, "tackle", "splash"); assert.equal(dano(x, "1"), Math.floor(A(x).hp / 8)); assert.equal(B(x).item, null);
  x = duelo(null, null, ["tackle"], ["splash"], ["Normal"], ["Normal"], {}, com("rowap-berry")); go(x, "tackle", "splash"); assert.equal(dano(x, "1"), 0, "Rowap só especial");
});
t("Fim da rodada: Leftovers, Black Sludge, Orbs, Klutz", () => {
  let s = duelo(null, null, ["splash"], ["splash"], ["Normal"], ["Normal"], com("leftovers")); A(s).hpAtual = 50; go(s, "splash", "splash"); assert.equal(A(s).hpAtual, 50 + Math.floor(A(s).hp / 16));
  s = duelo("klutz", null, ["splash"], ["splash"], ["Normal"], ["Normal"], com("leftovers")); A(s).hpAtual = 50; go(s, "splash", "splash"); assert.equal(A(s).hpAtual, 50, "Klutz anula");
  s = duelo(null, null, ["splash"], ["splash"], ["Poison"], ["Normal"], com("black-sludge")); A(s).hpAtual = 50; go(s, "splash", "splash"); assert.ok(A(s).hpAtual > 50);
  s = duelo(null, null, ["splash"], ["splash"], ["Normal"], ["Normal"], com("black-sludge")); go(s, "splash", "splash"); assert.equal(dano(s, "1"), Math.floor(A(s).hp / 8));
  s = duelo(null, null, ["splash"], ["splash"], ["Normal"], ["Normal"], com("flame-orb")); go(s, "splash", "splash"); assert.equal(A(s).cond, "queimadura");
  s = duelo(null, null, ["splash"], ["splash"], ["Normal"], ["Normal"], com("toxic-orb")); go(s, "splash", "splash"); assert.equal(A(s).cond, "veneno-grave");
  s = duelo("guts", null, ["tackle"], ["splash"], ["Normal"], ["Normal"], com("flame-orb")); go(s, "tackle", "splash"); go(s, "tackle", "splash"); assert.ok(A(s).cond === "queimadura");
  s = duelo("harvest", null, ["splash"], ["splash"], ["Normal"], ["Normal"], com("oran-berry")); A(s).hpAtual = 10; s.campo.clima = {t: "sol", n: 5}; go(s, "splash", "splash"); assert.ok(A(s).item, "Harvest repõe a baga no sol");
  s = duelo("unburden", null, ["tackle"], ["tackle"], ["Normal"], ["Normal"], {spe: 40, ...com("oran-berry")}, {spe: 60}); A(s).hpAtual = Math.floor(A(s).hp * 0.45); go(s, "tackle", "tackle"); s.log = []; go(s, "tackle", "tackle"); assert.match(s.log.find(x => /usou/.test(x)), /^A /, "Unburden dobra a Velocidade");
});
t("Duração: Light Clay, rochas, Room Service", () => {
  let s = duelo(null, null, ["reflect"], ["splash"], ["Normal"], ["Normal"], com("light-clay")); go(s, "reflect", "splash"); assert.equal(s.j["1"].lado.reflect, 7);
  s = duelo(null, null, ["reflect"], ["splash"]); go(s, "reflect", "splash"); assert.equal(s.j["1"].lado.reflect, 4);
  s = duelo(null, null, ["rain"], ["splash"], ["Normal"], ["Normal"], com("damp-rock")); go(s, "rain-dance", "splash"); assert.equal(s.campo.clima.n, 7);
  s = duelo(null, null, ["rain"], ["splash"], ["Normal"], ["Normal"], com("heat-rock")); go(s, "rain-dance", "splash"); assert.equal(s.campo.clima.n, 4, "rocha errada não vale");
  s = duelo("drought", null, ["splash"], ["splash"], ["Normal"], ["Normal"], com("heat-rock")); assert.equal(s.campo.clima.n, 8);
  s = duelo("electric-surge", null, ["splash"], ["splash"], ["Normal"], ["Normal"], com("terrain-extender")); assert.equal(s.campo.terreno.n, 8);
  s = duelo(null, null, ["trick"], ["splash"], ["Normal"], ["Normal"], {}, com("room-service")); go(s, "trick-room", "splash"); assert.equal(B(s).est.spe, -1); assert.equal(B(s).item, null);
});
t("Eject Button, Eject Pack, Red Card, Shed Shell", () => {
  let s = duelo(null, null, ["tackle"], ["splash"], ["Normal"], ["Normal"], {}, com("eject-button")); go(s, "tackle", "splash"); assert.equal(s.j["2"].pivo, true); assert.equal(B(s).item, null);
  s = duelo(null, null, ["growl"], ["splash"], ["Normal"], ["Normal"], {}, com("eject-pack")); go(s, "growl", "splash"); assert.equal(s.j["2"].pivo, true);
  s = duelo(null, null, ["tackle"], ["splash"], ["Normal"], ["Normal"], {}, com("red-card")); go(s, "tackle", "splash"); assert.equal(s.j["1"].ativo, 1, "o atacante foi puxado"); assert.equal(B(s).item, null);
  s = duelo(null, null, ["tackle"], ["splash"], ["Normal"], ["Normal"], com("shed-shell")); A(s).vol.preso = 3; assert.equal(M.podeTrocar(A(s)), true); A(s).item = null; assert.equal(M.podeTrocar(A(s)), false);
});
import * as M from "./motor.js";
t("Ordem: Quick Claw, Lagging Tail, Custap Berry", () => {
  let s = duelo(null, null, ["tackle"], ["tackle"], ["Normal"], ["Normal"], {spe: 10, ...com("lagging-tail")}, {spe: 10}); let primeiro = 0;
  for (let i = 0; i < 100; i++) { s = duelo(null, null, ["tackle"], ["tackle"], ["Normal"], ["Normal"], {spe: 100, ...com("lagging-tail")}, {spe: 10}); go(s, "tackle", "tackle"); if (/^A /.test(s.log.find(x => /usou/.test(x)))) primeiro++; } assert.equal(primeiro, 0, "Lagging Tail sempre por último");
  let qc = 0; for (let i = 0; i < 1000; i++) { s = duelo(null, null, ["tackle"], ["tackle"], ["Normal"], ["Normal"], {spe: 10, ...com("quick-claw")}, {spe: 200}); go(s, "tackle", "tackle"); if (/^A /.test(s.log.find(x => /usou/.test(x)))) qc++; } assert.ok(qc > 140 && qc < 270, "Quick Claw ~20%: " + qc);
  s = duelo(null, null, ["tackle"], ["tackle"], ["Normal"], ["Normal"], {spe: 10, ...com("custap-berry")}, {spe: 200}); A(s).hpAtual = Math.floor(A(s).hp * 0.2); go(s, "tackle", "tackle"); assert.equal(A(s).vol.custap, true);
  s.log = []; go(s, "tackle", "tackle"); assert.match(s.log.find(x => /usou/.test(x)), /^A /, "Custap: age primeiro"); assert.equal(A(s).vol.custap, false);
});
t("Precisão, crítico, flinch, Power Herb, Binding Band", () => {
  const taxa = (itA, itB, golpe = "lowacc") => { let h = 0; for (let i = 0; i < 1500; i++) { const x = duelo(null, null, [golpe], ["splash"], ["Normal"], ["Normal"], itA ? com(itA) : {}, itB ? com(itB) : {}); go(x, G[golpe].id, "splash"); if (dano(x, "2") > 0) h++; } return h; };
  const b = taxa(), w = taxa("wide-lens"), br = taxa(null, "brightpowder"); assert.ok(w > b, `Wide Lens ${b}→${w}`); assert.ok(br < b, `BrightPowder ${b}→${br}`);
  const crit = (item) => { let c = 0; for (let i = 0; i < 1500; i++) { const x = duelo(null, null, ["tackle"], ["splash"], ["Normal"], ["Normal"], item ? com(item) : {}); go(x, "tackle", "splash"); if (/crítico!/.test(log(x))) c++; } return c; };
  assert.ok(crit("scope-lens") > crit() * 2, "Scope Lens");
  let fl = 0; for (let i = 0; i < 1500; i++) { const x = duelo(null, null, ["tackle"], ["tackle"], ["Normal"], ["Normal"], {spe: 200, ...com("kings-rock")}, {spe: 10}); go(x, "tackle", "tackle"); if (/recuou/.test(log(x))) fl++; } assert.ok(fl > 100 && fl < 220, "King's Rock ~10%: " + fl);
  let s = duelo(null, null, ["solar"], ["splash"], ["Normal"], ["Normal"], com("power-herb")); go(s, "solar-beam", "splash"); assert.ok(dano(s, "2") > 0, "Power Herb: sai no 1º turno"); assert.equal(A(s).item, null);
  s = duelo(null, null, ["solar"], ["splash"]); go(s, "solar-beam", "splash"); assert.equal(dano(s, "2"), 0);
  const prender = it => { const x = duelo(null, null, ["firespin", "splash"], ["splash"], ["Normal"], ["Normal"], it ? com(it) : {}); fixo(0.5, () => go(x, "fire-spin", "splash")); const d1 = dano(x, "2"); fixo(0.5, () => go(x, "splash", "splash")); return dano(x, "2") - d1; };
  assert.ok(prender("binding-band") > prender(null), "Binding Band");
  const x = duelo(null, null, ["tackle"], ["splash"], ["Normal"], ["Normal"], com("pecha-berry")); assert.ok(x);
  const pk2 = duelo("pickpocket", null, ["splash"], ["tackle"], ["Normal"], ["Normal"], {}, com("leftovers")); // Pickpocket (A) rouba de quem toca nele
  const pp = duelo(null, "pickpocket", ["tackle"], ["splash"], ["Normal"], ["Normal"], com("leftovers")); go(pp, "tackle", "splash"); assert.equal(B(pp).item?.id, "leftovers"); assert.equal(A(pp).item, null);
  const mg = duelo("magician", null, ["tackle"], ["splash"], ["Normal"], ["Normal"], {}, com("leftovers")); go(mg, "tackle", "splash"); assert.equal(A(mg).item?.id, "leftovers");
});
t("Caixas e inventário", () => {
  const N = 30000, comb = {0: 0, 1: 0, 2: 0, 3: 0}, tiers = {comum: 0, incomum: 0, raro: 0}; let tot = 0;
  for (let i = 0; i < N; i++) { const r = sortearCaixa(); assert.equal(r.itens.length + r.cristais, CAIXA.total, "sempre 5 coisas"); assert.ok(r.cristais >= 0 && r.cristais <= 3); comb[r.cristais]++; for (const id of r.itens) { tiers[itemPorId(id).tier]++; tot++; assert.ok(!itemPorId(id).semEfeito); } }
  for (const n of [0, 1, 2, 3]) perto(comb[n] / N, 0.25, 0.015, "combinações uniformes (5+0, 4+1, 3+2, 2+3)");
  perto(tiers.comum / tot, 0.6, 0.02, "60% comuns"); perto(tiers.incomum / tot, 0.3, 0.02, "30% incomuns"); perto(tiers.raro / tot, 0.1, 0.02, "10% raros");
  { let pb = 0; for (let i = 0; i < N; i++) if (sortearCaixa().pokebola) pb++; perto(pb / N, 0.2, 0.01, "20% de Pokébola na caixa"); }
  assert.equal(sortearCaixa(() => 0.1).pokebola, true); assert.equal(sortearCaixa(() => 0.5).pokebola, false);
  assert.equal(sortearCaixa(() => 0.1).cristais, 0); assert.equal(sortearCaixa(() => 0.4).cristais, 1); assert.equal(sortearCaixa(() => 0.6).cristais, 2); assert.equal(sortearCaixa(() => 0.9).cristais, 3);
  // bots
  let nenhum = 0, ch = 0; for (let i = 0; i < 2000; i++) { if (!itemDeBot("facil")) nenhum++; const r = itemDeBot("chefe"); assert.ok(r && itemPorId(r.id).tier !== "comum"); }
  perto(nenhum / 2000, 0.7, 0.04, "fácil: 30% com item"); for (let i = 0; i < 300; i++) assert.ok(itemDeBot("dificil")); 
  // cópias
  assert.equal(copiasLivres({leftovers: 2}, {a: "leftovers"}, "leftovers", "b"), 1); assert.equal(copiasLivres({leftovers: 2}, {a: "leftovers"}, "leftovers", "a"), 2); assert.equal(copiasLivres({}, {}, "leftovers", "a"), 0);
  assert.deepEqual(itemEquipado("a", {leftovers: 1}, {a: "leftovers"}), {id: "leftovers", nome: "Leftovers"}); assert.equal(itemEquipado("a", {}, {a: "leftovers"}), null); assert.deepEqual(contarEquipados({a: "x", b: "x", c: "y"}), {x: 2, y: 1});
});
// ----- simulação: todos os itens do catálogo em batalhas aleatórias -----
const HABS = "intimidate levitate sturdy sheer-force mold-breaker blaze guts klutz unburden unnerve gluttony ripen cheek-pouch harvest pickpocket magician frisk speed-boost contrary magic-guard poison-heal static rough-skin multiscale".split(" ");
const pool = ["tackle", "strong", "swift", "ember", "flamethrower", "surf", "earthquake", "slash", "closecombat", "growl", "twave", "wisp", "toxic", "rain", "sand", "swords", "recover", "splash", "quick", "fury", "reflect", "trick", "firespin", "solar", "taunt", "hypervoice", "leech", "burner", "vine", "bark"];
const TIPOS = ["Normal", "Fire", "Water", "Grass", "Electric", "Ground", "Dark", "Fighting", "Flying", "Steel", "Ghost", "Dragon", "Poison"];
const rnd = a => a[Math.floor(Math.random() * a.length)];
const eq = () => [0, 1, 2].map(i => pk("P" + i + Math.random().toString(36).slice(2, 5), [rnd(TIPOS)], rnd(HABS), [0, 1, 2, 3].map(() => rnd(pool)), {spe: 30 + Math.floor(Math.random() * 120), item: Math.random() < 0.9 ? it(rnd(ITENS).id) : null}));
let batalhas = 0, rodadas = 0;
for (let b = 0; b < 2500; b++) {
  const s = {fase: "batalha", rodada: 1, log: [], vencedor: null, escolhas: {"1": null, "2": null}, campo: {}, j: {"1": {equipe: eq(), ativo: 0}, "2": {equipe: eq(), ativo: 0}}}; iniciarBatalha(s, s.log);
  let g = 0;
  while (s.fase !== "fim" && g++ < 80) {
    for (const k of ["1", "2"]) { let h = 0; while (precisaTrocar(s.j[k]) && h++ < 5) { const op = vivos(s.j[k]).filter(i => i !== s.j[k].ativo); const L = []; enviar(s, k, rnd(op), L, "enviou"); s.log = s.log.concat(L); fimDeBatalha(s, L); } }
    if (s.fase === "fim") break;
    s.escolhas = {"1": {tipo: "golpe", idx: Math.floor(Math.random() * 4)}, "2": {tipo: "golpe", idx: Math.floor(Math.random() * 4)}}; resolverRodada(s); rodadas++;
    for (const k of ["1", "2"]) for (const p of s.j[k].equipe) { assert.ok(Number.isFinite(p.hpAtual) && p.hpAtual >= 0 && p.hpAtual <= p.hp, "HP inválido " + p.hpAtual); for (const v of Object.values(p.est)) assert.ok(v >= -6 && v <= 6, "estágio fora do limite"); assert.ok(p.item === null || typeof p.item.id === "string"); }
  }
  batalhas++;
}
console.log(`${n} grupos de cenários ok; simulação: ${batalhas} batalhas com os 135 itens, ${rodadas} rodadas, sem erros`);
console.log("TUDO CERTO (itens e caixas)");
