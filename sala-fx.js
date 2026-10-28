// Feedback visual da batalha: barra de HP que desce devagar, números de dano/cura, tremida, desmaio e avisos (super efetivo, crítico...).
// Tudo é calculado a partir da diferença entre o passo atual e o anterior da reprodução da rodada.
import { E, persp } from "./salaestado.js";
import { ativoDe, adv } from "./motor.js";

const ult = {}; // k -> {id, hp, max} do Pokémon ativo na última tela desenhada
const idDe = (k, j) => `${k}:${j.ativo}:${ativoDe(j).nome}`;

// HTML da barra de vida: começa no HP anterior (se for o mesmo Pokémon) e o aplicarFx() a leva ao HP atual
export function barra(k, p, j) {
  const pct = p.hp ? Math.max(0, p.hpAtual / p.hp * 100) : 0, antes = ult[k] && ult[k].id === idDe(k, j) ? ult[k].hp / ult[k].max * 100 : pct;
  const nivel = pct >= 50 ? "alto" : pct >= 20 ? "medio" : "baixo";
  return `<div class="barra" data-nivel="${nivel}" role="progressbar" aria-valuenow="${p.hpAtual}" aria-valuemax="${p.hp}"><i style="width:${antes.toFixed(1)}%" data-para="${pct.toFixed(1)}"></i></div>`;
}

const spot = k => document.querySelector(k === persp() ? ".spot.eu" : ".spot.adv");
function flutuar(k, texto, classe) {
  const el = spot(k); if (!el) return;
  const f = document.createElement("span"); f.className = "flutua " + classe; f.textContent = texto;
  f.addEventListener("animationend", () => f.remove()); el.appendChild(f);
}
function impacto(el) { // clarão rápido no ponto de impacto
  const i = document.createElement("span"); i.className = "impacto"; i.addEventListener("animationend", () => i.remove()); el.appendChild(i);
}
function aviso(texto, classe) {
  const c = document.querySelector(".campo"); if (!c) return;
  const b = document.createElement("div"); b.className = "aviso-bat " + classe; b.textContent = texto;
  b.addEventListener("animationend", () => b.remove()); c.appendChild(b);
}
const AVISOS = [[/megaevoluiu/, "⚡ Megaevolução!", "mega"], [/Super efetivo/, "Super efetivo!", "super"], [/Pouco efetivo/, "Pouco efetivo…", "pouco"],
  [/crítico/, "Acerto crítico!", "crit"], [/errou!/, "Errou!", "erro"], [/não afeta/i, "Não afeta!", "erro"], [/Reviver/, "💫 Reviver!", "cura"], [/Poção/, "🧪 Poção!", "cura"]];

// chamado depois de desenhar a tela de batalha; E.s é o estado mostrado e E.reproz o passo atual (ou null)
export function aplicarFx() {
  const s = E.s, passo = E.reproz, atual = {};
  document.querySelectorAll(".barra i[data-para]").forEach(i => { void i.offsetWidth; i.style.width = i.dataset.para + "%"; }); // dispara a transição
  for (const k of ["1", "2"]) {
    const j = s.j[k], p = ativoDe(j); atual[k] = {id: idDe(k, j), hp: p.hpAtual, max: p.hp};
    const antes = ult[k];
    if (!passo || !antes || antes.id !== atual[k].id) continue;
    const d = p.hpAtual - antes.hp, el = spot(k);
    if (d < 0) { flutuar(k, "−" + -d, "dano"); if (el) { el.classList.remove("tremer"); void el.offsetWidth; el.classList.add("tremer"); impacto(el); }
      if (-d / (p.hp || 1) >= 0.3) { const c = document.querySelector(".campo"); if (c) c.classList.add("sacode"); } } // dano grande: o campo todo sacode
    else if (d > 0) flutuar(k, "+" + d, "cura");
    if (antes.hp > 0 && p.hpAtual <= 0 && el) el.classList.add("desmaiar");
  }
  if (passo) {
    const texto = passo.linhas.join(" "), el = passo.k && spot(passo.k);
    if (el && / usou /.test(passo.linhas[0] || "")) { el.classList.remove("ataca"); void el.offsetWidth; el.classList.add("ataca"); }
    const vistos = new Set(); for (const [re, t, c] of AVISOS) if (re.test(texto) && !vistos.has(c)) { vistos.add(c); aviso(t, c); if (vistos.size >= 2) break; }
  }
  Object.assign(ult, atual);
}
export const reiniciarFx = () => { for (const k of Object.keys(ult)) delete ult[k]; };
