// Página de Missões: lendários que não saem nas raids e são ganhos completando coleções. Dados e regras em missoes-dados.js.
import { listar } from "./firebase.js";
import { esc, nav } from "./common.js";
import { usuario, lerPokemons, lerMissoes, resgatarMissao } from "./usuarios.js";
import { carregarImagens } from "./imagem.js";
import { somaIvs, IV_STATS, IV_MAX } from "./pokemons.js";
import { MISSOES, progresso } from "./missoes-dados.js";
nav();
const $ = id => document.getElementById(id), u = usuario();
const aviso = t => { $("erro").textContent = t || ""; };
const POUCOS = 12; // listas pequenas mostram as figurinhas; as grandes (Pokédex, tipo, Galar) mostram só os nomes
let cat = [], tem = new Set(), resgatadas = {}, msg = "", ocupado = false;

const img = nome => `<img class="foto" data-pokemon="${esc(nome)}" alt="${esc(nome)}">`;
function cartao(m) {
  const p = progresso(m, cat, tem, resgatadas), pct = p.total ? Math.round(p.tenho / p.total * 100) : 0;
  const estado = p.resgatada ? "resgatada" : p.pronta ? "pronta" : !p.disponivel ? "indisponivel" : "";
  let lista = "";
  if (p.total) {
    const itens = p.req.map(q => ({q, ok: !p.falta.includes(q)}));
    lista = p.total <= POUCOS
      ? `<div class="missao-minis">${itens.map(({q, ok}) => `<span class="mm ${ok ? "tenho" : "falta"}" title="${esc(q.nome)}">${img(q.nome)}<small>${esc(q.nome)}</small></span>`).join("")}</div>`
      : `<details class="missao-lista"><summary>Ver Pokémon (faltam ${p.falta.length} de ${p.total})</summary><ul>${itens.sort((a, b) => a.ok - b.ok).map(({q, ok}) => `<li class="${ok ? "tenho" : "falta"}">${ok ? "✔" : "•"} ${esc(q.nome)}</li>`).join("")}</ul></details>`;
  }
  const acao = p.resgatada ? `<span class="missao-ok">✅ Resgatado — ${esc(m.nome)} está em Meus Pokémon</span>`
    : !p.disponivel ? `<span class="missao-ind">Indisponível: ${!p.premio ? esc(m.nome) + " não está no catálogo" : "nenhum Pokémon exigido está no catálogo"}.</span>`
    : `<button class="primario" data-resgatar="${esc(m.id)}" ${p.pronta && !ocupado ? "" : "disabled"}>${p.pronta ? `🎁 Resgatar ${esc(m.nome)}` : `Faltam ${p.falta.length}`}</button>`;
  return `<article class="missao ${estado}"><div class="missao-premio"><div class="missao-foto">${p.premio ? img(m.nome) : "<span>?</span>"}</div><b>${p.resgatada || p.pronta ? esc(m.nome) : "???"}</b></div>
    <div class="missao-corpo"><h3>${esc(m.titulo)}</h3><p>${esc(m.texto)}</p>
      <div class="missao-barra" title="${p.tenho}/${p.total}"><i style="width:${pct}%"></i><span>${p.tenho}/${p.total}</span></div>${lista}<div class="missao-acao">${acao}</div></div></article>`;
}
function desenhar() {
  const feitas = MISSOES.filter(m => resgatadas[m.id]).length;
  $("missoes").innerHTML = `<div class="tr-bloco"><h2>📜 Missões <small>${feitas}/${MISSOES.length} resgatadas</small></h2>
    <p class="missao-intro">Estes lendários <b>não aparecem nas raids</b>: o único jeito de consegui-los é completar a coleção de cada missão. Cada missão só pode ser resgatada uma vez.</p>
    ${msg ? `<p class="captura-res">${msg}</p>` : ""}
    <h3 class="missoes-sub">🌟 Coleções especiais</h3><div class="missoes-grade">${MISSOES.filter(m => m.grupo !== "tipos").map(cartao).join("")}</div>
    <h3 class="missoes-sub">🎨 Mestre dos tipos <small>um exemplar de cada Pokémon do tipo, sem lendários e míticos</small></h3><div class="missoes-grade">${MISSOES.filter(m => m.grupo === "tipos").map(cartao).join("")}</div></div>`;
  carregarImagens($("missoes"));
}
async function carregar() {
  const [especies, regs, feitas] = await Promise.all([listar(), lerPokemons(u.chave), lerMissoes(u.chave)]);
  cat = especies; tem = new Set(Object.values(regs).map(r => String(r.esp))); resgatadas = feitas;
}
$("missoes").onclick = async e => {
  const b = e.target.closest("button[data-resgatar]"); if (!b || ocupado) return;
  const m = MISSOES.find(x => x.id === b.dataset.resgatar), p = progresso(m, cat, tem, resgatadas); if (!p.pronta) return;
  ocupado = true; aviso(""); msg = ""; desenhar();
  try {
    const pk = await resgatarMissao(u.chave, m.id, p.premio.id, p.req.map(q => q.id));
    msg = `🎉 Missão cumprida! Você recebeu ${esc(m.nome)}${pk.shiny ? " ✨ shiny" : ""}! IVs ${somaIvs(pk.ivs)}/${IV_STATS.length * IV_MAX}. Ele já está em <a href="meus.html">Meus Pokémon</a>.`;
    await carregar();
  } catch(err) { aviso(err.message || "Não foi possível resgatar a missão."); try { await carregar(); } catch(e2) {} }
  ocupado = false; desenhar();
};
if (!u) $("missoes").innerHTML = '<div class="tr-bloco"><div class="tr-vazio"><span>🔒</span><p>Entre na sua conta em <a href="meus.html">Meus Pokémon</a> para ver as missões.</p></div></div>';
else { try { await carregar(); desenhar(); } catch(e) { aviso(e.message || "Não foi possível carregar as missões. Confira o firebaseConfig e as regras do Firestore."); } }
