// Megaevoluções via PokéAPI: cada mega é uma "forma" (variety) da espécie, com tipos e atributos próprios.
// Guardado no Pokémon do catálogo como  podeMega: true/false  e  megas: [{nome, slug, tipos, hp, atk, def, spa, spd, spe}]
import { slug } from "./imagem.js";
const API = "https://pokeapi.co/api/v2/";
const STATS = {hp: "hp", attack: "atk", defense: "def", "special-attack": "spa", "special-defense": "spd", speed: "spe"};
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const ehMega = n => /-mega(-[a-z])?$/.test(n); // charizard-mega-x, venusaur-mega... (não pega "meganium")

async function especie(nome) {
  let r = await fetch(API + "pokemon-species/" + slug(nome));
  if (!r.ok) { // espécies com nome de forma: parte do Pokémon
    const p = await fetch(API + "pokemon/" + slug(nome));
    if (!p.ok) throw new Error(`"${nome}" não encontrado na PokéAPI`);
    r = await fetch((await p.json()).species.url);
    if (!r.ok) throw new Error(`espécie de "${nome}" não encontrada`);
  }
  return r.json();
}
// "Mega Charizard X" a partir de ("Charizard", "charizard-mega-x")
const nomeMega = (base, s) => { const suf = s.match(/-mega(?:-([a-z]))?$/)?.[1]; return `Mega ${base}${suf ? " " + suf.toUpperCase() : ""}`; };

export async function buscarMegas(nome) {
  const e = await especie(nome), megas = [];
  for (const v of e.varieties.filter(v => ehMega(v.pokemon.name))) {
    const r = await fetch(v.pokemon.url);
    if (!r.ok) continue;
    const d = await r.json(), m = {nome: nomeMega(nome, v.pokemon.name), slug: v.pokemon.name, tipos: d.types.sort((a, b) => a.slot - b.slot).map(t => cap(t.type.name))};
    for (const s of d.stats) m[STATS[s.stat.name]] = s.base_stat;
    megas.push(m);
  }
  return {podeMega: megas.length > 0, megas};
}
