// Página da sala: liga o Firestore (ouvir a sala) às telas. O trabalho pesado está nos módulos:
//   salaestado.js (estado compartilhado) · sala-equipe.js (escolha do time) · sala-batalha.js (tela de batalha)
//   sala-menu.js (menu ☰: trocas e itens) · sala-replay.js (rodada passo a passo) · sala-fx.js (barras, números e avisos)
import { uid, sessao, ouvir, sair, contabilizarResultado, encerrarTorre } from "./salas.js";
import { listar } from "./firebase.js";
import { esc } from "./common.js";
import { carregarImagens, carregarSprites } from "./imagem.js";
import { usuario, lerBuilds, lerStatus, lerShiny, lerTimes, lerNiveis } from "./usuarios.js";
import { nivelDoPokemon, xpTorreTotal } from "./nivel.js";
import { E, $, ses, msg } from "./salaestado.js";
import { com, enfileirar, pararReplay } from "./sala-replay.js";
import { telaEquipe } from "./sala-equipe.js";
import { telaBatalha } from "./sala-batalha.js";
import { renderMenu } from "./sala-menu.js";
import { aplicarFx, reiniciarFx } from "./sala-fx.js";

if (!ses) location.replace("index.html");
let creditando = false, rodVista = null, parar = () => {};

// ----- tela -----
function desenhar() {
  const s = E.s, emBatalha = s.fase !== "equipes" && ["1", "2"].every(k => s.j[k] && s.j[k].equipe.length);
  document.body.classList.toggle("em-batalha", emBatalha);
  if (emBatalha) $("conteudo").innerHTML = telaBatalha();
  else {
    const stj = k => { const j = s.j[k]; if (j && j.bot) return "bot (equipe pronta)"; return !j ? "aguardando entrar" : j.saiu ? "saiu" : j.confirmada ? "equipe confirmada" : "escolhendo equipe"; };
    let h = `<h2>Sala ${esc(E.codigo)}</h2><p>Você é <b>${E.jogador ? "Jogador " + E.papel : "espectador"}</b>. <button onclick="sairSala()">Sair da sala</button></p>`;
    if (s.fase === "fim") h += `<p>Sala encerrada: um dos jogadores saiu.</p>`;
    else h += `<p>Jogador 1: ${stj("1")} · Jogador 2: ${stj("2")}</p>` + (E.jogador ? telaEquipe() : "<p>Aguardando os jogadores montarem as equipes...</p>");
    $("conteudo").innerHTML = h;
  }
  renderMenu();
  carregarImagens($("conteudo"));
  carregarSprites($("conteudo"));
  if (emBatalha) aplicarFx();
}
function render() { com(desenhar); if (!E.reproz) checarResultado(); }
E.render = render;

// ----- vitória: o vencedor (quando a reprodução termina) recebe +1 vitória e +1 poção (e Reviver a cada 20) -----
async function carregaStatus() {
  const u = usuario(); if (!u || !E.jogador) return;
  try { E.status = await lerStatus(u.chave); if (E.s) render(); } catch(e) {}
}
E.carregaStatus = carregaStatus;
let credito = Promise.resolve();
function checarResultado(forcar = false) { // quando a batalha acaba (e a reprodução terminou), cada jogador logado recebe o seu XP (e a vitória, se venceu)
  const s = E.s;
  if (creditando || !E.jogador || !s || s.fase !== "fim" || !s.vencedor || s.desistiu || s.j[E.papel]?.resultado || (E.reproz && !forcar)) return credito;
  creditando = true;
  credito = contabilizarResultado(E.codigo, E.papel).then(ok => ok && carregaStatus())
    .catch(e => { console.error("Resultado não registrado:", e); msg("Não foi possível registrar o resultado (" + (e.message || e) + "). Confira as regras do Firestore."); });
  return credito;
}

async function sairSala() {
  const T = E.s?.torre, naTorre = T && E.s.fase === "batalha";
  if (!confirm(naTorre ? `Sair da torre? A subida termina e você recebe o XP acumulado (${xpTorreTotal(T.n)} XP).` : "Sair da sala? Quando os dois jogadores saírem, a sala é apagada.")) return;
  if (naTorre) { try { await encerrarTorre(E.codigo, E.papel); await contabilizarResultado(E.codigo, E.papel); } catch(e) { console.error("Torre não encerrada:", e); } }
  else await checarResultado(true); // quem sai logo depois do fim ainda recebe o resultado
  E.saindo = true; parar(); pararReplay();
  try { await sair(E.codigo, E.papel); } catch(e) { sessao.limpar(); }
  location.replace("index.html");
}
window.sairSala = sairSala;

// ----- carga inicial: catálogo, golpes escolhidos, shiny e times da conta -----
async function carregarConta() {
  const u = usuario();
  if (!u) return msg(E.s?.bot ? "" : "Você não está logada(o). Saia da sala e entre na sua conta em Meus Pokémon (ou use a equipe aleatória contra o bot).");
  try {
    E.meusShiny = await lerShiny(u.chave).catch(() => ({}));
    const [b, times, niveis] = await Promise.all([lerBuilds(u.chave), lerTimes(u.chave), lerNiveis(u.chave)]);
    E.times = times; E.niveis = niveis;
    E.catalogo = E.todos.map(p => { // só entram Pokémon com golpes escolhidos pelo usuário (Meus Pokémon)
      const mv = (b[p.id] || []).map(n => p.aprende?.find(g => g.nome === n)).filter(Boolean).slice(0, 4);
      return mv.length ? {...p, mv, shiny: !!E.meusShiny[p.id], nivel: nivelDoPokemon(niveis, p.id)} : null;
    }).filter(Boolean);
    if (E.s) render();
  } catch(e) { E.catalogo = []; msg("Não foi possível carregar os seus times."); }
}

if (ses) {
  try { E.todos = await listar(); } catch(e) { msg("Não foi possível carregar o catálogo."); }
  if (E.jogador) { carregarConta(); carregaStatus(); }
  parar = ouvir(E.codigo, dados => {
    if (E.saindo) return;
    if (dados === undefined) return msg("Conexão com a sala perdida. Tentando reconectar...");
    if (dados === null) { sessao.limpar(); alert("A sala não existe mais."); return location.replace("index.html"); }
    if (E.jogador && (!dados.j[E.papel] || dados.j[E.papel].uid !== uid)) {
      sessao.limpar(); alert("Sua vaga foi retomada em outro navegador."); return location.replace("index.html");
    }
    msg(); E.s = dados;
    if (rodVista === null) { rodVista = dados.rodada; reiniciarFx(); } // primeira leitura: não reproduz o que já aconteceu
    else if (dados.rodada > rodVista) {
      const nova = dados.passosRod === dados.rodada - 1 && dados.passos && dados.passos.length;
      rodVista = dados.rodada;
      if (nova) { const rodando = !!E.reproz; enfileirar(dados.passos); if (!rodando) return; }
    }
    render();
  });
}
