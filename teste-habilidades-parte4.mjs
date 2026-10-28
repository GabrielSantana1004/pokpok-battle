// Testes do motor de habilidades em batalha (sem Firebase): cada gancho com um cenário dirigido + uma simulação aleatória.
import assert from "node:assert/strict";
import { copiaPokemon, resolverRodada, ativoDe, vivos, precisaTrocar, enviar, fimDeBatalha, iniciarBatalha } from "./motor.js";
import { podeTrocar } from "./motor.js";
import { estadoHabilidade, relatorioCobertura, marcaHabilidade } from "./habilidades.js";

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
  quick: {id: "quick", nome: "Quick", tipo: "Normal", cat: "fisico", poder: 40, precisao: 100, prioridade: 1},
};
const mapa = Object.fromEntries(Object.values(G).map(g => [g.nome, {prioridade: 0, efeitos: [], ...g, suportado: true, versao: 2}]));

Object.assign(G, {
  pulse: {id: "dark-pulse", nome: "Dark Pulse", tipo: "Dark", cat: "especial", poder: 80, precisao: 100},
  cut: {id: "cut", nome: "Cut", tipo: "Normal", cat: "fisico", poder: 70, precisao: 100},
  voice: {id: "hyper-voice", nome: "Hyper Voice", tipo: "Normal", cat: "especial", poder: 90, precisao: 100},
  fury: {id: "fury-swipes", nome: "Fury Swipes", tipo: "Normal", cat: "fisico", poder: 18, precisao: 100, efeitos: [E("multi", {min: 2, max: 5})]},
  moonblast: {id: "moonblast", nome: "Moonblast", tipo: "Fairy", cat: "especial", poder: 95, precisao: 100},
  protect: {id: "protect", nome: "Protect", tipo: "Normal", cat: "status", poder: null, precisao: null, prioridade: 4, efeitos: [E("protecao", {})]},
  ember2: {id: "ember-x", nome: "EmberX", tipo: "Fire", cat: "especial", poder: 40, precisao: 100},
  gust: {id: "gust", nome: "Gust", tipo: "Flying", cat: "especial", poder: 40, precisao: 100},
  drain: {id: "drain-punch", nome: "Drain Punch", tipo: "Fighting", cat: "fisico", poder: 75, precisao: 100, efeitos: [E("dreno", {fracao: 0.5})]},
  explosion: {id: "explosion", nome: "Explosion", tipo: "Normal", cat: "fisico", poder: 250, precisao: 100, efeitos: [E("explodir", {})]},
  stealth: {id: "stealth-rock", nome: "Stealth Rock", tipo: "Rock", cat: "status", poder: null, precisao: null, efeitos: [E("armadilha", {a: "rocha"})]},
  roar: {id: "roar", nome: "Roar", tipo: "Normal", cat: "status", poder: null, precisao: null, prioridade: -6, efeitos: [E("troca", {modo: "forcar"})]},
  kings: {id: "kings-shield", nome: "Kings Shield", tipo: "Steel", cat: "status", poder: null, precisao: null, prioridade: 4, efeitos: [E("protecao", {})]},
  solar: {id: "solar-beam", nome: "Solar Beam", tipo: "Grass", cat: "especial", poder: 120, precisao: 100, efeitos: [E("carga", {sol: true})]},
  shadow: {id: "shadow-ball", nome: "Shadow Ball", tipo: "Ghost", cat: "especial", poder: 80, precisao: 100},
  lowacc: {id: "lowacc", nome: "LowAcc", tipo: "Normal", cat: "fisico", poder: 40, precisao: 50},
  psychic: {id: "psychic", nome: "Psychic", tipo: "Psychic", cat: "especial", poder: 90, precisao: 100},
  sand2: {id: "rock-slide", nome: "Rock Slide", tipo: "Rock", cat: "fisico", poder: 75, precisao: 100},
});
const mapa2 = Object.fromEntries(Object.values(G).map(g => [g.nome, {prioridade: 0, efeitos: [], ...g, suportado: true, versao: 2}]));
Object.assign(mapa, mapa2);
const pk = (nome, tipos, hab, mvs, o = {}) => copiaPokemon({id: nome, nome, tipos, hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 80, nivel: 50, megas: [],
  habilidade: hab ? {id: hab, nome: hab} : null, mv: mvs.map(n => ({nome: G[n].nome, tipo: G[n].tipo, cat: G[n].cat, poder: G[n].poder, precisao: G[n].precisao})), ...o}, mapa);
const sala = (a, b, extra = {}) => { const s = {fase: "batalha", rodada: 1, log: [], vencedor: null, escolhas: {"1": null, "2": null}, campo: {}, ...extra,
  j: {"1": {equipe: [a, pk("res1", ["Normal"], null, ["tackle"])], ativo: 0}, "2": {equipe: [b, pk("res2", ["Normal"], null, ["tackle"])], ativo: 0}}}; iniciarBatalha(s, s.log); return s; };
const A = s => ativoDe(s.j["1"]), B = s => ativoDe(s.j["2"]);
const mv = (P, id) => P.mv.findIndex(m => m.id === (G[id]?.id || id));
const go = (s, g1, g2, z = {}) => { s.escolhas = {"1": g1 == null ? {tipo: "golpe", idx: 0} : {tipo: "golpe", idx: mv(A(s), g1), ...(z.a || {})}, "2": g2 == null ? {tipo: "golpe", idx: 0} : {tipo: "golpe", idx: mv(B(s), g2)}}; return resolverRodada(s); };
const fixo = (v, f) => { const o = Math.random; Math.random = () => v; try { return f(); } finally { Math.random = o; } }; // dados fixos: 0,5 = sem crítico, 0,99 = crítico
const dano = (s, k) => ativoDe(s.j[k]).hp - ativoDe(s.j[k]).hpAtual;
const log = s => s.log.join("\n");
let n = 0; const t = (nome, f) => { f(); n++; };
const duelo = (ha, hb, ma, mb, tA = ["Normal"], tB = ["Normal"], oa = {}, ob = {}) => sala(pk("A", tA, ha, ma, oa), pk("B", tB, hb, mb, ob));

const danoAtk = (ha, hb, g, tA, tB, oa, ob) => fixo(0.5, () => { const s = duelo(ha, hb, [g], ["splash"], tA, tB, oa, ob); go(s, g, "splash"); return dano(s, "2"); });
const base = (g, tA, tB, oa, ob) => danoAtk(null, null, g, tA, tB, oa, ob);
const perto = (v, alvo, tol, msg) => assert.ok(Math.abs(v / alvo - 1) <= tol, `${msg}: ${v} vs ${alvo.toFixed(1)}`);
const forte = (hb, g, extra = {}) => { const s = duelo(null, hb, [g], ["splash"], ["Normal"], extra.tB || ["Normal"], {spe: 200}, {...extra.ob}); B(s).hpAtual = extra.hp ?? B(s).hp; return s; };


const com = (ha, g, hb = null, tA, tB, oa, ob) => danoAtk(ha, hb, g, tA, tB, oa, ob);
t("1 Mega Sol: golpes agem como se houvesse sol", () => {
  perto(com("mega-sol", "ember"), base("ember") * 1.5, 0.08, "Fire x1,5"); perto(com("mega-sol", "surf"), base("surf") * 0.5, 0.08, "Water x0,5");
  const s = duelo("mega-sol", null, ["solar"], ["splash"]); fixo(0.5, () => go(s, "solar", "splash")); assert.ok(dano(s, "2") > 0, "Solar Beam sai no mesmo turno");
});
t("2 Poison Puppeteer: envenenado fica confuso", () => { const s = duelo("poison-puppeteer", null, ["toxic"], ["splash"]); go(s, "toxic", "splash"); assert.ok(B(s).cond?.startsWith("veneno")); assert.ok(B(s).conf > 0); });
t("3 Purifying Salt: imune a condições; Ghost x0,5", () => {
  const s = duelo(null, "purifying-salt", ["toxic"], ["splash"]); go(s, "toxic", "splash"); assert.equal(B(s).cond, null);
  perto(com(null, "shadow", "purifying-salt", ["Normal"], ["Water"]), base("shadow", ["Normal"], ["Water"]) * 0.5, 0.08, "ghost");
});
t("4 Queenly Majesty: golpes de prioridade não funcionam", () => { const s = duelo(null, "queenly-majesty", ["quick"], ["splash"]); go(s, "quick", "splash"); assert.equal(dano(s, "2"), 0); assert.match(log(s), /Queenly Majesty/); });
t("5 Soul Heart: +1 Atk Esp quando alguém é derrotado", () => { const s = duelo("soul-heart", null, ["tackle"], ["splash"]); B(s).hpAtual = 1; fixo(0.5, () => go(s, "tackle", "splash")); assert.equal(A(s).est.spa, 1); });
t("6 Supersweet Syrup: reduz a evasão do adversário uma vez por batalha", () => {
  const s = duelo("supersweet-syrup", null, ["splash"], ["splash"]); assert.equal(B(s).est.eva, -1); enviar(s, "1", 1, s.log); enviar(s, "1", 0, s.log); assert.equal(B(s).est.eva, -1, "não repete");
});
t("7 Supreme Overlord: +10% por aliado derrotado", () => {
  const d = caidos => { const s = duelo("supreme-overlord", null, ["tackle"], ["splash"]); if (caidos) s.j["1"].equipe[1].hpAtual = 0; return fixo(0.5, () => { go(s, "tackle", "splash"); return dano(s, "2"); }); };
  perto(d(1), d(0) * 1.1, 0.06, "1 caído");
});
t("8 Victory Star: precisão x1,1", () => {
  const taxa = h => { let c = 0; for (let i = 0; i < 3000; i++) { const s = duelo(h, null, ["lowacc"], ["splash"]); go(s, "lowacc", "splash"); if (dano(s, "2") > 0) c++; } return c / 3000; };
  const a = taxa("victory-star"), b = taxa(null); assert.ok(a > b + 0.02, `victory ${a} vs ${b}`);
});
t("9 Stalwart: não se aplica (sem dupla)", () => assert.equal(estadoHabilidade("stalwart").estado, "na"));
t("10 Aura Guard: contato x0,5", () => { perto(com(null, "tackle", "aura-guard"), base("tackle") * 0.5, 0.06, "contato"); perto(com(null, "ember", "aura-guard"), base("ember"), 0.02, "sem contato"); });
t("11 Dauntless Shield: +1 Def ao entrar (uma vez)", () => { const s = duelo("dauntless-shield", null, ["splash"], ["splash"]); assert.equal(A(s).est.def, 1); enviar(s, "1", 1, s.log); enviar(s, "1", 0, s.log); assert.equal(A(s).est.def, 0); });
t("12 Intrepid Sword: +1 Atk ao entrar (uma vez)", () => { const s = duelo("intrepid-sword", null, ["splash"], ["splash"]); assert.equal(A(s).est.atk, 1); enviar(s, "1", 1, s.log); enviar(s, "1", 0, s.log); assert.equal(A(s).est.atk, 0); });
t("13 Chilling Neigh: +1 Atk ao derrotar", () => { const s = duelo("chilling-neigh", null, ["tackle"], ["splash"]); B(s).hpAtual = 1; fixo(0.5, () => go(s, "tackle", "splash")); assert.equal(A(s).est.atk, 1); });
t("14 Grim Neigh: +1 Atk Esp ao derrotar", () => { const s = duelo("grim-neigh", null, ["tackle"], ["splash"]); B(s).hpAtual = 1; fixo(0.5, () => go(s, "tackle", "splash")); assert.equal(A(s).est.spa, 1); });
t("15 Eelevate: imune a Ground e +1 no maior atributo ao derrotar", () => {
  const s = duelo(null, "eelevate", ["earthquake"], ["splash"]); fixo(0.5, () => go(s, "earthquake", "splash")); assert.equal(dano(s, "2"), 0);
  const s2 = duelo("eelevate", null, ["tackle"], ["splash"], ["Normal"], ["Normal"], {atk: 200}); B(s2).hpAtual = 1; fixo(0.5, () => go(s2, "tackle", "splash")); assert.equal(A(s2).est.atk, 1);
});
t("16-20 Pressure, Run Away, Telepathy, Healer e Plus: não se aplicam", () => { for (const h of ["pressure", "run-away", "telepathy", "healer", "plus"]) assert.equal(estadoHabilidade(h).estado, "na", h); });
t("21-23 Quark Drive, Protosynthesis e Oblivious: completas para este jogo", () => {
  for (const h of ["quark-drive", "protosynthesis", "oblivious"]) assert.equal(estadoHabilidade(h).estado, "ok", h);
  const s = duelo("protosynthesis", null, ["tackle"], ["splash"]); s.campo.clima = {t: "sol", n: 5}; const d = fixo(0.5, () => { go(s, "tackle", "splash"); return dano(s, "2"); }); assert.ok(d > base("tackle") * 1.2, "Atk x1,3 no sol");
  const s2 = duelo(null, "oblivious", ["growl"], ["splash"]); assert.equal(estadoHabilidade("oblivious").estado, "ok");
});
{
  const hs = "mega-sol poison-puppeteer purifying-salt queenly-majesty soul-heart supersweet-syrup supreme-overlord victory-star aura-guard dauntless-shield intrepid-sword chilling-neigh grim-neigh eelevate quark-drive protosynthesis oblivious".split(" ");
  const ms = Object.keys(G), esc = a => a[Math.floor(Math.random() * a.length)], escolhaMv = () => Array.from({length: 4}, () => esc(ms));
  let rod = 0;
  for (let b = 0; b < 600; b++) {
    const s = sala(pk("A", [esc(["Normal", "Grass", "Fire"])], esc(hs), escolhaMv()), pk("B", [esc(["Normal", "Ghost", "Water"])], esc(hs), escolhaMv()));
    for (let r = 0; r < 40 && !fimDeBatalha(s, []); r++) {
      for (const k of ["1", "2"]) if (precisaTrocar(s.j[k])) { const v = vivos(s.j[k]); enviar(s, k, v[0], s.log); }
      const ix = k => Math.floor(Math.random() * ativoDe(s.j[k]).mv.length); s.escolhas = {"1": {tipo: "golpe", idx: ix("1")}, "2": {tipo: "golpe", idx: ix("2")}}; resolverRodada(s); rod++;
      for (const k of ["1", "2"]) for (const p of s.j[k].equipe) { assert.ok(Number.isFinite(p.hpAtual) && p.hpAtual >= 0); for (const v of Object.values(p.est)) assert.ok(v >= -6 && v <= 6); }
      JSON.stringify(s);
    }
  }
  console.log(`parte 4: ${n} cenários ok; simulação: 600 batalhas, ${rod} rodadas, sem erros`);
}
console.log("TUDO CERTO (habilidades, parte 4)");
