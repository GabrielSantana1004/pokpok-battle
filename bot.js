// Sorteio de equipes aleatórias (bot e "equipe aleatória" do jogador). A inteligência do bot fica em botia.js.
import { golpesDe } from "./golpesdb.js";
import { habilidadeAleatoria } from "./habilidades.js";
import { copiaPokemon } from "./motor.js";
import { REGRAS } from "./regras.js";
import { sortearIvs } from "./pokemons.js";
export const NIVEL_BOT = REGRAS.nivel; // os bots lutam sempre neste nível (não sobem)

const embaralhar = a => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const dano = m => m.cat !== "status";

// 4 golpes aleatórios que o motor sabe usar (e pelo menos 1 de dano, para a batalha não travar)
async function golpesSorteados(p, mapa) {
  const pool = embaralhar(p.aprende?.length ? p.aprende : p.mv), ok = [];
  const funciona = m => { try { copiaPokemon({...p, mv: [m]}, mapa); return true; } catch(e) { return false; } };
  for (let i = 0; i < pool.length; i += 16) {
    const lote = pool.slice(i, i + 16);
    Object.assign(mapa, await golpesDe(lote.map(m => m.nome)));
    ok.push(...lote.filter(funciona));
    if (ok.length >= 4 && ok.some(dano)) break;
  }
  if (!ok.some(dano)) return null;
  const mv = ok.slice(0, 4);
  if (!mv.some(dano)) mv[3] = ok.find(dano);
  return mv;
}

// Chefe da raid: em vez de 4 golpes ao acaso, escolhe os melhores de dano. Primeiro até 2 golpes do(s) tipo(s) do próprio Pokémon (STAB), depois um de cada tipo
// diferente (cobertura). Devolve null se não achar 4 golpes que o motor saiba usar (aí vale o sorteio comum). Muda o mapa para incluir os golpes que usou.
const NAO_CHEFE = /explosion|self-destruct|memento|final gambit|focus punch|fake out|first impression|upper hand|sucker punch|counter|mirror coat|metal burst|belch|dream eater|last resort|spit up|natural gift|fling|return|frustration|trump card|synchronoise|beat up|pain split/i;
export async function golpesDeChefe(p, mapa) {
  const bruto = m => m.poder > 0 && m.cat !== "status" && !NAO_CHEFE.test(m.nome) ? m.poder * (p.tipos.includes(m.tipo) ? 1.5 : 1) * ((m.precisao ?? 100) / 100) * ((m.cat === "fisico" ? p.atk : p.spa) || 100) / 100 : 0;
  const cand = (p.aprende || []).map(m => ({m, n: bruto(m)})).filter(x => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 24);
  if (cand.length < 4) return null;
  Object.assign(mapa, await golpesDe(cand.map(x => x.m.nome)));
  const viaveis = cand.map(x => { // golpes de 2 turnos ou com recarga valem menos; dano fixo/aleatório fica de fora
    const t = (mapa[x.m.nome]?.efeitos || []).map(e => e.t);
    return {m: x.m, n: t.includes("danofixo") ? 0 : x.n * (t.includes("recarga") ? 0.55 : t.includes("carga") ? 0.6 : 1)};
  }).filter(x => x.n > 0).filter(x => { try { copiaPokemon({...p, mv: [x.m]}, mapa); return true; } catch(e) { return false; } }).sort((a, b) => b.n - a.n).map(x => x.m);
  const mv = [];
  for (const m of viaveis) if (mv.length < 2 && p.tipos.includes(m.tipo) && !mv.some(x => x.tipo === m.tipo)) mv.push(m);
  for (const m of viaveis) if (mv.length < 4 && !mv.some(x => x.tipo === m.tipo)) mv.push(m);
  for (const m of viaveis) if (mv.length < 4 && !mv.includes(m)) mv.push(m);
  return mv.length === 4 ? mv : null;
}

// n Pokémon aleatórios do catálogo, cada um com 4 golpes aleatórios. Devolve {equipe, mapa} (mapa: golpes para copiaPokemon)
// shinyDe(p) decide se o Pokémon é shiny (padrão: 10% de chance, como no bot); nivelDe(p) decide o nível (padrão: o nível fixo do bot)
export async function sortearEquipe(catalogo, n = 6, shinyDe = () => Math.random() < 0.1, nivelDe = () => NIVEL_BOT, habDe = habilidadeAleatoria, itemDe = () => null) {
  const equipe = [], mapa = {};
  for (const p of embaralhar(catalogo.filter(p => p.aprende?.length || p.mv?.length))) {
    if (equipe.length >= n) break;
    const mv = await golpesSorteados(p, mapa);
    if (mv) equipe.push({...p, mv, ivs: sortearIvs(), shiny: !!shinyDe(p), nivel: nivelDe(p), habilidade: habDe(p), item: itemDe(p)});
  }
  if (!equipe.length) throw new Error("Não consegui sortear Pokémon: o catálogo está vazio ou sem golpes sincronizados.");
  return {equipe, mapa};
}
