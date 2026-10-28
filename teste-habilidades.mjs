// Testes dos dados de habilidades (sem Firebase nem rede): leitura da PokéAPI, escolha, relatórios e CSV.
import assert from "node:assert/strict";
import { lerHabilidadesApi } from "./habilidadesapi.js";
import { habilidadeEscolhida, habilidadeAleatoria, habilidadeOculta, relatorioHabilidades, relatorioGolpes, csv } from "./habilidades.js";

// resposta no formato da PokéAPI (Charizard: Blaze, Solar Power oculta)
const api = {abilities: [{ability: {name: "solar-power"}, is_hidden: true, slot: 3}, {ability: {name: "blaze"}, is_hidden: false, slot: 1}, {ability: {name: "blaze"}, is_hidden: false, slot: 2}]};
assert.deepEqual(lerHabilidadesApi(api), [{id: "blaze", nome: "Blaze", oculta: false}, {id: "solar-power", nome: "Solar Power", oculta: true}]); // ordem dos slots, sem repetir
assert.equal(lerHabilidadesApi({abilities: [{ability: {name: "sand-stream"}, is_hidden: false, slot: 1}]})[0].nome, "Sand Stream");
assert.deepEqual(lerHabilidadesApi({}), []);

const char = {id: "c", nome: "Charizard", habilidades: [{id: "blaze", nome: "Blaze", oculta: false}, {id: "solar-power", nome: "Solar Power", oculta: true}],
  megas: [{nome: "Mega Charizard X", habilidade: {id: "tough-claws", nome: "Tough Claws"}}, {nome: "Mega Charizard Y", habilidade: {id: "drought", nome: "Drought"}}],
  aprende: [{nome: "Flamethrower", tipo: "Fire", cat: "especial", poder: 90, precisao: 100, prioridade: 0}, {nome: "Roost", tipo: "Flying", cat: "status", poder: null, precisao: null, prioridade: 0}]};
const pika = {id: "p", nome: "Pikachu", habilidades: [{id: "static", nome: "Static", oculta: false}, {id: "lightning-rod", nome: "Lightning Rod", oculta: true}], megas: [],
  aprende: [{nome: "Flamethrower", tipo: "Fire", cat: "especial", poder: 90, precisao: 100, prioridade: 0}, {nome: "Thunderbolt", tipo: "Electric", cat: "especial", poder: 90, precisao: 100}]};
const sem = {id: "s", nome: "SemDados", aprende: []};

// escolha: a da conta, senão a 1ª normal; escolha antiga que não existe mais volta ao padrão; oculta pode ser escolhida
assert.equal(habilidadeEscolhida(char, {}).id, "blaze");
assert.equal(habilidadeEscolhida(char, {c: "solar-power"}).id, "solar-power");
assert.equal(habilidadeEscolhida(char, {c: "nao-existe"}).id, "blaze");
assert.equal(habilidadeEscolhida(sem, {}), null);
assert.deepEqual(habilidadeEscolhida(char, {}), {id: "blaze", nome: "Blaze"});
// bots: sorteio entre todas (inclusive oculta); chefes: oculta
const vistas = new Set(); for (let i = 0; i < 200; i++) vistas.add(habilidadeAleatoria(char).id); assert.deepEqual([...vistas].sort(), ["blaze", "solar-power"]);
assert.equal(habilidadeOculta(char).id, "solar-power"); assert.ok(habilidadeOculta({habilidades: [{id: "x", nome: "X", oculta: false}]}).id === "x"); assert.equal(habilidadeAleatoria(sem), null);

// relatório de habilidades
const r = relatorioHabilidades([char, pika, sem]);
assert.deepEqual(r.semDados, ["SemDados"]); assert.equal(r.porPokemon.length, 2);
const por = id => r.distintas.find(e => e.id === id);
assert.deepEqual([por("blaze").total, por("blaze").normal, por("blaze").oculta], [1, 1, 0]);
assert.deepEqual([por("solar-power").oculta, por("tough-claws").mega, por("tough-claws").total], [1, 1, 0]);
assert.equal(r.distintas.length, 6); assert.deepEqual(r.porPokemon[0].megas.map(m => m.habilidade), ["Tough Claws", "Drought"]);
// relatório de golpes: um por (Pokémon, golpe) e lista de distintos com a contagem
const g = relatorioGolpes([char, pika, sem]);
assert.equal(g.totalPokemon, 3); assert.equal(g.pokemons[0].total, 2); assert.equal(g.pokemons[2].total, 0);
assert.equal(g.unicos.length, 3); assert.equal(g.unicos[0].nome, "Flamethrower"); assert.equal(g.unicos[0].qtd, 2);
assert.equal(g.pokemons[1].golpes[1].prioridade, 0); assert.equal(g.pokemons[0].golpes[1].poder, null);
// CSV: aspas escapadas, separador ; e BOM
const c = csv(["a", "b"], [['diz "oi"', "x;y"], [null, 3]]);
assert.equal(c, '﻿"a";"b"\r\n"diz ""oi""";"x;y"\r\n"";"3"');
console.log("TUDO CERTO (habilidades)");
