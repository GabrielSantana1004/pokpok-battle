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

t("Intimidate no início, nos trocas e imunidades", () => {
  let s = sala(pk("A", ["Normal"], "intimidate", ["tackle"]), pk("B", ["Normal"], null, ["tackle"])); assert.equal(B(s).est.atk, -1);
  s = sala(pk("A", ["Normal"], "intimidate", ["tackle"]), pk("B", ["Normal"], "inner-focus", ["tackle"])); assert.equal(B(s).est.atk, 0);
  s = sala(pk("A", ["Normal"], "intimidate", ["tackle"]), pk("B", ["Normal"], "clear-body", ["tackle"])); assert.equal(B(s).est.atk, 0); assert.match(log(s), /impede a queda/);
  s = sala(pk("A", ["Normal"], "intimidate", ["tackle"]), pk("B", ["Normal"], "contrary", ["tackle"])); assert.equal(B(s).est.atk, 1);
  s = sala(pk("A", ["Normal"], "intimidate", ["tackle"]), pk("B", ["Normal"], "defiant", ["tackle"])); assert.equal(B(s).est.atk, 1, "-1 e +2 do Defiant");
  s = sala(pk("A", ["Normal"], "intimidate", ["tackle"]), pk("B", ["Normal"], "competitive", ["tackle"])); assert.equal(B(s).est.spa, 2);
  s = sala(pk("A", ["Normal"], null, ["tackle"]), pk("B", ["Normal"], null, ["tackle"])); s.j["1"].equipe[1] = pk("I", ["Normal"], "intimidate", ["tackle"]); enviar(s, "1", 1, []); // troca
  assert.equal(B(s).est.atk, -1);
  s = sala(pk("A", ["Normal"], "intimidate", ["tackle"]), pk("B", ["Normal"], null, ["growl"])); go(s, "tackle", "growl"); assert.equal(A(s).est.atk, -1, "Growl é queda do oponente (sem habilidade = cai)");
  s = sala(pk("A", ["Normal"], "hyper-cutter", ["tackle"]), pk("B", ["Normal"], null, ["growl"])); go(s, "tackle", "growl"); assert.equal(A(s).est.atk, 0, "Hyper Cutter");
  s = sala(pk("A", ["Normal"], "clear-body", ["tackle"]), pk("B", ["Normal"], null, ["closecombat"])); go(s, "tackle", "closecombat"); assert.equal(B(s).est.def, -1, "queda própria não é bloqueada");
});
t("Clima e terreno ao entrar (inclusive ao trocar e megaevoluir)", () => {
  let s = sala(pk("A", ["Fire"], "drought", ["tackle"]), pk("B", ["Normal"], null, ["tackle"])); assert.equal(s.campo.clima.t, "sol");
  s = sala(pk("A", ["Water"], "drizzle", ["tackle"]), pk("B", ["Normal"], "sand-stream", ["tackle"])); assert.equal(s.campo.clima.t, "areia", "o mais lento entra por último e vence");
  s = sala(pk("A", ["Water"], "electric-surge", ["tackle"]), pk("B", ["Normal"], null, ["tackle"])); assert.equal(s.campo.terreno.t, "eletrico");
  s = sala(pk("A", ["Normal"], "snow-warning", ["tackle"]), pk("B", ["Normal"], null, ["tackle"])); assert.equal(s.campo.clima.t, "neve");
  s = sala(pk("A", ["Fire"], null, ["tackle"], {megas: [{nome: "Mega A", slug: "a-mega", tipos: ["Fire"], atk: 100, def: 100, spa: 100, spd: 100, spe: 100, hp: 100, habilidade: {id: "drought", nome: "Drought"}}]}), pk("B", ["Normal"], null, ["tackle"]));
  s.escolhas = {"1": {tipo: "golpe", idx: 0, mega: 0}, "2": {tipo: "golpe", idx: 0}}; resolverRodada(s); assert.equal(A(s).habilidade.id, "drought"); assert.equal(s.campo.clima.t, "sol");
});
t("Levitate, absorções e Mold Breaker", () => {
  let s = duelo(null, "levitate", ["earthquake"], ["splash"]); go(s, "earthquake", "splash"); assert.equal(dano(s, "2"), 0); assert.match(log(s), /levitate/i);
  s = duelo("mold-breaker", "levitate", ["earthquake"], ["splash"]); go(s, "earthquake", "splash"); assert.ok(dano(s, "2") > 0, "Mold Breaker ignora Levitate");
  s = duelo(null, "flash-fire", ["flamethrower"], ["splash"]); go(s, "flamethrower", "splash"); assert.equal(dano(s, "2"), 0); assert.equal(B(s).vol.flash, true);
  s = duelo(null, "water-absorb", ["surf"], ["splash"]); B(s).hpAtual = 50; go(s, "surf", "splash"); assert.equal(B(s).hpAtual, 50 + Math.floor(B(s).hp / 4), "cura 25%");
  s = duelo(null, "volt-absorb", ["thunderbolt"], ["splash"]); go(s, "thunderbolt", "splash"); assert.equal(dano(s, "2"), 0);
  s = duelo(null, "lightning-rod", ["thunderbolt"], ["splash"]); go(s, "thunderbolt", "splash"); assert.equal(B(s).est.spa, 1);
  s = duelo(null, "sap-sipper", ["vine"], ["splash"]); go(s, "vine", "splash"); assert.equal(B(s).est.atk, 1);
  s = duelo(null, "motor-drive", ["thunderbolt"], ["splash"]); go(s, "thunderbolt", "splash"); assert.equal(B(s).est.spe, 1);
  s = duelo(null, "flash-fire", ["wisp"], ["splash"]); go(s, "wisp", "splash"); assert.equal(B(s).cond, null);
  // Flash Fire depois de absorver aumenta o próprio Fire
  const sA = fixo(0.5, () => { const x = sala(pk("A", ["Normal"], null, ["flamethrower", "splash"]), pk("B", ["Fire"], "flash-fire", ["ember", "splash"])); go(x, "flamethrower", "ember"); return x; });
  assert.equal(B(sA).vol.flash, true);
  const sem = fixo(0.5, () => { const x = sala(pk("A", ["Normal"], null, ["splash"]), pk("B", ["Fire"], null, ["ember"])); go(x, "splash", "ember"); return dano(x, "1"); });
  const com = fixo(0.5, () => { const x = sala(pk("A", ["Normal"], null, ["flamethrower", "splash"]), pk("B", ["Fire"], "flash-fire", ["ember", "splash"])); go(x, "flamethrower", "ember"); x.escolhas = {"1": {tipo: "golpe", idx: 1}, "2": {tipo: "golpe", idx: 0}}; A(x).hpAtual = A(x).hp; resolverRodada(x); return dano(x, "1"); });
  assert.ok(com > sem, `Flash Fire reforça Fire (${sem} → ${com})`);
  s = duelo(null, "soundproof", ["splash"], ["splash"]); // som: sem golpe de som na lista de teste, só confere a tabela
});
t("Sturdy", () => {
  let s = duelo(null, "sturdy", ["strong"], ["splash"], ["Normal"], ["Normal"], {atk: 900}); fixo(0.5, () => go(s, "strong", "splash")); assert.equal(B(s).hpAtual, 1); assert.match(log(s), /sturdy/i);
  s = duelo(null, "sturdy", ["strong"], ["splash"], ["Normal"], ["Normal"], {atk: 900}); B(s).hpAtual = B(s).hp - 1; fixo(0.5, () => go(s, "strong", "splash")); assert.equal(B(s).hpAtual, 0, "só vale com HP cheio");
  s = duelo(null, "sturdy", ["fissure"], ["splash"]); fixo(0.25, () => go(s, "fissure", "splash")); assert.equal(B(s).hpAtual, B(s).hp); assert.match(log(s), /sturdy/i);
});
t("Modificadores de poder e de atributo", () => {
  const base = danoAtk(null, null, "tackle");
  assert.ok(danoAtk("technician", null, "tackle") > base * 1.35, "Technician");
  assert.ok(danoAtk("huge-power", null, "tackle") > base * 1.8, "Huge Power");
  const sBurn = (h) => fixo(0.5, () => { const s = duelo(h, null, ["strong"], ["splash"]); A(s).cond = "queimadura"; go(s, "strong", "splash"); return dano(s, "2"); });
  const semBurn = danoAtk(null, null, "strong"); assert.ok(sBurn(null) < semBurn * 0.6, "queimadura corta"); assert.ok(sBurn("guts") > semBurn * 1.3, "Guts + sem penalidade");
  assert.ok(danoAtk(null, "thick-fat", "ember", ["Normal"]) < danoAtk(null, null, "ember", ["Normal"]) * 0.6, "Thick Fat");
  assert.ok(danoAtk("adaptability", null, "tackle", ["Normal"]) > base * 1.25, "Adaptability");
  const mult = danoAtk(null, "multiscale", "tackle"); assert.ok(mult < base * 0.6, "Multiscale com HP cheio");
  const hpBaixo = (h, tp) => fixo(0.5, () => { const s = duelo(h, null, ["ember"], ["splash"], tp); A(s).hpAtual = 20; go(s, "ember", "splash"); return dano(s, "2"); });
  assert.ok(hpBaixo("blaze", ["Fire"]) > hpBaixo(null, ["Fire"]) * 1.4, "Blaze com pouco HP"); assert.equal(hpBaixo("torrent", ["Fire"]), hpBaixo(null, ["Fire"]), "Torrent não ajuda Fire");
  assert.ok(danoAtk("iron-fist", null, "tackle") === base, "Iron Fist só soco");
  assert.ok(danoAtk("scrappy", null, "tackle", ["Normal"], ["Ghost"]) > 0, "Scrappy acerta Ghost"); assert.equal(danoAtk(null, null, "tackle", ["Normal"], ["Ghost"]), 0);
  assert.ok(danoAtk("pixilate", null, "tackle", ["Normal"], ["Dragon"]) > 0, "Pixilate: Normal vira Fairy (acerta Dragon)... Dragon é fraco a Fairy ×2");
  assert.ok(danoAtk("filter", null, "ember", ["Normal"], ["Grass"]) >= 0);
  assert.ok(danoAtk(null, "filter", "ember", ["Normal"], ["Grass"]) < danoAtk(null, null, "ember", ["Normal"], ["Grass"]), "Filter reduz super efetivo");
  assert.ok(danoAtk(null, "fur-coat", "tackle") < base * 0.6 && danoAtk(null, "ice-scales", "swift") < danoAtk(null, null, "swift") * 0.6);
});
t("Sheer Force e Serene Grace", () => {
  let queimou = 0, queimouSF = 0, queimouSG = 0;
  for (let i = 0; i < 700; i++) { for (const [h, set] of [[null, 0], ["sheer-force", 1], ["serene-grace", 2]]) { const s = duelo(h, null, ["flamethrower"], ["splash"], ["Normal"], ["Normal"], {}, {}); go(s, "flamethrower", "splash"); if (B(s).cond === "queimadura") { if (set === 0) queimou++; if (set === 1) queimouSF++; if (set === 2) queimouSG++; } } }
  assert.equal(queimouSF, 0, "Sheer Force remove o efeito secundário"); assert.ok(queimou > 30 && queimou < 120, "10%: " + queimou); assert.ok(queimouSG > queimou * 1.4, `Serene Grace dobra (${queimou} → ${queimouSG})`);
  assert.ok(danoAtk("sheer-force", null, "flamethrower", ["Normal"]) > danoAtk(null, null, "flamethrower", ["Normal"]) * 1.2, "Sheer Force dá ×1,3");
});
t("Contato e reações ao ser atingido", () => {
  let para = 0, queima = 0, veneno = 0, especial = 0;
  for (let i = 0; i < 500; i++) {
    let s = duelo(null, "static", ["tackle"], ["splash"]); go(s, "tackle", "splash"); if (A(s).cond === "paralisia") para++;
    s = duelo(null, "flame-body", ["tackle"], ["splash"]); go(s, "tackle", "splash"); if (A(s).cond === "queimadura") queima++;
    s = duelo(null, "poison-point", ["tackle"], ["splash"]); go(s, "tackle", "splash"); if (A(s).cond === "veneno") veneno++;
    s = duelo(null, "static", ["swift"], ["splash"]); go(s, "swift", "splash"); if (A(s).cond) especial++;
  }
  for (const [nome, v] of [["Static", para], ["Flame Body", queima], ["Poison Point", veneno]]) assert.ok(v > 100 && v < 200, `${nome} ~30%: ${v}`);
  assert.equal(especial, 0, "golpe especial não é contato");
  let s = duelo(null, "rough-skin", ["tackle"], ["splash"]); go(s, "tackle", "splash"); assert.equal(dano(s, "1"), Math.floor(A(s).hp / 8));
  s = duelo(null, "iron-barbs", ["tackle"], ["splash"]); go(s, "tackle", "splash"); assert.ok(dano(s, "1") > 0);
  s = duelo("magic-guard", "rough-skin", ["tackle"], ["splash"]); go(s, "tackle", "splash"); assert.equal(dano(s, "1"), 0);
  s = duelo("poison-touch", null, ["tackle"], ["splash"]); let v = 0; for (let i = 0; i < 300; i++) { s = duelo("poison-touch", null, ["tackle"], ["splash"]); go(s, "tackle", "splash"); if (B(s).cond === "veneno") v++; } assert.ok(v > 50 && v < 130, "Poison Touch " + v);
  s = duelo(null, "weak-armor", ["tackle"], ["splash"]); go(s, "tackle", "splash"); assert.deepEqual([B(s).est.def, B(s).est.spe], [-1, 2]);
  s = duelo(null, "weak-armor", ["swift"], ["splash"]); go(s, "swift", "splash"); assert.deepEqual([B(s).est.def, B(s).est.spe], [0, 0]);
  s = duelo(null, "justified", ["bark"], ["splash"]); go(s, "bark", "splash"); assert.equal(B(s).est.atk, 1);
  s = duelo(null, "stamina", ["tackle"], ["splash"]); go(s, "tackle", "splash"); assert.equal(B(s).est.def, 1);
  s = fixo(0.99, () => { const x = duelo(null, "anger-point", ["tackle"], ["splash"]); go(x, "tackle", "splash"); return x; }); assert.equal(B(s).est.atk, 6, "crítico → Anger Point");
  s = duelo("moxie", null, ["strong"], ["splash"], ["Normal"], ["Normal"], {atk: 900}); B(s).hpAtual = 5; go(s, "strong", "splash"); assert.equal(A(s).est.atk, 1);
  s = duelo("beast-boost", null, ["swift"], ["splash"], ["Normal"], ["Normal"], {spa: 900}); B(s).hpAtual = 5; go(s, "swift", "splash"); assert.equal(A(s).est.spa, 1, "o atributo mais alto sobe");
});
t("Condições bloqueadas, Synchronize e saída de campo", () => {
  let s = duelo(null, "limber", ["twave"], ["splash"]); go(s, "twave", "splash"); assert.equal(B(s).cond, null);
  s = duelo(null, "insomnia", ["spore"], ["splash"]); go(s, "spore", "splash"); assert.equal(B(s).cond, null);
  s = duelo(null, "water-veil", ["wisp"], ["splash"]); go(s, "wisp", "splash"); assert.equal(B(s).cond, null);
  s = duelo(null, "leaf-guard", ["wisp"], ["splash"]); s.campo.clima = {t: "sol", n: 5}; go(s, "wisp", "splash"); assert.equal(B(s).cond, null);
  s = duelo(null, "synchronize", ["wisp"], ["splash"]); go(s, "wisp", "splash"); assert.equal(B(s).cond, "queimadura"); assert.equal(A(s).cond, "queimadura");
  s = duelo(null, null, ["splash"], ["splash"]); A(s).habilidade = {id: "natural-cure", nome: "Natural Cure"}; A(s).cond = "veneno"; enviar(s, "1", 1, []); assert.equal(s.j["1"].equipe[0].cond, null);
  s = duelo(null, null, ["splash"], ["splash"]); A(s).habilidade = {id: "regenerator", nome: "Regenerator"}; A(s).hpAtual = 30; const hp0 = 30; enviar(s, "1", 1, []); assert.equal(s.j["1"].equipe[0].hpAtual, hp0 + Math.floor(A(s) && s.j["1"].equipe[0].hp / 3));
});
t("Fim da rodada: Speed Boost, curas, clima", () => {
  let s = duelo("speed-boost", null, ["splash"], ["splash"]); go(s, "splash", "splash"); assert.equal(A(s).est.spe, 1);
  s = duelo("ice-body", null, ["splash"], ["splash"]); s.campo.clima = {t: "neve", n: 5}; A(s).hpAtual = 50; go(s, "splash", "splash"); assert.ok(A(s).hpAtual > 50);
  s = duelo("rain-dish", null, ["splash"], ["splash"]); s.campo.clima = {t: "chuva", n: 5}; A(s).hpAtual = 50; go(s, "splash", "splash"); assert.ok(A(s).hpAtual > 50);
  s = duelo("hydration", null, ["splash"], ["splash"]); s.campo.clima = {t: "chuva", n: 5}; A(s).cond = "veneno"; go(s, "splash", "splash"); assert.equal(A(s).cond, null);
  s = duelo("poison-heal", null, ["splash"], ["splash"]); A(s).cond = "veneno"; A(s).hpAtual = 50; go(s, "splash", "splash"); assert.ok(A(s).hpAtual > 50);
  s = duelo("magic-guard", null, ["splash"], ["splash"]); A(s).cond = "queimadura"; s.campo.clima = {t: "areia", n: 5}; go(s, "splash", "splash"); assert.equal(A(s).hpAtual, A(s).hp, "Magic Guard: sem dano indireto");
  s = duelo(null, null, ["splash"], ["splash"]); s.campo.clima = {t: "areia", n: 5}; go(s, "splash", "splash"); assert.ok(A(s).hpAtual < A(s).hp);
  s = duelo("overcoat", null, ["splash"], ["splash"]); s.campo.clima = {t: "areia", n: 5}; go(s, "splash", "splash"); assert.equal(A(s).hpAtual, A(s).hp);
  s = duelo("solar-power", null, ["splash"], ["splash"]); s.campo.clima = {t: "sol", n: 5}; go(s, "splash", "splash"); assert.ok(A(s).hpAtual < A(s).hp);
  s = duelo("cloud-nine", null, ["splash"], ["splash"], ["Normal"], ["Water"]); s.campo.clima = {t: "chuva", n: 5};
  const d = (h) => fixo(0.5, () => { const x = duelo(h, null, ["surf"], ["splash"]); x.campo.clima = {t: "chuva", n: 5}; go(x, "surf", "splash"); return dano(x, "2"); });
  assert.ok(danoAtk(null, null, "surf") > 0); const chuva = d(null), nueve = fixo(0.5, () => { const x = duelo(null, "cloud-nine", ["surf"], ["splash"]); x.campo.clima = {t: "chuva", n: 5}; go(x, "surf", "splash"); return dano(x, "2"); }); assert.ok(nueve < chuva, "Cloud Nine anula o bônus da chuva");
});
t("Velocidade, prioridade, precisão e críticos", () => {
  const ordem = (s) => { const l = s.log.filter(x => /usou/.test(x)); return l.map(x => x[0]); };
  let s = duelo("swift-swim", null, ["tackle"], ["tackle"], ["Normal"], ["Normal"], {spe: 40}, {spe: 60}); s.campo.clima = {t: "chuva", n: 5}; go(s, "tackle", "tackle"); assert.match(s.log.find(x => /usou/.test(x)), /^A /, "Swift Swim: A age primeiro");
  s = duelo(null, null, ["tackle"], ["tackle"], ["Normal"], ["Normal"], {spe: 40}, {spe: 60}); go(s, "tackle", "tackle"); assert.match(s.log.find(x => /usou/.test(x)), /^B /);
  s = duelo("prankster", null, ["splash"], ["tackle"], ["Normal"], ["Normal"], {spe: 10}, {spe: 200}); go(s, "splash", "tackle"); assert.match(s.log.find(x => /usou/.test(x)), /^A /, "Prankster +1");
  s = duelo("prankster", null, ["twave"], ["splash"], ["Normal"], ["Dark"]); go(s, "twave", "splash"); assert.equal(B(s).cond, null); assert.match(log(s), /não afeta/);
  s = duelo("protean", null, ["ember"], ["splash"]); go(s, "ember", "splash"); assert.deepEqual(A(s).tipos, ["Fire"]);
  s = fixo(0.99, () => { const x = duelo(null, "shell-armor", ["slash"], ["splash"]); go(x, "slash", "splash"); return x; }); assert.doesNotMatch(log(s), /crítico!/);
  s = fixo(0.99, () => { const x = duelo(null, null, ["slash"], ["splash"]); go(x, "slash", "splash"); return x; }); assert.match(log(s), /crítico!/);
  let acertos = 0, base = 0; for (let i = 0; i < 400; i++) { let x = duelo("no-guard", null, ["fissure"], ["splash"]); go(x, "fissure", "splash"); if (dano(x, "2") > 0) acertos++; x = duelo(null, null, ["fissure"], ["splash"]); go(x, "fissure", "splash"); if (dano(x, "2") > 0) base++; }
  assert.ok(acertos === 400 && base < 200, `No Guard: sempre acerta (${acertos}) vs ${base}`);
  s = duelo("analytic", null, ["tackle"], ["tackle"], ["Normal"], ["Normal"], {spe: 10}, {spe: 200}); assert.ok(fixo(0.5, () => { go(s, "tackle", "tackle"); return dano(s, "2"); }) > 0);
});
t("Cobertura", () => {
  assert.equal(estadoHabilidade("intimidate").estado, "ok"); assert.equal(estadoHabilidade("arena-trap").estado, "nao"); assert.equal(estadoHabilidade("unnerve").estado, "ok"); assert.equal(estadoHabilidade("honey-gather").estado, "itens");
  assert.equal(estadoHabilidade("telepathy").estado, "na"); assert.equal(estadoHabilidade("pressure").estado, "na"); assert.equal(estadoHabilidade("oblivious").estado, "ok"); assert.equal(estadoHabilidade("mind's-eye").estado, "parcial");
  assert.equal(marcaHabilidade("intimidate"), ""); assert.match(marcaHabilidade("arena-trap"), /sem efeito/);
  const r = relatorioCobertura([{id: "x", nome: "X", habilidades: [{id: "intimidate", nome: "Intimidate", oculta: false}, {id: "arena-trap", nome: "Trace", oculta: true}], megas: []}]);
  assert.equal(r.total, 2); assert.deepEqual([r.cont.ok, r.cont.nao], [1, 1]);
});
t("Sem habilidade e estado serializável", () => {
  const s = sala(pk("A", ["Normal"], null, ["tackle"]), pk("B", ["Normal"], null, ["tackle"])); go(s, "tackle", "tackle");
  const walk = (o, c = "s") => { assert.notEqual(o, undefined, c); if (typeof o === "number") assert.ok(Number.isFinite(o), c); if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) walk(v, c + "." + k); }; walk(s);
});

// ----- simulação: habilidades aleatórias em muitas batalhas -----
const HABS = "intimidate levitate sturdy sheer-force shell-armor flash-fire mold-breaker swift-swim blaze overgrow torrent clear-body flame-body water-absorb weak-armor iron-fist guts ice-body natural-cure steadfast technician thick-fat beast-boost hyper-cutter keen-eye moxie rock-head infiltrator hydration reckless regenerator sand-veil snow-cloak static synchronize volt-absorb anger-point battle-armor chlorophyll competitive justified limber poison-touch sand-rush sap-sipper soundproof adaptability drought lightning-rod scrappy speed-boost strong-jaw analytic cloud-nine hustle huge-power multiscale prankster protean drizzle sand-stream snow-warning electric-surge rough-skin iron-barbs serene-grace contrary simple defiant magic-guard poison-heal no-guard solar-power filter fur-coat marvel-scale tinted-lens pixilate stamina quark-drive protosynthesis motor-drive dry-skin".split(" ");
const pool = ["tackle", "strong", "swift", "ember", "flamethrower", "surf", "thunderbolt", "vine", "bark", "earthquake", "slash", "closecombat", "growl", "twave", "wisp", "spore", "toxic", "rain", "sand", "swords", "recover", "splash", "quick", "fissure"];
const TIPOS = ["Normal", "Fire", "Water", "Grass", "Electric", "Ground", "Dark", "Fighting", "Flying", "Steel", "Ghost", "Dragon"];
const rnd = a => a[Math.floor(Math.random() * a.length)];
const eq = () => [0, 1, 2].map(i => pk("P" + i + Math.random().toString(36).slice(2, 5), [rnd(TIPOS)], rnd(HABS), [0, 1, 2, 3].map(() => rnd(pool)), {spe: 30 + Math.floor(Math.random() * 120)}));
let batalhas = 0, rodadas = 0;
for (let b = 0; b < 1500; b++) {
  const s = {fase: "batalha", rodada: 1, log: [], vencedor: null, escolhas: {"1": null, "2": null}, campo: {}, j: {"1": {equipe: eq(), ativo: 0}, "2": {equipe: eq(), ativo: 0}}}; iniciarBatalha(s, s.log);
  let g = 0;
  while (s.fase !== "fim" && g++ < 80) {
    for (const k of ["1", "2"]) { let h = 0; while (precisaTrocar(s.j[k]) && h++ < 5) { const op = vivos(s.j[k]).filter(i => i !== s.j[k].ativo); const L = []; enviar(s, k, rnd(op), L, "enviou"); s.log = s.log.concat(L); fimDeBatalha(s, L); } }
    if (s.fase === "fim") break;
    s.escolhas = {"1": {tipo: "golpe", idx: Math.floor(Math.random() * 4)}, "2": {tipo: "golpe", idx: Math.floor(Math.random() * 4)}}; resolverRodada(s); rodadas++;
    for (const k of ["1", "2"]) for (const p of s.j[k].equipe) { assert.ok(Number.isFinite(p.hpAtual) && p.hpAtual >= 0 && p.hpAtual <= p.hp, "HP inválido"); for (const v of Object.values(p.est)) assert.ok(v >= -6 && v <= 6, "estágio fora do limite"); }
  }
  batalhas++;
}
console.log(`${n} grupos de cenários ok; simulação: ${batalhas} batalhas com habilidades aleatórias, ${rodadas} rodadas, sem erros`);
console.log("TUDO CERTO (habilidades em batalha)");
