import { slug } from "./imagem.js";
// Dados de um golpe na PokéAPI: poder, precisão (null = nunca erra), prioridade
const cache = {};
export const slugGolpe = n => n.toLowerCase().replace(/['’.]/g, "").trim().replace(/\s+/g, "-");
export function dadosDoGolpe(nome) {
  const s = slugGolpe(nome);
  if (!cache[s]) cache[s] = (async () => {
    const r = await fetch("https://pokeapi.co/api/v2/move/" + s);
    if (!r.ok) throw new Error(`golpe "${nome}" não encontrado na PokéAPI`);
    const d = await r.json();
    return {nome: d.names?.find(n => n.language?.name === "en")?.name || null, poder: d.power ?? null, precisao: d.accuracy ?? null, prioridade: d.priority || 0,
      cat: {physical: "fisico", special: "especial", status: "status"}[d.damage_class?.name] || null, tipo: d.type?.name || null};
  })();
  return cache[s];
}

// Golpes que um Pokémon pode aprender: união de todas as gerações (cada golpe aparece uma vez só).
// Devolve os nomes no formato da PokéAPI (ex.: "night-slash"); use dadosDoGolpe para buscar os dados de cada um.
export async function golpesAprendidos(nome) {
  const s = slug(nome);
  let r = await fetch("https://pokeapi.co/api/v2/pokemon/" + s);
  if (!r.ok) { // espécies com várias formas: usa a forma padrão
    const e = await fetch("https://pokeapi.co/api/v2/pokemon-species/" + s);
    const v = e.ok ? (await e.json()).varieties.find(v => v.is_default) : null;
    if (!v) throw new Error(`Pokémon "${nome}" não encontrado na PokéAPI`);
    r = await fetch(v.pokemon.url);
    if (!r.ok) throw new Error(`Pokémon "${nome}" não encontrado na PokéAPI`);
  }
  const d = await r.json();
  return [...new Set(d.moves.map(m => m.move.name))];
}
