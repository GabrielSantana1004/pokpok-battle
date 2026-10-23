import { criarSala, lerSala, entrar, uid } from "./salas.js";
import { nav, esc } from "./common.js";
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
$("buscar").onclick = buscar;
$("codigo").onkeydown = e => { if (e.key === "Enter") buscar(); };
Object.assign(window, {ir, retomar});
