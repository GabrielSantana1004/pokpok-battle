// Teste do sistema de nível (rodar com: node teste-nivel.mjs)
import { infoNivel, tamanhoNivel, xpDe } from "./nivel.js";
import assert from "node:assert/strict";
assert.deepEqual([0, 1, 2, 3, 4].map(tamanhoNivel), [100, 120, 144, 173, 207]);
const casos = [[0, 0, 0], [99, 0, 99], [100, 1, 0], [219, 1, 119], [220, 2, 0], [363, 2, 143], [364, 3, 0], [364 + 173, 4, 0]]; // [xp, nível, xp dentro do nível]
for (const [xp, nivel, noNivel] of casos) { const i = infoNivel(xp); assert.equal(i.nivel, nivel, `xp ${xp}`); assert.equal(i.noNivel, noNivel, `xp ${xp}`); }
assert.equal(infoNivel(0).fim, 100); assert.equal(infoNivel(100).fim, 220); assert.equal(infoNivel(220).fim, 364);
assert.equal(infoNivel(150).pct, Math.round(50 / 120 * 100)); assert.equal(infoNivel(-5).nivel, 0); assert.equal(infoNivel(undefined).nivel, 0);
assert.equal(xpDe({vitorias: 7}), 140); assert.equal(xpDe({vitorias: 7, xp: 30}), 30); assert.equal(xpDe({xp: 0, vitorias: 9}), 0); assert.equal(xpDe(undefined), 0);
// sequência de ganhos: 5 vitórias = 100 XP = nível 1; 1 derrota = +5
let xp = 0; for (let i = 0; i < 5; i++) xp += 20; assert.equal(infoNivel(xp).nivel, 1); xp += 5; assert.equal(infoNivel(xp).noNivel, 5);
// ----- pontos de treino e nível dos Pokémon -----
import { nivelDoPokemon, pontosGastos, pontosLivres } from "./nivel.js";
import { statsFinais, REGRAS } from "./regras.js";
assert.equal(nivelDoPokemon({}, "x"), 50); assert.equal(nivelDoPokemon({x: 77}, "x"), 77); assert.equal(nivelDoPokemon({x: 250}, "x"), 100); assert.equal(nivelDoPokemon({x: 3}, "x"), 50);
assert.equal(pontosGastos({a: 53, b: 50, c: 51}), 4); assert.equal(pontosGastos(undefined), 0);
assert.equal(pontosLivres({xp: 0}), 0);                       // nível 0 da conta: nenhum ponto
assert.equal(pontosLivres({xp: 100}), 1);                     // nível 1: 1 ponto
assert.equal(pontosLivres({xp: 364}), 3);                     // nível 3: 3 pontos
assert.equal(pontosLivres({xp: 364, niveis: {a: 52}}), 1);    // 3 pontos - 2 gastos
assert.equal(pontosLivres({xp: 100, niveis: {a: 60}}), 0);    // nunca negativo
assert.equal(pontosLivres({vitorias: 5}), 1);                 // conta antiga: 5 vitórias = 100 XP = nível 1
// atributos crescem com o nível (fórmula oficial): Charizard base 78/84/78/109/85/100
const base = {hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100};
const a50 = statsFinais(base), a100 = statsFinais(base, {...REGRAS, nivel: 100});
assert.equal(a50.hp, 164); assert.equal(a100.hp, 318); assert.equal(a50.atk, 115); assert.equal(a100.atk, 225);
// ----- bot: nível por dificuldade e XP de vitória -----
import { nivelDoBot, xpVitoriaBot } from "./nivel.js";
const eq = [50, 60, 70, 80, 90, 100];
assert.equal(nivelDoBot("facil", eq), 50); assert.equal(nivelDoBot("normal", eq), 75); assert.equal(nivelDoBot("dificil", eq), 100);
assert.equal(nivelDoBot("normal", [50, 51]), 51);            // média arredondada (50,5 → 51)
assert.equal(nivelDoBot("dificil", [100, 100]), 100); assert.equal(nivelDoBot("normal", [100]), 100); assert.equal(nivelDoBot("facil", [30]), 50); assert.equal(nivelDoBot("dificil", [130]), 100); // limites 50..100
assert.equal(nivelDoBot("facil", []), 50);
assert.deepEqual(["facil", "normal", "dificil", undefined].map(xpVitoriaBot), [10, 20, 40, 10]);
console.log("TUDO CERTO (nível)");
