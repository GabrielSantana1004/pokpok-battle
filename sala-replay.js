// Reprodução da rodada: mostra uma ação por vez (3 s cada), com a vida/estado daquele momento.
import { E } from "./salaestado.js";

let fila = [], timer = null;

function visao() {
  const s = E.s;
  if (!E.reproz || !s) return s;
  const v = {...s, j: {...s.j}};
  for (const k of ["1", "2"]) {
    const j = s.j[k], f = E.reproz.snap[k];
    if (!j || !f || f.eq.length !== j.equipe.length) return s;
    v.j[k] = {...j, ativo: f.ativo, lado: f.lado || j.lado, equipe: j.equipe.map((q, i) => ({...q, nome: f.eq[i].n ?? q.nome, tipos: f.eq[i].t ?? q.tipos, slugMega: "sm" in f.eq[i] ? f.eq[i].sm : q.slugMega,
      hpAtual: f.eq[i].hp, cond: f.eq[i].cond, conf: f.eq[i].conf, est: f.eq[i].est, vol: f.eq[i].vol || q.vol}))};
  }
  if (E.reproz.snap.campo) v.campo = E.reproz.snap.campo;
  return v;
}
// roda fn com E.s trocado pela visão do momento (e restaura depois)
export function com(fn) { const real = E.s; E.s = visao(); try { fn(); } finally { E.s = real; } }

export function proximoPasso() {
  clearTimeout(timer);
  E.reproz = fila.shift() || null;
  if (E.s) E.render();
  if (E.reproz) timer = setTimeout(proximoPasso, 3000);
}
export function enfileirar(passos) { fila.push(...passos); if (!E.reproz) proximoPasso(); }
export function pararReplay() { clearTimeout(timer); }
