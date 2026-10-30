// Regras de cálculo do PokPok Battle (fórmulas oficiais dos jogos). Tudo que se ajusta fica aqui.
import { multTipo } from "./common.js";

export const REGRAS = {
  nivel: 50,   // nível inicial de todo Pokémon (e fixo para os bots); o jogador pode subir os seus até nivelMax
  nivelMax: 100,
  iv: 31,      // valor individual padrão (bots e Pokémon sem IVs); os Pokémon das contas têm IVs próprios (p.ivs)
  ev: 85,      // pontos de treinamento fixos em cada atributo (natureza neutra)
  stab: 1.5,
  critico: 1.5 // crítico: dois dados com 6 (par de seis)
};

// Atributos finais a partir dos atributos-base (fórmula oficial, natureza neutra)
export function statsFinais(p, R = REGRAS) {
  const f = (k, hp) => {
    const b = p[k], iv = p.ivs?.[k] ?? R.iv; // IV do atributo (0 a 31); sem IVs = valor padrão
    const x = Math.floor((2 * b + iv + Math.floor(R.ev / 4)) * R.nivel / 100);
    return hp ? (b === 1 ? 1 : x + R.nivel + 10) : x + 5;
  };
  return {hp: f("hp", true), atk: f("atk"), def: f("def"), spa: f("spa"), spd: f("spd"), spe: f("spe")};
}

// Variação de 85% a 100% decidida pela soma dos 2d6 (2 → 85%, 7 → 92%, 12 → 100%)
export const variacao = soma => Math.floor(85 + (soma - 2) * 1.5);

// Dano oficial, com arredondamento para baixo a cada etapa.
// Extras: critMin (valor mínimo dos dois dados para o crítico; 6 = só par de seis), critForcado (sempre crítico),
// modClima (multiplicador de clima/terreno, antes do crítico), modTela (Reflect/Light Screen/Aurora Veil, não vale no crítico)
// e modFinal (queimadura e outros, no fim).
export function calcularDano({nivel, poder, atk, def, stab, tipoGolpe, tiposDef, dados, critMin = 6, critForcado = false, modClima = 1, modTela = 1, modFinal = 1}, R = REGRAS) {
  const [d1, d2] = dados;
  const mults = tiposDef.map(t => multTipo(tipoGolpe, t));
  const mult = mults.reduce((a, b) => a * b, 1);
  if (mult === 0) return {dano: 0, mult: 0, crit: false, r: 0};
  let d = Math.floor(Math.floor(Math.floor(2 * nivel / 5 + 2) * poder * atk / def) / 50) + 2;
  if (modClima !== 1) d = Math.floor(d * modClima);
  const crit = critForcado || (d1 >= critMin && d2 >= critMin);
  if (crit) d = Math.floor(d * R.critico);
  const r = variacao(d1 + d2);
  d = Math.floor(d * r / 100);
  if (stab) d = Math.floor(d * R.stab);
  for (const m of mults) d = Math.floor(d * m);
  if (modTela !== 1 && !crit) d = Math.floor(d * modTela);
  if (modFinal !== 1) d = Math.floor(d * modFinal);
  return {dano: Math.max(1, d), mult, crit, r};
}
