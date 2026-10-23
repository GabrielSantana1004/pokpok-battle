// Listagem rápida do catálogo, com edição e exclusão (página do administrador).
import { listar, salvar, remover } from "./firebase.js";
import { STATS, TIPOS, esc, valid } from "./common.js";
import { carregarImagens } from "./imagem.js";
import { buscarMegas } from "./megas.js";
import { darCristais, chaveDeNick } from "./usuarios.js";
const $ = id => document.getElementById(id);
let cat = [], editando = null;
const aviso = t => { $("erro").textContent = t || ""; };

function tabela() {
  const q = $("busca").value.trim().toLowerCase(), t = $("filtro").value;
  const v = cat.filter(p => p.nome.toLowerCase().includes(q) && (!t || p.tipos.includes(t)));
  $("contagem").textContent = `${v.length} de ${cat.length} Pokémon`;
  $("linhas").innerHTML = v.map(p => `<tr>
    <td><img data-pokemon="${esc(p.nome)}" alt="" loading="lazy"></td><td><b>${esc(p.nome)}</b></td><td>${p.tipos.map(esc).join("/")}</td>
    ${STATS.map(s => `<td>${p[s[0]]}</td>`).join("")}
    <td title="${esc((p.mv || []).map(m => m.nome).join(", "))}">${(p.mv || []).length} padrão · ${p.aprende ? p.aprende.length : 0} aprende</td>
    <td>${p.megas ? (p.megas.length ? p.megas.map(m => esc(m.nome)).join(", ") : "—") : "<small>?</small>"}</td>
    <td><button onclick="editar('${esc(p.id)}')">Editar</button> <button onclick="excluir('${esc(p.id)}')">Excluir</button></td></tr>`).join("")
    || `<tr><td colspan="12">Nenhum Pokémon encontrado.</td></tr>`;
  carregarImagens($("linhas"));
}
function editar(id) {
  const p = cat.find(x => x.id === id); if (!p) return;
  editando = id; aviso();
  const sel = (n, v, vazio) => `<select id="${n}">${vazio ? '<option value="">(nenhum)</option>' : ""}${TIPOS.map(t => `<option${t === v ? " selected" : ""}>${t}</option>`).join("")}</select>`;
  $("editor").hidden = false;
  $("editor").innerHTML = `<h3>Editando ${esc(p.nome)}</h3>
    <label>Nome <input id="e-nome" value="${esc(p.nome)}"></label>
    <label>Tipo 1 ${sel("e-t1", p.tipos[0])}</label><label>Tipo 2 ${sel("e-t2", p.tipos[1], true)}</label><br>
    ${STATS.map(s => `<label>${s[1]} <input type="number" min="1" id="e-${s[0]}" value="${p[s[0]]}"></label>`).join("")}<br>
    <label>Golpes padrão (JSON, 1 a 4: nome, tipo, cat = fisico|especial|status, poder, precisao, prioridade)<br>
      <textarea id="e-mv" rows="6" style="width:100%">${esc(JSON.stringify(p.mv || [], null, 1))}</textarea></label><br>
    <small>A lista "aprende" (${p.aprende ? p.aprende.length : 0} golpes) não é editada aqui; use "Atualizar golpes".</small><br>
    <button class="primario" onclick="salvarEdicao()">Salvar</button> <button onclick="cancelar()">Cancelar</button>`;
  $("editor").scrollIntoView({behavior: "smooth"});
}
async function salvarEdicao() {
  const p = cat.find(x => x.id === editando); if (!p) return;
  let mv; try { mv = JSON.parse($("e-mv").value); } catch(e) { return aviso("O JSON dos golpes está inválido."); }
  const novo = {...p, nome: $("e-nome").value.trim(), tipos: [$("e-t1").value, $("e-t2").value].filter(Boolean).filter((t, i, a) => a.indexOf(t) === i), mv};
  for (const [k] of STATS) novo[k] = Number($("e-" + k).value);
  if (!valid(novo)) return aviso("Dados inválidos: confira nome, atributos (números maiores que 0) e golpes (1 a 4, com nome e cat).");
  try { await salvar(novo, editando); cat = cat.map(x => x.id === editando ? novo : x).sort((a, b) => a.nome.localeCompare(b.nome)); cancelar(); tabela(); }
  catch(e) { aviso("Não foi possível salvar: " + e.message); }
}
function cancelar() { editando = null; $("editor").hidden = true; $("editor").innerHTML = ""; }
async function excluir(id) {
  const p = cat.find(x => x.id === id); if (!p) return;
  if (!confirm(`Excluir ${p.nome} do catálogo? Isso não pode ser desfeito.`)) return;
  try { await remover(id); cat = cat.filter(x => x.id !== id); if (editando === id) cancelar(); tabela(); }
  catch(e) { aviso("Não foi possível excluir: " + e.message); }
}

$("bt-megas").onclick = async () => { // grava podeMega e megas em cada Pokémon (os que já têm o campo são pulados)
  const b = $("bt-megas"), log = t => { $("log").textContent += t + "\n"; };
  b.disabled = true; $("log").textContent = ""; let achou = 0, falhas = 0;
  for (const p of cat) {
    if (p.megas) continue;
    try {
      const m = await buscarMegas(p.nome); await salvar({...p, ...m}, p.id); p.podeMega = m.podeMega; p.megas = m.megas;
      if (m.podeMega) { achou++; log(`${p.nome}: ${m.megas.map(x => x.nome).join(", ")}`); }
    } catch(e) { falhas++; log(`${p.nome}: falhou (${e.message})`); }
  }
  log(`\nPronto: ${achou} Pokémon com mega, ${falhas} falhas. Falhas: rode de novo para tentar outra vez.`);
  b.disabled = false; tabela();
};
$("bt-z").onclick = async () => { // dá (ou tira, com número negativo no console) cristais Z a uma conta
  const nick = $("z-nick").value.trim(), n = Math.floor(Number($("z-qtd").value));
  if (!nick || !(n > 0)) return aviso("Informe o nickname e uma quantidade maior que 0.");
  try { aviso(`Pronto: ${nick} agora tem ${await darCristais(chaveDeNick(nick), n)} cristais Z.`); }
  catch(e) { aviso("Não foi possível dar os cristais: " + e.message); }
};
// Exporta a lista completa do catálogo (ordem alfabética): um CSV para abrir em planilha e um JSON com os mesmos dados
const baixar = (nome, texto, tipo) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([texto], {type: tipo})); a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
const celula = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
$("bt-exportar").onclick = () => {
  const lista = cat.map(p => ({id: p.id, nome: p.nome, tipos: p.tipos, megas: (p.megas || []).map(m => m.nome), hp: p.hp, atk: p.atk, def: p.def, spa: p.spa, spd: p.spd, spe: p.spe}));
  const csv = "\ufeff" + ["id;nome;tipos;megas;hp;atk;def;spa;spd;spe", ...lista.map(p => [p.id, p.nome, p.tipos.join("/"), p.megas.join(", "), p.hp, p.atk, p.def, p.spa, p.spd, p.spe].map(celula).join(";"))].join("\r\n");
  baixar("pokemons-lista.csv", csv, "text/csv;charset=utf-8"); baixar("pokemons-lista.json", JSON.stringify(lista, null, 1), "application/json");
  aviso(`${lista.length} Pokémon exportados (pokemons-lista.csv e pokemons-lista.json).`);
};
$("filtro").innerHTML += TIPOS.map(t => `<option>${t}</option>`).join("");
$("busca").oninput = tabela; $("filtro").onchange = tabela;
Object.assign(window, {editar, salvarEdicao, cancelar, excluir});
try { cat = await listar(); tabela(); } catch(e) { aviso("Não foi possível carregar o catálogo. Confira o firebaseConfig e as regras do Firestore."); }
