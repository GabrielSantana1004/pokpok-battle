// Listagem rápida do catálogo, com edição e exclusão (página do administrador).
import { listar, salvar, remover } from "./firebase.js";
import { STATS, TIPOS, esc, valid } from "./common.js";
import { carregarImagens } from "./imagem.js";
import { buscarMegas } from "./megas.js";
import { darCristais, chaveDeNick, definirPermissaoShiny, adicionarPokemon } from "./usuarios.js";
import { lendariosForaDoCatalogo, LENDARIOS } from "./pokemons.js";
import { buscarHabilidades } from "./habilidadesapi.js";
import { relatorioHabilidades, relatorioGolpes, relatorioCobertura, csv, HAB_NAO_SE_APLICAM } from "./habilidades.js";
import { ITENS, TIERS } from "./itens.js";
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
// Busca as habilidades (e as das megas) na PokéAPI e baixa os relatórios. Quem já tem habilidades é pulado: rode de novo para tentar as falhas.
const arquivos = () => {
  const h = relatorioHabilidades(cat), g = relatorioGolpes(cat), arq = [];
  arq.push(["habilidades-lista.csv", csv(["id", "habilidade", "pokemons", "como_normal", "como_oculta", "como_mega", "lista_de_pokemons"],
    h.distintas.map(e => [e.id, e.nome, e.total, e.normal, e.oculta, e.mega, e.pokemons.join(", ")])), "text/csv;charset=utf-8"]);
  arq.push(["itens-lista.csv", csv(["id", "item", "raridade", "efeito", "situacao"], ITENS.map(i => [i.id, i.nome, TIERS[i.tier].nome, i.desc, i.semEfeito ? "sem efeito: " + i.semEfeito + " (não sai nas caixas)" : "funciona"])), "text/csv;charset=utf-8"]);
  const cob = relatorioCobertura(cat);
  arq.push(["habilidades-cobertura.csv", csv(["id", "habilidade", "situacao", "nota", "pokemons", "lista_de_pokemons"],
    cob.linhas.map(e => [e.id, e.nome, e.texto, e.nota, e.total + e.mega, e.pokemons.join(", ")])), "text/csv;charset=utf-8"]);
  arq.push(["pokemons-habilidades.csv", csv(["pokemon", "habilidades_normais", "habilidade_oculta", "megas"],
    h.porPokemon.map(p => [p.nome, p.normais.join(" / "), p.oculta.join(" / "), p.megas.map(m => `${m.nome}: ${m.habilidade || "?"}`).join(", ")])), "text/csv;charset=utf-8"]);
  arq.push(["golpes-por-pokemon.csv", csv(["pokemon", "golpe", "tipo", "categoria", "poder", "precisao", "prioridade"],
    g.pokemons.flatMap(p => p.golpes.map(m => [p.nome, m.nome, m.tipo, m.cat, m.poder, m.precisao, m.prioridade]))), "text/csv;charset=utf-8"]);
  arq.push(["golpes-por-pokemon.json", JSON.stringify({geradoEm: new Date().toISOString(), totalPokemon: g.totalPokemon, golpesDistintos: g.unicos.length, pokemons: g.pokemons, golpesUnicos: g.unicos}, null, 1), "application/json"]);
  return {arq, h, g};
};
$("bt-hab").onclick = async () => {
  const b = $("bt-hab"), log = t => { $("log").textContent += t + "\n"; };
  b.disabled = true; $("log").textContent = ""; let novos = 0, falhas = 0;
  for (const p of cat) {
    if (p.habilidades?.length) continue;
    try {
      const r = await buscarHabilidades(p); await salvar({...p, habilidades: r.habilidades, megas: p.megas ? r.megas : p.megas}, p.id);
      p.habilidades = r.habilidades; if (p.megas) p.megas = r.megas; novos++;
      log(`${p.nome}: ${r.habilidades.map(h => h.nome + (h.oculta ? " (oculta)" : "")).join(", ")}`);
    } catch(e) { falhas++; log(`${p.nome}: falhou (${e.message})`); }
  }
  const {arq, h, g} = arquivos();
  arq.forEach(([nome, texto, tipo], i) => setTimeout(() => baixar(nome, texto, tipo), i * 500)); // espaçados: o navegador pode pedir permissão para vários downloads
  log(`\nPronto: ${novos} Pokémon atualizados, ${falhas} falhas (rode de novo para tentar outra vez). ${h.distintas.length} habilidades distintas em ${h.porPokemon.length} Pokémon; ${g.unicos.length} golpes distintos nas listas de escolha.`);
  { const c = relatorioCobertura(cat); log(`Cobertura em batalha: ${c.cont.ok || 0} funcionam, ${c.cont.parcial || 0} em parte, ${(c.cont.itens || 0)} dependem de itens, ${(c.cont.dupla || 0) + (c.cont.pp || 0)} sem uso no 1x1, ${c.cont.nao || 0} ainda sem efeito (de ${c.total}).`);
    log("Ainda sem efeito: " + c.linhas.filter(l => l.estado === "nao").map(l => l.nome).join(", ")); }
  if (h.semDados.length) log(`Sem dados de habilidade: ${h.semDados.join(", ")}`);
  log(`Arquivos baixados: ${arq.map(a => a[0]).join(", ")}. Se o navegador perguntar, permita vários downloads.`);
  b.disabled = false; tabela();
};
$("bt-limpar-hab").onclick = async () => { // tira do catálogo as habilidades que não se aplicam ao jogo (nunca deixa um Pokémon sem habilidade)
  const b = $("bt-limpar-hab"), log = t => { $("log").textContent += t + "\n"; }; $("log").textContent = "";
  const alvos = cat.filter(p => (p.habilidades || []).some(h => HAB_NAO_SE_APLICAM.includes(h.id)));
  if (!alvos.length) return log("Nenhum Pokémon tem essas habilidades (" + HAB_NAO_SE_APLICAM.join(", ") + ").");
  if (!confirm(`Remover ${HAB_NAO_SE_APLICAM.join(", ")} de ${alvos.length} Pokémon?`)) return;
  b.disabled = true;
  try {
    for (const p of alvos) {
      const resto = p.habilidades.filter(h => !HAB_NAO_SE_APLICAM.includes(h.id));
      if (!resto.length) { log(`${p.nome}: ficou sem outra habilidade, então foi mantido.`); continue; }
      await salvar({...p, habilidades: resto}, p.id); p.habilidades = resto; log(`${p.nome}: ok.`);
    }
    log("Pronto.");
  } catch(e) { log("Erro: " + e.message); }
  b.disabled = false;
};
$("bt-z").onclick = async () => { // dá (ou tira, com número negativo no console) cristais Z a uma conta
  const nick = $("z-nick").value.trim(), n = Math.floor(Number($("z-qtd").value));
  if (!nick || !(n > 0)) return aviso("Informe o nickname e uma quantidade maior que 0.");
  try { aviso(`Pronto: ${nick} agora tem ${await darCristais(chaveDeNick(nick), n)} cristais Z.`); }
  catch(e) { aviso("Não foi possível dar os cristais: " + e.message); }
};
$("bt-dar-pk").onclick = async () => { // dá um Pokémon (IVs e shiny sorteados) a uma conta: ferramenta de teste enquanto captura, caixas e iniciais não existem
  const nick = $("pk-nick").value.trim(), nome = $("pk-nome").value.trim().toLowerCase(), p = cat.find(x => x.nome.toLowerCase() === nome || x.id === nome);
  if (!nick || !nome) return aviso("Informe o nickname e o nome do Pokémon.");
  if (!p) return aviso("Pokémon não encontrado no catálogo. Escreva o nome exato.");
  try { const r = await adicionarPokemon(chaveDeNick(nick), p.id); aviso(`Pronto: ${nick} ganhou ${p.nome}${r.shiny ? " ✨ shiny" : ""} (IVs ${Object.values(r.ivs).join("/")}).`); }
  catch(e) { aviso("Não foi possível dar o Pokémon: " + e.message); }
};
$("bt-lend").onclick = () => { // confere a lista de lendários da torre com os nomes do catálogo
  const fora = lendariosForaDoCatalogo(cat);
  aviso(fora.length ? `${LENDARIOS.length - fora.length} de ${LENDARIOS.length} lendários estão no catálogo. Fora do catálogo (nome diferente ou não cadastrado): ${fora.join(", ")}.` : `Os ${LENDARIOS.length} lendários da lista estão todos no catálogo.`);
};
// Exporta a lista completa do catálogo (ordem alfabética): um CSV para abrir em planilha e um JSON com os mesmos dados
const baixar = (nome, texto, tipo) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([texto], {type: tipo})); a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
const celula = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
async function permissaoShiny(ligado) { // dá ou tira a permissão especial de escolher shiny
  const nick = $("sh-nick").value.trim();
  if (!nick) return aviso("Informe o nickname da conta.");
  try { await definirPermissaoShiny(chaveDeNick(nick), ligado); aviso(`Pronto: ${nick} ${ligado ? "agora pode" : "não pode mais"} escolher shiny.`); }
  catch(e) { aviso("Não foi possível alterar a permissão: " + e.message); }
}
$("bt-sh-dar").onclick = () => permissaoShiny(true);
$("bt-sh-tirar").onclick = () => permissaoShiny(false);
$("sh-nick").onkeydown = e => { if (e.key === "Enter") permissaoShiny(true); };

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
