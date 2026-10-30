// Tela de captura (separada da batalha): aparece por cima de tudo depois de vencer um bot (1 dos Pokémon dele) ou uma torre (1 lendário).
// O Pokémon fica no centro (sprite animado), a Pokébola é lançada com uma animação simples e uma caixa de texto embaixo conta o que acontece.
// Pokébola grátis e sem limite de tentativas; cada lançamento: capturou · escapou (tente de novo) · fugiu (acabou). Chances em pokemons.js (CAPTURA).
import { esc } from "./common.js";
import { E, badge } from "./salaestado.js";
import { usuario, prepararCaptura, tentarCaptura, descartarCaptura } from "./usuarios.js";
import { sortearLendario, somaIvs, IV_STATS, IV_MAX } from "./pokemons.js";
import { spriteImg, carregarSprites } from "./imagem.js";
const C = {iniciada: false, atual: null, ocupado: false, resumo: "", tela: null};
export const capturaPendente = () => !!C.atual;
const esperar = ms => new Promise(r => setTimeout(r, ms));
const anim = (el, quadros, ms, extra = {}) => el.animate(quadros, {duration: ms, fill: "forwards", easing: "ease-in-out", ...extra}).finished.catch(() => {});

// resumo curto que fica na tela de fim da batalha depois que a captura termina
export const htmlCaptura = () => C.resumo ? `<p class="captura-res">${C.resumo}</p>` : "";

// chamada a cada desenho da sala: assim que a vitória é contabilizada (s.capturaGanha), carrega a captura desta sala
export async function iniciarCaptura() {
  const u = usuario(); if (C.iniciada || !u || !E.jogador || !E.s?.capturaGanha) return;
  C.iniciada = true;
  try { C.atual = await prepararCaptura(u.chave, () => sortearLendario(E.todos)?.id, E.codigo); }
  catch(e) { C.resumo = "Não foi possível carregar a captura: " + esc(e.message || e); E.render(); return; }
  if (C.atual) abrirTela();
}

function abrirTela() {
  const p = E.todos.find(x => x.id === C.atual.esp);
  if (!p) { C.resumo = "Esse Pokémon não está mais no catálogo."; C.atual = null; E.render(); return; }
  const lend = C.atual.tipo === "lendario";
  const t = C.tela = document.createElement("div");
  t.className = "cap-tela" + (lend ? " lendario" : "");
  t.innerHTML = `<div class="cap-topo">${lend ? "⭐ Um lendário apareceu!" : "🎯 Captura"}</div>
    <div class="cap-palco">
      <div class="cap-sombra"></div>
      <div class="cap-pokemon">${spriteImg(p.nome, "frente")}</div>
      <div class="cap-bola" aria-hidden="true"></div>
      <div class="cap-efeito" aria-hidden="true"></div>
    </div>
    <div class="cap-info"><b>${esc(p.nome)}</b> ${p.tipos.map(badge).join("")}<span class="cap-tent"></span></div>
    <div class="cap-caixa"><p class="cap-texto"></p></div>
    <div class="cap-botoes"></div>`;
  document.body.appendChild(t); document.body.classList.add("cap-aberta");
  carregarSprites(t);
  C.p = p; C.lend = lend;
  t.querySelector(".cap-botoes").addEventListener("click", ev => { const a = ev.target.closest("[data-a]")?.dataset.a; if (a) acao[a]?.(); });
  const dizer = C.dizer = txt => new Promise(res => { // texto "digitado" na caixa
    const el = t.querySelector(".cap-texto"); clearInterval(C.digita); let i = 0; el.textContent = "";
    if (!txt) return res();
    C.digita = setInterval(() => { el.textContent = txt.slice(0, ++i); if (i >= txt.length) { clearInterval(C.digita); res(); } }, 16);
  });
  botoes(["lancar", "soltar"]);
  tentativas();
  dizer(lend ? `Um ${p.nome} lendário apareceu! Ele é bem mais difícil de capturar.` : `${p.nome}, um dos Pokémon do bot que você derrotou, está pronto para ser capturado!`);
}
const tentativas = () => { const e = C.tela?.querySelector(".cap-tent"); if (e) e.textContent = C.atual?.tentativas ? ` · tentativas: ${C.atual.tentativas}` : ""; };
function botoes(lista, extra = "") {
  const B = {lancar: `<button class="primario cap-lancar" data-a="lancar">Lançar Pokébola</button>`, soltar: `<button class="cap-soltar" data-a="soltar">Deixar ir embora</button>`,
    continuar: `<button class="primario" data-a="continuar">Continuar</button>`, meus: `<a class="cap-link" href="meus.html">Ver em Meus Pokémon</a>`};
  C.tela.querySelector(".cap-botoes").innerHTML = lista.map(k => B[k]).join("") + extra;
}
function fechar() { clearInterval(C.digita); C.tela?.remove(); C.tela = null; document.body.classList.remove("cap-aberta"); E.render(); }

const acao = {
  continuar: fechar,
  async soltar() {
    if (C.ocupado || !confirm("Deixar o Pokémon ir embora sem tentar capturar? Você não poderá voltar atrás.")) return;
    const u = usuario(), p = C.p;
    try { await descartarCaptura(u.chave, E.codigo); } catch(e) {}
    C.atual = null; C.resumo = `${esc(p.nome)} foi embora.`; fechar();
  },
  async lancar() {
    const u = usuario(); if (!u || !C.atual || C.ocupado) return;
    C.ocupado = true; botoes([]);
    const t = C.tela, p = C.p, nome = p.nome, bola = t.querySelector(".cap-bola"), poke = t.querySelector(".cap-pokemon"), fx = t.querySelector(".cap-efeito"), dizer = C.dizer;
    for (const e of [bola, poke, fx]) e.getAnimations().forEach(a => a.cancel());
    fx.textContent = ""; bola.style.opacity = 1; bola.classList.remove("aberta");
    const sorteio = tentarCaptura(u.chave, E.codigo).then(r => ({r}), erro => ({erro}));  // o resultado vem do servidor enquanto a bola voa
    dizer("Você lançou a Pokébola!");
    await anim(bola, [{transform: "translate(0,0) rotate(0) scale(.7)"}, {transform: "translate(0,-90px) rotate(360deg) scale(1)", offset: .55}, {transform: "translate(0,-170px) rotate(720deg) scale(1)"}], 750, {easing: "ease-out"});
    anim(poke, [{transform: "scale(1)", filter: "none", opacity: 1}, {transform: "scale(.5)", filter: "brightness(6) saturate(0) ", opacity: .9, offset: .6}, {transform: "scale(0)", filter: "brightness(6)", opacity: 0}], 450);
    await anim(bola, [{transform: "translate(0,-170px) rotate(720deg) scale(1)"}, {transform: "translate(0,-170px) rotate(720deg) scale(1.25)", offset: .4}, {transform: "translate(0,-170px) rotate(720deg) scale(1)"}], 450);
    await anim(bola, [{transform: "translate(0,-170px) rotate(720deg)"}, {transform: "translate(0,-40px) rotate(720deg)", offset: .5}, {transform: "translate(0,-70px) rotate(720deg)", offset: .7}, {transform: "translate(0,-40px) rotate(720deg)"}], 650, {easing: "ease-in"});
    const {r, erro} = await sorteio;
    if (erro) { // não deu para lançar: a bola volta e o Pokémon reaparece
      await abrirBola(bola, poke, fx); dizer("Não foi possível lançar a Pokébola: " + (erro.message || erro)); C.ocupado = false; botoes(["lancar", "soltar"]); return;
    }
    const balancos = r.resultado === "capturou" ? 3 : 1 + Math.floor(Math.random() * 2); // se vai escapar, a bola balança só 1 ou 2 vezes
    for (let i = 1; i <= balancos; i++) {
      await esperar(250); dizer("…");
      await anim(bola, [{transform: "translate(0,-40px) rotate(720deg)"}, {transform: "translate(-8px,-40px) rotate(700deg)"}, {transform: "translate(8px,-40px) rotate(740deg)"}, {transform: "translate(0,-40px) rotate(720deg)"}], 700, {easing: "ease-in-out"});
    }
    await esperar(300);
    if (r.resultado === "capturou") {
      const pk = r.pokemon; C.atual = null; C.ocupado = false; tentativas();
      bola.classList.add("capturada");
      await anim(bola, [{transform: "translate(0,-40px) rotate(720deg) scale(1)"}, {transform: "translate(0,-40px) rotate(720deg) scale(1.35)"}, {transform: "translate(0,-40px) rotate(720deg) scale(1)"}], 400);
      fx.textContent = "✨ ⭐ ✨ ⭐ ✨"; anim(fx, [{opacity: 0, transform: "translateY(20px) scale(.6)"}, {opacity: 1, transform: "translateY(-30px) scale(1.2)", offset: .5}, {opacity: 0, transform: "translateY(-70px) scale(1.4)"}], 1400);
      const resumo = `🎉 Você capturou ${esc(nome)}${pk.shiny ? " ✨ shiny" : ""}! IVs ${somaIvs(pk.ivs)}/${IV_STATS.length * IV_MAX}.`;
      C.resumo = resumo;
      await dizer(`Gotcha! ${nome}${pk.shiny ? " ✨ (shiny!)" : ""} foi capturado! IVs ${somaIvs(pk.ivs)}/${IV_STATS.length * IV_MAX}. Ele já está em Meus Pokémon.`);
      botoes(["meus", "continuar"]);
    } else if (r.resultado === "escapou") {
      C.atual = {...C.atual, tentativas: r.tentativas}; tentativas();
      await abrirBola(bola, poke, fx);
      await dizer(`Ah! ${nome} escapou da Pokébola! Tente de novo.`);
      C.ocupado = false; botoes(["lancar", "soltar"]);
    } else {
      C.atual = null; C.resumo = `🏃 ${esc(nome)} fugiu!`; tentativas();
      await abrirBola(bola, poke, fx);
      await anim(poke, [{transform: "translateX(0)", opacity: 1}, {transform: "translateX(260px)", opacity: 0}], 700, {easing: "ease-in"});
      await dizer(`${nome} fugiu! Não dá mais para capturá-lo.`);
      C.ocupado = false; botoes(["continuar"]);
    }
  }
};
// a bola se abre num clarão e o Pokémon reaparece
async function abrirBola(bola, poke, fx) {
  bola.classList.add("aberta");
  fx.textContent = "💥"; anim(fx, [{opacity: 1, transform: "scale(.4)"}, {opacity: 0, transform: "scale(2)"}], 500);
  await anim(bola, [{opacity: 1}, {opacity: 0}], 350);
  bola.classList.remove("aberta");
  poke.getAnimations().forEach(a => a.cancel());
  await anim(poke, [{transform: "scale(0)", filter: "brightness(6)", opacity: 0}, {transform: "scale(1.15)", filter: "brightness(3)", opacity: 1, offset: .6}, {transform: "scale(1)", filter: "none", opacity: 1}], 500);
}
