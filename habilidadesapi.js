// Habilidades de um Pokémon (e das suas megas) na PokéAPI.
import { slug } from "./imagem.js";
const API = "https://pokeapi.co/api/v2/";
const bonito = id => id.split("-").map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(" "); // "sand-stream" → "Sand Stream"

// resposta de /pokemon/<nome> → [{id, nome, oculta}] (ordem dos slots, sem repetir)
export function lerHabilidadesApi(d) {
  const vistos = new Set();
  return (d.abilities || []).slice().sort((a, b) => a.slot - b.slot).filter(a => !vistos.has(a.ability.name) && vistos.add(a.ability.name))
    .map(a => ({id: a.ability.name, nome: bonito(a.ability.name), oculta: !!a.is_hidden}));
}
async function pokemonJson(nome) {
  const s = slug(nome);
  let r = await fetch(API + "pokemon/" + s);
  if (!r.ok) { // espécies com várias formas: usa a forma padrão
    const e = await fetch(API + "pokemon-species/" + s), v = e.ok ? (await e.json()).varieties.find(v => v.is_default) : null;
    if (!v) throw new Error(`"${nome}" não encontrado na PokéAPI`);
    r = await fetch(v.pokemon.url);
    if (!r.ok) throw new Error(`"${nome}" não encontrado na PokéAPI`);
  }
  return r.json();
}
// Devolve {habilidades, megas}: as habilidades do Pokémon e as megas dele com a habilidade de cada forma
export async function buscarHabilidades(p) {
  const habilidades = lerHabilidadesApi(await pokemonJson(p.nome));
  if (!habilidades.length) throw new Error(`"${p.nome}" veio sem habilidades`);
  const megas = [];
  for (const m of p.megas || []) {
    let h = null;
    try { const r = await fetch(API + "pokemon/" + m.slug); if (r.ok) h = lerHabilidadesApi(await r.json())[0] || null; } catch(e) {}
    megas.push(h ? {...m, habilidade: {id: h.id, nome: h.nome}} : m);
  }
  return {habilidades, megas};
}
