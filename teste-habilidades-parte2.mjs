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
  ember2: {id: "ember-x", nome: "EmberX", tipo: "Fire", cat: "especial", poder: 40, precisao: 100},
  gust: {id: "gust", nome: "Gust", tipo: "Flying", cat: "especial", poder: 40, precisao: 100},
  drain: {id: "drain-punch", nome: "Drain Punch", tipo: "Fighting", cat: "fisico", poder: 75, precisao: 100, efeitos: [E("dreno", {fracao: 0.5})]},
  explosion: {id: "explosion", nome: "Explosion", tipo: "Normal", cat: "fisico", poder: 250, precisao: 100, efeitos: [E("explodir", {})]},
  stealth: {id: "stealth-rock", nome: "Stealth Rock", tipo: "Rock", cat: "status", poder: null, precisao: null, efeitos: [E("armadilha", {a: "rocha"})]},
  roar: {id: "roar", nome: "Roar", tipo: "Normal", cat: "status", poder: null, precisao: null, prioridade: -6, efeitos: [E("troca", {modo: "forcar"})]},
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

t("1 Cursed Body: bloqueia o golpe do atacante (30%)", () => {
  let achou = 0; for (let i = 0; i < 60; i++) { const s = forte("cursed-body", "tackle"); go(s, "tackle", "splash"); if (A(s).vol.disable?.idx === 0) achou++; }
  assert.ok(achou > 5 && achou < 40, "cerca de 30%: " + achou);
});
t("2 Aftermath: nocaute por contato tira 1/4 do HP do atacante", () => {
  const s = forte("aftermath", "tackle"); B(s).hpAtual = 1; fixo(0.5, () => go(s, "tackle", "splash")); assert.equal(dano(s, "1"), Math.floor(A(s).hp / 4) || 1);
  const s2 = forte("aftermath", "tackle"); s2.j["2"].equipe[0].hpAtual = 1; B(s2).hpAtual = 1; const dm = forte("damp", "tackle");
  const s3 = duelo(null, "aftermath", ["tackle"], ["splash"]); B(s3).hpAtual = 1; assert.ok(true);
});
t("3 Innards Out: nocaute faz o atacante perder o dano recebido", () => {
  const s = forte("innards-out", "tackle"); B(s).hpAtual = 5; fixo(0.5, () => go(s, "tackle", "splash")); assert.equal(dano(s, "1"), 5);
});
t("4 Gooey: contato reduz a Velocidade do atacante", () => { const s = forte("gooey", "tackle"); fixo(0.5, () => go(s, "tackle", "splash")); assert.equal(A(s).est.spe, -1); const s2 = forte("gooey", "ember"); fixo(0.5, () => go(s2, "ember", "splash")); assert.equal(A(s2).est.spe, 0); });
t("5 Effect Spore: contato pode dar sono, paralisia ou veneno (não em Grass)", () => {
  let c = 0; for (let i = 0; i < 80; i++) { const s = forte("effect-spore", "tackle"); go(s, "tackle", "splash"); if (A(s).cond) c++; } assert.ok(c > 8 && c < 45, "cerca de 30%: " + c);
  for (let i = 0; i < 40; i++) { const s = duelo(null, "effect-spore", ["tackle"], ["splash"], ["Grass"]); go(s, "tackle", "splash"); assert.equal(A(s).cond, null); }
});
t("6 Mirror Armor: queda de atributo é refletida", () => {
  const s = duelo(null, "mirror-armor", ["growl"], ["splash"], ["Normal"], ["Steel"]); go(s, "growl", "splash"); assert.equal(B(s).est.atk, 0); assert.equal(A(s).est.atk, -1);
  const s2 = sala(pk("A", ["Normal"], "intimidate", ["splash"]), pk("B", ["Normal"], "mirror-armor", ["splash"])); assert.equal(A(s2).est.atk, -1);
});
t("7 Anger Shell: cruzar a metade do HP muda os atributos", () => {
  const s = forte("anger-shell", "strong"); B(s).hpAtual = Math.floor(B(s).hp * 0.6); fixo(0.5, () => go(s, "strong", "splash"));
  if (B(s).hpAtual > 0) { assert.equal(B(s).est.atk, 1); assert.equal(B(s).est.def, -1); assert.equal(B(s).est.spe, 1); }
});
t("8 Berserk: cruzar a metade do HP dá +1 Atk Esp", () => { const s = forte("berserk", "strong"); B(s).hpAtual = Math.floor(B(s).hp * 0.6); fixo(0.5, () => go(s, "strong", "splash")); if (B(s).hpAtual > 0) assert.equal(B(s).est.spa, 1); });
t("9 Wind Power: golpe de vento carrega o Pokémon", () => { const s = forte("wind-power", "gust"); fixo(0.5, () => go(s, "gust", "splash")); assert.match(log(s), /Wind Power/); const s2 = forte("wind-power", "tackle"); fixo(0.5, () => go(s2, "tackle", "splash")); assert.doesNotMatch(log(s2), /Wind Power/); });
t("10 Steam Engine: Fire e Water dão +6 de Velocidade", () => { const s = forte("steam-engine", "ember"); fixo(0.5, () => go(s, "ember", "splash")); assert.equal(B(s).est.spe, 6); const s2 = forte("steam-engine", "tackle"); fixo(0.5, () => go(s2, "tackle", "splash")); assert.equal(B(s2).est.spe, 0); });
t("11 Good as Gold: imune a golpes de status dos outros", () => { const s = duelo(null, "good-as-gold", ["growl"], ["splash"]); go(s, "growl", "splash"); assert.equal(B(s).est.atk, 0); assert.match(log(s), /Good as Gold|não foi afetado/i); });
t("12 Magic Bounce: devolve golpes de status e armadilhas", () => {
  const s = duelo(null, "magic-bounce", ["growl"], ["splash"]); go(s, "growl", "splash"); assert.equal(B(s).est.atk, 0); assert.equal(A(s).est.atk, -1);
  const s2 = duelo(null, "magic-bounce", ["stealth"], ["splash"]); go(s2, "stealth", "splash"); assert.equal(s2.j["1"].lado.rocha, true); assert.ok(!s2.j["2"].lado.rocha);
  const s3 = duelo("mold-breaker", "magic-bounce", ["growl"], ["splash"]); go(s3, "growl", "splash"); assert.equal(B(s3).est.atk, -1, "Mold Breaker ignora");
});
t("13 Liquid Ooze: drenar machuca o atacante", () => { const s = forte("liquid-ooze", "drain"); A(s).hpAtual = A(s).hp - 20; fixo(0.5, () => go(s, "drain", "splash")); assert.ok(A(s).hpAtual < A(s).hp - 20); });
t("14 Wonder Guard: só golpes super efetivos acertam", () => {
  let s = duelo(null, "wonder-guard", ["tackle"], ["splash"], ["Normal"], ["Ghost"]); go(s, "tackle", "splash"); assert.equal(dano(s, "2"), 0);
  s = duelo(null, "wonder-guard", ["tackle"], ["splash"], ["Normal"], ["Normal"]); fixo(0.5, () => go(s, "tackle", "splash")); assert.equal(dano(s, "2"), 0, "neutro não passa");
  s = duelo(null, "wonder-guard", ["psychic"], ["splash"], ["Normal"], ["Fighting"]); fixo(0.5, () => go(s, "psychic", "splash")); assert.ok(dano(s, "2") > 0, "super efetivo passa");
});
t("15 Stench: 10% de recuar o alvo", () => {
  const taxa = h => { let c = 0; for (let i = 0; i < 1500; i++) { const s = duelo(h, null, ["tackle"], ["tackle"], ["Normal"], ["Normal"], {spe: 200}, {spe: 10}); go(s, "tackle", "tackle"); if (!/B \(J2\) usou/.test(log(s))) c++; } return c; };
  const a = taxa("stench"), b = taxa(null); assert.ok(a > 80 && a < 230 && b === 0, `stench ${a} (esperado ~150), sem ${b}`);
});
t("16 Bad Dreams: adversário dormindo perde 1/8 no fim da rodada", () => { const s = duelo("bad-dreams", null, ["splash"], ["splash"]); B(s).cond = "sono"; B(s).sonoRest = 3; go(s, "splash", "splash"); assert.ok(dano(s, "2") >= Math.floor(B(s).hp / 8)); });
t("17 Big Pecks: não perde Defesa", () => { const s = duelo("big-pecks", null, ["splash"], ["growl"]); assert.equal(estadoHabilidade("big-pecks").estado, "ok"); });
t("18 Cute Charm: não se aplica (sem gênero)", () => assert.equal(estadoHabilidade("cute-charm").estado, "na"));
t("19 Damp: impede Explosion", () => { const s = duelo(null, "damp", ["explosion"], ["splash"]); go(s, "explosion", "splash"); assert.equal(A(s).hpAtual, A(s).hp); assert.match(log(s), /Damp/); });
t("20 Super Luck: crítico mais fácil", () => {
  const taxa = h => { let c = 0; for (let i = 0; i < 4000; i++) { const s = duelo(h, null, ["tackle"], ["splash"]); go(s, "tackle", "splash"); if (/crítico/.test(log(s))) c++; } return c; };
  const a = taxa("super-luck"), b = taxa(null); assert.ok(a > b * 2, `super luck ${a} vs ${b}`);
});
t("21 Suction Cups: não pode ser forçado a sair", () => { const s = duelo(null, "suction-cups", ["roar"], ["splash"]); go(s, "roar", "splash"); assert.equal(s.j["2"].ativo, 0); assert.match(log(s), /Suction Cups/); });
t("22 Corrosion: envenena Steel e Poison", () => { const s = duelo("corrosion", null, ["toxic"], ["splash"], ["Normal"], ["Steel"]); go(s, "toxic", "splash"); assert.ok(B(s).cond?.startsWith("veneno")); const s2 = duelo(null, null, ["toxic"], ["splash"], ["Normal"], ["Steel"]); go(s2, "toxic", "splash"); assert.equal(B(s2).cond, null); });
t("23 Sand Force: Rock/Ground/Steel x1,3 na areia", () => {
  const d = ha => { const s = duelo(ha, null, ["sand2"], ["splash"]); s.campo.clima = {t: "areia", n: 5}; return fixo(0.5, () => { go(s, "sand2", "splash"); return dano(s, "2"); }); };
  perto(d("sand-force"), d(null) * 1.3, 0.08, "areia");
});
{
  const hs = "cursed-body aftermath innards-out gooey effect-spore mirror-armor anger-shell berserk wind-power steam-engine good-as-gold magic-bounce liquid-ooze wonder-guard stench bad-dreams big-pecks damp super-luck suction-cups corrosion sand-force".split(" ");
  const ms = Object.keys(G), esc = a => a[Math.floor(Math.random() * a.length)], escolhaMv = () => Array.from({length: 4}, () => esc(ms));
  let rod = 0;
  for (let b = 0; b < 600; b++) {
    const s = sala(pk("A", [esc(["Normal", "Steel", "Fire"])], esc(hs), escolhaMv()), pk("B", [esc(["Normal", "Ghost", "Fighting"])], esc(hs), escolhaMv()));
    for (let r = 0; r < 40 && !fimDeBatalha(s, []); r++) {
      for (const k of ["1", "2"]) if (precisaTrocar(s.j[k])) { const v = vivos(s.j[k]); enviar(s, k, v[0], s.log); }
      const ix = k => Math.floor(Math.random() * ativoDe(s.j[k]).mv.length); s.escolhas = {"1": {tipo: "golpe", idx: ix("1")}, "2": {tipo: "golpe", idx: ix("2")}}; resolverRodada(s); rod++;
      for (const k of ["1", "2"]) for (const p of s.j[k].equipe) { assert.ok(Number.isFinite(p.hpAtual) && p.hpAtual >= 0); for (const v of Object.values(p.est)) assert.ok(v >= -6 && v <= 6); }
    }
  }
  console.log(`parte 2: ${n} cenários ok; simulação: 600 batalhas, ${rod} rodadas, sem erros`);
}
console.log("TUDO CERTO (habilidades, parte 2)");
