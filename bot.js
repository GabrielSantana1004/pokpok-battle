// Sorteio de equipes aleatórias (bot e "equipe aleatória" do jogador). A inteligência do bot fica em botia.js.
import { golpesDe } from "./golpesdb.js";
import { copiaPokemon } from "./motor.js";
import { REGRAS } from "./regras.js";
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

// n Pokémon aleatórios do catálogo, cada um com 4 golpes aleatórios. Devolve {equipe, mapa} (mapa: golpes para copiaPokemon)
// shinyDe(p) decide se o Pokémon é shiny (padrão: 10% de chance, como no bot); nivelDe(p) decide o nível (padrão: o nível fixo do bot)
export async function sortearEquipe(catalogo, n = 6, shinyDe = () => Math.random() < 0.1, nivelDe = () => NIVEL_BOT) {
  const equipe = [], mapa = {};
  for (const p of embaralhar(catalogo.filter(p => p.aprende?.length || p.mv?.length))) {
    if (equipe.length >= n) break;
    const mv = await golpesSorteados(p, mapa);
    if (mv) equipe.push({...p, mv, shiny: !!shinyDe(p), nivel: nivelDe(p)});
  }
  if (!equipe.length) throw new Error("Não consegui sortear Pokémon: o catálogo está vazio ou sem golpes sincronizados.");
  return {equipe, mapa};
}
