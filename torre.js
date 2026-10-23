// Modo Torre (funções sem Firebase): a fila de adversários e o avanço de andar.
// Cada andar é UM Pokémon (nível fixo de bot). Todo andar múltiplo de TORRE_CHEFE_A_CADA é um chefe que já aparece megaevoluído.
import { copiaPokemon } from "./motor.js";
import { statsFinais, REGRAS } from "./regras.js";
import { TORRE_ANDARES, TORRE_CHEFE_A_CADA, TORRE_NIVEL_MAIS, TORRE_NIVEL_CHEFE_MAIS, xpTorre } from "./nivel.js";

// Cópia congelada de um adversário que pode ter o nível recalculado depois (megasBase guarda os atributos-base das megas)
export const copiaBot = (p, mapa) => ({...copiaPokemon(p, mapa), megasBase: (p.megas || []).map(m => ({slug: m.slug, atk: m.atk, def: m.def, spa: m.spa, spd: m.spd, spe: m.spe, hp: m.hp}))});

const comMega = p => { // o chefe já entra na forma mega (o HP não muda); slugMega impede que megaevolua de novo
  const m = p.megas?.[Math.floor(Math.random() * p.megas.length)];
  if (m) Object.assign(p, {nome: m.nome, tipos: m.tipos, atk: m.atk, def: m.def, spa: m.spa, spd: m.spd, spe: m.spe, slugMega: m.slug});
  return p;
};

// Fila de adversários já prontos (cópias congeladas). "sortear" é o sortearEquipe do bot.js (injetado para este módulo ficar puro).
export async function filaTorre(catalogo, sortear, andares = TORRE_ANDARES) {
  const nChefes = Math.floor(andares / TORRE_CHEFE_A_CADA);
  const pronto = ({equipe, mapa}) => equipe.map(p => copiaBot(p, mapa));
  const comMegas = catalogo.filter(p => p.megas?.length), semMega = catalogo.filter(p => !p.megas?.length);
  const normais = pronto(await sortear(semMega.length ? semMega : catalogo, andares - nChefes));
  const chefes = comMegas.length ? pronto(await sortear(comMegas, nChefes)) : [];
  const fila = [];
  for (let a = 1; a <= andares; a++) {
    const chefe = a % TORRE_CHEFE_A_CADA === 0;
    const p = (chefe ? chefes.shift() : null) ?? normais.shift() ?? chefes.shift();
    if (!p) break;
    if (chefe && p.megas?.length) comMega(p);
    if (chefe) p.chefe = true;
    fila.push(p);
  }
  return fila;
}

// Nível do adversário: maior nível do time do jogador + 5 (chefe: + 15), no máximo REGRAS.nivelMax
export const nivelNaTorre = (s, p) => Math.min(REGRAS.nivelMax, Math.max(...s.j["1"].equipe.map(q => q.nivel || REGRAS.nivel)) + (p.chefe ? TORRE_NIVEL_CHEFE_MAIS : TORRE_NIVEL_MAIS));
// Recalcula os atributos de um adversário (e das suas megas) para o nível dado; entra com HP cheio
export function reescalar(p, nivel) {
  const R = {...REGRAS, nivel}, f = statsFinais(p.base, R);
  p.nivel = nivel; p.hp = p.hpAtual = f.hp;
  if (p.megasBase) p.megas = p.megasBase.map(m => { const g = statsFinais({...m, hp: m.hp || p.base.hp}, R), o = p.megas?.find(x => x.slug === m.slug) || {}; return {nome: o.nome, slug: m.slug, tipos: o.tipos, atk: g.atk, def: g.def, spa: g.spa, spd: g.spd, spe: g.spe}; });
  const forma = p.slugMega && p.megas.find(m => m.slug === p.slugMega) || f; // chefe já megaevoluído usa os atributos da mega
  Object.assign(p, {atk: forma.atk, def: forma.def, spa: forma.spa, spd: forma.spd, spe: forma.spe});
  return p;
}

// Chamada depois de cada rodada/troca: se o Pokémon do adversário caiu e o jogador ainda está de pé, entra o próximo andar.
export function torreAvancar(s) {
  const T = s.torre;
  if (!T || s.fase !== "fim" || s.vencedor !== "1" || T.completa || T.encerrada) return false;
  T.n++;
  s.log = s.log.filter(l => !/venceu a batalha/.test(l));
  if (!T.fila.length) { T.completa = true; s.log = s.log.concat(`🏆 Você chegou ao topo da torre! (${T.n} Pokémon derrotados)`).slice(-40); return false; }
  const p0 = T.fila.shift(), prox = reescalar(p0, nivelNaTorre(s, p0));
  T.andar = T.n + 1;
  s.j["2"].equipe = [prox]; s.j["2"].ativo = 0; s.j["2"].megaUsada = false; s.j["2"].lado = {}; s.j["2"].pivo = false;
  s.fase = "batalha"; s.vencedor = null;
  s.log = s.log.concat(`✔ Derrotado! +${xpTorre(T.n)} XP. Andar ${T.andar}: ${prox.chefe ? "CHEFE — " : ""}apareceu ${prox.nome}!`).slice(-40);
  return true;
}
