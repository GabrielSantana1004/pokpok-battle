// Aba "Times" de Meus Pokémon: vários times salvos na conta, com nome editável e ordem de entrada em campo.
import { esc } from "./common.js";
import { carregarImagens } from "./imagem.js";
import { lerTimes, salvarTimes, MAX_TIMES } from "./usuarios.js";

const novoId = () => "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
let raiz, ctx, times = [], recado = "";

// ctx: {chave, prontos: [Pokémon com golpes escolhidos], shiny: {id: true}, golpes: p => [golpes escolhidos]}
export async function montarTimes(el, c) {
  raiz = el; ctx = c; raiz.hidden = false; raiz.innerHTML = "Carregando...";
  try { times = await lerTimes(ctx.chave); } catch(e) { raiz.innerHTML = '<p class="aviso-erro">Não foi possível carregar seus times.</p>'; return; }
  desenhar();
}
const pk = id => ctx.prontos.find(p => p.id === id);
async function gravar(msg) {
  try { await salvarTimes(ctx.chave, times); recado = msg || "Salvo ✔"; } catch(e) { recado = "Não foi possível salvar: " + e.message; }
  desenhar();
}
function slot(t, id, i) {
  const p = pk(id);
  if (!p) return `<li class="slot vazio" title="Esse Pokémon não tem mais golpes escolhidos"><span>⚠ indisponível</span><button onclick="tmRm('${t.id}',${i})" aria-label="Tirar">✕</button></li>`;
  const golpes = ctx.golpes(p).map(m => m.nome).join(", ");
  return `<li class="slot" title="${esc(golpes)}"><img class="foto mini" data-pokemon="${esc(p.nome)}"${ctx.shiny[p.id] ? ' data-shiny="1"' : ""} alt="">
    <b>${i + 1}. ${esc(p.nome)}${ctx.shiny[p.id] ? " ✨" : ""} <small class="nv-pk">Nv ${p.nivel || 50}</small></b><small>${esc(golpes)}</small>
    <span class="slot-bt"><button onclick="tmMv('${t.id}',${i},-1)" aria-label="Para cima" ${i === 0 ? "disabled" : ""}>↑</button><button onclick="tmMv('${t.id}',${i},1)" aria-label="Para baixo" ${i === t.ids.length - 1 ? "disabled" : ""}>↓</button><button onclick="tmRm('${t.id}',${i})" aria-label="Tirar">✕</button></span></li>`;
}
function cartao(t) {
  const livres = ctx.prontos.filter(p => !t.ids.includes(p.id));
  return `<article class="time">
    <div class="time-topo"><input class="time-nome" value="${esc(t.nome)}" maxlength="24" aria-label="Nome do time" onchange="tmNome('${t.id}',this.value)">
      <span class="time-qtd">${t.ids.length}/6</span></div>
    <ol class="slots">${t.ids.map((id, i) => slot(t, id, i)).join("") || '<li class="slot vazio"><span>Time vazio: adicione Pokémon abaixo.</span></li>'}</ol>
    ${t.ids.length < 6 ? `<div class="time-add"><select id="add-${t.id}">${livres.map(p => `<option value="${esc(p.id)}">${esc(p.nome)}${ctx.shiny[p.id] ? " ✨" : ""}</option>`).join("") || "<option value=''>(nenhum Pokémon pronto)</option>"}</select>
      <button onclick="tmAdd('${t.id}')" ${livres.length ? "" : "disabled"}>Adicionar</button></div>` : ""}
    <div class="time-acoes"><button onclick="tmDup('${t.id}')" ${times.length >= MAX_TIMES ? "disabled" : ""}>Duplicar</button><button class="remover" onclick="tmDel('${t.id}')">Excluir time</button></div></article>`;
}
function desenhar() {
  raiz.innerHTML = `<div class="times-topo"><h2>Meus times <small>(${times.length}/${MAX_TIMES})</small></h2>
    <button class="primario" onclick="tmNovo()" ${times.length >= MAX_TIMES ? "disabled" : ""}>➕ Novo time</button></div>
    <p class="dica">${recado ? esc(recado) : "Monte até 6 Pokémon por time. Só entram Pokémon com golpes escolhidos. Na sala de batalha você escolhe um dos seus times."}</p>
    ${ctx.prontos.length ? "" : '<p class="aviso-erro">Você ainda não escolheu golpes de nenhum Pokémon: abra a aba Pokémon e escolha.</p>'}
    <div class="times">${times.map(cartao).join("") || "<p>Você ainda não tem times.</p>"}</div>`;
  carregarImagens(raiz);
}
const achar = id => times.find(t => t.id === id);
Object.assign(window, {
  tmNovo: () => { if (times.length >= MAX_TIMES) return; times.push({id: novoId(), nome: `Time ${times.length + 1}`, ids: []}); gravar("Novo time criado."); },
  tmNome: (id, v) => { const t = achar(id); if (!t) return; t.nome = v.trim().slice(0, 24) || "Time sem nome"; gravar("Nome salvo ✔"); },
  tmAdd: id => { const t = achar(id), v = document.getElementById("add-" + id)?.value; if (!t || !v || t.ids.length >= 6 || t.ids.includes(v)) return; t.ids.push(v); gravar(); },
  tmRm: (id, i) => { const t = achar(id); if (!t) return; t.ids.splice(i, 1); gravar(); },
  tmMv: (id, i, d) => { const t = achar(id), j = i + d; if (!t || j < 0 || j >= t.ids.length) return; [t.ids[i], t.ids[j]] = [t.ids[j], t.ids[i]]; gravar(); },
  tmDup: id => { const t = achar(id); if (!t || times.length >= MAX_TIMES) return; times.push({id: novoId(), nome: (t.nome + " (cópia)").slice(0, 24), ids: [...t.ids]}); gravar("Time duplicado."); },
  tmDel: id => { const t = achar(id); if (!t || !confirm(`Excluir o time "${t.nome}"?`)) return; times = times.filter(x => x.id !== id); gravar("Time excluído."); }
});
