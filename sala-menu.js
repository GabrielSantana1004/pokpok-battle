// Menu hambúrguer: trocar de Pokémon, itens (Poção e Reviver), registro e sair.
import { escolher } from "./salas.js";
import { esc } from "./common.js";
import { ativoDe, precisaTrocar, adv, podeTrocar } from "./motor.js";
import { carregarImagens } from "./imagem.js";
import { VITORIAS_POR_REVIVER } from "./usuarios.js";
import { E, $, imgAttr, jogada } from "./salaestado.js";
import { com } from "./sala-replay.js";

let caixa = null;
const logHtml = s => `<div class="log">${s.log.slice().reverse().map(l => `<div>${esc(l)}</div>`).join("")}</div>`;
const hpNum = q => `<span class="hp-num">${q.hpAtual}/${q.hp}</span>`;
function itemTime(q, i, j, pode) {
  const off = !pode || i === j.ativo || q.hpAtual <= 0;
  return `<button class="troca-item" ${off ? "disabled" : ""} ${off ? "" : `onclick="trocar(${i})"`}><img class="foto mini" ${imgAttr(q)} alt="">
    <span>${esc(q.nome)}${q.shiny ? " ✨" : ""}${i === j.ativo ? " (em campo)" : q.hpAtual <= 0 ? " (derrotado)" : ""}</span>${hpNum(q)}</button>`;
}
// botão de item: usa(i) diz se aquele Pokémon pode receber o item agora
const itemBtn = (q, fn, pode, nota) => `<button class="troca-item" ${pode ? `onclick="${fn}"` : "disabled"}><img class="foto mini" ${imgAttr(q)} alt=""><span>${esc(q.nome)}${q.shiny ? " ✨" : ""}${nota}</span>${hpNum(q)}</button>`;

function menuHtml() {
  const s = E.s, papel = E.papel, st = E.status;
  let h = `<div class="menu-topo"><b>Menu</b><button onclick="alternarMenu()" aria-label="Fechar o menu">✕</button></div>`;
  if (E.jogador) {
    const eu = s.j[papel], preso = !podeTrocar(ativoDe(eu), ativoDe(s.j[adv(papel)]));
    const livre = s.fase === "batalha" && !E.reproz && !precisaTrocar(eu) && !precisaTrocar(s.j[adv(papel)]) && !s.escolhas[papel]; // dá para agir agora
    h += `<h3>Trocar de Pokémon</h3><p class="dica">${livre && !preso ? "Trocar gasta a rodada e o Pokémon que sai leva o golpe do adversário." : preso ? "Seu Pokémon está preso e não pode trocar." : "Agora não dá para trocar."}</p>`;
    h += eu.equipe.map((q, i) => itemTime(q, i, eu, livre && !preso)).join("");
    const semConta = !eu.chave;
    h += `<h3>Itens</h3><p class="dica">⭐ Nível ${st.nivel} (${st.noNivel}/${st.tamanho} XP) · 🏆 ${st.vitorias} vitórias · próximo Reviver em ${VITORIAS_POR_REVIVER - st.vitorias % VITORIAS_POR_REVIVER}.💎 ${st.zcristais || 0} ${st.zcristais === 1 ? "cristal Z" : "cristais Z"} (golpe Z: botão na hora de escolher o golpe).${semConta ? " Itens são só para quem joga logado na conta." : " Usar um item gasta a rodada."}</p>`;
    h += `<h4>🧪 Poção (${st.pocoes}) <small>cura 50% do HP</small></h4>` + eu.equipe.map((q, i) =>
      itemBtn(q, `pocao(${i})`, livre && st.pocoes > 0 && q.hpAtual > 0 && q.hpAtual < q.hp, q.hpAtual <= 0 ? " (derrotado)" : q.hpAtual >= q.hp ? " (HP cheio)" : "")).join("");
    h += `<h4>💫 Reviver (${st.revives}) <small>revive com 50% do HP</small></h4>` + eu.equipe.map((q, i) =>
      itemBtn(q, `reviver(${i})`, livre && st.revives > 0 && q.hpAtual <= 0, q.hpAtual > 0 ? " (de pé)" : " (derrotado)")).join("");
  } else {
    for (const k of ["1", "2"]) h += `<h3>Equipe do Jogador ${k}</h3>` + s.j[k].equipe.map((q, i) => itemTime(q, i, s.j[k], false)).join("");
  }
  return h + `<h3>Registro</h3>${logHtml(s)}<button class="sair" onclick="sairSala()">Sair da sala</button>`;
}
export function renderMenu() {
  if (!caixa) { caixa = document.createElement("div"); document.body.appendChild(caixa); }
  const botao = $("btn-menu"), s = E.s;
  if (botao && botao.setAttribute) botao.setAttribute("aria-expanded", E.menuAberto ? "true" : "false");
  const emBatalha = s && s.fase !== "equipes" && ["1", "2"].every(k => s.j[k] && s.j[k].equipe.length);
  caixa.innerHTML = E.menuAberto && emBatalha ? `<div class="menu-fundo" onclick="alternarMenu()"></div><aside class="menu">${menuHtml()}</aside>` : "";
  if (caixa.innerHTML) carregarImagens(caixa);
}
Object.assign(window, {
  alternarMenu: () => { E.menuAberto = !E.menuAberto; if (E.s) com(renderMenu); },
  trocar: i => jogada(escolher(E.codigo, E.papel, {tipo: "troca", idx: i})),
  pocao: i => jogada(escolher(E.codigo, E.papel, {tipo: "pocao", idx: i})),
  reviver: i => jogada(escolher(E.codigo, E.papel, {tipo: "reviver", idx: i}))
});
