import { listar } from "./firebase.js";
import { STATS, esc, nav, efetividade } from "./common.js";
import { carregarImagens } from "./imagem.js";
nav();
const $ = id => document.getElementById(id);
const EFET = [["Neutro (×1)",1],["Super efetivo (×3)",3],["Pouco efetivo (×0,75)",0.75],
  ["Dupla fraqueza (×6)",6],["Dupla resistência (×0,375)",0.375],["Imunidade (×0)",0]];
const PIPS = "<span></span>".repeat(9);
let cat = [], st = {team:[], active:0}, dados = [1, 1], oponenteId = "";
const nivelHp = (hp, max) => { const pct = max ? hp / max * 100 : 0; return pct >= 50 ? "alto" : pct >= 20 ? "medio" : "baixo"; };
try { const s = JSON.parse(localStorage.getItem("pbb2")); if (s && Array.isArray(s.team)) st = s; } catch(e) {}
const save = () => { try { localStorage.setItem("pbb2", JSON.stringify(st)); } catch(e) {} };
const mon = e => cat.find(p => p.id === e.id);
function clean() {
  st.team = st.team.filter(mon);
  st.team.forEach(e => e.hp = Math.min(e.hp, mon(e).hp));
  if (st.active >= st.team.length) st.active = Math.max(0, st.team.length - 1);
}

// ===== EQUIPE =====
function add() {
  if (st.team.length >= 6) return alert("A equipe já tem 6 Pokémon.");
  const p = cat.find(p => p.id === $("cat").value);
  if (!p) return;
  st.team.push({id:p.id, hp:p.hp}); save(); renderAll();
}
function act(i) { st.active = i; save(); renderAll(); }
function mv(i, d) {
  const j = i + d;
  if (j < 0 || j >= st.team.length) return;
  [st.team[i], st.team[j]] = [st.team[j], st.team[i]];
  if (st.active === i) st.active = j; else if (st.active === j) st.active = i;
  save(); renderAll();
}
function rm(i) {
  st.team.splice(i, 1);
  if (i < st.active) st.active--;
  if (st.active >= st.team.length) st.active = Math.max(0, st.team.length - 1);
  save(); renderAll();
}
function renderTeam() {
  $("cnt").textContent = st.team.length;
  $("team").innerHTML = st.team.map((e, i) => {
    const p = mon(e);
    return `<div>${i === st.active ? "▶ " : ""}${i + 1}. ${esc(p.nome)} — ${e.hp}/${p.hp}${e.hp === 0 ? " (derrotado)" : ""}
      <button onclick="act(${i})">Ativar</button><button onclick="mv(${i},-1)">↑</button>
      <button onclick="mv(${i},1)">↓</button><button onclick="rm(${i})">✕</button></div>`;
  }).join("") || "<p>Equipe vazia. Escolha um Pokémon do catálogo.</p>";
}

// ===== FICHA =====
function renderSheet() {
  const e = st.team[st.active];
  if (!e) { $("sheet").innerHTML = "<h2>Pokémon em campo</h2><p>Nenhum Pokémon em campo.</p>"; return; }
  const p = mon(e);
  $("sheet").innerHTML = `<img class="foto" data-pokemon="${esc(p.nome)}" alt="">
    <h2>${esc(p.nome)} <small>${p.tipos.map(esc).join(" / ")}</small></h2>
    <table><tr>${STATS.map(s => `<th>${s[1]}</th>`).join("")}</tr>
    <tr>${STATS.map(s => `<td>${p[s[0]]}</td>`).join("")}</tr></table>
    <p>HP: <b>${e.hp}/${p.hp}</b></p><progress value="${e.hp}" max="${p.hp}" data-nivel="${nivelHp(e.hp, p.hp)}"></progress>
    <div>Valor: <input type="number" id="dmg" min="0" value="0">
    <button onclick="hit(-1)">Receber dano</button><button onclick="hit(1)" id="curar">Curar</button></div>
    <ul>${p.mv.map(m => `<li>${esc(m.nome)} (${esc(m.tipo)}, ${m.cat})</li>`).join("")}</ul>`;
  carregarImagens($("sheet"));
}
function hit(sign) {
  const e = st.team[st.active], p = mon(e);
  const v = Math.max(0, parseInt($("dmg").value) || 0);
  e.hp = Math.min(p.hp, Math.max(0, e.hp + sign * v));
  save(); renderTeam(); renderSheet();
}

// ===== DADOS =====
const faceDado = v => (v >= 1 && v <= 6) ? v : 0;
function setDado(n, v) { const d = $("dado" + n); if (d) d.dataset.v = faceDado(v); }
function syncDados() {
  const a = parseInt($("d1").value), b = parseInt($("d2").value);
  dados = [faceDado(a) || 1, faceDado(b) || 1];
  setDado(1, a); setDado(2, b);
}
function rolar() {
  const btn = $("rolar"), r = () => 1 + Math.floor(Math.random() * 6);
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  $("dado1").classList.add("rolando"); $("dado2").classList.add("rolando");
  let t = 0;
  const iv = setInterval(() => {
    if (!$("rolar")) { clearInterval(iv); return; } // calculadora foi redesenhada
    if (++t < 9) { setDado(1, r()); setDado(2, r()); return; }
    clearInterval(iv);
    const a = r(), b = r();
    $("d1").value = a; $("d2").value = b; syncDados();
    $("dado1").classList.remove("rolando"); $("dado2").classList.remove("rolando");
    btn.disabled = false;
  }, 70);
}

// ===== CALCULADORA =====
function renderCalc() {
  const e = st.team[st.active];
  if (!e) { $("calc").innerHTML = ""; return; }
  const p = mon(e);
  $("calc").innerHTML = `<h2>Calcular dano de ${esc(p.nome)}</h2>
    <div>Adversário: <select id="co" onchange="escolherOponente()"><option value="">(escolher)</option>
      ${cat.map(q => `<option value="${esc(q.id)}"${q.id === oponenteId ? " selected" : ""}>${esc(q.nome)}</option>`).join("")}</select></div>
    <div>Movimento: <select id="cm" onchange="autoPreencher()">${p.mv.map((m, i) => `<option value="${i}">${esc(m.nome)} (${m.cat})</option>`).join("")}</select></div>
    <div>Defesa do adversário (Def para físico, Def Esp para especial): <input type="number" id="cd" min="0" value="0"></div>
    <div>Efetividade: <select id="ce">${EFET.map(x => `<option value="${x[1]}">${x[0]}</option>`).join("")}</select></div>
    <div id="info"></div>
    <div class="dados">
      <div class="dado" id="dado1" data-v="${dados[0]}">${PIPS}</div>
      <div class="dado" id="dado2" data-v="${dados[1]}">${PIPS}</div>
      <div class="dados-ctl">
        <button id="rolar" onclick="rolar()">🎲 Rolar dados</button>
        <div>Ou digite: <input type="number" id="d1" min="1" max="6" value="${dados[0]}" oninput="syncDados()"> <input type="number" id="d2" min="1" max="6" value="${dados[1]}" oninput="syncDados()"></div>
      </div>
    </div>
    <button onclick="calc()">Calcular</button>
    <div id="res"></div>`;
  autoPreencher();
}
function escolherOponente() { oponenteId = $("co").value; autoPreencher(); }
// Com adversário escolhido: preenche Defesa e Efetividade (continuam editáveis)
function autoPreencher() {
  const op = cat.find(q => q.id === oponenteId), e = st.team[st.active];
  if (!op || !e) { $("info").textContent = ""; return; }
  const m = mon(e).mv[+$("cm").value];
  if (!m || m.cat === "status") { $("info").textContent = "Movimento de status: não causa dano direto."; return; }
  const def = m.cat === "fisico" ? op.def : op.spd;
  const mult = efetividade(m.tipo, op.tipos);
  $("cd").value = def;
  $("ce").value = String(mult);
  $("info").innerHTML = `<img class="foto mini" data-pokemon="${esc(op.nome)}" alt=""> ${esc(`${op.nome} (${op.tipos.join(" / ")}): ${m.cat === "fisico" ? "Defesa" : "Def Esp"} ${def}; ${m.tipo} → ×${mult}`)}`;
  carregarImagens($("info"));
}
function calc() {
  const p = mon(st.team[st.active]), m = p.mv[+$("cm").value];
  if (m.cat === "status") { $("res").innerHTML = "<p>Movimento de status: não causa dano direto.</p>"; return; }
  const d1 = parseInt($("d1").value), d2 = parseInt($("d2").value);
  if (!(d1 >= 1 && d1 <= 6 && d2 >= 1 && d2 <= 6)) { $("res").innerHTML = "<p>Os dados precisam estar entre 1 e 6.</p>"; return; }
  const atk = m.cat === "fisico" ? p.atk : p.spa;
  const def = Math.max(0, parseFloat($("cd").value) || 0);
  const mult = parseFloat($("ce").value);
  const forca = Math.max(1, atk - def), soma = d1 + d2;
  const bruto = Math.floor(forca * soma * mult / 12);
  // dano 0 é exclusivo de imunidade (×0); qualquer outro ataque causa no mínimo 1
  const dano = mult === 0 ? 0 : Math.max(1, bruto);
  const nota = mult === 0 ? "<br>Imunidade: o alvo não sofre dano." : bruto < 1 ? "<br>Dano mínimo: 1 (só imunidade zera o dano)." : "";
  $("res").innerHTML = `<p>Força efetiva = ${atk} − ${def} = ${forca} (mínimo 1)<br>
    Dano bruto = (${forca} ÷ 12) × ${soma} = ${(forca / 12 * soma).toFixed(2)}<br>
    × efetividade ${mult} → arredondado para baixo = ${bruto}${nota}<br><b>Dano final: ${dano}</b></p>`;
}
function renderAll() { renderTeam(); renderSheet(); renderCalc(); }

$("add").onclick = add;
$("resetHp").onclick = () => { st.team.forEach(e => e.hp = mon(e).hp); save(); renderAll(); };
$("clear").onclick = () => { if (confirm("Limpar a equipe inteira?")) { st = {team:[], active:0}; save(); renderAll(); } };
Object.assign(window, {act, mv, rm, hit, calc, rolar, syncDados, escolherOponente, autoPreencher});
try {
  cat = await listar();
  $("cat").innerHTML = cat.map(p => `<option value="${esc(p.id)}">${esc(p.nome)}</option>`).join("");
} catch(e) { $("erro").textContent = "Não foi possível carregar o catálogo. Confira o firebaseConfig e as regras do Firestore."; }
clean(); save(); renderAll();
