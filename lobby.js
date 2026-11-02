import { criarSala, lerSala, entrar, uid, chefeDaRaid } from "./salas.js";
import { nav, esc, TIPOS, efetividade } from "./common.js";
import { carregarImagens } from "./imagem.js";
import { usuario } from "./usuarios.js";
nav(); // quem já está em uma sala é levado para ela
const $ = id => document.getElementById(id);
const aviso = t => { $("erro").textContent = t || ""; };
let codigo = "";

const FASE = {equipes:"montando equipes", prontas:"equipes confirmadas", batalha:"em batalha", fim:"encerrada"};
const vaga = (s, k) => { const j = s.j[k]; return !j ? "livre" : j.saiu ? "encerrada" : "ocupada"; };

const semConta = () => { // jogar (não assistir) exige conta
  if (usuario()) return false;
  $("erro").innerHTML = 'Entre na sua conta em <a href="meus.html">Meus Pokémon</a> antes de jogar.';
  return true;
};
async function ir(papel, retomar) {
  if (papel !== "E" && semConta()) return;
  try { aviso(); await entrar(codigo, papel, retomar); location.href = "sala.html"; }
  catch(e) { aviso(e.message); }
}
function mostrar(s) {
  const fui = ["1", "2"].find(k => s.j[k] && s.j[k].uid === uid); // este navegador já esteve nesta sala
  const card = k => {
    const v = vaga(s, k);
    let b = "";
    if (!(fui && fui !== k)) { // quem já participou não toma a vaga do outro
      if (s.bot && k === "2") b = "";
      else if (v === "livre") b = `<button class="primario" onclick="ir('${k}',false)">Entrar</button>`;
      else if (v === "ocupada") b = `<button onclick="retomar('${k}')">Retomar vaga</button>`;
    }
    return `<div class="vaga ${v}"><h3>${s.bot && k === "2" ? "Bot 🤖" : "Jogador " + k}</h3><span class="status">${v}</span>${b}</div>`;
  };
  $("resultado").innerHTML = `<section class="sala-achada">
    <h2>Sala <span class="codigo">${esc(codigo)}</span> <span class="fase">${esc(FASE[s.fase] || s.fase)}</span></h2>
    <div class="vagas">${card("1")}${card("2")}
      <div class="vaga esp"><h3>Espectador</h3><span class="status">assistir</span><button onclick="ir('E',false)">Assistir</button></div></div>
    ${fui ? `<p class="nota">Você saiu desta sala como Jogador ${fui}; só dá para voltar como espectador.</p>` : ""}
  </section>`;
}
function retomar(k) {
  if (confirm(`Retomar a vaga do Jogador ${k}? Use só se for a sua vaga (por exemplo, depois de trocar de aparelho).`)) ir(k, true);
}
async function buscar() {
  codigo = $("codigo").value.trim().toUpperCase(); $("resultado").innerHTML = ""; aviso();
  if (!codigo) return;
  try {
    const s = await lerSala(codigo);
    if (!s) aviso("Sala não encontrada."); else mostrar(s);
  } catch(e) { aviso("Não foi possível buscar a sala. Confira o firebaseConfig e as regras do Firestore."); }
}
$("criar").onclick = async () => {
  if (semConta()) return;
  try { aviso(); codigo = await criarSala(); await entrar(codigo, "1"); location.href = "sala.html"; }
  catch(e) { aviso(e.message); }
};
$("criar-bot").onclick = async () => { // sala com o bot como Jogador 2; não exige conta (dá para usar equipe aleatória)
  const b = $("criar-bot"); b.disabled = true; b.textContent = "Sorteando a equipe do bot…";
  try { aviso(); codigo = await criarSala(true, $("nivel-bot").value); await entrar(codigo, "1"); location.href = "sala.html"; }
  catch(e) { aviso(e.message); b.disabled = false; b.textContent = "Batalhar contra o bot"; }
};
$("criar-torre").onclick = async () => { // torre: bot que manda um Pokémon por vez; exige conta (o XP vai para ela)
  if (semConta()) return;
  const b = $("criar-torre"); b.disabled = true; b.textContent = "Montando a torre…";
  try { aviso(); codigo = await criarSala(true, "normal", true); await entrar(codigo, "1"); location.href = "sala.html"; }
  catch(e) { aviso(e.message); b.disabled = false; b.textContent = "Subir a torre"; }
};
$("criar-raid").onclick = async () => { // raid: um lendário com 6x o HP; exige conta (o lendário capturado vai para ela)
  if (semConta()) return;
  const b = $("criar-raid"); b.disabled = true; b.textContent = "Procurando um lendário…";
  try { aviso(); codigo = await criarSala(true, "dificil", false, true); await entrar(codigo, "1"); location.href = "sala.html"; }
  catch(e) { aviso(e.message); b.disabled = false; b.textContent = "Enfrentar uma raid"; }
};
// Raid: mostra o chefe guardado na conta (ele só muda quando é derrotado ou você perde), com tipos e fraquezas, para dar tempo de planejar a equipe
async function mostrarChefeRaid() {
  const el = $("raid-chefe"); if (!el || !usuario()) return;
  try {
    const a = await chefeDaRaid(); if (!a) return;
    el.hidden = false;
    if (a.vazio) { el.innerHTML = a.esgotado ? "<p>🏆 Você já tem todos os lendários das raids!</p>" : "<p>Nenhum lendário apareceu ainda. Clique no botão para tentar de novo.</p>"; return; }
    const p = a.especie, chip = (t, extra = "") => `<span class="tipo t-${esc(t)}">${esc(t)}${extra}</span>`;
    const fracos = TIPOS.map(t => [t, efetividade(t, p.tipos)]).filter(([, m]) => m > 1).sort((x, y) => y[1] - x[1]);
    el.innerHTML = `<div class="rc-foto"><img class="foto" data-pokemon="${esc(p.nome)}"${a.shiny ? ' data-shiny="1"' : ""} alt=""></div>
      <div class="rc-info"><b>${esc(p.nome)}${a.shiny ? " ✨ shiny" : ""}</b><div>${p.tipos.map(t => chip(t)).join("")}</div>
      <small>Fraco contra: ${fracos.map(([t, m]) => chip(t, m >= 4 ? " ×4" : "")).join("") || "nenhum tipo"}</small>
      <small class="rc-nota">Este é o seu chefe: ele não muda até você vencê-lo ou perder.</small></div>`;
    carregarImagens(el);
  } catch(e) { /* sem chefe à mostra: o botão ainda sorteia/cria normalmente */ }
}
mostrarChefeRaid();
// a dificuldade escolhida contra o bot fica guardada neste navegador
const CH_NIVEL_BOT = "pbb_nivel_bot";
try { const n = localStorage.getItem(CH_NIVEL_BOT); if (n && [...$("nivel-bot").options].some(x => x.value === n)) $("nivel-bot").value = n; } catch(e) {}
$("nivel-bot").onchange = () => { try { localStorage.setItem(CH_NIVEL_BOT, $("nivel-bot").value); } catch(e) {} };
$("buscar").onclick = buscar;
$("codigo").onkeydown = e => { if (e.key === "Enter") buscar(); };
Object.assign(window, {ir, retomar});
