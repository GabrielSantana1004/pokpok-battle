// Menu hambúrguer: três abas — Equipe (trocar de Pokémon), Itens (Poção e Reviver) e Registro — mais o botão de sair.
import { escolher } from "./salas.js";
import { esc } from "./common.js";
import { ativoDe, precisaTrocar, adv, podeTrocar } from "./motor.js";
import { carregarImagens } from "./imagem.js";
import { VITORIAS_POR_REVIVER } from "./usuarios.js";
import { RAID } from "./raid.js";
import { E, $, imgAttr, jogada } from "./salaestado.js";
import { com } from "./sala-replay.js";

let caixa = null;
const ABAS = [["equipe", "🔄", "Equipe"], ["itens", "🎒", "Itens"], ["registro", "📜", "Registro"]];
const corHp = f => f > 0.5 ? "#36c46a" : f > 0.2 ? "#f0b400" : "#e63946";
const nome = q => `${esc(q.nome)}${q.shiny ? " ✨" : ""}`;

// cartão de um Pokémon da equipe. acao: texto de onclick (ou null = só mostra); chip: etiqueta de baixo; selo: etiqueta de cima
function cartao(q, {acao, ativo, campo = false, chip = "", dica = ""}) {
  const caido = q.hpAtual <= 0, f = Math.max(0, Math.min(1, q.hpAtual / q.hp));
  return `<button class="mn-card${campo ? " campo" : ""}${caido ? " caido" : ""}${acao && ativo ? " pode" : ""}" ${acao && ativo ? `onclick="${acao}"` : "disabled"} title="${esc(dica)}">
    ${campo ? '<em class="mn-selo">Em campo</em>' : caido ? '<em class="mn-selo cai">Derrotado</em>' : ""}
    <span class="mn-foto"><img class="foto mini" ${imgAttr(q)} alt=""></span>
    <b>${nome(q)}</b>
    <span class="mn-hp" aria-hidden="true"><i style="width:${Math.round(f * 100)}%;background:${corHp(f)}"></i></span>
    <small class="hp-num">${q.hpAtual}/${q.hp}</small>
    ${chip ? `<span class="mn-chip">${chip}</span>` : ""}
  </button>`;
}
const equipeDe = (j, anotar) => j.equipe.map((q, i) => anotar(q, i, i === j.ativo)).join("");
const logHtml = s => `<div class="log mn-log">${s.log.slice().reverse().map(l => `<div${/^(⚠️|⏳)/.test(l) ? ' class="alerta"' : ""}>${esc(l)}</div>`).join("")}</div>`;

function abaEquipe(s, eu, podeAgir, preso) {
  const dica = podeAgir && !preso ? "Trocar gasta a rodada e o Pokémon que sai leva o golpe do adversário." : preso ? "Seu Pokémon está preso e não pode trocar." : "Agora não dá para trocar.";
  return `<p class="mn-dica">${dica}</p><div class="mn-grade">${equipeDe(eu, (q, i, campo) => {
    const ok = podeAgir && !preso && !campo && q.hpAtual > 0;
    return cartao(q, {acao: `trocar(${i})`, ativo: ok, campo, chip: ok ? "🔄 Trocar" : "", dica: ok ? `Trocar para ${q.nome}` : ""});
  })}</div>`;
}
function abaItens(s, eu, st, podeAgir) {
  if (!eu.chave) return `<p class="mn-dica">Itens e cristais só existem para quem está logado na conta.</p>`;
  const item = E.menuItem === "reviver" ? "reviver" : "pocao", restam = s.raid ? RAID.itens - (eu.itensRaid || 0) : null;
  const semItensRaid = restam !== null && restam <= 0;
  const botao = (id, ico, rotulo, qtd, sub) => `<button class="mn-item${item === id ? " sel" : ""}" onclick="menuItem('${id}')" aria-pressed="${item === id}"><span class="ico">${ico}</span><b>${rotulo}</b><span class="qtd">×${qtd}</span><small>${sub}</small></button>`;
  const pocao = item === "pocao", estoque = pocao ? st.pocoes : st.revives;
  let h = `<div class="mn-itens">${botao("pocao", "🧪", "Poção", st.pocoes, "cura 50% do HP")}${botao("reviver", "💫", "Reviver", st.revives, "revive com 50%")}</div>`;
  if (restam !== null) h += `<p class="mn-aviso${semItensRaid ? " zero" : ""}">⚔️ <b>Raid:</b> ${semItensRaid ? "você já usou todos os itens permitidos." : `restam <b>${restam}</b> de ${RAID.itens} itens (Poção e Reviver) para você.`}</p>`;
  h += `<p class="mn-dica">${pocao ? "Escolha o Pokémon que vai beber a poção." : "Escolha o Pokémon derrotado que vai reviver."} Usar um item gasta a rodada.</p>`;
  h += `<div class="mn-grade">${equipeDe(eu, (q, i, campo) => {
    const elegivel = pocao ? q.hpAtual > 0 && q.hpAtual < q.hp : q.hpAtual <= 0, ok = podeAgir && estoque > 0 && !semItensRaid && elegivel;
    const chip = ok ? (pocao ? `🧪 +${Math.min(q.hp - q.hpAtual, Math.floor(q.hp / 2))} HP` : `💫 volta com ${Math.floor(q.hp / 2)}`) : pocao ? (q.hpAtual <= 0 ? "Derrotado" : q.hpAtual >= q.hp ? "HP cheio" : "") : (q.hpAtual > 0 ? "De pé" : "");
    return cartao(q, {acao: `${item}(${i})`, ativo: ok, campo, chip, dica: ok ? `Usar em ${q.nome}` : ""});
  })}</div>`;
  const prox = VITORIAS_POR_REVIVER - st.vitorias % VITORIAS_POR_REVIVER;
  h += `<div class="mn-rodape-info"><span>🏆 ${st.vitorias} vitórias · próximo Reviver em ${prox}</span><span>💎 ${st.zcristais || 0} ${st.zcristais === 1 ? "cristal Z" : "cristais Z"} <small>(golpe Z: botão na hora de escolher o golpe)</small></span></div>`;
  return h;
}
function menuHtml() {
  const s = E.s, papel = E.papel, st = E.status, aba = ABAS.some(a => a[0] === E.menuAba) ? E.menuAba : "equipe";
  let corpo;
  if (E.jogador) {
    const eu = s.j[papel], preso = !podeTrocar(ativoDe(eu), ativoDe(s.j[adv(papel)]));
    const podeAgir = s.fase === "batalha" && !E.reproz && !precisaTrocar(eu) && !precisaTrocar(s.j[adv(papel)]) && !s.escolhas[papel]; // dá para agir agora
    corpo = aba === "equipe" ? abaEquipe(s, eu, podeAgir, preso) : aba === "itens" ? abaItens(s, eu, st, podeAgir) : logHtml(s);
  } else { // espectador: só vê as equipes e o registro
    corpo = aba === "registro" ? logHtml(s) : ["1", "2"].map(k => `<h3 class="mn-sub">Equipe do Jogador ${k}</h3><div class="mn-grade">${equipeDe(s.j[k], (q, i, campo) => cartao(q, {acao: null, ativo: false, campo}))}</div>`).join("");
  }
  const abas = E.jogador ? ABAS : [ABAS[0], ABAS[2]];
  const fichas = E.jogador ? `<div class="mn-fichas"><span title="Nível e XP">⭐ Nv ${st.nivel} <small>${st.noNivel}/${st.tamanho} XP</small></span><span>🧪 ${st.pocoes}</span><span>💫 ${st.revives}</span><span>💎 ${st.zcristais || 0}</span></div>` : "";
  return `<div class="mn-topo"><b>☰ Menu</b><button onclick="alternarMenu()" aria-label="Fechar o menu">✕</button></div>${fichas}
    <nav class="mn-abas" role="tablist">${abas.map(([id, ico, rot]) => `<button role="tab" aria-selected="${aba === id}" class="${aba === id ? "sel" : ""}" onclick="menuAba('${id}')">${ico} ${rot}</button>`).join("")}</nav>
    <div class="mn-corpo">${corpo}</div>
    <div class="mn-rodape"><button class="sair" onclick="sairSala()">🚪 Sair da sala</button></div>`;
}
export function renderMenu() {
  if (!caixa) { caixa = document.createElement("div"); document.body.appendChild(caixa); }
  const botao = $("btn-menu"), s = E.s;
  if (botao && botao.setAttribute) botao.setAttribute("aria-expanded", E.menuAberto ? "true" : "false");
  const emBatalha = s && s.fase !== "equipes" && ["1", "2"].every(k => s.j[k] && s.j[k].equipe.length);
  const abrindo = !caixa.innerHTML, rolagem = caixa.querySelector?.(".mn-corpo")?.scrollTop || 0; // anima só ao abrir e mantém a rolagem quando o menu se atualiza
  caixa.innerHTML = E.menuAberto && emBatalha ? `<div class="menu-fundo" onclick="alternarMenu()"></div><aside class="menu mn${abrindo ? " anim" : ""}" role="dialog" aria-label="Menu">${menuHtml()}</aside>` : "";
  if (caixa.innerHTML) { carregarImagens(caixa); const c = caixa.querySelector(".mn-corpo"); if (c) c.scrollTop = rolagem; }
}
Object.assign(window, {
  alternarMenu: () => { E.menuAberto = !E.menuAberto; if (E.s) com(renderMenu); },
  menuAba: a => { E.menuAba = a; if (E.s) com(renderMenu); },
  menuItem: i => { E.menuItem = i; if (E.s) com(renderMenu); },
  trocar: i => jogada(escolher(E.codigo, E.papel, {tipo: "troca", idx: i})),
  pocao: i => jogada(escolher(E.codigo, E.papel, {tipo: "pocao", idx: i})),
  reviver: i => jogada(escolher(E.codigo, E.papel, {tipo: "reviver", idx: i}))
});
