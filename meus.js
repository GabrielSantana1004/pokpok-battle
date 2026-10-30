import { listar } from "./firebase.js";
import { STATS, TIPOS, esc, nav } from "./common.js";
import { carregarImagens } from "./imagem.js";
import { montarTimes } from "./meus-times.js";
import { lerStatus, lerNiveis, subirNivelPokemon } from "./usuarios.js";
import { nivelDoPokemon } from "./nivel.js";
import { REGRAS, statsFinais } from "./regras.js";
import { usuario, criarConta, entrarConta, lerBuilds, salvarBuild, lerEscolhasHab, salvarEscolhaHab, podeEscolherShiny, definirShiny } from "./usuarios.js";
import { habilidadeEscolhida, marcaHabilidade, estadoHabilidade } from "./habilidades.js";
import { lerInventario, abrirCaixa, equiparItem, lerPokemons, inicialEscolhido, escolherInicial } from "./usuarios.js";
import { instancias, shinyPorInstancia, somaIvs, IV_STATS, IV_MAX, acharIniciais, sortearPokemonAleatorio } from "./pokemons.js";
import { ITENS, TIERS, itemPorId, copiasLivres, marcaItem } from "./itens.js";
nav();
const $ = id => document.getElementById(id);
const CAT = {fisico: "Físico", especial: "Especial", status: "Status"};
const badge = t => `<span class="tipo t-${esc(t)}">${esc(t)}</span>`;
const aviso = t => { $("erro").textContent = t || ""; };
const MAX = 4;
let u = usuario(), todas = [], podeShiny = false, inv = {itens: {}, itensEq: {}}, caixaRes = "", cat = [], builds = {}, shiny = {}, habs = {}, niveis = {}, pontos = 0, atual = null, marcados = [], recado = "";

// ---------- conta ----------
async function conta(acao) {
  aviso();
  const nick = $("nick").value, senha = $("senha").value;
  if (!nick.trim() || !senha) return aviso("Digite o nickname e a senha.");
  try { u = await (acao === "criar" ? criarConta : entrarConta)(nick, senha); location.reload(); }
  catch(e) { aviso(e.message || "Não foi possível acessar a conta. Confira o firebaseConfig e as regras do Firestore."); }
}
$("entrar").onclick = () => conta("entrar");
$("criar").onclick = () => conta("criar");
$("senha").onkeydown = e => { if (e.key === "Enter") conta("entrar"); };

// ---------- lista dos meus Pokémon ----------
const golpesDe = p => (builds[p.id] || []).map(n => p.aprende?.find(g => g.nome === n)).filter(Boolean);
function lista() {
  atual = null; $("editor").hidden = true; $("lista-pk").hidden = false;
  const com = cat.filter(p => p.aprende?.length), sem = cat.length - com.length;
  const prontos = com.filter(p => golpesDe(p).length).length;
  $("resumo").innerHTML = `${esc(recado)} <b>${prontos}</b> de ${com.length} Pokémon prontos para batalha (com golpes escolhidos).` +
    (sem ? ` ${sem} Pokémon seu${sem > 1 ? "s" : ""} ainda não ${sem > 1 ? "têm" : "tem"} a lista de golpes: abra <a href="golpes.html">Atualizar golpes</a> e use o segundo botão.` : "") +
    (cat.length ? "" : " Você ainda não tem Pokémon.");
  grade();
}
function grade() { // aplica a busca e o filtro de tipo; a barra de busca fica fora desta área e não perde o foco
  const com = cat.filter(p => p.aprende?.length);
  const q = $("busca").value.trim().toLowerCase(), t = $("filtro").value;
  const so = $("so-shiny").checked, vistos = com.filter(p => p.nome.toLowerCase().includes(q) && (!t || p.tipos.includes(t)) && (!so || shiny[p.id]));
  $("contagem").textContent = `${vistos.length} de ${com.length} Pokémon`;
  $("grade").innerHTML = vistos.map(p => {
    const mv = golpesDe(p);
    return `<article class="card">
      <img class="foto" data-pokemon="${esc(p.nome)}"${shiny[p.id] ? ' data-shiny="1"' : ""} alt="${esc(p.nome)}" loading="lazy">
      <h3>${esc(p.nome)}${shiny[p.id] ? " ✨" : ""} <small class="nv-pk">Nv ${nivelDoPokemon(niveis, p.id)}</small>${p.megas?.length ? ' <small title="Pode megaevoluir: ' + esc(p.megas.map(m => m.nome).join(", ")) + '">⚡ Mega</small>' : ""}</h3>
      <div class="tipos">${p.tipos.map(badge).join("")}</div>
      ${p.ivs ? `<p class="hab-card" title="${esc(IV_STATS.map(k => `${k.toUpperCase()} ${p.ivs[k]}`).join(" · "))}">📊 IVs ${somaIvs(p.ivs)}/${IV_STATS.length * IV_MAX}</p>` : ""}
      ${p.habilidades?.length ? `<p class="hab-card">🧬 ${esc(habilidadeEscolhida(p, habs).nome)}${inv.itensEq[p.id] && itemPorId(inv.itensEq[p.id]) ? ` · 🎒 ${esc(itemPorId(inv.itensEq[p.id]).nome)}` : ""}</p>` : ""}
      <ul class="golpes">${mv.length ? mv.map(m => `<li>${badge(m.tipo)} ${esc(m.nome)} <small>${CAT[m.cat] || m.cat}</small></li>`).join("") : "<li><small>Sem golpes escolhidos</small></li>"}</ul>
      <div class="acoes"><button class="primario" onclick="abrir('${esc(p.id)}')">${mv.length ? "Editar golpes" : "Escolher golpes"}</button>
        <button onclick="subir('${esc(p.id)}')" ${pontos > 0 && nivelDoPokemon(niveis, p.id) < REGRAS.nivelMax ? "" : "disabled"} title="Gasta 1 ponto de treino">⬆ Subir nível</button></div>
      ${podeShiny ? `<label class="shiny-opcao" title="Liga ou desliga o shiny deste Pokémon"><input type="checkbox" data-shiny-id="${esc(p.id)}"${shiny[p.id] ? " checked" : ""}> ✨ Shiny</label>` : ""}
    </article>`;
  }).join("") || (com.length ? "<p>Nenhum Pokémon encontrado.</p>" : "<p>Nenhum Pokémon com lista de golpes ainda.</p>");
  carregarImagens($("grade"));
}

// ---------- escolha dos golpes de um Pokémon ----------
function abrir(id) {
  atual = cat.find(p => p.id === id); if (!atual?.aprende) return;
  aviso(); marcados = (builds[id] || []).filter(n => atual.aprende.some(g => g.nome === n)).slice(0, MAX);
  $("lista-pk").hidden = true; $("editor").hidden = false;
  $("editor").innerHTML = `<div class="topo-editor">
      <img class="foto mini" data-pokemon="${esc(atual.nome)}"${shiny[atual.id] ? ' data-shiny="1"' : ""} alt="">
      <div><h2>${esc(atual.nome)}<span id="ed-ico">${shiny[atual.id] ? " ✨" : ""}</span> <small class="nv-pk">Nv ${nivelDoPokemon(niveis, atual.id)}</small></h2><div class="tipos">${atual.tipos.map(badge).join("")}</div></div>
      <button id="voltar">← Voltar</button></div>
    ${podeShiny ? `<label class="shiny-opcao" title="Liga ou desliga o shiny deste Pokémon"><input type="checkbox" id="shiny-ed"${shiny[atual.id] ? " checked" : ""}> ✨ Shiny</label>` : ""}
    <div class="stats stats-editor">${STATS.map(s => `<div><small>${s[1]}</small><b>${atual[s[0]]}</b></div>`).join("")}</div>
    <p class="dica">Nível ${nivelDoPokemon(niveis, atual.id)} em batalha: ${(() => { const f = statsFinais(atual, {...REGRAS, nivel: nivelDoPokemon(niveis, atual.id)}); return STATS.map(s => `${s[1]} ${f[s[0]]}`).join(" · "); })()}</p>
    ${(() => { const hs = atual.habilidades || [], em = habilidadeEscolhida(atual, habs);
      return hs.length ? `<div class="hab-box"><label>🧬 Habilidade <select id="hab">${hs.map(h => `<option value="${esc(h.id)}"${em?.id === h.id ? " selected" : ""}>${esc(h.nome)}${h.oculta ? " (oculta)" : ""}${marcaHabilidade(h.id)}</option>`).join("")}</select></label>
        <small id="hab-info">${esc(estadoHabilidade(em?.id).texto)}${estadoHabilidade(em?.id).nota ? " — " + esc(estadoHabilidade(em?.id).nota) : ""}. A escolha é salva na hora. ⚠ = a habilidade ainda não faz nada em batalha (não é bug).</small></div>`
        : `<p class="dica">Habilidades ainda não sincronizadas (no admin: "Buscar habilidades").</p>`; })()}
    <div class="hab-box"><label>🎒 Item segurado <select id="item-eq"></select></label>
      <small id="item-info"></small></div>
    <h3 id="tit-esc"></h3><div id="escolhidos" class="chips"></div>
    <div class="filtros"><input id="b-busca" type="search" placeholder="Buscar golpe">
      <select id="b-tipo"><option value="">Todos os tipos</option>${TIPOS.map(t => `<option>${t}</option>`).join("")}</select>
      <select id="b-cat"><option value="">Todas as categorias</option>${Object.entries(CAT).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
      <span id="b-cont"></span></div>
    <div id="opcoes" class="opcoes"></div>
    <div class="acoes-editor"><button id="salvar" class="primario">Salvar golpes</button>
      <button id="padrao">Usar golpes padrão</button>${builds[id] ? '<button id="remover-b" class="remover">Remover build</button>' : ""}</div>`;
  carregarImagens($("editor"));
  $("voltar").onclick = lista;
  if ($("shiny-ed")) $("shiny-ed").onchange = async e => {
    const caixa = e.target, id = atual.id; caixa.disabled = true;
    try {
      shiny = await definirShiny(u.chave, id, caixa.checked); aviso(); recado = "";
      $("ed-ico").textContent = shiny[id] ? " ✨" : "";
      const img = $("editor").querySelector("img.foto"); if (shiny[id]) img.dataset.shiny = "1"; else delete img.dataset.shiny;
      carregarImagens($("editor"));
    } catch(err) { caixa.checked = !caixa.checked; aviso(err.message || "Não foi possível salvar o shiny."); }
    caixa.disabled = false;
  };
  itemSelect();
  $("item-eq").onchange = async e => { try { inv.itensEq = await equiparItem(u.chave, atual.id, e.target.value || null); aviso(); recado = ""; itemSelect(); } catch(err) { aviso(err.message || "Não foi possível equipar o item."); itemSelect(); } };
  if ($("hab")) $("hab").onchange = async e => { try { habs = await salvarEscolhaHab(u.chave, atual.id, e.target.value); { const i = estadoHabilidade(e.target.value); $("hab-info").textContent = i.texto + (i.nota ? " — " + i.nota : "") + ". Salvo."; } aviso(); recado = ""; } catch(err) { aviso(err.message || "Não foi possível salvar a habilidade."); } };
  ["b-busca", "b-tipo", "b-cat"].forEach(i => { $(i).oninput = opcoes; });
  $("opcoes").onchange = e => {
    const g = atual.aprende[+e.target.dataset.i]; if (!g) return;
    if (e.target.checked) { if (marcados.length < MAX) marcados.push(g.nome); } else marcados = marcados.filter(n => n !== g.nome);
    escolhidos(); opcoes();
  };
  $("escolhidos").onclick = e => { const b = e.target.closest("[data-rm]"); if (b) { marcados = marcados.filter(n => n !== b.dataset.rm); escolhidos(); opcoes(); } };
  $("padrao").onclick = () => { marcados = atual.mv.map(m => m.nome).filter(n => atual.aprende.some(g => g.nome === n)).slice(0, MAX); escolhidos(); opcoes(); };
  $("salvar").onclick = salvar;
  if ($("remover-b")) $("remover-b").onclick = remover;
  escolhidos(); opcoes();
}
function escolhidos() {
  $("tit-esc").textContent = `Golpes escolhidos (${marcados.length}/${MAX})`;
  $("escolhidos").innerHTML = marcados.map(n => { const g = atual.aprende.find(x => x.nome === n);
    return `<span class="chip-golpe">${badge(g.tipo)} ${esc(n)} <button type="button" data-rm="${esc(n)}" aria-label="Tirar">✕</button></span>`; }).join("") || "<small>Nenhum golpe escolhido ainda.</small>";
}
function opcoes() {
  const q = $("b-busca").value.trim().toLowerCase(), t = $("b-tipo").value, c = $("b-cat").value;
  const itens = atual.aprende.map((g, i) => ({g, i})).filter(({g}) => g.nome.toLowerCase().includes(q) && (!t || g.tipo === t) && (!c || g.cat === c));
  $("b-cont").textContent = `${itens.length} de ${atual.aprende.length} golpes`;
  const cheio = marcados.length >= MAX;
  $("opcoes").innerHTML = itens.map(({g, i}) => {
    const on = marcados.includes(g.nome), st = g.cat === "status";
    const info = [CAT[g.cat], st ? "" : "poder " + g.poder, g.precisao == null ? "nunca erra" : g.precisao + "%", g.prioridade ? "prioridade " + (g.prioridade > 0 ? "+" : "") + g.prioridade : ""].filter(Boolean).join(" · ");
    return `<label class="opcao${on ? " marcada" : ""}"><input type="checkbox" data-i="${i}" ${on ? "checked" : ""} ${!on && cheio ? "disabled" : ""}>
      ${badge(g.tipo)} <b>${esc(g.nome)}</b> <small>${esc(info)}</small></label>`;
  }).join("") || "<p>Nenhum golpe encontrado.</p>";
}
async function salvar() {
  if (!marcados.length) return aviso("Escolha pelo menos 1 golpe (ou use Remover build).");
  $("salvar").disabled = true;
  try { builds = await salvarBuild(u.chave, atual.id, marcados); recado = `Golpes de ${atual.nome} salvos.`; lista(); }
  catch(e) { aviso(e.message || "Não foi possível salvar."); $("salvar").disabled = false; }
}
async function remover() {
  if (!confirm(`Remover os golpes escolhidos de ${atual.nome}? Ele deixa de aparecer na escolha de time.`)) return;
  try { builds = await salvarBuild(u.chave, atual.id, []); recado = `Build de ${atual.nome} removida.`; lista(); }
  catch(e) { aviso(e.message || "Não foi possível remover."); }
}
$("filtro").innerHTML += TIPOS.map(t => `<option>${t}</option>`).join("");
$("busca").oninput = grade;
$("filtro").onchange = grade;
$("so-shiny").onchange = grade;
$("grade").onchange = async e => { // shiny liga/desliga direto no cartão (só contas com permissão)
  const caixa = e.target.closest("[data-shiny-id]"); if (!caixa) return;
  const id = caixa.dataset.shinyId, p = cat.find(x => x.id === id); caixa.disabled = true;
  try { shiny = await definirShiny(u.chave, id, caixa.checked); aviso(); recado = `${p?.nome || "Pokémon"}: shiny ${shiny[id] ? "ligado" : "desligado"}.`; lista(); }
  catch(err) { caixa.checked = !caixa.checked; caixa.disabled = false; aviso(err.message || "Não foi possível salvar o shiny."); }
};
async function subir(id) {
  const p = cat.find(x => x.id === id); if (!p) return;
  const n = nivelDoPokemon(niveis, id);
  if (!confirm(`Gastar 1 ponto de treino para subir ${p.nome} do nível ${n} para o ${n + 1}? Não dá para desfazer.`)) return;
  aviso();
  try { niveis = await subirNivelPokemon(u.chave, id); recado = `${p.nome} subiu para o nível ${n + 1}!`; await perfil(); lista(); }
  catch(e) { aviso(e.message || "Não foi possível subir o nível."); }
}
Object.assign(window, {abrir, subir});

// ---------- itens segurados ----------
const nomeTier = i => `<span style="color:${TIERS[i.tier].cor};font-weight:700">${TIERS[i.tier].nome}</span>`;
function itemSelect() { // só aparecem os itens que a conta tem (com cópia livre) ou que este Pokémon já segura
  const eq = inv.itensEq[atual.id] || "", dono = ITENS.filter(i => (inv.itens[i.id] || 0) > 0 && (i.id === eq || copiasLivres(inv.itens, inv.itensEq, i.id, atual.id) > 0));
  $("item-eq").innerHTML = `<option value="">— sem item —</option>` + dono.map(i => `<option value="${esc(i.id)}"${i.id === eq ? " selected" : ""}>${esc(i.nome)} (${copiasLivres(inv.itens, inv.itensEq, i.id, atual.id)} livre${copiasLivres(inv.itens, inv.itensEq, i.id, atual.id) === 1 ? "" : "s"} de ${inv.itens[i.id]})${esc(marcaItem(i))}</option>`).join("");
  const i = eq && itemPorId(eq);
  $("item-info").innerHTML = i ? `${nomeTier(i)} — ${esc(i.desc)}` : (dono.length ? "Escolha um item: ele vale nas batalhas deste Pokémon. Itens de uso único (bagas, gemas…) só somem daquela batalha." : "Você ainda não tem itens: cada nível da conta rende 1 caixa (abra na aba Perfil).");
}
async function abrirUmaCaixa() {
  aviso();
  try {
    const r = await abrirCaixa(u.chave, () => sortearPokemonAleatorio(todas)?.id);
    const parteCristais = r.cristais ? `<b>💎 ${r.cristais} cristal${r.cristais > 1 ? "is" : ""} Z!</b> ` : "";
    const parteItens = r.itens.length ? `<b>📦 ${r.itens.length} iten${r.itens.length > 1 ? "s" : ""}:</b> ${r.itens.map((id, k) => { const i = itemPorId(id); return `<span class="caixa-item">${nomeTier(i)} ${esc(i.nome)}${r.jaTinha[k] ? " <small>(+1 cópia)</small>" : " <small>(novo!)</small>"}</span>`; }).join(" ")}` : "";
    const partePokebola = r.pokemon ? ` <b>🎁 Uma Pokébola com ${esc(todas.find(p => p.id === r.pokemon.esp)?.nome || "um Pokémon")}${r.pokemon.shiny ? " ✨ shiny" : ""}!</b> <small>(IVs ${somaIvs(r.pokemon.ivs)}/${IV_STATS.length * IV_MAX}, já está nos seus Pokémon)</small>` : "";
    caixaRes = parteCristais + parteItens + partePokebola;
    if (r.pokemon) { const regs = await lerPokemons(u.chave); cat = instancias(todas, regs); shiny = shinyPorInstancia(regs); if (!$("lista-pk").hidden) lista(); }
    inv = await lerInventario(u.chave); await perfil();
  } catch(e) { aviso(e.message || "Não foi possível abrir a caixa."); }
}
window.abrirUmaCaixa = abrirUmaCaixa;

// ---------- aba Perfil: nível, XP e estoque de itens ----------
async function perfil() {
  try {
    const st = await lerStatus(u.chave), el = $("perfil"); pontos = st.pontos; if (!$("lista-pk").hidden) grade();
    const pl = (n, um, varios) => n === 1 ? um : varios;
    const lin = (ico, nome, val, dica = "") => `<li title="${esc(dica)}"><span class="pf-ico">${ico}</span><span class="pf-rot">${nome}</span><b class="pf-val">${val}</b></li>`;
    const meus = ITENS.filter(i => inv.itens[i.id]), totalItens = meus.reduce((a, i) => a + inv.itens[i.id], 0);
    el.innerHTML = `<div class="pf-capa">
        <span class="nv-selo grande">Nv ${st.nivel}</span>
        <div class="pf-ident"><h2 class="pf-nome">${esc(u.nick)}</h2><span class="pf-sub">Treinador · nível ${st.nivel}</span>
          <div class="xp-barra" role="progressbar" aria-valuenow="${st.noNivel}" aria-valuemax="${st.tamanho}"><i style="width:${st.pct}%"></i></div>
          <small class="pf-xp"><b>${st.noNivel}/${st.tamanho} XP</b> · faltam ${st.falta} para o nível ${st.nivel + 1}</small></div></div>
      <div class="pf-corpo">
        <h3 class="pf-titulo">Estatísticas</h3>
        <ul class="pf-lista">
          ${lin("🏆", "Vitórias", st.vitorias)}
          ${lin("🎯", pl(st.pontos, "Ponto de treino", "Pontos de treino"), st.pontos, `Cada nível da conta rende 1 ponto, que sobe 1 nível de um Pokémon (máx. ${REGRAS.nivelMax})`)}
        </ul>
        <h3 class="pf-titulo">Recursos</h3>
        <ul class="pf-lista">
          ${lin("🧪", pl(st.pocoes, "Poção", "Poções"), st.pocoes)}
          ${lin("💫", pl(st.revives, "Reviver", "Revives"), st.revives)}
          ${lin("💎", pl(st.zcristais, "Cristal Z", "Cristais Z"), st.zcristais || 0, "Combustível do golpe Z: 1 por batalha em que você usa")}
        </ul>
        <h3 class="pf-titulo">Caixas</h3>
        <div class="pf-caixas"><span class="pf-ico">📦</span>
          <div class="pf-rot"><b>${st.caixas} ${pl(st.caixas, "caixa guardada", "caixas guardadas")}</b><small>Cada nível da conta rende 1 caixa (cristais Z e itens).</small></div>
          ${st.caixas > 0 ? `<button type="button" class="primario" onclick="abrirUmaCaixa()">Abrir uma caixa</button>` : `<span class="pf-vazio">Suba de nível para ganhar mais</span>`}</div>
        ${caixaRes ? `<p class="caixa-res">${caixaRes}</p>` : ""}
        <h3 class="pf-titulo">Mochila <span class="pf-contador">${totalItens}</span></h3>
        <ul class="pf-itens">${meus.map(i => `<li><span class="pf-item-nome">${nomeTier(i)} <b>${esc(i.nome)}</b></span><b class="pf-qtd">×${inv.itens[i.id]}</b><small>${esc(i.desc)}</small></li>`).join("") || `<li class="pf-vazio">Ainda sem itens. Abra caixas para ganhar.</li>`}</ul>
        <details class="pf-xpinfo"><summary>Como ganhar XP</summary><ul>
          <li>Vitória contra o bot: <b>+10 / +20 / +40 XP</b> (fácil / normal / difícil)</li>
          <li>Vitória em PvP: <b>+20 XP</b></li>
          <li>Derrota: <b>+5 XP</b></li></ul></details>
      </div>`;
  } catch(e) { /* o perfil é só informativo */ }
}

// ---------- abas: Pokémon (golpes), Times (equipes salvas na conta) e Perfil (nível, XP, itens e caixas) ----------
function aba(qual) {
  const times = qual === "times", prf = qual === "perfil";
  [["pk", qual === "pk"], ["times", times], ["perfil", prf]].forEach(([k, ativa]) => {
    const b = $("aba-" + k); b.classList.toggle("ativa", ativa); b.setAttribute("aria-selected", String(ativa));
  });
  $("perfil").hidden = !prf;
  if (times) {
    $("lista-pk").hidden = true; $("editor").hidden = true;
    montarTimes($("times"), {chave: u.chave, prontos: cat.filter(p => p.aprende?.length && golpesDe(p).length).map(p => ({...p, nivel: nivelDoPokemon(niveis, p.id)})), shiny, golpes: golpesDe}); // só Pokémon com golpes escolhidos
  } else if (prf) {
    $("times").hidden = true; $("lista-pk").hidden = true; $("editor").hidden = true;
    $("perfil").hidden = false; perfil(); // atualiza os números ao abrir a aba
  } else { $("times").hidden = true; lista(); }
}
$("aba-pk").onclick = () => aba("pk");
$("aba-times").onclick = () => aba("times");
$("aba-perfil").onclick = () => aba("perfil");

// ---------- escolha do inicial (conta nova): 1 entre os 27, na forma final e no nível 50 ----------
function telaInicial(especies) {
  const linhas = acharIniciais(especies); let sel = null;
  const sec = $("inicial"); sec.hidden = false;
  const desenhar = () => {
    sec.innerHTML = `<h2>Escolha o seu Pokémon inicial</h2>
      <p>Cada conta começa com 1 dos 27 iniciais, já na forma final e no nível ${REGRAS.nivel}. A escolha vale uma vez só. Os outros Pokémon você conquista jogando.</p>
      ${linhas.map((l, g) => `<h4 class="inicial-ger">Geração ${g + 1}</h4><div class="inicial-linha">${l.map(c => c.esp
        ? `<button type="button" class="inicial-op${sel === c.esp.id ? " marcada" : ""}" data-esp="${esc(c.esp.id)}"><img class="foto mini" data-pokemon="${esc(c.esp.nome)}" alt="" loading="lazy"><b>${esc(c.esp.nome)}</b><span class="tipos">${c.esp.tipos.map(badge).join("")}</span></button>`
        : `<button type="button" class="inicial-op" disabled title="Não está no catálogo"><b>${esc(c.nome)}</b><small>fora do catálogo</small></button>`).join("")}</div>`).join("")}
      <div class="acoes-editor"><button id="confirmar-ini" class="primario" ${sel ? "" : "disabled"}>${sel ? `Escolher ${esc(linhas.flat().find(c => c.esp?.id === sel).nome)}` : "Toque em um Pokémon"}</button></div>`;
    carregarImagens(sec);
    sec.querySelectorAll("[data-esp]").forEach(b => { b.onclick = () => { sel = b.dataset.esp; desenhar(); }; });
    $("confirmar-ini").onclick = async () => {
      const nome = linhas.flat().find(c => c.esp?.id === sel)?.nome; if (!nome || !confirm(`Escolher ${nome} como seu inicial? Não dá para trocar depois.`)) return;
      $("confirmar-ini").disabled = true; aviso();
      try { await escolherInicial(u.chave, sel); location.reload(); }
      catch(e) { aviso(e.message || "Não foi possível salvar o inicial."); $("confirmar-ini").disabled = false; }
    };
  };
  desenhar();
}

// ---------- início ----------
if (!u) $("conta").hidden = false;
else {
  try { let especies, regs; [especies, regs, builds, niveis, habs, inv] = await Promise.all([listar(), lerPokemons(u.chave), lerBuilds(u.chave), lerNiveis(u.chave), lerEscolhasHab(u.chave), lerInventario(u.chave).catch(() => ({itens: {}, itensEq: {}}))]); todas = especies; cat = instancias(especies, regs); shiny = shinyPorInstancia(regs); podeShiny = await podeEscolherShiny(u.chave).catch(() => false); if (!Object.keys(regs).length && !(await inicialEscolhido(u.chave))) telaInicial(especies); else { $("abas-meus").hidden = false; lista(); perfil(); } }
  catch(e) { aviso("Não foi possível carregar os dados. Confira o firebaseConfig e as regras do Firestore."); }
}
