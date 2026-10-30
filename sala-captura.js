// Captura logo depois de vencer um bot (1 dos 6 Pokémon dele) ou uma torre (1 lendário): aparece na própria tela de fim da batalha.
// Pokébola grátis e sem limite de tentativas; cada lançamento: capturou · escapou (tente de novo) · fugiu (acabou). Chances em pokemons.js (CAPTURA).
import { esc } from "./common.js";
import { E, badge } from "./salaestado.js";
import { usuario, prepararCaptura, tentarCaptura } from "./usuarios.js";
import { sortearLendario, somaIvs, IV_STATS, IV_MAX } from "./pokemons.js";
const C = {iniciada: false, atual: null, msg: "", ocupado: false};
export const capturaPendente = () => !!C.atual;

// chamada a cada desenho da sala: assim que a vitória é contabilizada (s.capturaGanha), carrega a captura desta sala
export async function iniciarCaptura() {
  const u = usuario(); if (C.iniciada || !u || !E.jogador || !E.s?.capturaGanha) return;
  C.iniciada = true;
  try { C.atual = await prepararCaptura(u.chave, () => sortearLendario(E.todos)?.id, E.codigo); }
  catch(e) { C.msg = "Não foi possível carregar a captura: " + (e.message || e); }
  E.render();
}
export function htmlCaptura() {
  if (!C.atual && !C.msg) return "";
  const msg = C.msg ? `<p class="captura-res">${C.msg}</p>` : "";
  if (!C.atual) return `<div class="captura">${msg}</div>`;
  const p = E.todos.find(x => x.id === C.atual.esp);
  if (!p) return `<div class="captura">${msg}<p>Esse Pokémon não está mais no catálogo.</p></div>`;
  const lend = C.atual.tipo === "lendario";
  return `<div class="captura"><p><b>${lend ? "⭐ Um lendário apareceu!" : "🎯 Capture um Pokémon do bot"}</b></p>
    <img class="foto" data-pokemon="${esc(p.nome)}" alt="${esc(p.nome)}">
    <p><b>${esc(p.nome)}</b> ${p.tipos.map(badge).join("")}${C.atual.tentativas ? ` · tentativas: ${C.atual.tentativas}` : ""}</p>${msg}
    <button class="primario" onclick="lancarPokebola()" ${C.ocupado ? "disabled" : ""}>Lançar Pokébola</button>
    <p class="dica">${lend ? "Lendário: bem mais difícil de capturar. " : ""}A Pokébola é grátis e você pode tentar quantas vezes quiser, mas o Pokémon pode fugir a qualquer tentativa. Se você sair da sala sem capturar, ele vai embora.</p></div>`;
}
window.lancarPokebola = async () => {
  const u = usuario(); if (!u || !C.atual || C.ocupado) return;
  C.ocupado = true; C.msg = ""; E.render();
  const p = E.todos.find(x => x.id === C.atual.esp), nome = esc(p?.nome || "O Pokémon");
  try {
    const r = await tentarCaptura(u.chave, E.codigo);
    if (r.resultado === "escapou") { C.atual = {...C.atual, tentativas: r.tentativas}; C.msg = `💨 ${nome} escapou da Pokébola! Tente de novo.`; }
    else {
      C.atual = null;
      C.msg = r.resultado === "fugiu" ? `🏃 ${nome} fugiu! Não dá mais para capturá-lo.`
        : `🎉 Você capturou ${nome}${r.pokemon.shiny ? " ✨ shiny" : ""}! IVs ${somaIvs(r.pokemon.ivs)}/${IV_STATS.length * IV_MAX}. Ele já está em Meus Pokémon.`;
    }
  } catch(e) { C.msg = "Não foi possível lançar a Pokébola: " + (e.message || e); }
  C.ocupado = false; E.render();
};
