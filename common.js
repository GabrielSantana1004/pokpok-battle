export const STATS = [["hp","HP"],["atk","Atq"],["def","Def"],["spa","Atq Esp"],["spd","Def Esp"],["spe","Vel"]];
export const TIPOS = ["Normal","Fire","Water","Electric","Grass","Ice","Fighting","Poison","Ground","Flying","Psychic","Bug","Rock","Ghost","Dragon","Dark","Steel","Fairy"];
export const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export function valid(p) {
  return p && typeof p.nome === "string" && p.nome && Array.isArray(p.tipos) && p.tipos.length &&
    STATS.every(s => Number.isFinite(p[s[0]]) && p[s[0]] > 0) &&
    Array.isArray(p.mv) && p.mv.length > 0 && p.mv.length <= 4 &&
    p.mv.every(m => typeof m.nome === "string" && ["fisico","especial","status"].includes(m.cat));
}
export function nav() {
  // Quem está em uma sala só pode ficar na página da sala
  try { if (localStorage.getItem("pbb_sala") && !location.pathname.endsWith("sala.html")) { location.replace("sala.html"); return; } } catch(e) {}
  let u = null; try { u = JSON.parse(localStorage.getItem("pbb_user")); } catch(e) {}
  document.getElementById("nav").innerHTML =
    '<a href="meus.html">Meus Pokémon</a><a href="index.html">Batalha</a><a href="catalogo.html">Catálogo</a><a href="trocas.html">Trocas</a><a href="ranking.html">Ranking</a>' +
    (u ? `<span class="nav-user">${esc(u.nick)} <span id="nav-status"></span> · <a href="#" id="nav-sair">Sair</a></span>` : "");
  if (u) import("./usuarios.js").then(m => m.lerStatus(u.chave)).then(st => { const e = document.getElementById("nav-status"); if (e) e.textContent = `· ⭐ Nv ${st.nivel} · 🏆 ${st.vitorias} · 🧪 ${st.pocoes} · 💫 ${st.revives} · 💎 ${st.zcristais || 0}${st.caixas > 0 ? ` · 📦 ${st.caixas}` : ""}`; }).catch(() => {});
  const sair = document.getElementById("nav-sair");
  if (sair) sair.onclick = e => { e.preventDefault(); localStorage.removeItem("pbb_user"); location.reload(); };
}

// ===== TABELA DE TIPOS =====
// tipo do golpe: [super efetivo contra, pouco efetivo contra, sem efeito contra]
const CHART = {
  Normal:["","Rock,Steel","Ghost"],
  Fire:["Grass,Ice,Bug,Steel","Fire,Water,Rock,Dragon",""],
  Water:["Fire,Ground,Rock","Water,Grass,Dragon",""],
  Electric:["Water,Flying","Electric,Grass,Dragon","Ground"],
  Grass:["Water,Ground,Rock","Fire,Grass,Poison,Flying,Bug,Dragon,Steel",""],
  Ice:["Grass,Ground,Flying,Dragon","Fire,Water,Ice,Steel",""],
  Fighting:["Normal,Ice,Rock,Dark,Steel","Poison,Flying,Psychic,Bug,Fairy","Ghost"],
  Poison:["Grass,Fairy","Poison,Ground,Rock,Ghost","Steel"],
  Ground:["Fire,Electric,Poison,Rock,Steel","Grass,Bug","Flying"],
  Flying:["Grass,Fighting,Bug","Electric,Rock,Steel",""],
  Psychic:["Fighting,Poison","Psychic,Steel","Dark"],
  Bug:["Grass,Psychic,Dark","Fire,Fighting,Poison,Flying,Ghost,Steel,Fairy",""],
  Rock:["Fire,Ice,Flying,Bug","Fighting,Ground,Steel",""],
  Ghost:["Psychic,Ghost","Dark","Normal"],
  Dragon:["Dragon","Steel","Fairy"],
  Dark:["Psychic,Ghost","Fighting,Dark,Fairy",""],
  Steel:["Ice,Rock,Fairy","Fire,Water,Electric,Steel",""],
  Fairy:["Fighting,Dragon,Dark","Fire,Poison,Steel",""]
};
// Multiplicador oficial de um tipo de golpe contra UM tipo defensor: 0, 0,5, 1 ou 2
export function multTipo(tipoGolpe, tipoDef) {
  const r = CHART[tipoGolpe];
  if (!r) return 1;
  if (r[2].split(",").includes(tipoDef)) return 0;
  if (r[0].split(",").includes(tipoDef)) return 2;
  if (r[1].split(",").includes(tipoDef)) return 0.5;
  return 1;
}
// Multiplicador total contra todos os tipos do defensor (valores oficiais: 0, 0,25, 0,5, 1, 2, 4)
const MULT_MANUAL = {0:0, 0.25:0.25, 0.5:0.5, 1:1, 2:2, 4:4};
export function efetividade(tipoGolpe, tiposDefensor) {
  const r = CHART[tipoGolpe];
  if (!r) return 1;
  let m = 1;
  for (const t of tiposDefensor) {
    if (r[2].split(",").includes(t)) m = 0;
    else if (r[0].split(",").includes(t)) m *= 2;
    else if (r[1].split(",").includes(t)) m *= 0.5;
  }
  return MULT_MANUAL[m];
}
