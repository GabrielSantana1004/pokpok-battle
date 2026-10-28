// Inteligência do bot (funções puras, rodam dentro da transação da sala).
// Níveis (s.botNivel):
//   facil   golpe totalmente aleatório; só troca quando o Pokémon cai (como era antes)
//   normal  prefere o golpe de maior dano esperado (com sorte), usa golpes de status úteis, às vezes troca por desvantagem de tipo
//   dificil quase sempre o melhor golpe, sabe quando acaba com o alvo (inclusive por prioridade), troca bem e megaevolui logo
import { ativoDe, vivos, precisaTrocar, enviar, fimDeBatalha, podeTrocar, velocidade, megaBloqueada } from "./motor.js";
import { efetividade } from "./common.js";

export const BOT = "2";
export const NIVEIS = {facil: "Fácil (aleatório)", normal: "Normal", dificil: "Difícil"};
const RUIDO = {normal: 60, dificil: 4}; // quanto o acaso pode atrapalhar a escolha (em "pontos")
const azar = n => Math.random() * n;
const sorteia = a => a[Math.floor(Math.random() * a.length)];

const mult = n => n >= 0 ? (2 + n) / 2 : 2 / (2 - n);
const efet = (p, k) => Math.floor(p[k] * mult(p.est?.[k] || 0));
const ef = (m, t) => (m.efeitos || []).filter(e => e.t === t);
const resta = (q) => q.hpAtual / q.hp;

// Dano médio esperado de um golpe (sem sorte nos dados, considerando precisão, mesmo tipo, tipos e queimadura)
export function danoEsperado(A, D, m) {
  if (m.cat === "status") return 0;
  const tipoMult = efetividade(m.tipo, D.tipos);
  if (tipoMult === 0) return 0;
  const acc = (m.precisao ?? 100) / 100;
  const fixo = ef(m, "danofixo")[0];
  if (fixo) {
    if (fixo.valor) return fixo.valor * acc;
    if (fixo.nivel) return (A.nivel || 50) * acc;
    if (fixo.metade) return D.hpAtual / 2 * acc;
    if (fixo.ohko) return D.hpAtual * acc;
    return D.hpAtual * 0.2 * acc; // contra-ataques, emparelhar...
  }
  if (!(m.poder > 0)) return 0;
  const fis = m.cat === "fisico", atk = efet(A, fis ? "atk" : "spa"), def = Math.max(1, efet(D, fis ? "def" : "spd"));
  let d = (Math.floor(2 * (A.nivel || 50) / 5 + 2) * m.poder * atk / def) / 50 + 2;
  d *= 0.92 * (A.tipos.includes(m.tipo) ? 1.5 : 1) * tipoMult * acc;
  if (fis && A.cond === "queimadura") d *= 0.5;
  const mu = ef(m, "multi")[0]; if (mu) d *= (mu.min + mu.max) / 2;
  if (ef(m, "recarga").length) d *= 0.6; // perde o turno seguinte
  return d;
}

// Quanto um golpe de status vale agora (0 = inútil). "campo" e "lado" vêm da sala.
function valorStatus(s, k, A, D, m) {
  const meuLado = s.j[k].lado || {}, op = s.j[k === "1" ? "2" : "1"], opVivos = vivos(op).length;
  let v = 0;
  for (const e of m.efeitos || []) {
    switch (e.t) {
      case "estagio": {
        const stat = e.stat === "aleatorio" ? "atk" : e.stat, atual = (e.alvo === "self" ? A : D).est?.[stat] || 0;
        if (e.alvo === "self" && e.n > 0) v += atual >= 4 ? 0 : (stat === "atk" || stat === "spa" ? 38 : 24) - 11 * atual;
        else if (e.alvo !== "self" && e.n < 0) v += (stat === "atk" || stat === "spa" || stat === "spe" ? 28 : 16) + 9 * Math.min(0, atual);
        break;
      }
      case "condicao":
        if (e.alvo === "self" || D.cond || D.vol?.subst > 0) break;
        if (e.condicao === "confusao") { v += D.conf > 0 ? 0 : 22; break; }
        if ((e.condicao === "queimadura" && D.tipos.includes("Fire")) || ((e.condicao === "veneno" || e.condicao === "veneno-grave") && D.tipos.some(t => t === "Poison" || t === "Steel"))
          || (e.condicao === "paralisia" && D.tipos.includes("Electric")) || (e.condicao === "congelamento" && D.tipos.includes("Ice"))) break;
        v += e.condicao === "sono" ? 55 : e.condicao === "paralisia" ? 42 : 35; break;
      case "cura": v += resta(A) < 0.55 ? 85 - resta(A) * 60 : resta(A) > 0.9 ? -50 : 0; break;
      case "curarCond": v += A.cond ? 45 : 0; break;
      case "clima": v += s.campo?.clima ? 0 : 18; break;
      case "terreno": v += s.campo?.terreno ? 0 : 12; break;
      case "armadilha": v += opVivos > 1 && !(op.lado || {})[{rocha: "rocha", espinhos: "espinhos", venenosa: "venenosa", teia: "teia"}[e.a]] ? 34 : 0; break;
      case "tela": v += (meuLado[e.tela] > 0) ? 0 : 24; break;
      case "volatil":
        if (e.v === "substituto") v += A.vol?.subst > 0 || resta(A) < 0.3 ? 0 : 26;
        else if (e.v === "semente") v += D.vol?.semente || D.tipos.includes("Grass") ? 0 : 36;
        else v += 12;
        break;
      case "protecao": v += A.vol?.prot ? 0 : 12; break;
      default: v += 6;
    }
  }
  return m.efeitos?.length ? v : 8;
}

// Nota de cada golpe do Pokémon ativo do bot (mais alto = melhor)
export function notasGolpes(s, k = BOT) {
  const o = k === "1" ? "2" : "1", A = ativoDe(s.j[k]), D = ativoDe(s.j[o]), V = A.vol || {};
  const rapido = velocidade(A) >= velocidade(D);
  return A.mv.map((m, i) => {
    if ((V.provocar > 0 && m.cat === "status") || (V.disable && V.disable.idx === i)) return {i, nota: -999};
    if (m.cat === "status") return {i, nota: valorStatus(s, k, A, D, m)};
    const dano = danoEsperado(A, D, m);
    let nota = dano / D.hp * 100; // % do HP máximo do alvo
    if (dano === 0) return {i, nota: -5};
    if (dano >= D.hpAtual * 0.98 && (m.precisao ?? 100) >= 70) nota += 60 + ((m.prioridade || 0) > 0 && !rapido ? 40 : 0); // acaba com o alvo
    if (ef(m, "explodir").length) nota -= resta(A) > 0.3 ? 70 : 0;
    if (ef(m, "recuo").length) nota -= 6;
    return {i, nota};
  });
}

const ataque = (P, D) => Math.max(0, ...P.mv.filter(m => m.cat !== "status").map(m => (efetividade(m.tipo, D.tipos) * (P.tipos.includes(m.tipo) ? 1.5 : 1)) * ((m.poder || 40) / 80)));
const perigo = (P, D) => Math.max(...D.tipos.map(t => efetividade(t, P.tipos)));
const confronto = (P, D) => ataque(P, D) - 0.9 * perigo(P, D); // Pokémon P contra o ativo D

// Melhor substituto vivo (mais vantagem). Nível fácil: aleatório.
function escolherSubstituto(s, nivel) {
  const J = s.j[BOT], D = ativoDe(s.j[BOT === "1" ? "2" : "1"]), opc = vivos(J).filter(i => i !== J.ativo);
  if (nivel === "facil" || !opc.length) return sorteia(opc);
  return opc.map(i => ({i, n: confronto(J.equipe[i], D) + azar(RUIDO[nivel] / 20)})).sort((a, b) => b.n - a.n)[0].i;
}

// Escolha do bot na rodada: golpe (com megaevolução) ou troca estratégica
export function botEscolha(s) {
  const nivel = s.botNivel || "facil", J = s.j[BOT], A = ativoDe(J), D = ativoDe(s.j["1"]), V = A.vol || {};
  const megaForma = () => A.megas?.length && !megaBloqueada(s, J) && !A.slugMega
    ? (nivel === "facil" ? (Math.random() < 0.5 ? Math.floor(Math.random() * A.megas.length) : null)
      : A.megas.map((m, i) => ({i, t: m.atk + m.spa})).sort((a, b) => b.t - a.t)[0].i) : null;
  if (nivel === "facil") {
    const livres = A.mv.map((m, i) => i).filter(i => !(V.provocar > 0 && A.mv[i].cat === "status") && !(V.disable && V.disable.idx === i));
    const lista = livres.length ? livres : A.mv.map((m, i) => i);
    return {tipo: "golpe", idx: sorteia(lista), mega: megaForma()};
  }
  const notas = notasGolpes(s), melhor = Math.max(...notas.map(n => n.nota));
  // trocar: o ativo está em desvantagem de tipo e não tem golpe bom
  const forcado = V.recarga || V.carga != null || V.furia || V.encore;
  if (!forcado && podeTrocar(A, D) && s.botTrocou !== s.rodada - 1 && melhor < 45 && perigo(A, D) >= 2 && (A.est?.atk || 0) < 2 && (A.est?.spa || 0) < 2) {
    const opc = vivos(J).filter(i => i !== J.ativo).map(i => ({i, n: confronto(J.equipe[i], D)})).sort((a, b) => b.n - a.n);
    if (opc.length && opc[0].n > confronto(A, D) + 1 && Math.random() < (nivel === "dificil" ? 0.8 : 0.3)) { s.botTrocou = s.rodada; return {tipo: "troca", idx: opc[0].i, mega: null}; }
  }
  if (nivel === "normal" && Math.random() < 0.35) { // distração: às vezes joga qualquer golpe
    const ok = notas.filter(n => n.nota > -999); return {tipo: "golpe", idx: sorteia(ok.length ? ok : notas).i, mega: null};
  }
  const escolha = notas.map(n => ({...n, n: n.nota + azar(RUIDO[nivel])})).sort((a, b) => b.n - a.n)[0];
  const mega = A.mv[escolha.i].cat !== "status" || nivel === "dificil" ? megaForma() : null;
  return {tipo: "golpe", idx: escolha.i, mega: mega != null && (nivel === "dificil" || Math.random() < 0.7) ? mega : null};
}

// se o bot precisa de outro Pokémon (nocaute ou U-turn), manda o melhor (ou um aleatório no nível fácil)
export function botTroca(s) {
  const eu = s.j[BOT], L = [];
  for (let i = 0; i < 6 && s.bot && s.fase === "batalha" && precisaTrocar(eu); i++) { // repete se o novo Pokémon cair nas armadilhas
    enviar(s, BOT, escolherSubstituto(s, s.botNivel || "facil"), L, ativoDe(eu).hpAtual > 0 ? "trocou para" : "enviou");
    fimDeBatalha(s, L);
  }
  if (L.length) s.log = s.log.concat(L).slice(-40);
}
