// Testes dos Pokémon como instâncias: IVs, shiny, ids e atributos. Rode com:  node teste-pokemons.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { INICIAIS, acharIniciais, sortearIvs, novoPokemon, novoIdPokemon, instancias, shinyPorInstancia, shinyPorEspecie, somaIvs, IV_STATS, IV_MIN, CHANCE_SHINY, tentativaCaptura, sortearLendario, LENDARIOS, lendariosForaDoCatalogo, trocarPokemons, sortearPokemonAleatorio, ehLendario } from "./pokemons.js";
import { pontosLivres } from "./nivel.js";
import { statsFinais, REGRAS } from "./regras.js";
import { copiaPokemon } from "./motor.js";
import { copiaBot, reescalar } from "./torre.js";

let n = 0; const t = (nome, f) => { f(); n++; console.log("ok -", nome); };
const perto = (v, alvo, tol, msg) => assert.ok(Math.abs(v - alvo) <= tol, `${msg}: ${v} longe de ${alvo}`);

t("IVs: 6 atributos, de 16 a 31, uniformes", () => {
  const cont = Array.from({length: 32}, () => 0); let tot = 0;
  for (let i = 0; i < 20000; i++) { const iv = sortearIvs(); assert.deepEqual(Object.keys(iv), IV_STATS); for (const k of IV_STATS) { assert.ok(Number.isInteger(iv[k]) && iv[k] >= IV_MIN && iv[k] <= 31, "IV fora de 16 a 31: " + iv[k]); cont[iv[k]]++; tot++; } }
  assert.ok(cont[16] > 0 && cont[31] > 0, "os extremos existem"); assert.equal(cont.slice(0, 16).reduce((a, b) => a + b, 0), 0, "nenhum IV abaixo de 16");
  perto(cont[16] / tot, 1 / 16, 0.006, "IV 16"); perto(cont[31] / tot, 1 / 16, 0.006, "IV 31");
  assert.deepEqual(sortearIvs(() => 0), Object.fromEntries(IV_STATS.map(k => [k, 16]))); assert.deepEqual(sortearIvs(() => 0.9999), Object.fromEntries(IV_STATS.map(k => [k, 31])));
});
t("shiny: 10% por Pokémon novo", () => {
  let s = 0; for (let i = 0; i < 30000; i++) if (novoPokemon("x").shiny) s++;
  perto(s / 30000, CHANCE_SHINY, 0.01, "10% shiny");
  assert.equal(novoPokemon("x", () => 0.05).shiny, true); assert.equal(novoPokemon("x", () => 0.5).shiny, false);
});
t("ids únicos e instâncias separadas da mesma espécie", () => {
  const ids = new Set(Array.from({length: 5000}, () => novoIdPokemon())); assert.equal(ids.size, 5000);
  const cat = [{id: "6", nome: "Charizard", hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100, tipos: ["Fire", "Flying"]}];
  const mapa = {a: {esp: "6", ivs: sortearIvs(), shiny: true}, b: {esp: "6", ivs: sortearIvs(), shiny: false}, c: {esp: "999", ivs: sortearIvs(), shiny: false}};
  const inst = instancias(cat, mapa);
  assert.equal(inst.length, 2, "espécie fora do catálogo é ignorada"); assert.deepEqual(inst.map(p => p.id), ["a", "b"]); assert.ok(inst.every(p => p.esp === "6" && p.nome === "Charizard"));
  assert.deepEqual(shinyPorInstancia(mapa), {a: true}); assert.deepEqual(shinyPorEspecie(mapa), {"6": true});
  assert.equal(somaIvs({hp: 1, atk: 2, def: 3, spa: 4, spd: 5, spe: 6}), 21);
});
t("atributos: IVs mudam os valores; sem IVs vale o padrão (31)", () => {
  const p = {hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100};
  const base = statsFinais(p), padrao = statsFinais({...p, ivs: Object.fromEntries(IV_STATS.map(k => [k, 31]))});
  assert.deepEqual(base, padrao, "IV 31 em tudo = comportamento antigo");
  const zero = statsFinais({...p, ivs: Object.fromEntries(IV_STATS.map(k => [k, 0]))});
  for (const k of IV_STATS) assert.ok(zero[k] < base[k], k + " menor com IV 0");
  assert.equal(base.hp - zero.hp, Math.floor((2 * 78 + 31 + 21) * 50 / 100) - Math.floor((2 * 78 + 0 + 21) * 50 / 100));
  const um = statsFinais({...p, ivs: {atk: 0}}); assert.equal(um.spa, base.spa, "atributo sem IV informado usa o padrão"); assert.ok(um.atk < base.atk);
});
t("cópia da batalha usa os IVs (e as megas também)", () => {
  const p = {id: "i1", nome: "X", tipos: ["Fire"], hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100, megas: [{nome: "Mega X", slug: "x-mega", tipos: ["Fire"], atk: 130, def: 111, spa: 130, spd: 85, spe: 100}],
    mv: [{nome: "Tackle", tipo: "Normal", cat: "fisico", poder: 40, precisao: 100}]};
  const alto = copiaPokemon({...p, ivs: Object.fromEntries(IV_STATS.map(k => [k, 31]))}), baixo = copiaPokemon({...p, ivs: Object.fromEntries(IV_STATS.map(k => [k, 0]))}), sem = copiaPokemon(p);
  assert.deepEqual([alto.hp, alto.atk, alto.spe], [sem.hp, sem.atk, sem.spe]);
  assert.ok(baixo.hp < alto.hp && baixo.atk < alto.atk && baixo.megas[0].atk < alto.megas[0].atk);
  assert.equal(alto.id, "i1");
});
t("27 iniciais: 9 gerações × 3, sem repetição, casados com o catálogo pelo nome", () => {
  assert.equal(INICIAIS.length, 9); assert.ok(INICIAIS.every(l => l.length === 3)); assert.equal(new Set(INICIAIS.flat()).size, 27);
  const cat = [{id: "1", nome: "Charizard"}, {id: "2", nome: "meganium"}, {id: "3", nome: "Typhlosion"}];
  const m = acharIniciais(cat); assert.equal(m[0][1].esp.id, "1"); assert.equal(m[1][0].esp.id, "2"); assert.equal(m[0][0].esp, null);
});
t("bots e torre: IVs de 16 a 31 mantidos ao reescalar", () => {
  const p = {id: "1", nome: "Bulbasaur", tipos: ["Grass"], hp: 45, atk: 49, def: 49, spa: 65, spd: 65, spe: 45, megas: [], mv: [{nome: "Tackle", tipo: "Normal", cat: "fisico", poder: 40, precisao: 100}]};
  const ivs = sortearIvs(), c = copiaBot({...p, ivs}, {}); assert.deepEqual(c.ivs, ivs, "a cópia guarda os IVs");
  const r = reescalar({...c}, 70), esperado = statsFinais({...p, ivs}, {...REGRAS, nivel: 70});
  assert.equal(r.hp, esperado.hp); assert.equal(r.atk, esperado.atk); assert.equal(r.spe, esperado.spe);
  assert.ok(/ivs: sortearIvs\(\)/.test(readFileSync(new URL("./bot.js", import.meta.url), "utf8")), "o sorteio de equipe do bot dá IVs aleatórios"); // bot.js importa o Firebase, então aqui só se confere o código
});
t("captura: bot 47,5/47,5/5 · lendário 23,75/71,25/5", () => {
  const N = 200000;
  for (const [tipo, cap, esc, fug] of [["bot", 0.475, 0.475, 0.05], ["lendario", 0.2375, 0.7125, 0.05]]) {
    const c = {capturou: 0, escapou: 0, fugiu: 0}; for (let i = 0; i < N; i++) c[tentativaCaptura(tipo)]++;
    perto(c.capturou / N, cap, 0.005, tipo + " captura"); perto(c.escapou / N, esc, 0.005, tipo + " escapa"); perto(c.fugiu / N, fug, 0.003, tipo + " foge");
  }
  assert.equal(tentativaCaptura("bot", () => 0.1), "capturou"); assert.equal(tentativaCaptura("bot", () => 0.5), "fugiu"); assert.equal(tentativaCaptura("bot", () => 0.9), "escapou");
  assert.equal(tentativaCaptura("lendario", () => 0.2), "capturou"); assert.equal(tentativaCaptura("lendario", () => 0.6), "escapou");
});
t("lendário da torre: só sorteia quem está na lista e no catálogo", () => {
  const cat = [{id: "1", nome: "Bulbasaur"}, {id: "150", nome: "Mewtwo"}, {id: "250", nome: "Ho-Oh"}, {id: "4", nome: "Charmander"}];
  const vistos = new Set(); for (let i = 0; i < 300; i++) vistos.add(sortearLendario(cat).id);
  assert.deepEqual([...vistos].sort(), ["150", "250"]); assert.equal(sortearLendario([{id: "1", nome: "Bulbasaur"}]), null);
  assert.equal(new Set(LENDARIOS).size, LENDARIOS.length, "sem nomes repetidos");
});
t("lista de lendários: 67 nomes sem repetição; conferência com o catálogo", () => {
  assert.equal(LENDARIOS.length, 67); assert.ok(LENDARIOS.includes("Type: Null") && LENDARIOS.includes("Tapu Koko") && LENDARIOS.includes("Zygarde"));
  assert.deepEqual(lendariosForaDoCatalogo([{nome: "Mew"}, {nome: "Type: Null"}, {nome: "TAPU KOKO"}]).length, 64);
  assert.deepEqual(lendariosForaDoCatalogo(LENDARIOS.map(nome => ({nome}))), []);
});
t("troca: o Pokémon vai com tudo e sai dos times de quem deu", () => {
  const iv = n => Object.fromEntries(IV_STATS.map(k => [k, n]));
  const dA = {pokemons: {x1: {esp: "6", ivs: iv(30), shiny: true}, x2: {esp: "9", ivs: iv(20), shiny: false}}, builds: {x1: ["Flamethrower"], x2: ["Surf"]}, niveis: {x1: 58, x2: 52}, habilidades: {x1: "blaze"},
    itens: {orb: 2, band: 1}, itensEq: {x1: "orb", x2: "orb"}, times: [{id: "t1", nome: "Time", ids: ["x1", "x2"]}]};
  const dB = {pokemons: {y1: {esp: "25", ivs: iv(17), shiny: false}}, builds: {y1: ["Thunderbolt"]}, niveis: {}, habilidades: {}, itens: {}, itensEq: {}, times: [{id: "t9", nome: "Meu", ids: ["y1"]}]};
  const {A, B} = trocarPokemons(dA, "x1", dB, "y1");
  assert.deepEqual(Object.keys(A.pokemons).sort(), ["x2", "y1"]); assert.deepEqual(Object.keys(B.pokemons), ["x1"]);
  assert.equal(B.pokemons.x1.shiny, true); assert.deepEqual(B.pokemons.x1.ivs, iv(30)); assert.deepEqual(B.builds.x1, ["Flamethrower"]); assert.equal(B.niveis.x1, 58); assert.equal(B.habilidades.x1, "blaze");
  assert.equal(B.itensEq.x1, "orb"); assert.equal(B.itens.orb, 1, "quem recebeu ganha a cópia do item"); assert.equal(A.itens.orb, 1, "quem deu perde 1 cópia (a do outro Pokémon continua)"); assert.equal(A.itensEq.x2, "orb"); assert.equal(A.itensEq.x1, undefined);
  assert.deepEqual(A.times[0].ids, ["x2"], "x1 sai do time de quem deu"); assert.deepEqual(A.builds.y1, ["Thunderbolt"]); assert.equal(A.builds.x1, undefined); assert.equal(A.niveis.x1, undefined);
  assert.deepEqual(B.times[0].ids, [], "y1 saiu do time de B"); assert.deepEqual(dA.pokemons.x1.ivs, iv(30), "não altera os originais");
  assert.throws(() => trocarPokemons(dA, "nao-existe", dB, "y1"), /não está mais/);
  const ida = trocarPokemons(dA, "x1", dB, "y1"), volta = trocarPokemons({...dA, ...ida.A}, "y1", {...dB, ...ida.B}, "x1");
  assert.deepEqual(volta.A.pokemons, dA.pokemons); assert.deepEqual(volta.B.pokemons, dB.pokemons); // trocar de volta restaura os Pokémon
});
t("troca: pontos de treino — quem dá não recupera, quem recebe não paga", () => {
  const dA = {xp: 20000, pokemons: {x1: {esp: "6", ivs: {}, shiny: false}}, niveis: {x1: 58}}, dB = {xp: 20000, pokemons: {y1: {esp: "25", ivs: {}, shiny: false}}, niveis: {}};
  const antesA = pontosLivres(dA), antesB = pontosLivres(dB); assert.ok(antesA >= 1, "conta com pontos suficientes para o teste");
  const {A, B} = trocarPokemons(dA, "x1", dB, "y1");
  assert.equal(B.niveis.x1, 58, "vai no nível atual"); assert.equal(pontosLivres({...dA, ...A}), antesA, "quem deu não recupera os 8 pontos gastos");
  assert.equal(pontosLivres({...dB, ...B}), antesB, "quem recebeu não perde pontos livres"); assert.equal(B.pontosTrocados, -8); assert.equal(A.pontosTrocados, 8);
  const volta = trocarPokemons({...dA, ...A}, "y1", {...dB, ...B}, "x1"); // trocar de volta: cada um fica como estava
  assert.equal(pontosLivres({...dA, ...A, ...volta.A}), antesA); assert.equal(pontosLivres({...dB, ...B, ...volta.B}), antesB);
});
t("Pokébola da caixa: Pokémon aleatório que nunca é lendário da lista", () => {
  const cat = [{id: "1", nome: "Bulbasaur"}, {id: "150", nome: "Mewtwo"}, {id: "25", nome: "Pikachu"}, {id: "251", nome: "Celebi"}];
  const vistos = new Set(); for (let i = 0; i < 400; i++) vistos.add(sortearPokemonAleatorio(cat).id);
  assert.deepEqual([...vistos].sort(), ["1", "25", "251"]); assert.equal(sortearPokemonAleatorio([{id: "150", nome: "Mewtwo"}]), null);
});
t("lendários: formas também contam, e nenhum Pokémon comum é confundido com lendário", () => {
  for (const n of ["Kyurem Black", "Urshifu Rapid Strike", "Giratina-Origin", "Zygarde 10%", "Necrozma Dusk Mane", "Mewtwo", "Mew", "Type: Null", "Tapu Koko", "Ho-Oh", "Shaymin Sky"]) assert.ok(ehLendario(n), n + " deveria ser lendário");
  for (const n of ["Meowth", "Charizard", "Pikachu", "Eevee", "Munchlax", "Lucario", "Gengar", "Hoppip", "Zubat", "Snorlax", "Raichu", "Diglett", "Kingdra", "Sylveon", "Greninja", "Phanpy", "Mienfoo"]) assert.ok(!ehLendario(n), n + " não é lendário");
  const cat = [{id: "1", nome: "Bulbasaur"}, {id: "a", nome: "Urshifu Rapid Strike"}, {id: "b", nome: "Kyurem Black"}];
  assert.deepEqual([...new Set(Array.from({length: 200}, () => sortearPokemonAleatorio(cat).id))], ["1"], "a Pokébola da caixa nunca dá lendário, nem forma dele");
  assert.deepEqual([...new Set(Array.from({length: 200}, () => sortearLendario(cat).id))].sort(), ["a", "b"], "a torre pode dar as formas");
  assert.ok(!lendariosForaDoCatalogo([{nome: "Urshifu Rapid Strike"}]).includes("Urshifu"));
});
console.log(`TUDO CERTO (${n} grupos: pokémons como instâncias)`);
