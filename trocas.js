// Página de trocas às cegas: você escolhe o seu Pokémon e convida o outro jogador; ele escolhe o dele sem ver o seu; depois os dois aparecem e cada um confirma.
// Visual: uma "mesa de troca" com os dois Pokémon frente a frente (o do outro jogador fica escondido atrás de um "?" até a revelação).
import { listar } from "./firebase.js";
import { esc, nav } from "./common.js";
import { usuario, lerPokemons, lerNiveis, chaveDeNick } from "./usuarios.js";
import { instancias, somaIvs, IV_STATS, IV_MAX } from "./pokemons.js";
import { nivelDoPokemon } from "./nivel.js";
import { carregarImagens } from "./imagem.js";
import { propor, escolher, listarTrocas, confirmar, desistir } from "./trocasapi.js";
nav();
const $ = id => document.getElementById(id), u = usuario();
const aviso = t => { $("erro").textContent = t || ""; };
const STATUS = {aguardando: "⏳ Aguardando", revelada: "👀 Revelada", aceita: "✅ Troca feita", recusada: "❌ Recusada", cancelada: "🚫 Cancelada"};
const IV_TOTAL = IV_STATS.length * IV_MAX;
let cat = [], meus = [], niveisMeus = {}, trocas = [], ocupado = false;
const sel = {}; // Pokémon escolhido em cada lugar: "novo" (convite) ou o id de uma troca recebida
const nomeDe = esp => cat.find(p => p.id === esp)?.nome || "Pokémon #" + esp;
const btn = (acao, id, txt, primario) => `<button${primario ? ' class="primario"' : ""} data-acao="${acao}" data-id="${esc(id)}">${txt}</button>`;

// ----- peças visuais -----
const img = (nome, shiny) => `<img class="foto" data-pokemon="${esc(nome)}"${shiny ? ' data-shiny="1"' : ""} alt="${esc(nome)}">`;
const barraIv = ivs => ivs ? `<div class="tr-iv" title="Soma dos IVs"><i style="width:${Math.round(somaIvs(ivs) / IV_TOTAL * 100)}%"></i><span>IVs ${somaIvs(ivs)}/${IV_TOTAL}</span></div>` : "";
const peca = (nome, shiny, ivs, extra = "") => `<div class="tr-peca${shiny ? " shiny" : ""}"><div class="tr-foto">${img(nome, shiny)}</div><b>${esc(nome)}${shiny ? " ✨" : ""}</b>${extra}${barraIv(ivs)}</div>`;
const pecaMeu = p => peca(p.nome, p.shiny, p.ivs, `<small>Nv ${nivelDoPokemon(niveisMeus, p.id)}</small>`);
const pecaF = f => peca(nomeDe(f.esp), f.shiny, f.ivs);
const misterio = txt => `<div class="tr-peca tr-misterio"><div class="tr-foto"><span>?</span></div><b>???</b><small>${txt}</small></div>`;
const cena = (dou, recebo) => `<div class="tr-cena"><div class="tr-lado"><span class="tr-rotulo">Você dá</span>${dou}</div><div class="tr-meio" aria-hidden="true">⇄</div><div class="tr-lado"><span class="tr-rotulo">Você recebe</span>${recebo}</div></div>`;
const selecionado = escopo => { if (!meus.some(p => p.id === sel[escopo])) sel[escopo] = meus[0]?.id; return meus.find(p => p.id === sel[escopo]); };
const previa = escopo => { const p = selecionado(escopo); return `<div class="tr-previa" data-escopo="${esc(escopo)}">${p ? pecaMeu(p) : ""}</div>`; };
const seletor = escopo => { selecionado(escopo); return `<div class="tr-picker"><input type="search" class="tr-busca" placeholder="Buscar nos seus Pokémon"><div class="tr-grade" data-escopo="${esc(escopo)}">${meus.map(p =>
  `<button type="button" class="tr-op${sel[escopo] === p.id ? " marcada" : ""}" data-pick="${esc(p.id)}" data-escopo="${esc(escopo)}" data-nome="${esc(p.nome.toLowerCase())}" title="${esc(p.nome)}">${img(p.nome, p.shiny)}<b>${esc(p.nome)}${p.shiny ? " ✨" : ""}</b><small>Nv ${nivelDoPokemon(niveisMeus, p.id)}${p.ivs ? ` · IV ${somaIvs(p.ivs)}` : ""}</small></button>`).join("")}</div></div>`; };

// ----- uma troca em andamento -----
function cartao(t) {
  const sou = t.de === u.chave, outro = esc(sou ? t.paraNick : t.deNick), dou = sou ? t.meu : t.dele, recebo = sou ? t.dele : t.meu;
  let corpo, nota = "", botoes = "";
  if (t.status === "aguardando") {
    if (sou) {
      corpo = cena(pecaF(dou), misterio(`${outro} ainda vai escolher`));
      nota = `Você ofereceu este Pokémon a <b>${outro}</b>. Ele não vê o seu até escolher o dele.`;
      botoes = btn("desistir", t.id, "Cancelar");
    } else if (meus.length) {
      corpo = cena(previa(t.id), misterio(`${outro} já escolheu`)) + `<h3 class="tr-sub">Escolha o que oferecer</h3>` + seletor(t.id);
      nota = `<b>${outro}</b> quer trocar com você e já escolheu um Pokémon. Você só vê qual é depois de oferecer o seu.`;
      botoes = btn("escolher", t.id, "Oferecer este", true) + btn("desistir", t.id, "Recusar");
    } else { corpo = cena(`<div class="tr-peca tr-misterio"><div class="tr-foto"><span>🎒</span></div><b>Sem Pokémon</b></div>`, misterio(`${outro} já escolheu`)); botoes = btn("desistir", t.id, "Recusar"); }
  } else { // revelada: os dois Pokémon aparecem e cada um confirma
    const eu = sou ? t.confDe : t.confPara, ele = sou ? t.confPara : t.confDe;
    corpo = cena(pecaF(dou), pecaF(recebo));
    nota = `<span class="tr-conf ${eu ? "ok" : ""}">${eu ? "✅" : "⏳"} Você</span><span class="tr-conf ${ele ? "ok" : ""}">${ele ? "✅" : "⏳"} ${outro}</span>`;
    botoes = (eu ? "" : btn("confirmar", t.id, "Confirmar troca", true)) + btn("desistir", t.id, "Desistir");
  }
  return `<article class="tr-troca tr-${t.status}"><header class="tr-cabeca"><span>🤝 Troca com <b>${outro}</b></span><span class="tr-status">${STATUS[t.status]}</span></header>${corpo}${nota ? `<p class="tr-nota">${nota}</p>` : ""}<div class="tr-botoes">${botoes}</div></article>`;
}
// ----- uma troca já encerrada (histórico) -----
function linha(t) {
  const sou = t.de === u.chave, outro = esc(sou ? t.paraNick : t.deNick), dou = sou ? t.meu : t.dele, recebo = sou ? t.dele : t.meu, ok = t.status === "aceita";
  const mini = f => `<div class="tr-mini">${f ? img(nomeDe(f.esp), f.shiny) : "<span>?</span>"}</div>`;
  const txt = t.dele ? `${ok ? "Deu" : "Daria"} <b>${esc(nomeDe(dou.esp))}</b> ${ok ? "e recebeu" : "e receberia"} <b>${esc(nomeDe(recebo.esp))}</b> · ${outro}` : `Convite para ${outro} que não chegou a ser respondido`;
  return `<li class="tr-hist tr-${t.status}">${mini(dou)}<span class="tr-seta">⇄</span>${mini(recebo)}<span class="tr-hist-txt">${txt}</span><span class="tr-status">${STATUS[t.status] || esc(t.status)}</span></li>`;
}
function desenhar() {
  const nickAntes = $("t-nick")?.value || "", rolagem = {};
  document.querySelectorAll(".tr-grade").forEach(g => { rolagem[g.dataset.escopo] = g.scrollTop; });
  const ativas = trocas.filter(t => ["aguardando", "revelada"].includes(t.status)), fim = trocas.filter(t => !ativas.includes(t)).slice(0, 8);
  let h = `<div class="tr-bloco"><h2>🔁 Nova troca</h2>`;
  h += meus.length ? `<ol class="tr-passos"><li><b>1</b> Escolha o seu Pokémon</li><li><b>2</b> Convide um treinador</li><li><b>3</b> Ele escolhe sem ver o seu</li><li><b>4</b> Os dois confirmam</li></ol>
    ${cena(previa("novo"), misterio("Quem vai receber?"))}
    <h3 class="tr-sub">Escolha o que oferecer</h3>${seletor("novo")}
    <div class="tr-convite"><input id="t-nick" placeholder="Nickname do outro treinador" maxlength="20"><button class="primario" id="t-propor" ${ocupado ? "disabled" : ""}>Convidar para trocar</button></div>
    <details class="tr-como"><summary>Como funciona</summary><p>Você escolhe o Pokémon que vai oferecer e convida o outro jogador. Ele escolhe o dele <b>sem ver o seu</b>; só depois os dois Pokémon aparecem e cada um confirma. A troca leva o Pokémon com tudo: IVs, shiny, golpes, nível, habilidade e item. Os pontos de treino gastos nele não voltam para quem o dá.</p></details>`
    : `<div class="tr-vazio"><span>🎒</span><p>Você ainda não tem Pokémon para trocar.</p></div>`;
  h += `</div><div class="tr-bloco"><h2>⏳ Trocas em andamento</h2>${ativas.length ? ativas.map(cartao).join("") : `<div class="tr-vazio"><span>🤝</span><p>Nenhuma troca em andamento.</p></div>`}</div>`;
  if (fim.length) h += `<div class="tr-bloco"><h2>📜 Últimas trocas</h2><ul class="tr-hist-lista">${fim.map(linha).join("")}</ul></div>`;
  $("trocas").innerHTML = h;
  if (nickAntes && $("t-nick")) $("t-nick").value = nickAntes;
  document.querySelectorAll(".tr-grade").forEach(g => { g.scrollTop = rolagem[g.dataset.escopo] || 0; });
  if ($("t-propor")) $("t-propor").onclick = convidar;
  carregarImagens($("trocas"));
}
async function carregar() {
  const [especies, regs, niveis, lista] = await Promise.all([listar(), lerPokemons(u.chave), lerNiveis(u.chave), listarTrocas(u.chave)]);
  cat = especies; meus = instancias(cat, regs); niveisMeus = niveis; trocas = lista;
}
async function convidar() {
  aviso(""); const nick = $("t-nick").value.trim(); if (!nick) return aviso("Digite o nickname do outro jogador.");
  if (!selecionado("novo")) return aviso("Escolha o Pokémon que você quer oferecer.");
  ocupado = true; desenhar();
  try { await propor(u, chaveDeNick(nick), sel.novo); await carregar(); }
  catch(e) { aviso(e.message || "Não foi possível convidar para a troca."); }
  ocupado = false; desenhar();
}
$("trocas").addEventListener("input", e => { // busca dentro do seletor, sem redesenhar a tela
  const i = e.target.closest(".tr-busca"); if (!i) return;
  const q = i.value.trim().toLowerCase();
  i.closest(".tr-picker").querySelectorAll(".tr-op").forEach(b => { b.hidden = !!q && !b.dataset.nome.includes(q); });
});
$("trocas").onclick = async e => {
  const op = e.target.closest(".tr-op");
  if (op) { // escolher um Pokémon no seletor: atualiza só a marcação e a vitrine
    const {pick, escopo} = op.dataset; sel[escopo] = pick;
    op.parentElement.querySelectorAll(".tr-op").forEach(b => b.classList.toggle("marcada", b === op));
    const pv = document.querySelector(`.tr-previa[data-escopo="${CSS.escape(escopo)}"]`), p = meus.find(x => x.id === pick);
    if (pv && p) { pv.innerHTML = pecaMeu(p); carregarImagens(pv); }
    return;
  }
  const b = e.target.closest("button[data-acao]"); if (!b || ocupado) return;
  const {acao, id} = b.dataset; aviso("");
  if (acao === "escolher" && !selecionado(id)) return aviso("Escolha um Pokémon para oferecer.");
  if (acao === "confirmar" && !confirm("Confirmar a troca? Quando os dois confirmarem, os Pokémon trocam de dono na hora.")) return;
  ocupado = true;
  try {
    if (acao === "escolher") await escolher(id, u.chave, sel[id]);
    else if (acao === "desistir") await desistir(id, u.chave);
    else if (acao === "confirmar") { if (await confirmar(id, u.chave) === "feita") nav(); }
    await carregar();
  } catch(e2) { aviso(e2.message || "Não foi possível concluir."); try { await carregar(); } catch(e3) {} }
  ocupado = false; desenhar();
};
if (!u) $("trocas").innerHTML = '<div class="tr-bloco"><div class="tr-vazio"><span>🔒</span><p>Entre na sua conta em <a href="meus.html">Meus Pokémon</a> para trocar.</p></div></div>';
else { try { await carregar(); desenhar(); } catch(e) { aviso(e.message || "Não foi possível carregar as trocas. Confira o firebaseConfig e as regras do Firestore (coleção trocas)."); } }
