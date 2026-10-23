// Ranking de vitórias: coleção "ranking" (um documento por conta: {nick, vitorias}), atualizada quando alguém vence.
import "./firebase.js"; // inicializa o app com o seu firebaseConfig
import { getFirestore, collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { esc, nav } from "./common.js";
import { usuario, lerStatus, VITORIAS_POR_REVIVER } from "./usuarios.js";
import { infoNivel, xpDe } from "./nivel.js";
nav();
const $ = id => document.getElementById(id);
const eu = usuario();
try {
  const s = await getDocs(query(collection(getFirestore(), "ranking"), orderBy("vitorias", "desc"), limit(50)));
  const lista = s.docs.map(d => ({chave: d.id, ...d.data()}));
  const medalha = i => ["🥇", "🥈", "🥉"][i] || i + 1;
  $("rank").innerHTML = lista.length ? `<ol class="ranking">${lista.map((r, i) => `<li class="${eu && r.chave === eu.chave ? "eu" : ""}">
      <span class="pos">${medalha(i)}</span><span class="nick">${esc(r.nick)} <small class="nv" title="${xpDe(r)} XP">Nv ${infoNivel(xpDe(r)).nivel}</small></span><span class="vit">${r.vitorias} <small>vitória${r.vitorias === 1 ? "" : "s"}</small></span></li>`).join("")}</ol>`
    : "<p>Ninguém venceu ainda. Seja o primeiro!</p>";
  if (eu && !lista.some(r => r.chave === eu.chave)) {
    const st = await lerStatus(eu.chave);
    $("rank").insertAdjacentHTML("beforeend", `<p class="nota">Você: nível ${st.nivel}, ${st.vitorias} vitória${st.vitorias === 1 ? "" : "s"}${st.vitorias ? " (fora do top 50 ou ainda não registrada)" : ""}. Próximo Reviver em ${VITORIAS_POR_REVIVER - st.vitorias % VITORIAS_POR_REVIVER} vitória(s).</p>`);
  }
} catch(e) { $("erro").textContent = "Não foi possível carregar o ranking. Confira as regras do Firestore (coleção ranking)."; $("rank").innerHTML = ""; }
