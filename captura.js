// Tela de captura: depois de vencer um bot (1 dos 6 Pokémon dele) ou uma torre (1 lendário), lance Pokébolas grátis até capturar ou o Pokémon fugir.
import { listar } from "./firebase.js";
import { esc, nav } from "./common.js";
import { carregarImagens } from "./imagem.js";
import { usuario, prepararCaptura, tentarCaptura } from "./usuarios.js";
import { sortearLendario, somaIvs, IV_STATS, IV_MAX } from "./pokemons.js";
nav();
const $ = id => document.getElementById(id), u = usuario();
const badge = t => `<span class="tipo t-${esc(t)}">${esc(t)}</span>`;
let cat = [], atual = null, msg = "", ocupado = false;

function desenhar() {
  const sec = $("captura");
  if (!atual) {
    sec.innerHTML = `${msg ? `<p class="captura-res">${msg}</p>` : ""}<p>Nenhuma captura disponível agora. Ao vencer um bot você pode tentar capturar um dos Pokémon dele; ao vencer uma torre, aparece um lendário.</p>`;
    return;
  }
  const p = cat.find(x => x.id === atual.esp);
  if (!p) { sec.innerHTML = "<p>Esse Pokémon não está mais no catálogo.</p>"; return; }
  const lend = atual.tipo === "lendario";
  sec.innerHTML = `<h2>${lend ? "⭐ Um lendário apareceu!" : "🎯 Capture um Pokémon do bot"}</h2>
    <article class="card captura-card"><img class="foto" data-pokemon="${esc(p.nome)}" alt="${esc(p.nome)}">
      <h3>${esc(p.nome)}</h3><div class="tipos">${p.tipos.map(badge).join("")}</div>
      <p>${lend ? "Lendário: é bem mais difícil de capturar." : "Pokémon do time do bot que você derrotou."}${atual.tentativas ? ` Tentativas: <b>${atual.tentativas}</b>.` : ""}</p></article>
    ${msg ? `<p class="captura-res">${msg}</p>` : ""}
    <div class="acoes-editor"><button class="primario" id="lancar" ${ocupado ? "disabled" : ""}>Lançar Pokébola</button></div>
    <p class="dica">A Pokébola é grátis e você pode tentar quantas vezes quiser, mas o Pokémon pode fugir a qualquer tentativa.${atual.fila > 1 ? ` Há mais ${atual.fila - 1} captura(s) esperando.` : ""}</p>`;
  carregarImagens(sec);
  $("lancar").onclick = lancar;
}
async function lancar() {
  ocupado = true; msg = ""; desenhar();
  const p = cat.find(x => x.id === atual.esp);
  try {
    const r = await tentarCaptura(u.chave);
    if (r.resultado === "escapou") { atual = {...atual, tentativas: r.tentativas}; msg = `💨 ${esc(p.nome)} escapou da Pokébola! Tente de novo.`; }
    else {
      const nome = esc(p.nome);
      msg = r.resultado === "fugiu" ? `🏃 ${nome} fugiu! Não dá mais para capturá-lo.`
        : `🎉 Você capturou ${nome}${r.pokemon.shiny ? " ✨ shiny" : ""}! IVs ${somaIvs(r.pokemon.ivs)}/${IV_STATS.length * IV_MAX}. Ele já está em <a href="meus.html">Meus Pokémon</a>.`;
      atual = r.fila ? await prepararCaptura(u.chave, escolherLendario) : null;
      nav();
    }
  } catch(e) { aviso(e.message || "Não foi possível lançar a Pokébola."); }
  ocupado = false; desenhar();
}
const aviso = t => { $("erro").textContent = t || ""; };
const escolherLendario = () => sortearLendario(cat)?.id;

if (!u) $("captura").innerHTML = '<p>Entre na sua conta em <a href="meus.html">Meus Pokémon</a> para capturar.</p>';
else {
  try { cat = await listar(); atual = await prepararCaptura(u.chave, escolherLendario); desenhar(); }
  catch(e) { aviso(e.message || "Não foi possível carregar a captura. Confira o firebaseConfig e as regras do Firestore."); }
}
