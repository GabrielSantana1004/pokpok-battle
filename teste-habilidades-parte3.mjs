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

const ord = s => s.log.filter(x => /usou/.test(x)).map(x => x[0]);
t("1 Quick Feet: com condição, Vel x1,5 e sem corte da paralisia", () => {
  const s = duelo("quick-feet", null, ["tackle"], ["tackle"], ["Normal"], ["Normal"], {spe: 100}, {spe: 130}); A(s).cond = "paralisia"; fixo(0.5, () => go(s, "tackle", "tackle")); assert.equal(ord(s)[0], "A");
  const s2 = duelo(null, null, ["tackle"], ["tackle"], ["Normal"], ["Normal"], {spe: 100}, {spe: 130}); A(s2).cond = "paralisia"; fixo(0.5, () => go(s2, "tackle", "tackle")); assert.equal(ord(s2)[0], "B");
});
t("2 Stall: sempre age por último", () => { const s = duelo("stall", null, ["tackle"], ["tackle"], ["Normal"], ["Normal"], {spe: 300}, {spe: 10}); go(s, "tackle", "tackle"); assert.equal(ord(s)[0], "B"); });
t("3 Slow Start: Atk e Vel pela metade nos 5 primeiros turnos", () => {
  const d = turnos => { const s = duelo("slow-start", null, ["tackle"], ["splash"]); A(s).vol.t = turnos; return fixo(0.5, () => { go(s, "tackle", "splash"); return dano(s, "2"); }); };
  perto(d(0), d(5) * 0.5, 0.1, "slow start");
});
t("4 Truant: age de turno sim, turno não", () => {
  const s = duelo("truant", null, ["tackle"], ["splash"]); go(s, "tackle", "splash"); const d1 = dano(s, "2"); assert.ok(d1 > 0);
  go(s, "tackle", "splash"); assert.equal(dano(s, "2"), d1); assert.match(log(s), /mandrião/); go(s, "tackle", "splash"); assert.ok(dano(s, "2") > d1);
});
t("5 Early Bird: sono mais curto", () => { for (let i = 0; i < 30; i++) { const s = duelo(null, "early-bird", ["spore"], ["splash"]); go(s, "spore", "splash"); if (B(s).cond === "sono") assert.ok(B(s).sonoRest <= 1); } });
t("6 Shadow Tag: prende quem não é Ghost (nem outro Shadow Tag)", () => {
  const a = pk("A", ["Normal"], "shadow-tag", ["tackle"]), b = pk("B", ["Normal"], null, ["tackle"]), g = pk("G", ["Ghost"], null, ["tackle"]), st = pk("S", ["Normal"], "shadow-tag", ["tackle"]);
  assert.equal(podeTrocar(b, a), false); assert.equal(podeTrocar(g, a), true); assert.equal(podeTrocar(st, a), true); assert.equal(podeTrocar(b, null), true);
});
t("7 Magnet Pull: prende só Steel", () => { const a = pk("A", ["Electric"], "magnet-pull", ["tackle"]); assert.equal(podeTrocar(pk("S", ["Steel"], null, ["tackle"]), a), false); assert.equal(podeTrocar(pk("N", ["Normal"], null, ["tackle"]), a), true); });
t("8 Emergency Exit: cair abaixo de metade força a troca", () => { const s = forte("emergency-exit", "strong"); B(s).hpAtual = Math.floor(B(s).hp * 0.6); fixo(0.5, () => go(s, "strong", "splash")); if (B(s).hpAtual > 0 && B(s).hpAtual * 2 <= B(s).hp) assert.equal(s.j["2"].pivo, true); });
t("9 Tangled Feet: confuso, evita metade dos golpes", () => {
  let e = 0; for (let i = 0; i < 600; i++) { const s = duelo(null, "tangled-feet", ["tackle"], ["splash"]); B(s).conf = 5; go(s, "tackle", "splash"); if (/errou/.test(log(s))) e++; }
  assert.ok(e > 200 && e < 400, "erros ~50%: " + e);
});
t("10 Unaware: ignora aumentos do outro ao atacar e ao defender", () => {
  const sA = duelo(null, "unaware", ["tackle"], ["splash"]); A(sA).est.atk = 6; const d1 = fixo(0.5, () => { go(sA, "tackle", "splash"); return dano(sA, "2"); });
  perto(d1, base("tackle"), 0.05, "defende ignorando Atk +6");
  const sB = duelo("unaware", null, ["tackle"], ["splash"]); B(sB).est.def = 6; perto(fixo(0.5, () => { go(sB, "tackle", "splash"); return dano(sB, "2"); }), base("tackle"), 0.05, "ataca ignorando Def +6");
});
t("11 Download: sobe o ataque certo", () => { const s = duelo("download", null, ["splash"], ["splash"], ["Normal"], ["Normal"], {}, {def: 50, spd: 100}); assert.equal(A(s).est.atk, 1); const s2 = duelo("download", null, ["splash"], ["splash"], ["Normal"], ["Normal"], {}, {def: 100, spd: 50}); assert.equal(A(s2).est.spa, 1); });
t("12 Trace: copia a habilidade do oponente e volta ao sair", () => {
  const s = duelo("trace", "intimidate", ["splash"], ["splash"]); assert.equal(A(s).habilidade.id, "intimidate"); assert.equal(B(s).est.atk, -1, "Intimidate copiado"); assert.equal(A(s).est.atk, -1, "o original também age");
  enviar(s, "1", 1, s.log); assert.equal(s.j["1"].equipe[0].habilidade.id, "trace");
});
t("13 Forewarn: revela o golpe mais forte", () => { const s = duelo("forewarn", null, ["splash"], ["tackle", "strong"]); assert.match(log(s), /Forewarn.*Strong/); });
t("14 Anticipation: percebe golpe super efetivo", () => { const s = duelo("anticipation", null, ["splash"], ["psychic"], ["Fighting"]); assert.match(log(s), /Anticipation/); const s2 = duelo("anticipation", null, ["splash"], ["tackle"], ["Normal"]); assert.doesNotMatch(log(s2), /Anticipation/); });
t("15 Moody: muda atributos no fim da rodada", () => { const s = duelo("moody", null, ["splash"], ["splash"]); go(s, "splash", "splash"); assert.ok(Object.values(A(s).est).some(v => v !== 0)); });
t("16 Neutralizing Gas: apaga as outras habilidades", () => {
  const s = sala(pk("A", ["Normal"], "neutralizing-gas", ["splash"]), pk("B", ["Normal"], "intimidate", ["splash"])); assert.equal(A(s).est.atk, 0);
  const s2 = duelo("neutralizing-gas", "levitate", ["earthquake"], ["splash"]); fixo(0.5, () => go(s2, "earthquake", "splash")); assert.ok(dano(s2, "2") > 0, "Levitate anulado");
  const s3 = duelo(null, "levitate", ["earthquake"], ["splash"]); fixo(0.5, () => go(s3, "earthquake", "splash")); assert.equal(dano(s3, "2"), 0, "sem gás, Levitate vale");
});
t("17 Delta Stream: tira a fraqueza do Flying", () => {
  const d = ha => { const s = duelo(ha, null, ["thunderbolt"], ["splash"], ["Normal"], ["Flying"]); return fixo(0.5, () => { go(s, "thunderbolt", "splash"); return dano(s, "2"); }); };
  perto(d("delta-stream"), d(null) / 2, 0.08, "elétrico vs Flying");
});
t("18 Disguise: o primeiro golpe é absorvido", () => {
  const s = duelo(null, "disguise", ["tackle"], ["splash"]); fixo(0.5, () => go(s, "tackle", "splash")); assert.equal(dano(s, "2"), Math.floor(B(s).hp / 8)); assert.match(log(s), /disfarce/);
  fixo(0.5, () => go(s, "tackle", "splash")); assert.ok(dano(s, "2") > Math.floor(B(s).hp / 8) + 5, "o segundo golpe causa dano normal");
});
t("19 Zen Mode: abaixo de metade vira Psychic e troca Atk/AtkEsp", () => {
  const s = duelo(null, "zen-mode", ["splash"], ["splash"], ["Normal"], ["Fire"], {}, {atk: 140, spa: 30}); const atk0 = B(s).atk; B(s).hpAtual = Math.floor(B(s).hp * 0.4); go(s, "splash", "splash");
  assert.equal(B(s).zen, true); assert.ok(B(s).tipos.includes("Psychic")); assert.equal(B(s).spa, atk0); B(s).hpAtual = B(s).hp; go(s, "splash", "splash"); assert.equal(B(s).zen, false); assert.equal(B(s).atk, atk0);
});
t("20 Stance Change: golpe de dano vira Blade (troca Atk/Def); trocar volta ao Shield", () => {
  const s = duelo("stance-change", null, ["tackle"], ["splash"], ["Steel"], ["Normal"], {atk: 50, def: 140, spa: 50, spd: 140}); const d0 = A(s).def; go(s, "tackle", "splash"); assert.equal(A(s).lamina, true); assert.equal(A(s).atk, d0);
  enviar(s, "1", 1, s.log); assert.equal(s.j["1"].equipe[0].def, d0);
});
t("21-23 Multitype, RKS System e Illusion: não se aplicam", () => { for (const h of ["multitype", "rks-system", "illusion"]) assert.equal(estadoHabilidade(h).estado, "na"); });
{
  const hs = "quick-feet stall slow-start truant early-bird shadow-tag magnet-pull emergency-exit tangled-feet unaware download trace forewarn anticipation moody neutralizing-gas delta-stream disguise zen-mode stance-change".split(" ");
  const ms = Object.keys(G), esc = a => a[Math.floor(Math.random() * a.length)], escolhaMv = () => Array.from({length: 4}, () => esc(ms));
  let rod = 0;
  for (let b = 0; b < 600; b++) {
    const s = sala(pk("A", [esc(["Normal", "Steel", "Flying"])], esc(hs), escolhaMv()), pk("B", [esc(["Normal", "Ghost", "Fire"])], esc(hs), escolhaMv()));
    for (let r = 0; r < 40 && !fimDeBatalha(s, []); r++) {
      for (const k of ["1", "2"]) if (precisaTrocar(s.j[k])) { const v = vivos(s.j[k]); enviar(s, k, v[0], s.log); }
      const ix = k => Math.floor(Math.random() * ativoDe(s.j[k]).mv.length); s.escolhas = {"1": {tipo: "golpe", idx: ix("1")}, "2": {tipo: "golpe", idx: ix("2")}}; resolverRodada(s); rod++;
      for (const k of ["1", "2"]) for (const p of s.j[k].equipe) { assert.ok(Number.isFinite(p.hpAtual) && p.hpAtual >= 0 && Number.isFinite(p.atk) && Number.isFinite(p.def)); for (const v of Object.values(p.est)) assert.ok(v >= -6 && v <= 6); }
      JSON.stringify(s);
    }
  }
  console.log(`parte 3: ${n} cenários ok; simulação: 600 batalhas, ${rod} rodadas, sem erros`);
}
console.log("TUDO CERTO (habilidades, parte 3)");
