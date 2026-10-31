import { listar, salvar, EXEMPLOS } from "./firebase.js";
import { STATS, TIPOS, esc, nav } from "./common.js";
import { carregarImagens } from "./imagem.js";
import { golpesDe } from "./golpesdb.js";
import { resumoEfeitos } from "./motor.js";
import { usuario, lerShinyEspecies } from "./usuarios.js";
import { tagLendario } from "./pokemons.js";
const leitura = document.body.dataset.leitura === "1"; // dentro da sala: só leitura
if (!leitura) nav();
const $ = id => document.getElementById(id);
const CAT = {fisico:"Físico", especial:"Especial", status:"Status"};
let cat = [], meus = {}, aba = "pokemon", efeitos = null; // meus: Pokémon shiny da conta logada // efeitos: dados dos golpes de status (coleção "golpes"), carregados só na aba Golpes
const badge = t => `<span class="tipo t-${esc(t)}">${esc(t)}</span>`;

function card(p) {
  return `<article class="card">
    <img class="foto" data-pokemon="${esc(p.nome)}"${meus[p.id] ? ' data-shiny="1"' : ""} alt="${esc(p.nome)}" loading="lazy">
    <h3>${esc(p.nome)}${meus[p.id] ? " ✨" : ""} ${tagLendario(p.nome)}${p.megas?.length ? ' <small title="Pode megaevoluir: ' + esc(p.megas.map(m => m.nome).join(", ")) + '">⚡ Mega</small>' : ""}</h3>
    <div class="tipos">${p.tipos.map(badge).join("")}</div>
    <div class="stats">${STATS.map(s => `<div><small>${s[1]}</small><b>${p[s[0]]}</b></div>`).join("")}</div>
  </article>`;
}
// golpes únicos de todo o catálogo (só para consulta), com quem os aprende
function golpesDoCatalogo() {
  const mapa = new Map();
  for (const p of cat) for (const m of p.mv) {
    const g = mapa.get(m.nome) || {...m, quem: []};
    if (g.poder === undefined && m.poder !== undefined) Object.assign(g, {poder: m.poder, precisao: m.precisao, prioridade: m.prioridade});
    g.quem.push(p.nome); mapa.set(m.nome, g);
  }
  return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome));
}
function cardGolpe(m) {
  const sem = m.poder === undefined, st = m.cat === "status";
  const poder = st ? "—" : sem ? "?" : m.poder ?? "—";
  const prec = sem ? "?" : m.precisao == null ? "nunca erra" : m.precisao + "%";
  const prio = sem ? "?" : (m.prioridade > 0 ? "+" : "") + (m.prioridade || 0);
  const ef = st && efeitos?.[m.nome]?.efeitos ? resumoEfeitos(efeitos[m.nome].efeitos) : "";
  return `<article class="card golpe">
    <div class="topo"><h3>${esc(m.nome)}</h3>${badge(m.tipo)}</div>
    <div class="golpe-info"><div><small>Categoria</small><b>${CAT[m.cat] || esc(m.cat)}</b></div><div><small>Poder</small><b>${poder}</b></div>
      <div><small>Precisão</small><b>${prec}</b></div><div><small>Prioridade</small><b>${prio}</b></div></div>
    ${ef ? `<p class="golpe-efeito">${esc(ef)}</p>` : ""}
    <p class="golpe-quem">Aprendem: ${m.quem.map(esc).join(", ")}</p>
  </article>`;
}
function render() {
  const q = $("busca").value.trim().toLowerCase(), t = $("filtro").value;
  $("aba-pokemon").classList.toggle("ativa", aba === "pokemon"); $("aba-pokemon").setAttribute("aria-selected", aba === "pokemon");
  $("aba-golpes").classList.toggle("ativa", aba === "golpes"); $("aba-golpes").setAttribute("aria-selected", aba === "golpes");
  $("busca").placeholder = aba === "golpes" ? "Buscar golpe por nome" : "Buscar por nome";
  const lbShiny = $("so-shiny")?.parentElement; if (lbShiny) lbShiny.hidden = aba === "golpes"; // shiny só vale para Pokémon
  if (aba === "golpes") {
    const todos = golpesDoCatalogo(), lista = todos.filter(m => m.nome.toLowerCase().includes(q) && (!t || m.tipo === t));
    $("contagem").textContent = `${lista.length} de ${todos.length} golpes`;
    $("lista").innerHTML = lista.map(cardGolpe).join("") || `<p>${todos.length ? "Nenhum golpe encontrado." : "Nenhum golpe: o catálogo está vazio."}</p>`;
    return;
  }
  const so = !!$("so-shiny")?.checked, lista = cat.filter(p => p.nome.toLowerCase().includes(q) && (!t || p.tipos.includes(t)) && (!so || meus[p.id]));
  $("contagem").textContent = `${lista.length} de ${cat.length} Pokémon`;
  $("lista").innerHTML = lista.map(card).join("") ||
    (cat.length ? "<p>Nenhum Pokémon encontrado.</p>"
      : `<p>Catálogo vazio.</p>${leitura ? "" : '<button onclick="exemplos()">Adicionar 3 Pokémon de exemplo</button>'}`);
  carregarImagens($("lista"));
}
async function trocarAba(nova) {
  aba = nova; render();
  if (nova === "golpes" && !efeitos) { // efeitos dos golpes de status; se não der para ler, mostra sem eles
    try { efeitos = await golpesDe(cat.flatMap(p => p.mv.filter(m => m.cat === "status").map(m => m.nome))); render(); } catch(e) { efeitos = {}; }
  }
}
async function carregar() {
  try {
    cat = await listar();
    const u = usuario(); if (u) meus = await lerShinyEspecies(u.chave).catch(() => ({})); // conta logada: seus shiny aparecem com a arte shiny
    render();
  }
  catch(e) { $("erro").textContent = "Não foi possível carregar o catálogo. Confira o firebaseConfig e as regras do Firestore."; }
}
async function exemplos() { for (const p of EXEMPLOS) await salvar(p); carregar(); }

$("filtro").innerHTML += TIPOS.map(t => `<option>${t}</option>`).join("");
$("aba-pokemon").onclick = () => trocarAba("pokemon");
$("aba-golpes").onclick = () => trocarAba("golpes");
$("busca").oninput = render;
$("filtro").onchange = render;
if ($("so-shiny")) { $("so-shiny").onchange = render; if (!usuario()) { $("so-shiny").disabled = true; $("so-shiny").parentElement.title = "Entre na conta para ver seus shiny"; } }
Object.assign(window, {exemplos});
carregar();
