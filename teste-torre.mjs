// Testes do modo Torre (sem Firebase): fila, chefes mega, avanço de andar e XP geométrico.
import assert from "node:assert/strict";
import { filaTorre, torreAvancar, reescalar, nivelNaTorre } from "./torre.js";
import { copiaPokemon, megaBloqueada, resolverRodada, ativoDe, vivos, precisaTrocar, enviar, fimDeBatalha } from "./motor.js";
import { xpTorre, xpTorreTotal, TORRE_ANDARES, infoNivel } from "./nivel.js";

assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(xpTorre), [1, 2, 2, 3, 5, 8, 11]);   // +50% por vitória (1,5 ao quadrado...), arredondado
assert.deepEqual([0, 1, 2, 3, 4, 5].map(xpTorreTotal), [0, 1, 3, 5, 8, 13]);     // acumulado = soma dos andares

const T = ["Normal", "Fire", "Water", "Grass", "Electric", "Ground", "Flying", "Ice", "Rock"];
const mk = i => ({id: "p" + i, nome: "Mon" + i, tipos: [T[i % 9]], hp: 60 + i % 30, atk: 70, def: 70, spa: 70, spd: 70, spe: 50 + i * 3 % 50, mv: [], nivel: 50,
  aprende: [0, 1, 2, 3].map(j => ({nome: `Mv${i}_${j}`, tipo: T[(i + j) % 9], cat: j % 2 ? "fisico" : "especial", poder: 70, precisao: 100, prioridade: 0})),
  megas: i % 4 === 0 ? [{nome: "Mega" + i, slug: "mon" + i + "-mega", tipos: ["Fire"], hp: 60, atk: 120, def: 90, spa: 120, spd: 90, spe: 90}] : []});
const cat = Array.from({length: 60}, (_, i) => mk(i));
const sortear = async (c, n) => ({equipe: c.slice().sort(() => Math.random() - .5).slice(0, n).map(p => ({...p, mv: p.aprende})), mapa: {}});

const fila0 = await filaTorre(cat, sortear);
const fila = fila0;
assert.equal(fila.length, TORRE_ANDARES);
assert.equal(new Set(fila.map(p => p.id)).size, TORRE_ANDARES, "sem repetição");
fila.forEach((p, i) => { const a = i + 1;
  assert.equal(!!p.chefe, a % 10 === 0, `andar ${a}`);
  assert.equal(!!p.slugMega, a % 10 === 0, `mega só nos chefes (andar ${a})`);
  assert.equal(p.nivel, 50); });
assert.ok(JSON.stringify(fila).length < 300000, "cabe folgado no documento do Firestore");
console.log("fila ok:", fila.length, "andares;", JSON.stringify(fila).length, "bytes; chefes:", fila.filter(p => p.chefe).map(p => p.nome).join(", "));

// simulação: jogador com equipe de nível L contra a torre inteira
async function subir(L, tam = 3) {
  const f = await filaTorre(cat, sortear), eq = (await sortear(cat, tam)).equipe.map((p, i) => copiaPokemon({...p, nivel: i === 0 ? L : Math.max(50, L - 20)}, {}));
  const s = {fase: "batalha", bot: true, botNivel: "normal", rodada: 1, log: [], vencedor: null, escolhas: {"1": null, "2": null}, campo: {},
    torre: {n: 0, andar: 1, total: f.length, fila: f.slice(1)}, j: {"1": {uid: "u", equipe: eq, ativo: 0}, "2": {uid: "bot", bot: true, ativo: 0, equipe: [f[0]]}}};
  reescalar(f[0], nivelNaTorre(s, f[0])); s.niveisVistos = [f[0].nivel];
  const {botEscolha} = await import("./botia.js").catch(() => ({}));
  let g = 0;
  while (s.fase === "batalha" && g++ < 3000) {
    const J = s.j["1"];
    if (precisaTrocar(J)) { const L2 = []; enviar(s, "1", vivos(J).filter(i => i !== J.ativo)[0], L2, "enviou"); fimDeBatalha(s, L2); torreAvancar(s); continue; }
    s.escolhas["1"] = {tipo: "golpe", idx: Math.floor(Math.random() * ativoDe(J).mv.length), mega: null};
    const B = ativoDe(s.j["2"]); s.escolhas["2"] = {tipo: "golpe", idx: Math.floor(Math.random() * B.mv.length), mega: null};
    const a0 = s.torre.andar; resolverRodada(s); torreAvancar(s);
    if (s.torre.andar !== a0) { const p = ativoDe(s.j["2"]); s.niveisVistos.push(p.nivel); if (p.chefe) s.chefesVistos = (s.chefesVistos || []).concat(p.nivel); }
    JSON.parse(JSON.stringify(s));
  }
  return s;
}
const alto = await subir(80, 6); // time com Pokémon nível 80 (+5 = 85; chefe 95): deve ir longe
console.log("nível 80:", alto.torre.completa ? "chegou ao topo" : "caiu no andar " + alto.torre.andar, "| derrotados:", alto.torre.n, "| fase:", alto.fase, "vencedor:", alto.vencedor);
assert.equal(alto.niveisVistos[0], 85, "1º adversário = maior nível (80) + 5");
assert.ok(alto.niveisVistos.slice(1).every((n, i) => n === ((i + 2) % 10 === 0 ? 95 : 85)), "andares normais +5, chefes +15: " + alto.niveisVistos);

const fraco = await subir(50);
assert.equal(fraco.niveisVistos[0], 55);
console.log("nível 50:", fraco.torre.completa ? "topo" : "caiu no andar " + fraco.torre.andar, "| derrotados:", fraco.torre.n);
assert.equal(fraco.fase === "fim", true); assert.ok(fraco.vencedor === "2" || fraco.torre.completa || fraco.vencedor === "empate");
// o andar só avança com o adversário caído e o jogador vivo
const s2 = {fase: "batalha", vencedor: null, log: [], torre: {n: 0, andar: 1, fila: [fila[0]]}, j: {"2": {equipe: []}}};
assert.equal(torreAvancar(s2), false); assert.equal(s2.torre.n, 0);
// limite de nível 100 e atributos recalculados (chefe já mega usa a forma mega)
const bs = {hp: 80, atk: 100, def: 80, spa: 100, spd: 80, spe: 80}, B = filaBoss();
function filaBoss() { const p = copiaPokemon({...mk(0), nivel: 50}, {}); p.megasBase = [{slug: "mon0-mega", atk: 120, def: 90, spa: 120, spd: 90, spe: 90, hp: 60}]; return p; }
const sx = {j: {"1": {equipe: [{nivel: 98}, {nivel: 60}]}}};
assert.equal(nivelNaTorre(sx, {}), 100); assert.equal(nivelNaTorre(sx, {chefe: true}), 100);
assert.equal(nivelNaTorre({j: {"1": {equipe: [{nivel: 60}]}}}, {chefe: true}), 75);
const hp50 = B.hp; reescalar(B, 100); assert.ok(B.hp > hp50 * 1.8 && B.hpAtual === B.hp && B.nivel === 100);
const b2 = filaBoss(); b2.slugMega = "mon0-mega"; reescalar(b2, 100); assert.equal(b2.atk, b2.megas[0].atk); assert.ok(b2.megas[0].atk > 150);
// megas na torre: sem limite por equipe, mas só uma mega viva por vez (nas outras salas: 1 por equipe)
const mega = (hp) => ({slugMega: "x-mega", hpAtual: hp}), eqT = {equipe: [mega(0), {hpAtual: 10}]};
assert.equal(megaBloqueada({torre: {}}, eqT), false, "a mega anterior caiu: pode megaevoluir outra");
assert.equal(megaBloqueada({torre: {}}, {equipe: [mega(5), {hpAtual: 10}]}), true, "mega anterior ainda viva: bloqueado");
assert.equal(megaBloqueada({}, {...eqT, megaUsada: true}), true, "fora da torre vale 1 por equipe");
assert.equal(megaBloqueada({}, {...eqT, megaUsada: false}), false);
// avanço real até um chefe: monta o estado no andar 9 com o jogador forte (nível 100) e confere o nível do chefe do andar 10
{ const f = await filaTorre(cat, sortear), eq = (await sortear(cat, 6)).equipe.map(p => copiaPokemon({...p, nivel: 60}, {}));
  const s3 = {fase: "fim", vencedor: "1", log: [], torre: {n: 8, andar: 9, total: 30, fila: f.slice(9)}, j: {"1": {equipe: eq, ativo: 0}, "2": {equipe: [f[8]], ativo: 0}}};
  assert.equal(torreAvancar(s3), true); const c = ativoDe(s3.j["2"]);
  assert.equal(s3.torre.andar, 10); assert.ok(c.chefe && c.slugMega, "andar 10 é chefe mega"); assert.equal(c.nivel, 75, "chefe = 60 + 15"); assert.equal(c.hpAtual, c.hp); }
const total = xpTorreTotal(30); console.log("XP no topo (30 andares):", total, "→ nível da conta", infoNivel(total).nivel);
console.log("TUDO CERTO (torre)");
