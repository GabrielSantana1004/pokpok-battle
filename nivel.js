// Nível do jogador. Funções puras (sem Firebase), usadas pela conta, pela sala, pelo ranking e pelo perfil.
//   nível 0: 0 a 100 XP · nível 1: 100 a 220 · nível 2: 220 a 364 ...  cada nível exige 20% mais XP que o anterior
import { REGRAS } from "./regras.js";
export const XP_VITORIA = 20, XP_DERROTA = 5; // empate conta como derrota (+5): quem lutou até o fim ganha XP
export const XP_PRIMEIRO_NIVEL = 100, CRESCIMENTO = 1.2;

// XP necessário para atravessar o nível n (arredondado para número inteiro): 100, 120, 144, 173, 207...
export const tamanhoNivel = n => Math.round(XP_PRIMEIRO_NIVEL * CRESCIMENTO ** n);

// XP de uma conta. Contas antigas (sem o campo xp) começam com o XP das vitórias que já tinham.
export const xpDe = d => Number.isFinite(d?.xp) ? d.xp : (d?.vitorias || 0) * XP_VITORIA;

// {nivel, inicio, fim, tamanho, noNivel (XP já feito neste nível), falta, pct}
export function infoNivel(xp) {
  xp = Math.max(0, Math.floor(xp || 0));
  let nivel = 0, inicio = 0, tamanho = tamanhoNivel(0);
  while (xp >= inicio + tamanho) { inicio += tamanho; nivel++; tamanho = tamanhoNivel(nivel); }
  const noNivel = xp - inicio;
  return {nivel, xp, inicio, fim: inicio + tamanho, tamanho, noNivel, falta: tamanho - noNivel, pct: Math.round(noNivel / tamanho * 100)};
}

// ----- Pontos de treino: cada nível da conta rende 1 ponto, que sobe 1 nível de um Pokémon (de REGRAS.nivel até REGRAS.nivelMax) -----
// A conta guarda só os níveis dos Pokémon (niveis: {idDoPokemon: nível}); os pontos gastos são calculados a partir deles.
export const nivelDoPokemon = (niveis, id) => Math.min(REGRAS.nivelMax, Math.max(REGRAS.nivel, Math.floor(niveis?.[id] ?? REGRAS.nivel)));
export const pontosDoNivel = n => Math.max(0, Math.min(REGRAS.nivelMax, Math.floor(n)) - REGRAS.nivel); // pontos de treino que um Pokémon de nível n já consumiu
export const pontosGastos = niveis => Object.values(niveis || {}).reduce((t, n) => t + pontosDoNivel(n), 0);
// pontosTrocados: ajuste das trocas. Quem DÁ um Pokémon treinado continua tendo gasto aqueles pontos (+); quem RECEBE ganha o Pokémon sem pagar por ele (−).
export const pontosLivres = d => Math.max(0, infoNivel(xpDe(d)).nivel - pontosGastos(d?.niveis) - (d?.pontosTrocados || 0));

// ----- Batalha contra o bot: o nível dos adversários acompanha o seu time, e a vitória rende mais XP nas dificuldades maiores -----
export const XP_VITORIA_BOT = {facil: 10, normal: 20, dificil: 40}; // derrota continua +XP_DERROTA em qualquer dificuldade
export const xpVitoriaBot = dif => XP_VITORIA_BOT[dif] ?? XP_VITORIA_BOT.facil;
// fácil: nível do seu Pokémon mais fraco · normal: média dos níveis do time · difícil: nível do seu mais forte (sempre entre 50 e 100)
export function nivelDoBot(dif, niveis) {
  const n = niveis.length ? niveis : [REGRAS.nivel];
  const v = dif === "dificil" ? Math.max(...n) : dif === "normal" ? Math.round(n.reduce((t, x) => t + x, 0) / n.length) : Math.min(...n);
  return Math.min(REGRAS.nivelMax, Math.max(REGRAS.nivel, v));
}

// ----- Torre: cada Pokémon derrotado vale 50% mais XP que o anterior (1, 2, 2, 3, 5, 8, 11... arredondado). Sem vitórias, poções ou ranking: só XP -----
export const TORRE_ANDARES = 30, TORRE_CHEFE_A_CADA = 10; // a torre tem 30 andares; todo andar múltiplo de 10 é um chefe mega
export const TORRE_CRESCIMENTO = 1.5;                      // taxa de aumento do XP por vitória seguida (era 2 = +100%)
export const TORRE_NIVEL_MAIS = 5, TORRE_NIVEL_CHEFE_MAIS = 15; // nível do adversário = maior nível do seu time + 5 (chefe: + 15)
export const xpTorre = n => n >= 1 ? Math.round(TORRE_CRESCIMENTO ** (n - 1)) : 0; // XP da n-ésima vitória seguida
export const xpTorreTotal = n => { let t = 0; for (let i = 1; i <= n; i++) t += xpTorre(i); return t; } // XP acumulado depois de n vitórias

// ----- Raid: vencer o lendário rende bastante XP (e a chance de capturá-lo); perder rende o XP de derrota -----
export const XP_RAID = 100;

// ----- Caixas: cada nível da conta rende 1 caixa (guardada; a abertura chega com os itens). caixasAbertas conta as já abertas. -----
export const caixasLivres = d => Math.max(0, infoNivel(xpDe(d)).nivel - (d?.caixasAbertas || 0));
