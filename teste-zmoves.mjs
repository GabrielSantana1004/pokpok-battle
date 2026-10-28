// Testes do golpe Z (sem Firebase): tabela de poder, golpe sintético, prioridade, Protect e simulação de batalhas.
import assert from "node:assert/strict";
import { poderZ, golpeZ, elegivelZ, Z_NOMES } from "./zmoves.js";
import { copiaPokemon, resolverRodada, ativoDe, vivos, precisaTrocar, enviar, fimDeBatalha } from "./motor.js";

// tabela oficial
const tab = [[40, 100], [55, 100], [60, 120], [65, 120], [70, 140], [75, 140], [80, 160], [85, 160], [90, 175], [95, 175], [100, 180], [110, 185], [120, 190], [125, 190], [130, 195], [150, 200]];
for (const [p, z] of tab) assert.equal(poderZ(p), z, `poder ${p}`);
assert.equal(Object.keys(Z_NOMES).length, 18);
// só golpes de dano com poder
assert.equal(elegivelZ({cat: "status", poder: null, tipo: "Fire"}), false);
assert.equal(elegivelZ({cat: "fisico", poder: 0, tipo: "Fire"}), false);
assert.equal(elegivelZ({cat: "especial", poder: 90, tipo: "Fire"}), true);
const z = golpeZ({id: "flamethrower", nome: "Flamethrower", tipo: "Fire", cat: "especial", poder: 90, precisao: 100, prioridade: 0, efeitos: [{t: "condicao", condicao: "queimadura", alvo: "alvo", chance: 10}]});
assert.deepEqual([z.nome, z.poder, z.precisao, z.prioridade, z.efeitos.length, z.z, z.tipo, z.cat], ["Inferno Overdrive", 175, null, 0, 0, true, "Fire", "especial"]);
assert.equal(golpeZ({cat: "status", tipo: "Fire"}), null);

// ----- engine -----
const mk = (id, tipos, mv, extra = {}) => { // golpes de status precisam de uma entrada no mapa de golpes (como na coleção "golpes")
  const mapa = {};
  for (const [nome, tipo, cat, , prioridade = 0, precisao = 100, efeitos = []] of mv) if (cat === "status") mapa[nome] = {id: nome.toLowerCase(), nome, tipo, cat, precisao: null, prioridade, efeitos, suportado: true, versao: 2, alvoTipo: null};
  return copiaPokemon({id, nome: id, tipos, hp: 80, atk: 100, def: 80, spa: 100, spd: 80, spe: 80, nivel: 50, megas: [],
    mv: mv.map(([nome, tipo, cat, poder, prioridade = 0, precisao = 100]) => ({nome, tipo, cat, poder, precisao, prioridade})), ...extra}, mapa); };
const sala = (a, b, extra = {}) => ({fase: "batalha", rodada: 1, log: [], vencedor: null, escolhas: {"1": null, "2": null}, campo: {}, ...extra,
  j: {"1": {equipe: [a, mk("reserva1", ["Normal"], [["Tackle", "Normal", "fisico", 40]])], ativo: 0}, "2": {equipe: [b, mk("reserva2", ["Normal"], [["Tackle", "Normal", "fisico", 40]])], ativo: 0}}});
const hp = (s, k) => ativoDe(s.j[k]).hpAtual;

// 1) golpe Z: poder pela tabela e nunca erra (mesmo com precisão baixa); sempre dá dano neste alvo neutro
{ let erros = 0, danos = [];
  for (let i = 0; i < 200; i++) {
    const s = sala(mk("A", ["Fire"], [["Weak Burn", "Fire", "especial", 70, 0, 30]]), mk("B", ["Normal"], [["Tackle", "Normal", "fisico", 40]]));
    s.escolhas = {"1": {tipo: "golpe", idx: 0, z: true}, "2": {tipo: "golpe", idx: 0}}; resolverRodada(s);
    if (!s.log.some(l => l.includes("Inferno Overdrive")) || !s.log.some(l => l.includes("liberou o poder Z"))) erros++;
    danos.push(80 * 0 + (ativoDe(s.j["2"]).hp - hp(s, "2")));
  }
  assert.equal(erros, 0, "o golpe Z sempre acontece (nunca erra)");
  assert.ok(Math.min(...danos) > 0); console.log("golpe Z: dano mínimo/máximo contra neutro:", Math.min(...danos), Math.max(...danos), "(golpe base poder 70, 30% de precisão)"); }
// sem Z o mesmo golpe erra com frequência (precisão 30%)
{ let errou = 0; for (let i = 0; i < 200; i++) { const s = sala(mk("A", ["Fire"], [["Weak Burn", "Fire", "especial", 70, 0, 30]]), mk("B", ["Normal"], [["Splash", "Normal", "status", null]])); s.escolhas = {"1": {tipo: "golpe", idx: 0}, "2": {tipo: "golpe", idx: 0}}; resolverRodada(s); if (hp(s, "2") === ativoDe(s.j["2"]).hp) errou++; } assert.ok(errou > 80, "sem Z erra muito: " + errou); }
// 2) prioridade: Z de um golpe prioritário (Quick Attack) NÃO tem prioridade; o adversário mais rápido age primeiro
{ let primeiroRapido = 0, N = 100;
  for (let i = 0; i < N; i++) {
    const s = sala(mk("Lento", ["Normal"], [["Quick Attack", "Normal", "fisico", 40, 1]], {spe: 10}), mk("Rapido", ["Normal"], [["Tackle", "Normal", "fisico", 40]], {spe: 200}));
    s.escolhas = {"1": {tipo: "golpe", idx: 0, z: true}, "2": {tipo: "golpe", idx: 0}}; resolverRodada(s);
    const l = s.log.filter(x => /usou/.test(x)); if (l[0].includes("Tackle")) primeiroRapido++; }
  assert.equal(primeiroRapido, N, "Z de golpe prioritário não ganha prioridade"); }
// 3) Protect: o Z atravessa com 25% do dano
{ const dano = z_ => { let t = 0; const N = 60;
    for (let i = 0; i < N; i++) { const A = mk("A", ["Fire"], [["Flamethrower", "Fire", "especial", 90]], {spe: 10}), B = mk("B", ["Normal"], [["Protect", "Normal", "status", null, 4, 100, [{t: "protecao"}]]], {spe: 10});
      const s = sala(A, B); s.escolhas = {"1": {tipo: "golpe", idx: 0, z: z_}, "2": {tipo: "golpe", idx: 0}}; resolverRodada(s); t += ativoDe(s.j["2"]).hp - hp(s, "2"); }
    return t / N; };
  const semZ = dano(false), comZ = dano(true); console.log("contra Protect: sem Z", semZ, "| com Z", comZ.toFixed(1));
  assert.equal(semZ, 0); assert.ok(comZ > 0, "o Z atravessa o Protect"); }
// 4) golpe de status com z (não deveria acontecer pela sala, mas o motor não quebra): usa o golpe normal
{ const s = sala(mk("A", ["Normal"], [["Growl", "Normal", "status", null]]), mk("B", ["Normal"], [["Tackle", "Normal", "fisico", 40]])); s.escolhas = {"1": {tipo: "golpe", idx: 0, z: true}, "2": {tipo: "golpe", idx: 0}}; resolverRodada(s); assert.ok(s.log.some(l => l.includes("Growl"))); }
// 5) simulação: milhares de batalhas com Z em momentos aleatórios, sem quebrar nem perder JSON
const T = ["Normal", "Fire", "Water", "Grass", "Electric", "Ground", "Flying", "Ice", "Rock", "Ghost", "Dragon"];
let batalhas = 0, comZ = 0;
for (let b = 0; b < 600; b++) {
  const eq = k => Array.from({length: 3}, (_, i) => mk(`P${k}${i}`, [T[(b + i + k) % 11]], [0, 1, 2, 3].map(j => [`M${j}`, T[(b + j + i) % 11], j % 3 === 0 ? "status" : j % 2 ? "fisico" : "especial", j % 3 === 0 ? null : 40 + 15 * j, j === 1 && i === 0 ? 1 : 0, 90 + (j % 2) * 10])));
  const s = sala(eq(1)[0], eq(2)[0]); s.j["1"].equipe = eq(1); s.j["2"].equipe = eq(2);
  let g = 0, zUsos = {"1": 0, "2": 0};
  while (s.fase === "batalha" && g++ < 400) {
    let pend = false;
    for (const k of ["1", "2"]) { const J = s.j[k]; if (precisaTrocar(J)) { const L = []; enviar(s, k, vivos(J).filter(i => i !== J.ativo)[0], L, "enviou"); fimDeBatalha(s, L); pend = true; } }
    if (pend || s.fase !== "batalha") continue;
    for (const k of ["1", "2"]) { const J = s.j[k], A = ativoDe(J), idx = Math.floor(Math.random() * A.mv.length);
      const pedeZ = !J.zUsada && !A.slugMega && golpeZ(A.mv[idx]) && Math.random() < 0.3;
      if (pedeZ) { J.zUsada = true; zUsos[k]++; }
      s.escolhas[k] = {tipo: "golpe", idx, z: !!pedeZ}; }
    resolverRodada(s); JSON.parse(JSON.stringify(s));
  }
  assert.ok(g < 400, "batalha travada"); batalhas++; if (zUsos["1"] + zUsos["2"]) comZ++;
  assert.ok(zUsos["1"] <= 1 && zUsos["2"] <= 1);
}
console.log(`simulação: ${batalhas} batalhas ok, ${comZ} com golpe Z`);
console.log("TUDO CERTO (golpe Z)");
