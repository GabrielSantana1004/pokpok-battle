import { listar } from "./firebase.js";
import { STATS, TIPOS, esc, nav } from "./common.js";
import { carregarImagens } from "./imagem.js";
import { montarTimes } from "./meus-times.js";
import { lerStatus, lerNiveis, subirNivelPokemon } from "./usuarios.js";
import { nivelDoPokemon } from "./nivel.js";
import { REGRAS, statsFinais } from "./regras.js";
import { usuario, criarConta, entrarConta, lerBuilds, salvarBuild, lerShiny } from "./usuarios.js";
nav();
const $ = id => document.getElementById(id);
const CAT = {fisico: "Físico", especial: "Especial", status: "Status"};
const badge = t => `<span class="tipo t-${esc(t)}">${esc(t)}</span>`;
const aviso = t => { $("erro").textContent = t || ""; };
const MAX = 4;
let u = usuario(), cat = [], builds = {}, shiny = {}, niveis = {}, pontos = 0, atual = null, marcados = [], recado = "";

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
    (sem ? ` ${sem} Pokémon do catálogo ainda não têm a lista de golpes: abra <a href="golpes.html">Atualizar golpes</a> e use o segundo botão.` : "");
  grade();
}
function grade() { // aplica a busca e o filtro de tipo; a barra de busca fica fora desta área e não perde o foco
  const com = cat.filter(p => p.aprende?.length);
  const q = $("busca").value.trim().toLowerCase(), t = $("filtro").value;
  const vistos = com.filter(p => p.nome.toLowerCase().includes(q) && (!t || p.tipos.includes(t)));
  $("contagem").textContent = `${vistos.length} de ${com.length} Pokémon`;
  $("grade").innerHTML = vistos.map(p => {
    const mv = golpesDe(p);
    return `<article class="card">
      <img class="foto" data-pokemon="${esc(p.nome)}"${shiny[p.id] ? ' data-shiny="1"' : ""} alt="${esc(p.nome)}" loading="lazy">
      <h3>${esc(p.nome)}${shiny[p.id] ? " ✨" : ""} <small class="nv-pk">Nv ${nivelDoPokemon(niveis, p.id)}</small>${p.megas?.length ? ' <small title="Pode megaevoluir: ' + esc(p.megas.map(m => m.nome).join(", ")) + '">⚡ Mega</small>' : ""}</h3>
      <div class="tipos">${p.tipos.map(badge).join("")}</div>
      <ul class="golpes">${mv.length ? mv.map(m => `<li>${badge(m.tipo)} ${esc(m.nome)} <small>${CAT[m.cat] || m.cat}</small></li>`).join("") : "<li><small>Sem golpes escolhidos</small></li>"}</ul>
      <div class="acoes"><button class="primario" onclick="abrir('${esc(p.id)}')">${mv.length ? "Editar golpes" : "Escolher golpes"}</button>
        <button onclick="subir('${esc(p.id)}')" ${pontos > 0 && nivelDoPokemon(niveis, p.id) < REGRAS.nivelMax ? "" : "disabled"} title="Gasta 1 ponto de treino">⬆ Subir nível</button></div>
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
      <div><h2>${esc(atual.nome)}${shiny[atual.id] ? " ✨" : ""} <small class="nv-pk">Nv ${nivelDoPokemon(niveis, atual.id)}</small></h2><div class="tipos">${atual.tipos.map(badge).join("")}</div></div>
      <button id="voltar">← Voltar</button></div>
    <div class="stats stats-editor">${STATS.map(s => `<div><small>${s[1]}</small><b>${atual[s[0]]}</b></div>`).join("")}</div>
    <p class="dica">Nível ${nivelDoPokemon(niveis, atual.id)} em batalha: ${(() => { const f = statsFinais(atual, {...REGRAS, nivel: nivelDoPokemon(niveis, atual.id)}); return STATS.map(s => `${s[1]} ${f[s[0]]}`).join(" · "); })()}</p>
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
async function subir(id) {
  const p = cat.find(x => x.id === id); if (!p) return;
  const n = nivelDoPokemon(niveis, id);
  if (!confirm(`Gastar 1 ponto de treino para subir ${p.nome} do nível ${n} para o ${n + 1}? Não dá para desfazer.`)) return;
  aviso();
  try { niveis = await subirNivelPokemon(u.chave, id); recado = `${p.nome} subiu para o nível ${n + 1}!`; await perfil(); lista(); }
  catch(e) { aviso(e.message || "Não foi possível subir o nível."); }
}
Object.assign(window, {abrir, subir});

// ---------- perfil: nível, XP e estoque de itens ----------
async function perfil() {
  try {
    const st = await lerStatus(u.chave), el = $("perfil"); pontos = st.pontos; if (!$("lista-pk").hidden) grade();
    el.innerHTML = `<div class="perfil-nivel"><span class="nv-selo">Nv ${st.nivel}</span>
      <div class="perfil-info"><b>${esc(u.nick)}</b>
        <div class="xp-barra" role="progressbar" aria-valuenow="${st.noNivel}" aria-valuemax="${st.tamanho}"><i style="width:${st.pct}%"></i></div>
        <small>${st.noNivel}/${st.tamanho} XP · faltam ${st.falta} para o nível ${st.nivel + 1} · vitória +20 XP, derrota +5 XP</small></div></div>
      <div class="perfil-itens"><span title="Cada nível da conta rende 1 ponto, que sobe 1 nível de um Pokémon (máx. ${REGRAS.nivelMax})">🎯 ${st.pontos} ${st.pontos === 1 ? "ponto de treino" : "pontos de treino"}</span><span>🏆 ${st.vitorias} ${st.vitorias === 1 ? "vitória" : "vitórias"}</span><span>🧪 ${st.pocoes} ${st.pocoes === 1 ? "poção" : "poções"}</span><span>💫 ${st.revives} ${st.revives === 1 ? "reviver" : "revives"}</span><span title="Combustível do golpe Z: 1 por batalha em que você usa">💎 ${st.zcristais} ${st.zcristais === 1 ? "cristal Z" : "cristais Z"}</span><span title="Cada nível da conta rende 1 caixa. Elas ficam guardadas e abrem na próxima atualização (cristais Z e itens)">📦 ${st.caixas} ${st.caixas === 1 ? "caixa guardada" : "caixas guardadas"}</span></div>`;
    el.hidden = false;
  } catch(e) { /* o perfil é só informativo */ }
}

// ---------- abas: Pokémon (golpes) e Times (equipes salvas na conta) ----------
function aba(qual) {
  const times = qual === "times";
  $("aba-pk").classList.toggle("ativa", !times); $("aba-pk").setAttribute("aria-selected", String(!times));
  $("aba-times").classList.toggle("ativa", times); $("aba-times").setAttribute("aria-selected", String(times));
  if (times) {
    $("lista-pk").hidden = true; $("editor").hidden = true;
    montarTimes($("times"), {chave: u.chave, prontos: cat.filter(p => p.aprende?.length && golpesDe(p).length).map(p => ({...p, nivel: nivelDoPokemon(niveis, p.id)})), shiny, golpes: golpesDe}); // só Pokémon com golpes escolhidos
  } else { $("times").hidden = true; lista(); }
}
$("aba-pk").onclick = () => aba("pk");
$("aba-times").onclick = () => aba("times");

// ---------- início ----------
if (!u) $("conta").hidden = false;
else {
  try { [cat, builds, shiny, niveis] = await Promise.all([listar(), lerBuilds(u.chave), lerShiny(u.chave).catch(() => ({})), lerNiveis(u.chave)]); $("abas-meus").hidden = false; lista(); perfil(); }
  catch(e) { aviso("Não foi possível carregar os dados. Confira o firebaseConfig e as regras do Firestore."); }
}
