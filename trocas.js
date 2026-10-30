// Página de trocas às cegas: você escolhe o seu Pokémon e convida o outro jogador; ele escolhe o dele sem ver o seu; depois os dois aparecem e cada um confirma.
import { listar } from "./firebase.js";
import { esc, nav } from "./common.js";
import { usuario, lerPokemons, lerNiveis, chaveDeNick } from "./usuarios.js";
import { instancias, somaIvs, IV_STATS, IV_MAX } from "./pokemons.js";
import { nivelDoPokemon } from "./nivel.js";
import { propor, escolher, listarTrocas, confirmar, desistir } from "./trocasapi.js";
nav();
const $ = id => document.getElementById(id), u = usuario();
const aviso = t => { $("erro").textContent = t || ""; };
const STATUS = {aceita: "✅ aceita", recusada: "❌ recusada", cancelada: "🚫 cancelada"};
let cat = [], meus = [], niveisMeus = {}, trocas = [], ocupado = false;
const nomeDe = esp => cat.find(p => p.id === esp)?.nome || "Pokémon #" + esp;
const ivTxt = ivs => ivs ? ` · IVs ${somaIvs(ivs)}/${IV_STATS.length * IV_MAX}` : "";
const opcoes = () => meus.map(p => `<option value="${esc(p.id)}">${esc(`${p.nome}${p.shiny ? " ✨" : ""} · Nv ${nivelDoPokemon(niveisMeus, p.id)}${ivTxt(p.ivs)}`)}</option>`).join("");
const lado = f => `<b>${esc(nomeDe(f.esp))}${f.shiny ? " ✨" : ""}</b>${ivTxt(f.ivs)}`;
const btn = (acao, id, txt, primario) => `<button${primario ? ' class="primario"' : ""} data-acao="${acao}" data-id="${esc(id)}">${txt}</button>`;

function cartao(t) {
  const sou = t.de === u.chave, outro = esc(sou ? t.paraNick : t.deNick), dou = sou ? t.meu : t.dele, recebo = sou ? t.dele : t.meu;
  let txt, botoes = "";
  if (t.status === "aguardando") {
    if (sou) { txt = `Você ofereceu ${lado(t.meu)} a <b>${outro}</b>. Esperando ele escolher o Pokémon dele (ele não vê o seu).`; botoes = btn("desistir", t.id, "Cancelar"); }
    else { txt = `<b>${outro}</b> quer trocar com você e já escolheu um Pokémon (você só vai ver qual depois de escolher o seu).`;
      botoes = `<br><select data-sel="${esc(t.id)}">${opcoes()}</select> ${btn("escolher", t.id, "Oferecer este", true)} ${btn("desistir", t.id, "Recusar")}`; }
  } else if (t.status === "revelada") {
    const eu = sou ? t.confDe : t.confPara, ele = sou ? t.confPara : t.confDe;
    txt = `Troca com <b>${outro}</b>: você dá ${lado(dou)} e recebe ${lado(recebo)}.${eu ? ` ✅ Você confirmou, esperando ${outro}.` : ele ? ` ✅ ${outro} já confirmou.` : ""}`;
    botoes = (eu ? "" : btn("confirmar", t.id, "Confirmar troca", true) + " ") + btn("desistir", t.id, "Desistir");
  } else txt = t.dele ? `Troca com <b>${outro}</b>: você ${t.status === "aceita" ? "deu" : "daria"} ${lado(dou)} e ${t.status === "aceita" ? "recebeu" : "receberia"} ${lado(recebo)}.` : `Convite de troca com <b>${outro}</b> que não chegou a ser respondido.`;
  return `<li class="troca-item">${txt} ${STATUS[t.status] ? `<small>${STATUS[t.status]}</small>` : ""} ${botoes}</li>`;
}
function desenhar() {
  const ativas = trocas.filter(t => ["aguardando", "revelada"].includes(t.status)), fim = trocas.filter(t => !ativas.includes(t)).slice(0, 8);
  let h = `<h2>Nova troca</h2><p>Você escolhe o Pokémon que vai oferecer e convida o outro jogador. Ele escolhe o dele <b>sem ver o seu</b>; só depois os dois Pokémon aparecem e cada um confirma. A troca leva o Pokémon com tudo: IVs, shiny, golpes, nível, habilidade e item. Os pontos de treino gastos nele não voltam para quem o dá.</p>`;
  h += meus.length ? `<p><label>Seu Pokémon <select id="t-meu">${opcoes()}</select></label></p><p><input id="t-nick" placeholder="Nickname do outro jogador" maxlength="20"> <button class="primario" id="t-propor" ${ocupado ? "disabled" : ""}>Convidar para trocar</button></p>` : "<p>Você ainda não tem Pokémon para trocar.</p>";
  h += `<h2>Trocas em andamento</h2>${ativas.length ? `<ul class="troca-lista">${ativas.map(cartao).join("")}</ul>` : "<p>Nenhuma troca em andamento.</p>"}`;
  if (fim.length) h += `<h2>Últimas trocas</h2><ul class="troca-lista">${fim.map(cartao).join("")}</ul>`;
  $("trocas").innerHTML = h;
  if ($("t-propor")) $("t-propor").onclick = convidar;
}
async function carregar() {
  const [especies, regs, niveis, lista] = await Promise.all([listar(), lerPokemons(u.chave), lerNiveis(u.chave), listarTrocas(u.chave)]);
  cat = especies; meus = instancias(cat, regs); niveisMeus = niveis; trocas = lista;
}
async function convidar() {
  aviso(""); const nick = $("t-nick").value.trim(); if (!nick) return aviso("Digite o nickname do outro jogador.");
  ocupado = true; desenhar();
  try { await propor(u, chaveDeNick(nick), $("t-meu").value); await carregar(); }
  catch(e) { aviso(e.message || "Não foi possível convidar para a troca."); }
  ocupado = false; desenhar();
}
$("trocas").onclick = async e => {
  const b = e.target.closest("button[data-acao]"); if (!b || ocupado) return;
  const {acao, id} = b.dataset; aviso("");
  if (acao === "confirmar" && !confirm("Confirmar a troca? Quando os dois confirmarem, os Pokémon trocam de dono na hora.")) return;
  ocupado = true;
  try {
    if (acao === "escolher") await escolher(id, u.chave, document.querySelector(`select[data-sel="${CSS.escape(id)}"]`).value);
    else if (acao === "desistir") await desistir(id, u.chave);
    else if (acao === "confirmar") { if (await confirmar(id, u.chave) === "feita") nav(); }
    await carregar();
  } catch(e2) { aviso(e2.message || "Não foi possível concluir."); try { await carregar(); } catch(e3) {} }
  ocupado = false; desenhar();
};
if (!u) $("trocas").innerHTML = '<p>Entre na sua conta em <a href="meus.html">Meus Pokémon</a> para trocar.</p>';
else { try { await carregar(); desenhar(); } catch(e) { aviso(e.message || "Não foi possível carregar as trocas. Confira o firebaseConfig e as regras do Firestore (coleção trocas)."); } }
