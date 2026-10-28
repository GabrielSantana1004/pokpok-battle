// Testes do motor de habilidades em batalha (sem Firebase): cada gancho com um cenário dirigido + uma simulação aleatória.
import assert from "node:assert/strict";
import { copiaPokemon, resolverRodada, ativoDe, vivos, precisaTrocar, enviar, fimDeBatalha, iniciarBatalha } from "./motor.js";
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
const base = (g, tA, tB, oa, ob, hb = null) => fixo(0.5, () => { const s = duelo(null, hb, [g], ["splash"], tA, tB, oa, ob); go(s, g, "splash"); return dano(s, "2"); });
const com = (ha, g, hb = null, tA, tB, oa, ob) => danoAtk(ha, hb, g, tA, tB, oa, ob);
const perto = (v, alvo, tol, msg) => assert.ok(Math.abs(v / alvo - 1) <= tol, `${msg}: ${v} vs ${alvo.toFixed(1)}`);

t("1 Sniper: crítico causa 1,5x a mais", () => {
  const c = ha => fixo(0.99, () => { const s = duelo(ha, null, ["tackle"], ["splash"]); go(s, "tackle", "splash"); return dano(s, "2"); });
  perto(c("sniper"), c(null) * 1.5, 0.06, "sniper com crítico"); perto(com("sniper", "tackle"), base("tackle"), 0.01, "sem crítico não muda");
});
t("2 Skill Link: multigolpe sempre no máximo", () => { for (let i = 0; i < 30; i++) { const s = duelo("skill-link", null, ["fury"], ["splash"]); go(s, "fury", "splash"); assert.match(log(s), /\(5 golpes\)/); } });
t("3 Mega Launcher: golpes de pulso x1,5", () => perto(com("mega-launcher", "pulse"), base("pulse") * 1.5, 0.06, "pulse"));
t("4 Sharpness: golpes de corte x1,5", () => { perto(com("sharpness", "cut"), base("cut") * 1.5, 0.06, "cut"); perto(com("sharpness", "tackle"), base("tackle"), 0.01, "tackle não é de corte"); });
t("5 Rivalry (sem gênero), 12 Heavy Metal e 13 Light Metal (sem peso): marcados como não se aplicam", () => { for (const h of ["rivalry", "heavy-metal", "light-metal"]) assert.equal(estadoHabilidade(h).estado, "na"); });
t("6 Punk Rock: sonoro x1,3 e recebe metade", () => { perto(com("punk-rock", "voice"), base("voice") * 1.3, 0.06, "ataque"); perto(com(null, "voice", "punk-rock"), base("voice") * 0.5, 0.06, "defesa"); });
t("7 Liquid Voice: golpe sonoro vira Water", () => { const s = duelo("liquid-voice", null, ["voice"], ["splash"], ["Normal"], ["Fire"]); fixo(0.5, () => go(s, "voice", "splash")); assert.match(log(s), /Super efetivo/); });
t("8 Dark Aura / 10 Aura Break: golpes Dark x4/3, ou x3/4 com Aura Break em campo", () => {
  const dk = (ha, hb) => fixo(0.5, () => { const s = duelo(ha, hb, ["bark"], ["splash"]); go(s, "bark", "splash"); return dano(s, "2"); });
  perto(dk("dark-aura", null), base("bark") * 4 / 3, 0.06, "aura"); perto(dk("dark-aura", "aura-break"), base("bark") * 0.75, 0.06, "aura + break");
});
t("9 Fairy Aura: golpes Fairy x4/3 (também quando é o adversário que tem)", () => {
  perto(com("fairy-aura", "moonblast"), base("moonblast") * 4 / 3, 0.06, "dono");
  perto(com(null, "moonblast", "fairy-aura"), base("moonblast") * 4 / 3, 0.06, "adversário");
});
t("11 Fluffy: contato x0,5 e Fire x2", () => {
  perto(com(null, "tackle", "fluffy"), base("tackle") * 0.5, 0.06, "contato"); perto(com(null, "ember", "fluffy"), base("ember") * 2, 0.06, "fogo");
  perto(com("long-reach", "tackle", "fluffy"), base("tackle"), 0.06, "Long Reach não faz contato");
});
t("14 Merciless: crítico contra envenenado", () => {
  const s = duelo("merciless", null, ["tackle"], ["splash"]); B(s).cond = "veneno"; fixo(0.5, () => go(s, "tackle", "splash")); assert.match(log(s), /crítico/);
  const s2 = duelo("merciless", null, ["tackle"], ["splash"]); fixo(0.5, () => go(s2, "tackle", "splash")); assert.doesNotMatch(log(s2), /crítico/);
});
t("15 Orichalcum Pulse: chama o sol e Atk x4/3 no sol", () => {
  const s = duelo("orichalcum-pulse", null, ["tackle"], ["splash"]); assert.equal(s.campo.clima.t, "sol");
  const d = fixo(0.5, () => { go(s, "tackle", "splash"); return dano(s, "2"); });
  const s0 = duelo(null, null, ["tackle"], ["splash"]); s0.campo.clima = {t: "sol", n: 5}; perto(d, fixo(0.5, () => { go(s0, "tackle", "splash"); return dano(s0, "2"); }) * 4 / 3, 0.06, "dano");
});
t("16 Hadron Engine: Terreno Elétrico e Atk Esp x4/3 nele", () => {
  const s = duelo("hadron-engine", null, ["thunderbolt"], ["splash"]); assert.equal(s.campo.terreno.t, "eletrico");
  const d = fixo(0.5, () => { go(s, "thunderbolt", "splash"); return dano(s, "2"); });
  const s0 = duelo(null, null, ["thunderbolt"], ["splash"]); s0.campo.terreno = {t: "eletrico", n: 5}; perto(d, fixo(0.5, () => { go(s0, "thunderbolt", "splash"); return dano(s0, "2"); }) * 4 / 3, 0.06, "dano");
});
t("17 Parental Bond: dois golpes, o segundo com 25%", () => perto(com("parental-bond", "tackle"), base("tackle") * 1.25, 0.08, "tackle"));
t("18 Piercing Drill: contato atravessa Protect com 25%; 21 Unseen Fist com 100%", () => {
  const atravessa = ha => fixo(0.5, () => { const s = duelo(ha, null, ["tackle"], ["protect"], ["Normal"], ["Normal"], {spe: 10}, {spe: 200}); go(s, "tackle", "protect"); return dano(s, "2"); });
  perto(atravessa("piercing-drill"), base("tackle") * 0.25, 0.1, "drill"); perto(atravessa("unseen-fist"), base("tackle"), 0.06, "fist"); assert.equal(atravessa(null), 0, "sem a habilidade, Protect bloqueia");
});
t("19 Sword of Ruin: Def dos outros x0,75", () => { perto(com(null, "tackle", "sword-of-ruin"), base("tackle"), 0.01, "o dono não perde"); perto(com("sword-of-ruin", "tackle"), base("tackle") / 0.75, 0.08, "alvo perde 25% de Def"); });
t("20 Mycelium Might: status ignora habilidade do alvo e age por último", () => {
  const s = duelo("mycelium-might", "contrary", ["growl"], ["tackle"], ["Normal"], ["Normal"], {spe: 200}, {spe: 10}); go(s, "growl", "tackle");
  assert.equal(B(s).est.atk, -1, "Contrary ignorada");
  const l = s.log.filter(x => /usou/.test(x)); assert.match(l[0], /^B/, "B age primeiro: " + l.join(" | "));
});
t("22 Long Reach: sem contato (Rough Skin não machuca)", () => {
  let s = duelo("long-reach", "rough-skin", ["tackle"], ["splash"]); fixo(0.5, () => go(s, "tackle", "splash")); assert.equal(dano(s, "1"), 0);
  s = duelo(null, "rough-skin", ["tackle"], ["splash"]); fixo(0.5, () => go(s, "tackle", "splash")); assert.ok(dano(s, "1") > 0);
});
t("23 Dragonize: Normal vira Dragon (x1,2)", () => {
  const s = duelo("dragonize", null, ["tackle"], ["splash"], ["Normal"], ["Fairy"]); fixo(0.5, () => go(s, "tackle", "splash")); assert.match(log(s), /não afeta/i);
  perto(com("dragonize", "tackle", null, ["Water"]), base("tackle", ["Water"]) * 1.2, 0.06, "x1,2 (sem STAB nos dois)");
});
// simulação: todas as habilidades da parte 1 em batalhas aleatórias, sem erro
{
  const hs = "sniper skill-link mega-launcher sharpness punk-rock liquid-voice dark-aura fairy-aura aura-break fluffy merciless orichalcum-pulse hadron-engine parental-bond piercing-drill sword-of-ruin mycelium-might unseen-fist long-reach dragonize".split(" ");
  const ms = Object.keys(G), esc = a => a[Math.floor(Math.random() * a.length)], escolhaMv = () => Array.from({length: 4}, () => esc(ms));
  let rod = 0;
  for (let b = 0; b < 600; b++) {
    const s = sala(pk("A", [esc(["Normal", "Fairy", "Fire"])], esc(hs), escolhaMv()), pk("B", [esc(["Normal", "Steel", "Ghost"])], esc(hs), escolhaMv()));
    for (let r = 0; r < 40 && !fimDeBatalha(s, []); r++) {
      for (const k of ["1", "2"]) if (precisaTrocar(s.j[k])) { const v = vivos(s.j[k]); enviar(s, k, v[0], s.log); }
      const ix = k => Math.floor(Math.random() * ativoDe(s.j[k]).mv.length); s.escolhas = {"1": {tipo: "golpe", idx: ix("1")}, "2": {tipo: "golpe", idx: ix("2")}}; resolverRodada(s); rod++;
      for (const k of ["1", "2"]) for (const p of s.j[k].equipe) assert.ok(Number.isFinite(p.hpAtual));
    }
  }
  console.log(`parte 1: ${n} cenários ok; simulação: 600 batalhas, ${rod} rodadas, sem erros`);
}
console.log("TUDO CERTO (habilidades, parte 1)");
