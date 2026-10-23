// Regras da batalha (funções puras: recebem o estado da sala e o alteram).
// Visão geral do estado (tudo cabe no documento da sala):
//   s.campo            {clima:{t,n}|null, terreno:{t,n}|null, sala:n}      clima: chuva sol areia granizo neve
//   s.j[k].lado        armadilhas (rocha, espinhos, venenosa, teia), telas (reflect, luz, veu, vento, protecaoStatus, nevoa), desejo, futuro
//   s.j[k].equipe[i]   hpAtual, cond, conf, tox, sonoRest, est{} e vol{} (efeitos "voláteis": substituto, semente, preso, protegido...)
//   s.j[k].pivo        true quando o jogador precisa escolher um Pokémon para entrar (U-turn, Baton Pass)
import { REGRAS, statsFinais, calcularDano } from "./regras.js";
import { multTipo } from "./common.js";
import { golpeZ } from "./zmoves.js";

export const adv = k => k === "1" ? "2" : "1";
export const ativoDe = j => j.equipe[j.ativo];
export const vivos = j => j.equipe.map((p, i) => p.hpAtual > 0 ? i : -1).filter(i => i >= 0);
export const precisaTrocar = j => !!j && j.equipe.length > 0 &&
  ((ativoDe(j).hpAtual <= 0 && vivos(j).length > 0) || (!!j.pivo && vivos(j).some(i => i !== j.ativo)));
// preso (Wrap, Mean Look, Ingrain...) não pode trocar, a menos que seja do tipo Ghost
export const podeTrocar = P => { const v = P.vol || {}; return P.tipos.includes("Ghost") || !(v.preso > 0 || v.naoFugir || v.enraizado); };

const NOME_STAT = {atk: "Ataque", def: "Defesa", spa: "Atq. Esp.", spd: "Def. Esp.", spe: "Velocidade", prec: "Precisão", eva: "Evasão"};
const NOME_COND = {paralisia: "paralisado", queimadura: "queimado", veneno: "envenenado", "veneno-grave": "muito envenenado", sono: "dormindo", congelamento: "congelado"};
export const nomeStat = k => NOME_STAT[k] || k;
export const nomeCond = c => NOME_COND[c] || c;
export const NOME_CLIMA = {chuva: "Chuva", sol: "Sol forte", areia: "Tempestade de areia", granizo: "Granizo", neve: "Neve"};
export const NOME_TERRENO = {eletrico: "Terreno Elétrico", grama: "Terreno de Grama", nevoa: "Terreno de Névoa", psiquico: "Terreno Psíquico"};
export const NOME_VOL = {substituto: "substituto", semente: "semeado", preso: "preso", naoFugir: "sem fuga", provocar: "provocado", encore: "encore", disable: "bloqueado",
  tormento: "atormentado", foco: "concentrado", mira: "mirando", bocejo: "sonolento", aquaring: "anel de água", enraizado: "enraizado", maldicao: "amaldiçoado",
  pesadelo: "pesadelo", perish: "perish", destino: "laço do destino", carga: "preparando golpe", invul: "fora de alcance", recarga: "recarregando", furia: "em fúria", protegido: "protegido"};
const NOME_TELA = {reflect: "Reflect", luz: "Light Screen", veu: "Aurora Veil", vento: "Tailwind", protecaoStatus: "Safeguard", nevoa: "Mist"};
const NOME_ARM = {rocha: "Stealth Rock", espinhos: "Spikes", venenosa: "Toxic Spikes", teia: "Sticky Web"};
export const nomeTela = k => NOME_TELA[k] || k;
export const nomeArmadilha = k => NOME_ARM[k] || k;

export const resumoEfeitos = ef => (ef || []).map(e => {
  const q = e.alvo === "self" ? "em si" : "no alvo", ch = e.chance != null && e.chance < 100 ? ` (${e.chance}%)` : "";
  switch (e.t) {
    case "estagio": return `${e.stat === "aleatorio" ? "atributo aleatório" : NOME_STAT[e.stat]} ${e.n > 0 ? "+" : ""}${e.n} ${q}${ch}`;
    case "condicao": return `${e.condicao === "confusao" ? "confusão" : NOME_COND[e.condicao] || e.condicao} ${q}${ch}`;
    case "cura": return `cura ${Math.round(e.fracao * 100)}% do HP`;
    case "curarCond": return e.equipe ? "cura as condições da equipe" : "cura a própria condição";
    case "recuar": return `pode fazer recuar${ch}`;
    case "dreno": return `drena ${Math.round(e.fracao * 100)}% do dano`;
    case "recuo": return `recuo de ${Math.round(e.fracao * 100)}%`;
    case "multi": return `${e.min}-${e.max} golpes`;
    case "clima": return `clima: ${NOME_CLIMA[e.clima]}`;
    case "terreno": return NOME_TERRENO[e.terreno];
    case "sala": return "Trick Room";
    case "armadilha": return NOME_ARM[e.a];
    case "tela": return NOME_TELA[e.tela];
    case "protecao": return e.endure ? "sobrevive com 1 de HP" : "protege neste turno";
    case "troca": return e.modo === "forcar" ? "força a troca do alvo" : e.modo === "passar" ? "troca e passa os atributos" : "troca de Pokémon";
    case "carga": return "2 turnos";
    case "recarga": return "recarrega no turno seguinte";
    case "volatil": return `efeito: ${e.v}`;
    default: return "";
  }
}).filter(Boolean).join(", ");

const estadoInicial = () => ({est: {atk: 0, def: 0, spa: 0, spd: 0, spe: 0, prec: 0, eva: 0}, cond: null, sonoRest: 0, tox: 1, conf: 0, vol: {}});

// Cópia congelada que fica na sala: atributos FINAIS (no nível da batalha) e dados completos dos golpes.
// "mapa" traz os golpes da coleção "golpes" (versão 2: todos os golpes, com seus efeitos).
export function copiaPokemon(p, mapa = {}) {
  const nivel = Math.min(REGRAS.nivelMax, Math.max(1, Math.floor(p.nivel || REGRAS.nivel))), R = {...REGRAS, nivel}; // nível do Pokémon (padrão 50)
  const s = statsFinais(p, R);
  return {id: p.id, nome: p.nome, tipos: p.tipos, nivel, shiny: !!p.shiny, ...s,
    megas: (p.megas || []).map(m => { const f = statsFinais({...m, hp: m.hp || p.hp}, R); return {nome: m.nome, slug: m.slug, tipos: m.tipos, atk: f.atk, def: f.def, spa: f.spa, spd: f.spd, spe: f.spe}; }), // formas mega, já no nível da batalha
    base: {hp: p.hp, atk: p.atk, def: p.def, spa: p.spa, spd: p.spd, spe: p.spe},
    mv: p.mv.map(m => {
      const g = mapa[m.nome];
      if (g && g.versao >= 2) {
        if (!g.suportado) throw new Error(`O golpe ${m.nome} (${p.nome}) ainda não funciona na batalha: ${g.motivo}.`);
        return {id: g.id, nome: g.nome, tipo: g.tipo, cat: g.cat, poder: g.poder ?? null, precisao: g.precisao ?? null, prioridade: g.prioridade || 0,
          efeitos: g.efeitos || [], alvoTipo: g.alvoTipo ?? null, nota: g.nota || null};
      }
      if (m.cat === "status" || g?.cat === "status") { // golpes de status no formato antigo
        if (!g) throw new Error(`O golpe de status ${m.nome} (${p.nome}) não está na coleção de golpes.`);
        if (!g.suportado) throw new Error(`O golpe ${m.nome} (${p.nome}) ainda não funciona na batalha: ${g.motivo}.`);
        return {id: g.id, nome: g.nome, tipo: g.tipo, cat: "status", poder: null, precisao: g.precisao ?? null, prioridade: g.prioridade || 0, efeitos: g.efeitos || [], nota: g.nota || null};
      }
      if (!(m.poder > 0))
        throw new Error(`O golpe ${m.nome} (${p.nome}) ainda não tem poder cadastrado. Rode "Sincronizar golpes" (sincronizar.html).`);
      return {id: g?.id || null, nome: m.nome, tipo: m.tipo, cat: m.cat, poder: m.poder ?? null, precisao: m.precisao ?? null, prioridade: m.prioridade || 0, efeitos: []};
    }),
    hpAtual: s.hp, ...estadoInicial()};
}

// ----- dados, estágios e atalhos -----
const d6 = () => 1 + Math.floor(Math.random() * 6);
const percentil = () => { const v = Math.floor(Math.random() * 10) * 10 + Math.floor(Math.random() * 10); return v === 0 ? 100 : v; }; // 2 dados de 10 faces
const sorteio = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const mult = (n, b) => n >= 0 ? (b + n) / b : b / (b - n);   // estágios: b=2 (atributos) ou b=3 (precisão e evasão)
const est = (p, k) => p.est?.[k] || 0;
const efetivo = (p, k, n = est(p, k)) => Math.floor(p[k] * mult(n, 2));
export const velocidade = p => Math.floor(efetivo(p, "spe") * (p.cond === "paralisia" ? 0.5 : 1));
const quem = (P, k) => `${P.nome} (J${k})`;
const vol = P => P.vol || (P.vol = {});
const campoDe = s => s.campo || (s.campo = {clima: null, terreno: null, sala: 0});
const ladoDe = (s, k) => s.j[k].lado || (s.j[k].lado = {rocha: false, espinhos: 0, venenosa: 0, teia: false, reflect: 0, luz: 0, veu: 0, vento: 0, protecaoStatus: 0, nevoa: 0, desejo: null, futuro: null});
const clima = s => s.campo?.clima?.t || null;
const terreno = s => s.campo?.terreno?.t || null;
const aterrado = P => !P.tipos.includes("Flying") && !vol(P).invul;
const ef = (m, t) => (m.efeitos || []).find(e => e.t === t);
const efs = (m, t) => (m.efeitos || []).filter(e => e.t === t);
const velEm = (s, k) => velocidade(ativoDe(s.j[k])) * (ladoDe(s, k).vento > 0 ? 2 : 1);
const derrotado = (P, L) => { if (P.hpAtual === 0) L.push(`${P.nome} foi derrotado!`); };
const perder = (P, v) => { const r = Math.max(0, Math.min(P.hpAtual, v)); P.hpAtual -= r; return r; };
const curarHp = (P, v) => { const antes = P.hpAtual; P.hpAtual = Math.min(P.hp, P.hpAtual + Math.max(0, v)); return P.hpAtual - antes; };

// ----- pode agir nesta rodada? -----
function podeAgir(A, k, L, m) {
  const n = quem(A, k), V = vol(A);
  if (A.cond === "sono") {
    if (A.sonoRest > 0) { A.sonoRest--; L.push(`${n} está dormindo.`); return false; }
    A.cond = null; L.push(`${n} acordou!`);
  }
  if (A.cond === "congelamento") {
    const fogo = m && (m.tipo === "Fire" || ["scald", "steam-eruption", "scorching-sands"].includes(m.id));
    if (fogo || percentil() <= 20) { A.cond = null; L.push(`${n} descongelou!`); }
    else { L.push(`${n} está congelado e não conseguiu agir!`); return false; }
  }
  if (V.recuar) { L.push(`${n} recuou e não conseguiu agir!`); return false; }
  if (A.cond === "paralisia" && percentil() <= 25) { L.push(`${n} está paralisado e não conseguiu agir!`); return false; }
  if (A.conf > 0) {
    A.conf--;
    if (A.conf === 0) L.push(`${n} saiu da confusão!`);
    else {
      L.push(`${n} está confuso.`);
      if (percentil() <= 33) { // se machuca: golpe sem tipo, poder 40, sem crítico nem variação
        const d = Math.floor(Math.floor(Math.floor(2 * (A.nivel || REGRAS.nivel) / 5 + 2) * 40 * efetivo(A, "atk") / efetivo(A, "def")) / 50) + 2;
        perder(A, d);
        L.push(`${n} se machucou de tanta confusão: ${d} de dano.${A.hpAtual === 0 ? " " + A.nome + " foi derrotado!" : ""}`);
        return false;
      }
    }
  }
  return true;
}

// ----- efeitos de estágio, condição e cura -----
const MUDOU = n => Math.abs(n) >= 3 ? " drasticamente" : Math.abs(n) === 2 ? " bastante" : "";
function mudarEstagio(P, e, L) {
  let stat = e.stat;
  if (stat === "aleatorio") {
    const livres = ["atk", "def", "spa", "spd", "spe", "prec", "eva"].filter(x => est(P, x) < 6);
    if (!livres.length) { L.push("Nada mudou."); return; }
    stat = livres[Math.floor(Math.random() * livres.length)];
  }
  const antes = est(P, stat), novo = Math.max(-6, Math.min(6, antes + e.n));
  if (novo === antes) { L.push(`${NOME_STAT[stat]} de ${P.nome} não pode ${e.n > 0 ? "subir" : "descer"} mais!`); return; }
  P.est[stat] = novo;
  L.push(`${NOME_STAT[stat]} de ${P.nome} ${e.n > 0 ? "subiu" : "caiu"}${MUDOU(e.n)}!`);
}
const IMUNE = {queimadura: t => t.includes("Fire"), paralisia: t => t.includes("Electric"), congelamento: t => t.includes("Ice"),
  veneno: t => t.includes("Poison") || t.includes("Steel"), "veneno-grave": t => t.includes("Poison") || t.includes("Steel")};
const PO = new Set(["spore", "sleep-powder", "stun-spore", "poison-powder"]); // golpes de pó não afetam o tipo Grass
const TEXTO_COND = {paralisia: "ficou paralisado", queimadura: "se queimou", veneno: "foi envenenado", "veneno-grave": "foi gravemente envenenado", sono: "adormeceu", congelamento: "congelou"};
// k = dono do Pokémon que recebe a condição; propria = o golpe afeta quem o usou (ignora telas e terrenos de proteção)
function condicao(s, k, P, c, m, L, propria = false) {
  if (c === "confusao") {
    if (!propria && (ladoDe(s, k).protecaoStatus > 0 || (terreno(s) === "nevoa" && aterrado(P)))) { L.push(`${P.nome} está protegido contra isso.`); return false; }
    if (P.conf > 0) { L.push(`${P.nome} já está confuso!`); return false; }
    P.conf = 2 + Math.floor(Math.random() * 4); L.push(`${P.nome} ficou confuso!`); return true;
  }
  if (P.cond) { L.push(`Não teve efeito: ${P.nome} já tem uma condição.`); return false; }
  if (IMUNE[c]?.(P.tipos) || (PO.has(m?.id) && P.tipos.includes("Grass")) || (m?.id === "thunder-wave" && P.tipos.includes("Ground"))) {
    L.push(`Não afeta ${P.nome}.`); return false;
  }
  if (!propria) {
    if (ladoDe(s, k).protecaoStatus > 0) { L.push(`${P.nome} está protegido pelo Safeguard.`); return false; }
    if (terreno(s) === "nevoa" && aterrado(P)) { L.push(`O Terreno de Névoa protege ${P.nome}.`); return false; }
    if (c === "sono" && terreno(s) === "eletrico" && aterrado(P)) { L.push(`O Terreno Elétrico impede ${P.nome} de dormir.`); return false; }
  }
  if (c === "congelamento" && clima(s) === "sol") { L.push(`O sol forte impede o congelamento.`); return false; }
  P.cond = c;
  if (c === "sono") P.sonoRest = 1 + Math.floor(Math.random() * 3);
  if (c === "veneno-grave") P.tox = 1;
  L.push(`${P.nome} ${TEXTO_COND[c]}!`);
  return true;
}
function curar(P, fracao, L) {
  if (P.hpAtual >= P.hp) { L.push(`${P.nome} já está com o HP cheio!`); return; }
  L.push(`${P.nome} recuperou ${curarHp(P, Math.floor(P.hp * fracao))} de HP.`);
}

// ----- dano em um alvo (substituto, Endure) -----
function danoNoAlvo(D, valor, L, {ignoraSub = false, cat = null} = {}) {
  const V = vol(D);
  if (V.subst > 0 && !ignoraSub) {
    const real = Math.min(V.subst, valor); V.subst -= real;
    if (V.subst <= 0) { V.subst = 0; L.push(`O substituto de ${D.nome} foi destruído!`); } else L.push(`O substituto de ${D.nome} absorveu o dano.`);
    return 0;
  }
  let v = valor;
  if (V.endure && v >= D.hpAtual && D.hpAtual > 1) { v = D.hpAtual - 1; L.push(`${D.nome} aguentou o golpe com 1 de HP!`); }
  const perdido = perder(D, v);
  if (perdido > 0) V.levouDano = {cat, dano: perdido};
  return perdido;
}

// ----- saída e entrada em campo -----
export function sair(s, k) { // ao sair, perde estágios, confusão e efeitos voláteis (as condições ficam)
  const P = ativoDe(s.j[k]), O = ativoDe(s.j[adv(k)]), VO = vol(O);
  if (VO.presoPor === k) { delete VO.preso; delete VO.presoPor; }
  if (VO.naoFugirPor === k) { delete VO.naoFugir; delete VO.naoFugirPor; }
  Object.assign(P, {est: estadoInicial().est, conf: 0, vol: {}});
  if (P.cond === "veneno-grave") P.tox = 1;
}
export function entrar(s, k, L) { // chamado depois que o novo Pokémon já é o ativo: aplica armadilhas de campo
  const J = s.j[k], P = ativoDe(J), V = vol(P), lado = ladoDe(s, k), n = quem(P, k);
  V.t = 0;
  if (J.passa) { // Baton Pass
    Object.assign(P.est, J.passa.est);
    for (const c of ["subst", "semente", "foco", "aquaring", "enraizado"]) if (J.passa[c]) V[c] = J.passa[c];
    delete J.passa; L.push(`${P.nome} recebeu os efeitos passados.`);
  }
  const dano = (d, de) => { perder(P, Math.max(1, d)); L.push(`${n} sofreu ${Math.max(1, d)} de dano ${de}.${P.hpAtual === 0 ? " " + P.nome + " foi derrotado!" : ""}`); };
  if (lado.rocha) { const m = P.tipos.reduce((a, t) => a * multTipo("Rock", t), 1); dano(Math.floor(P.hp * m / 8), "das pedras pontiagudas"); }
  if (P.hpAtual > 0 && lado.espinhos > 0 && aterrado(P)) dano(Math.floor(P.hp / ({1: 8, 2: 6, 3: 4}[lado.espinhos])), "dos espinhos");
  if (P.hpAtual > 0 && lado.venenosa > 0 && aterrado(P)) {
    if (P.tipos.includes("Poison")) { lado.venenosa = 0; L.push(`${P.nome} absorveu os espinhos venenosos.`); }
    else if (!P.tipos.includes("Steel") && !P.cond) condicao(s, k, P, lado.venenosa >= 2 ? "veneno-grave" : "veneno", null, L, true);
  }
  if (P.hpAtual > 0 && lado.teia && aterrado(P)) { L.push(`${P.nome} caiu na teia!`); mudarEstagio(P, {stat: "spe", n: -1}, L); }
}
// envia o Pokémon idx para o campo (troca normal, troca forçada, Roar...)
export function enviar(s, k, idx, L, verbo = "trocou para") {
  const J = s.j[k];
  if (ativoDe(J).hpAtual > 0) sair(s, k); else { const P = ativoDe(J); P.vol = {}; P.est = estadoInicial().est; P.conf = 0; }
  J.ativo = idx; J.pivo = false;
  L.push(`Jogador ${k} ${verbo} ${ativoDe(J).nome}.`);
  entrar(s, k, L);
}

// ----- efeitos de golpes -----
const volatilTexto = {substituto: "criou um substituto", semente: "foi semeado", provocar: "foi provocado", encore: "recebeu um Encore", disable: "teve um golpe bloqueado",
  tormento: "foi atormentado", foco: "está concentrado", mira: "está mirando", bocejo: "ficou sonolento", aquaring: "se envolveu em um anel de água", enraizar: "criou raízes",
  maldicao: "foi amaldiçoado", pesadelo: "está tendo pesadelos", perish: "ouviu a canção da perdição", destino: "quer levar o adversário junto", desejo: "fez um desejo"};
function aplicarVolatil(s, k, P, v, A, L, m) {
  const V = vol(P), ko = adv(k);
  const falha = () => L.push("Mas falhou!");
  switch (v) {
    case "substituto": { const c = Math.floor(P.hp / 4); if (V.subst > 0 || P.hpAtual <= c) return falha(); P.hpAtual -= c; V.subst = c; break; }
    case "semente": if (P.tipos.includes("Grass") || V.semente) return L.push(`Não afeta ${P.nome}.`); V.semente = true; break;
    case "provocar": if (V.provocar > 0) return falha(); V.provocar = 3; break;
    case "encore": if (V.ultimo == null || V.encore) return falha(); V.encore = {n: 3, idx: V.ultimo}; break;
    case "disable": if (V.ultimo == null || V.disable) return falha(); V.disable = {n: 4, idx: V.ultimo}; break;
    case "tormento": if (V.tormento) return falha(); V.tormento = true; break;
    case "foco": if (V.foco) return falha(); V.foco = true; break;
    case "mira": V.mira = true; break;
    case "bocejo": if (V.bocejo > 0 || P.cond) return falha(); V.bocejo = 2; break;
    case "aquaring": if (V.aquaring) return falha(); V.aquaring = true; break;
    case "enraizar": if (V.enraizado) return falha(); V.enraizado = true; break;
    case "maldicao": {
      if (A.tipos.includes("Ghost")) { // Ghost paga metade do HP para amaldiçoar o alvo
        const alvo = ativoDe(s.j[ko]), VT = vol(alvo);
        if (VT.maldicao || A.hpAtual <= 1) return falha();
        perder(A, Math.floor(A.hp / 2)); VT.maldicao = true; L.push(`${alvo.nome} foi amaldiçoado!`); return;
      }
      for (const [stat, n] of [["spe", -1], ["atk", 1], ["def", 1]]) mudarEstagio(A, {stat, n}, L);
      return;
    }
    case "pesadelo": if (P.cond !== "sono" || V.pesadelo) return falha(); V.pesadelo = true; break;
    case "perish": if (V.perish > 0) return falha(); V.perish = 4; break;
    case "destino": V.destino = true; break;
    case "desejo": { const lado = ladoDe(s, k); if (lado.desejo) return falha(); lado.desejo = {n: 2, hp: Math.floor(A.hp / 2)}; break; }
    default: return falha();
  }
  L.push(`${P.nome} ${volatilTexto[v] || v}!`);
}

// aplica UM efeito. ctx = {k, A, D, m, dano (HP perdido pelo alvo), L}
function aplicarEfeito(s, e, ctx) {
  const {k, A, D, m, L} = ctx, ko = adv(k), VD = vol(D), VA = vol(A);
  if (e.chance != null && e.chance < 100 && percentil() > e.chance) return;
  const alvoEfeito = e.alvo === "self" ? A : D;
  const noOponente = e.alvo === "alvo";
  if (noOponente && ["estagio", "condicao", "volatil", "recuar", "prender"].includes(e.t) && VD.subst > 0 && m.cat === "status") { L.push("Mas o substituto bloqueou!"); return; }
  if (noOponente && ["estagio", "condicao", "volatil", "recuar", "prender"].includes(e.t) && VD.subst > 0 && D.hpAtual > 0 && ctx.sub) return; // substituto em pé: sem efeitos secundários
  if (noOponente && D.hpAtual <= 0) return;
  switch (e.t) {
    case "estagio":
      if (noOponente && e.n < 0 && ladoDe(s, ko).nevoa > 0) { L.push(`${D.nome} está protegido pela névoa.`); return; }
      mudarEstagio(alvoEfeito, e, L); break;
    case "condicao":
      condicao(s, noOponente ? ko : k, alvoEfeito, e.condicao, m, L, !noOponente); break;
    case "cura": {
      let f = e.fracao;
      if (e.clima === "padrao") f = clima(s) === "sol" ? 2 / 3 : clima(s) ? 1 / 4 : 1 / 2;
      if (e.clima === "areia") f = clima(s) === "areia" ? 2 / 3 : 1 / 2;
      curar(A, f, L); break;
    }
    case "curarCond": {
      const alvos = e.equipe ? s.j[k].equipe : [A];
      for (const P of alvos) { P.cond = null; P.sonoRest = 0; P.tox = 1; if (P === A) P.conf = 0; }
      L.push(e.equipe ? "As condições da equipe foram curadas!" : `${A.nome} curou sua condição!`); break;
    }
    case "recuar": if (!VD.agiu) VD.recuar = true; break;
    case "volatil": {
      const alvos = e.alvo === "ambos" ? [[k, A], [ko, D]] : e.alvo === "alvo" ? [[ko, D]] : [[k, A]];
      for (const [kk, P] of alvos) aplicarVolatil(s, kk, P, e.v, A, L, m);
      break;
    }
    case "clima": { const c = campoDe(s); if (c.clima?.t === e.clima) { L.push("Mas falhou!"); return; } c.clima = {t: e.clima, n: e.turnos || 5}; L.push(`${NOME_CLIMA[e.clima]} começou!`); break; }
    case "terreno": { const c = campoDe(s); if (c.terreno?.t === e.terreno) { L.push("Mas falhou!"); return; } c.terreno = {t: e.terreno, n: e.turnos || 5}; L.push(`${NOME_TERRENO[e.terreno]} cobriu o campo!`); break; }
    case "sala": { const c = campoDe(s); if (c.sala > 0) { c.sala = 0; L.push("A dimensão voltou ao normal!"); } else { c.sala = e.turnos || 5; L.push("A dimensão ficou distorcida (Trick Room)!"); } break; }
    case "armadilha": {
      const lado = ladoDe(s, ko), cheio = e.a === "espinhos" ? lado.espinhos >= 3 : e.a === "venenosa" ? lado.venenosa >= 2 : lado[e.a];
      if (cheio) { L.push("Mas falhou!"); return; }
      if (e.a === "espinhos" || e.a === "venenosa") lado[e.a]++; else lado[e.a] = true;
      L.push(`${NOME_ARM[e.a]} foi espalhado no lado do Jogador ${ko}!`); break;
    }
    case "tela": {
      const lado = ladoDe(s, k);
      if (lado[e.tela] > 0 || (e.tela === "veu" && !["granizo", "neve"].includes(clima(s)))) { L.push("Mas falhou!"); return; }
      lado[e.tela] = e.turnos || 5; L.push(`${NOME_TELA[e.tela]} protege o lado do Jogador ${k}!`); break;
    }
    case "limpar": {
      const lados = e.alvo === "ambos" ? [k, ko] : e.alvo === "alvo" ? [ko] : [k];
      if (e.o === "armadilhas") for (const kk of lados) Object.assign(ladoDe(s, kk), {rocha: false, espinhos: 0, venenosa: 0, teia: false});
      if (e.o === "telas") for (const kk of lados) { const l = ladoDe(s, kk); if (l.reflect || l.luz || l.veu) L.push("As telas foram quebradas!"); Object.assign(l, {reflect: 0, luz: 0, veu: 0}); }
      if (e.o === "estagios") { for (const kk of lados) Object.assign(ativoDe(s.j[kk]), {est: estadoInicial().est}); L.push("Todas as mudanças de atributo foram desfeitas!"); }
      break;
    }
    case "troca": {
      if (e.modo === "forcar") {
        const J = s.j[ko], opcoes = vivos(J).filter(i => i !== J.ativo);
        if (!opcoes.length || VD.subst > 0 && m.cat === "status") { L.push("Mas falhou!"); return; }
        if (VD.enraizado) { L.push(`${D.nome} está enraizado!`); return; }
        enviar(s, ko, opcoes[Math.floor(Math.random() * opcoes.length)], L, "foi puxado para");
      } else {
        const J = s.j[k];
        if (!vivos(J).some(i => i !== J.ativo)) { if (m.cat === "status") L.push("Mas falhou!"); return; }
        if (e.modo === "passar") J.passa = {est: {...A.est}, subst: VA.subst || 0, semente: !!VA.semente, foco: !!VA.foco, aquaring: !!VA.aquaring, enraizado: !!VA.enraizado};
        J.pivo = true; L.push(`${A.nome} vai voltar! O Jogador ${k} escolherá o próximo Pokémon.`);
      }
      break;
    }
    case "prender": {
      if (D.tipos.includes("Ghost")) { L.push(`Não afeta ${D.nome}.`); return; }
      const t = e.turnos;
      if (Array.isArray(t) ? t[1] > 0 : t > 0) { if (VD.preso > 0) return; VD.preso = sorteio(t[0], t[1]); VD.presoPor = k; L.push(`${D.nome} ficou preso!`); }
      else { VD.naoFugir = true; VD.naoFugirPor = k; L.push(`${D.nome} não pode mais fugir!`); }
      break;
    }
    case "descansar": {
      if (A.hpAtual >= A.hp || A.cond === "sono") { L.push("Mas falhou!"); return; }
      A.hpAtual = A.hp; A.cond = "sono"; A.sonoRest = 2; A.tox = 1; L.push(`${A.nome} dormiu e recuperou todo o HP!`); break;
    }
    case "belly": {
      const c = Math.floor(A.hp / 2);
      if (A.hpAtual <= c || est(A, "atk") >= 6) { L.push("Mas falhou!"); return; }
      perder(A, c); A.est.atk = 6; L.push(`${A.nome} perdeu metade do HP e o Ataque foi ao máximo!`); break;
    }
    case "dividirHp": { const med = Math.floor((A.hpAtual + D.hpAtual) / 2); A.hpAtual = Math.min(A.hp, med); D.hpAtual = Math.min(D.hp, med); L.push("Os dois dividiram o HP!"); break; }
    case "copiarEstagios": Object.assign(A.est, D.est); L.push(`${A.nome} copiou as mudanças de atributo de ${D.nome}!`); break;
    case "trocarEstagios": {
      const lista = e.stats === "todos" ? ["atk", "def", "spa", "spd", "spe", "prec", "eva"] : e.stats;
      for (const x of lista) { const t = A.est[x]; A.est[x] = D.est[x]; D.est[x] = t; }
      L.push("Os dois trocaram as mudanças de atributo!"); break;
    }
    default: break; // tipos tratados em outros pontos (multi, crit, danofixo, carga...)
  }
}

// ----- usar um golpe -----
const HITS_INVUL = {voo: ["gust", "twister", "thunder", "hurricane", "sky-uppercut", "smack-down", "thousand-arrows"], cavar: ["earthquake", "magnitude", "fissure", "bulldoze"],
  mergulho: ["surf", "whirlpool"], fantasma: []};
const TRATADOS_NO_DANO = new Set(["multi", "crit", "critSempre", "danofixo", "carga", "recarga", "furia", "explodir", "falhaSe", "dobrar", "poderPorEstagios", "poderPorHp",
  "climaBola", "usaDef", "defFis", "atkAlvo", "dreno", "recuo", "protecao", "futuro"]);

function acerto(s, m, A, D) { // precisão do golpe × estágios de precisão e evasão
  const VA = vol(A), cl = clima(s);
  if (m.precisao == null) return {ok: true, txt: ""};
  if (VA.mira) { VA.mira = false; return {ok: true, txt: "mira certeira"}; }
  let base = m.precisao;
  if (["thunder", "hurricane"].includes(m.id)) { if (cl === "chuva") return {ok: true, txt: ""}; if (cl === "sol") base = 50; }
  if (m.id === "blizzard" && ["granizo", "neve"].includes(cl)) return {ok: true, txt: ""};
  const ohko = ef(m, "danofixo")?.ohko;
  const ch = ohko ? base : Math.floor(base * mult(Math.max(-6, Math.min(6, est(A, "prec") - est(D, "eva"))), 3));
  if (ch >= 100) return {ok: true, txt: ""};
  const r = percentil();
  return {ok: r <= ch, txt: `precisão ${ch}%, rolou ${r}`};
}
const quantosGolpes = e => {
  if (e.min >= e.max) return e.max;
  if (e.min === 2 && e.max === 5) { const r = percentil(); return r <= 35 ? 2 : r <= 70 ? 3 : r <= 85 ? 4 : 5; }
  return sorteio(e.min, e.max);
};
const climaBola = {sol: "Fire", chuva: "Water", areia: "Rock", granizo: "Ice", neve: "Ice"};

function usar(s, k, L, ctx) {
  const ko = adv(k), J = s.j[k], A = ativoDe(J), D = ativoDe(s.j[ko]), VA = vol(A), VD = vol(D), act = ctx.act[k];
  if (A.hpAtual <= 0) return;
  if (act.tipo === "nada") { if (act.pocao) return; L.push(`${quem(A, k)} ${act.motivo}`); if (act.motivo.includes("recarregar")) VA.recarga = false; return; }
  const idx = act.idx, m = (act.z && golpeZ(A.mv[idx])) || A.mv[idx], n = quem(A, k); // golpe Z: o golpe vira o Z do mesmo tipo
  if (m.z) L.push(`💎 ${A.nome} liberou o poder Z!`);
  if (!podeAgir(A, k, L, m)) { VA.carga = null; VA.invul = null; VA.furia = null; return; }
  // restrições de Taunt, Disable e Torment
  if ((VA.provocar > 0 && m.cat === "status") || (VA.disable?.idx === idx && VA.disable.n > 0) || (VA.tormento && VA.ultimo === idx && !act.forcado)) {
    L.push(`${n} não pode usar ${m.nome} agora!`); return;
  }
  const segundoTurno = VA.carga != null;
  VA.ultimo = idx; VA.agiu = true; VA.usouProt = false;
  const q = `${n} usou ${m.nome}`;
  const carga = ef(m, "carga");
  if (carga && !segundoTurno && !(carga.sol && clima(s) === "sol")) { // primeiro turno de um golpe de 2 turnos
    VA.carga = idx; if (carga.invul) VA.invul = carga.invul;
    for (const a of carga.antes || []) aplicarEfeito(s, a, {k, A, D, m, L});
    L.push(`${q}: ${carga.invul ? "ficou fora de alcance" : "está acumulando energia"}!`); return;
  }
  if (segundoTurno) { VA.carga = null; VA.invul = null; }
  const falha = ef(m, "falhaSe");
  if (falha) {
    const ok = falha.se === "primeiroTurno" ? (VA.t || 0) === 0
      : falha.se === "naoAtacando" ? (ctx.act[ko].tipo === "golpe" && D.mv[ctx.act[ko].idx]?.cat !== "status" && !VD.agiu)
      : !VA.levouDano;
    if (!ok) { L.push(`${q}, mas falhou!`); return; }
  }
  // Protect e parecidos
  const prot = ef(m, "protecao");
  if (prot) {
    const chance = Math.floor(100 / Math.pow(3, VA.prot || 0));
    VA.usouProt = true;
    if (percentil() > chance) { VA.prot = 0; L.push(`${q}, mas falhou!`); return; }
    VA.prot = (VA.prot || 0) + 1;
    if (prot.endure) VA.endure = true; else { VA.protegido = true; VA.contatoProt = prot.contato || null; }
    L.push(`${q}: ${prot.endure ? "vai resistir" : "está protegido"}!`); return;
  }
  const dano = m.cat !== "status";
  const alveja = dano || (m.efeitos || []).some(e => e.alvo === "alvo" || (e.t === "troca" && e.modo === "forcar") || e.t === "danofixo");
  const fut = ef(m, "futuro");
  if (fut) { // Future Sight: o dano vem 2 turnos depois
    const lado = ladoDe(s, ko);
    if (lado.futuro) { L.push(`${q}, mas falhou!`); return; }
    lado.futuro = {n: fut.turnos || 3, tipo: fut.tipo, poder: fut.poder, nome: m.nome, spa: efetivo(A, "spa"), nivel: A.nivel || REGRAS.nivel, de: k, stab: A.tipos.includes(fut.tipo)};
    L.push(`${q}: ${A.nome} previu um ataque!`); return;
  }
  const ctxE = {k, A, D, m, L, sub: false};
  if (alveja) {
    const inv = VD.invul;
    if (inv && !HITS_INVUL[inv]?.includes(m.id)) { L.push(`${q}, mas ${D.nome} estava fora de alcance!`); VA.furia = null; return; }
    if (VD.protegido && !m.z && !["feint", "shadow-force", "phantom-force"].includes(m.id)) { // o golpe Z atravessa a proteção (com 25% do dano, mais abaixo)
      L.push(`${q}, mas ${D.nome} se protegeu!`);
      const c = VD.contatoProt;
      if (c && m.cat === "fisico") { // efeitos de contato dos golpes de proteção
        if (c.t === "dano") { perder(A, Math.max(1, Math.floor(A.hp * c.fracao))); L.push(`${A.nome} se machucou ao tocar em ${D.nome}.${A.hpAtual === 0 ? " " + A.nome + " foi derrotado!" : ""}`); }
        else if (c.t === "estagio") mudarEstagio(A, c, L);
        else if (c.t === "condicao") condicao(s, k, A, c.condicao, null, L, true);
      }
      VA.furia = null; return;
    }
    if (terreno(s) === "psiquico" && (m.prioridade || 0) > 0 && aterrado(D)) { L.push(`${q}, mas o Terreno Psíquico protegeu ${D.nome}!`); return; }
    if (PO.has(m.id) && D.tipos.includes("Grass")) { L.push(`${q}. Não afeta ${D.nome}.`); return; }
  }
  const ac = alveja ? acerto(s, m, A, D) : {ok: true, txt: ""};
  if (!ac.ok) { L.push(`${q} [${ac.txt}]: errou!`); VA.furia = null; return; }
  for (const e of efs(m, "limpar")) if (e.antes) aplicarEfeito(s, e, ctxE);
  if (!dano) { // ----- golpe de status -----
    L.push(`${q}${ac.txt ? " [" + ac.txt + "]" : ""}.`);
    for (const e of m.efeitos || []) if (!["carga", "falhaSe", "protecao", "futuro"].includes(e.t)) aplicarEfeito(s, e, ctxE);
    if (ef(m, "explodir")) { A.hpAtual = 0; derrotado(A, L); }
    return;
  }
  // ----- golpe de dano -----
  const T = {tipo: m.tipo, poder: m.poder};
  const cl = clima(s), te = terreno(s), fis = m.cat === "fisico";
  const dobrar = ef(m, "dobrar");
  if (ef(m, "climaBola") && cl) { T.tipo = climaBola[cl]; T.poder = 100; }
  if (ef(m, "poderPorEstagios")) T.poder = 20 + 20 * Object.values(A.est).filter(x => x > 0).reduce((a, b) => a + b, 0);
  if (ef(m, "poderPorHp")) T.poder = Math.max(1, Math.floor(150 * A.hpAtual / A.hp));
  if (dobrar) {
    const ok = {statusUser: !!A.cond, statusAlvo: !!D.cond, venenoAlvo: D.cond === "veneno" || D.cond === "veneno-grave", hpMetadeAlvo: D.hpAtual <= D.hp / 2,
      levouDano: !!VA.levouDano, agiuAntes: !!VD.agiu, sempre: true}[dobrar.se];
    if (ok) T.poder *= 2;
  }
  const imune = D.tipos.reduce((a, t) => a * multTipo(T.tipo, t), 1) === 0;
  const fixo = ef(m, "danofixo");
  const textoEf = mult => mult === 0 ? " Não afeta o alvo." : mult > 1 ? " Super efetivo!" : mult < 1 ? " Pouco efetivo." : "";
  let total = 0, golpes = 0, linhaDados = [], criticos = 0, mult_ = 1;
  if (fixo) {
    let valor = null;
    if (imune && !fixo.contra) { L.push(`${q}${ac.txt ? " [" + ac.txt + "]" : ""}: não afeta ${D.nome}.`); VA.furia = null; return; }
    if (fixo.valor) valor = fixo.valor;
    else if (fixo.nivel) valor = A.nivel || REGRAS.nivel;
    else if (fixo.metade) valor = Math.max(1, Math.floor(D.hpAtual / 2));
    else if (fixo.ohko) valor = D.hpAtual;
    else if (fixo.emparelhar) valor = D.hpAtual > A.hpAtual ? D.hpAtual - A.hpAtual : null;
    else if (fixo.userHp) valor = A.hpAtual;
    else if (fixo.contra) {
      const lv = VA.levouDano;
      if (lv && (fixo.contra === "qualquer" || lv.cat === fixo.contra)) valor = Math.max(1, Math.floor(lv.dano * fixo.mult));
    }
    if (valor == null) { L.push(`${q}, mas falhou!`); return; }
    total = danoNoAlvo(D, valor, L, {cat: m.cat}); golpes = 1;
    L.push(`${q}${ac.txt ? " [" + ac.txt + "]" : ""}: ${fixo.ohko ? "nocaute de um golpe só!" : total + " de dano fixo"} em ${D.nome}.${D.hpAtual === 0 ? " " + D.nome + " foi derrotado!" : ""}`);
  } else {
    const multi = ef(m, "multi"), n_ = multi ? quantosGolpes(multi) : 1;
    const estC = (ef(m, "crit")?.n || 0) + (VA.foco ? 2 : 0);
    const critMin = estC >= 3 ? 3 : estC === 2 ? 4 : estC === 1 ? 5 : 6;
    const critSempre = !!ef(m, "critSempre");
    const lado = ladoDe(s, ko);
    for (let i = 0; i < n_ && D.hpAtual > 0; i++) {
      const d1 = d6(), d2 = d6(), crit = critSempre || (d1 >= critMin && d2 >= critMin);
      const kaBase = ef(m, "usaDef") ? "def" : fis ? "atk" : "spa", kd = ef(m, "defFis") || fis || ef(m, "usaDef") ? "def" : "spd";
      const fonte = ef(m, "atkAlvo") ? D : A, kaFonte = ef(m, "atkAlvo") ? "atk" : kaBase;
      let def = efetivo(D, kd, crit ? Math.min(0, est(D, kd)) : est(D, kd));
      if (cl === "areia" && D.tipos.includes("Rock") && kd === "spd") def = Math.floor(def * 1.5);
      if (cl === "neve" && D.tipos.includes("Ice") && kd === "def") def = Math.floor(def * 1.5);
      let modClima = 1;
      if (cl === "chuva") modClima *= T.tipo === "Water" ? 1.5 : T.tipo === "Fire" ? 0.5 : 1;
      if (cl === "sol") modClima *= T.tipo === "Fire" ? 1.5 : T.tipo === "Water" ? 0.5 : 1;
      if (["solar-beam", "solar-blade"].includes(m.id) && ["chuva", "areia", "granizo", "neve"].includes(cl)) modClima *= 0.5;
      if (te === "eletrico" && T.tipo === "Electric" && aterrado(A)) modClima *= 1.3;
      if (te === "grama" && T.tipo === "Grass" && aterrado(A)) modClima *= 1.3;
      if (te === "psiquico" && T.tipo === "Psychic" && aterrado(A)) modClima *= 1.3;
      if (te === "nevoa" && T.tipo === "Dragon" && aterrado(D)) modClima *= 0.5;
      if (te === "grama" && ["earthquake", "bulldoze", "magnitude"].includes(m.id) && aterrado(D)) modClima *= 0.5;
      const modTela = (lado.veu > 0 || (fis ? lado.reflect : lado.luz) > 0) ? 0.5 : 1;
      const modFinal = (A.cond === "queimadura" && fis && !(dobrar?.ignoraQueimadura) ? 0.5 : 1) * (m.z && VD.protegido ? 0.25 : 1);
      const R = calcularDano({nivel: A.nivel || REGRAS.nivel, poder: T.poder,
        atk: efetivo(fonte, kaFonte, crit ? Math.max(0, est(fonte, kaFonte)) : est(fonte, kaFonte)), def,
        stab: A.tipos.includes(T.tipo), tipoGolpe: T.tipo, tiposDef: D.tipos, dados: [d1, d2], critMin, critForcado: critSempre, modClima, modTela, modFinal});
      mult_ = R.mult;
      if (R.mult === 0) { if (i === 0) { L.push(`${q}${ac.txt ? " [" + ac.txt + "]" : ""}: não afeta ${D.nome}.`); VA.furia = null; return; } break; }
      total += danoNoAlvo(D, R.dano, L, {cat: m.cat, ignoraSub: false}); golpes++;
      if (R.crit) criticos++;
      linhaDados.push(`${d1}+${d2}${R.crit ? " crítico!" : ""}`);
    }
    const extra = (A.cond === "queimadura" && fis && !dobrar?.ignoraQueimadura ? " (queimado: dano pela metade)" : "") + (multi ? ` (${golpes} golpe${golpes > 1 ? "s" : ""})` : "");
    L.push(`${q} [dados ${linhaDados.join("; ")}${ac.txt ? "; " + ac.txt : ""}]: ${total} de dano em ${D.nome}.${extra}${textoEf(mult_)}${D.hpAtual === 0 ? " " + D.nome + " foi derrotado!" : ""}`);
  }
  // consequências do golpe de dano
  const dr = ef(m, "dreno"), rc = ef(m, "recuo");
  if (dr && total > 0) { const c = curarHp(A, Math.max(1, Math.floor(total * dr.fracao))); if (c) L.push(`${A.nome} drenou ${c} de HP.`); }
  if (rc && (rc.base === "hp" || total > 0)) {
    const r = Math.max(1, Math.floor(rc.base === "hp" ? A.hp * rc.fracao : total * rc.fracao));
    perder(A, r); L.push(`${A.nome} sofreu ${r} de dano de recuo.${A.hpAtual === 0 ? " " + A.nome + " foi derrotado!" : ""}`);
  }
  if (ef(m, "recarga")) VA.recarga = true;
  const fu = ef(m, "furia");
  if (fu) {
    if (!VA.furia) VA.furia = {idx, n: (percentil() <= 50 ? 2 : 3) - 1};
    else { VA.furia.n--; if (VA.furia.n <= 0) { VA.furia = null; if (!A.conf) { A.conf = 2 + Math.floor(Math.random() * 4); L.push(`${A.nome} ficou confuso de cansaço!`); } } }
  }
  ctxE.sub = vol(D).subst > 0; // o substituto ainda está de pé: sem efeitos secundários no alvo
  for (const e of m.efeitos || []) if (!TRATADOS_NO_DANO.has(e.t) && !e.antes) aplicarEfeito(s, e, ctxE);
  if (ef(m, "explodir") && A.hpAtual > 0) { A.hpAtual = 0; derrotado(A, L); }
  if (D.hpAtual === 0 && VD.destino && A.hpAtual > 0) { A.hpAtual = 0; L.push(`${A.nome} foi levado junto pelo laço do destino!`); }
}

// ----- fim da rodada -----
function residuo(s, ordem, L) {
  const cl = clima(s), te = terreno(s);
  for (const k of ordem) {
    const P = ativoDe(s.j[k]);
    if (P.hpAtual <= 0) continue;
    const V = vol(P), n = quem(P, k), lado = ladoDe(s, k);
    const sofrer = (d, de) => { const r = perder(P, Math.max(1, d)); L.push(`${n} sofreu ${r} de dano ${de}.${P.hpAtual === 0 ? " " + P.nome + " foi derrotado!" : ""}`); };
    if (cl === "areia" && !P.tipos.some(t => ["Rock", "Ground", "Steel"].includes(t))) sofrer(Math.floor(P.hp / 16), "da tempestade de areia");
    if (cl === "granizo" && P.hpAtual > 0 && !P.tipos.includes("Ice")) sofrer(Math.floor(P.hp / 16), "do granizo");
    if (P.hpAtual > 0 && te === "grama" && aterrado(P) && P.hpAtual < P.hp) L.push(`${P.nome} recuperou ${curarHp(P, Math.floor(P.hp / 16))} de HP com o Terreno de Grama.`);
    if (P.hpAtual > 0 && lado.desejo) { lado.desejo.n--; if (lado.desejo.n <= 0) { L.push(`O desejo se realizou: ${P.nome} recuperou ${curarHp(P, lado.desejo.hp)} de HP.`); lado.desejo = null; } }
    if (P.hpAtual > 0 && V.semente) {
      const O = ativoDe(s.j[adv(k)]), r = perder(P, Math.max(1, Math.floor(P.hp / 8)));
      if (O.hpAtual > 0) curarHp(O, r);
      L.push(`${n} teve ${r} de HP drenado pela semente.${P.hpAtual === 0 ? " " + P.nome + " foi derrotado!" : ""}`);
    }
    if (P.hpAtual > 0 && (V.aquaring || V.enraizado) && P.hpAtual < P.hp) L.push(`${P.nome} recuperou ${curarHp(P, Math.max(1, Math.floor(P.hp / 16)))} de HP com as raízes ou o anel de água.`);
    if (P.hpAtual > 0) {
      if (P.cond === "queimadura") sofrer(Math.floor(P.hp / 16), "da queimadura");
      else if (P.cond === "veneno") sofrer(Math.floor(P.hp / 8), "do veneno");
      else if (P.cond === "veneno-grave") { const d = Math.max(1, Math.floor(P.hp * P.tox / 16)); P.tox = Math.min(15, P.tox + 1); sofrer(d, "do veneno grave"); }
    }
    if (P.hpAtual > 0 && V.pesadelo) { if (P.cond === "sono") sofrer(Math.floor(P.hp / 4), "do pesadelo"); else V.pesadelo = false; }
    if (P.hpAtual > 0 && V.maldicao) sofrer(Math.floor(P.hp / 4), "da maldição");
    if (P.hpAtual > 0 && V.preso > 0) { sofrer(Math.floor(P.hp / 8), "do aprisionamento"); V.preso--; if (V.preso <= 0) { delete V.presoPor; L.push(`${P.nome} se libertou!`); } }
    if (P.hpAtual > 0 && V.bocejo > 0) { V.bocejo--; if (V.bocejo === 0) { if (!P.cond) condicao(s, k, P, "sono", null, L); } }
    if (P.hpAtual > 0 && V.perish > 0) { V.perish--; if (V.perish === 0) { P.hpAtual = 0; L.push(`${n} caiu pela canção da perdição. ${P.nome} foi derrotado!`); } else L.push(`${n}: canção da perdição, ${V.perish}.`); }
  }
  // dano atrasado (Future Sight)
  for (const k of ordem) {
    const lado = ladoDe(s, k); if (!lado.futuro) continue;
    lado.futuro.n--;
    if (lado.futuro.n > 0) continue;
    const f = lado.futuro, P = ativoDe(s.j[k]); lado.futuro = null;
    if (P.hpAtual <= 0) continue;
    const R = calcularDano({nivel: f.nivel, poder: f.poder, atk: f.spa, def: efetivo(P, "spd"), stab: f.stab, tipoGolpe: f.tipo, tiposDef: P.tipos, dados: [d6(), d6()]});
    const r = R.mult === 0 ? 0 : perder(P, R.dano);
    L.push(R.mult === 0 ? `${f.nome} não afeta ${P.nome}.` : `${f.nome} atingiu ${quem(P, k)}: ${r} de dano.${P.hpAtual === 0 ? " " + P.nome + " foi derrotado!" : ""}`);
  }
}
const FIM = {chuva: "A chuva parou.", sol: "O sol voltou ao normal.", areia: "A tempestade de areia acabou.", granizo: "O granizo parou.", neve: "A neve parou.",
  eletrico: "O Terreno Elétrico sumiu.", grama: "O Terreno de Grama sumiu.", nevoa: "O Terreno de Névoa sumiu.", psiquico: "O Terreno Psíquico sumiu."};
function contadores(s, L) {
  const c = campoDe(s);
  for (const x of ["clima", "terreno"]) if (c[x]) { c[x].n--; if (c[x].n <= 0) { L.push(FIM[c[x].t]); c[x] = null; } }
  if (c.sala > 0) { c.sala--; if (c.sala === 0) L.push("A dimensão voltou ao normal."); }
  for (const k of ["1", "2"]) {
    const lado = ladoDe(s, k), P = ativoDe(s.j[k]), V = vol(P);
    for (const t of Object.keys(NOME_TELA)) if (lado[t] > 0) { lado[t]--; if (lado[t] === 0) L.push(`${NOME_TELA[t]} do Jogador ${k} acabou.`); }
    if (V.provocar > 0) { V.provocar--; if (!V.provocar) L.push(`${P.nome} não está mais provocado.`); }
    if (V.encore) { V.encore.n--; if (V.encore.n <= 0) delete V.encore; }
    if (V.disable) { V.disable.n--; if (V.disable.n <= 0) delete V.disable; }
    Object.assign(V, {recuar: false, protegido: false, endure: false, agiu: false, levouDano: null, contatoProt: null});
    if (!V.usouProt) V.prot = 0;
    V.usouProt = false; V.t = (V.t || 0) + 1;
    if (P.hpAtual <= 0) s.j[k].pivo = false;
  }
}

// decide o que cada jogador faz de fato (golpes forçados: recarga, golpe de 2 turnos, fúria, Encore; troca impedida)
function decidir(s, k, esc, L) {
  const A = ativoDe(s.j[k]), V = vol(A);
  if (esc.tipo === "pocao" || esc.tipo === "reviver") return {tipo: esc.tipo, idx: esc.idx}; // item: acontece antes dos golpes
  if (esc.tipo === "troca") {
    if (!podeTrocar(A)) return {tipo: "nada", motivo: "está preso e não pode trocar!"};
    return {tipo: "troca", idx: esc.idx};
  }
  if (V.recarga) return {tipo: "nada", motivo: "precisa recarregar!"};
  if (V.carga != null) return {tipo: "golpe", idx: V.carga, forcado: true};
  if (V.furia) return {tipo: "golpe", idx: V.furia.idx, forcado: true};
  if (V.encore && V.encore.n > 0 && A.mv[V.encore.idx]) return {tipo: "golpe", idx: V.encore.idx, forcado: true};
  return {tipo: "golpe", idx: esc.idx, z: !!esc.z}; // z: golpe Z (a sala já validou e gastou o cristal)
}

// Megaevolução: o Pokémon ativo troca de nome, tipos e atributos (o HP não muda). Cada equipe só pode megaevoluir uma vez.
// Na Torre não há limite de megas por equipe, mas só se megaevolui de novo depois que a mega anterior cair; nas outras salas é 1 por equipe.
export const megaBloqueada = (s, J) => s.torre ? J.equipe.some(q => q.slugMega && q.hpAtual > 0) : !!J.megaUsada;
function megaEvoluir(s, k, idx, L) {
  const J = s.j[k], P = ativoDe(J), m = P.megas?.[idx];
  if (!m || megaBloqueada(s, J) || P.slugMega || P.hpAtual <= 0) return;
  J.megaUsada = true;
  L.push(`${P.nome} megaevoluiu em ${m.nome}!`);
  Object.assign(P, {nome: m.nome, tipos: m.tipos, atk: m.atk, def: m.def, spa: m.spa, spd: m.spd, spe: m.spe, slugMega: m.slug});
}

export function fimDeBatalha(s, L) { // quem ficou sem Pokémon vivos
  if (s.fase === "fim") return;
  const sem = ["1", "2"].filter(k => !vivos(s.j[k]).length);
  if (sem.length === 2) { s.fase = "fim"; s.vencedor = "empate"; L.push("Os dois jogadores ficaram sem Pokémon: a batalha terminou em empate!"); }
  else if (sem.length === 1) { s.fase = "fim"; s.vencedor = adv(sem[0]); L.push(`Jogador ${s.vencedor} venceu a batalha!`); }
}

export function resolverRodada(s) {
  campoDe(s); for (const k of ["1", "2"]) { ladoDe(s, k); for (const p of s.j[k].equipe) vol(p); }
  const L = [`— Rodada ${s.rodada} —`], e = s.escolhas, rod = s.rodada;
  // "passos": a rodada dividida em ações (a tela mostra uma de cada vez); cada passo guarda a foto do estado depois dele
  const P = [], clone = o => JSON.parse(JSON.stringify(o));
  const foto = () => ({campo: clone(s.campo), j: Object.fromEntries(["1", "2"].map(k => [k, {ativo: s.j[k].ativo, lado: clone(ladoDe(s, k)),
    eq: s.j[k].equipe.map(q => ({n: q.nome, t: q.tipos, sm: q.slugMega || null, hp: q.hpAtual, cond: q.cond || null, conf: q.conf || 0, est: {...q.est}, vol: clone(vol(q))}))}]))});
  let ini = 1;
  const passo = k => { if (L.length > ini) { const f = foto(); P.push({k: k || null, linhas: L.slice(ini), snap: {...f.j, campo: f.campo}}); ini = L.length; } };
  const act = {"1": decidir(s, "1", e["1"], L), "2": decidir(s, "2", e["2"], L)};
  const ctx = {act};
  const trocar = k => { const idx = act[k].idx; enviar(s, k, idx, L); };
  const t1 = act["1"].tipo === "troca", t2 = act["2"].tipo === "troca";
  passo(null);
  for (const k of ["1", "2"]) if (act[k].tipo === "pocao" || act[k].tipo === "reviver") { // Poção ou Reviver: cura 50% do HP máximo e gasta a ação da rodada; vale antes de qualquer golpe
    const Q = s.j[k].equipe[act[k].idx], rev = act[k].tipo === "reviver", c = curarHp(Q, Math.floor(Q.hp / 2));
    if (rev) { Q.cond = null; Q.tox = 1; Q.sonoRest = 0; } // quem estava derrotado volta sem condição
    L.push(`Jogador ${k} usou ${rev ? "um Reviver" : "uma Poção"} em ${Q.nome} (+${c} HP).`); passo(k);
    act[k] = {tipo: "nada", motivo: "", pocao: true};
  }
  for (const k of ["1", "2"]) if (act[k].tipo === "golpe" && e[k].mega != null) { megaEvoluir(s, k, e[k].mega, L); passo(k); } // mega vem antes dos golpes
  if (t1 && t2) { trocar("1"); passo("1"); trocar("2"); passo("2"); }
  else if (t1 || t2) { // quem troca leva o golpe antes de sair; prioridade e Velocidade são ignoradas
    const t = t1 ? "1" : "2";
    usar(s, adv(t), L, ctx); passo(adv(t)); trocar(t); passo(t);
  } else {
    const pr = k => act[k].tipo === "golpe" && !act[k].z ? (ativoDe(s.j[k]).mv[act[k].idx].prioridade || 0) : 0; // golpe Z não tem prioridade
    const sala = s.campo.sala > 0, v1 = velEm(s, "1"), v2 = velEm(s, "2");
    let p;
    if (pr("1") !== pr("2")) p = pr("1") > pr("2") ? "1" : "2"; // maior prioridade age primeiro
    else if (v1 === v2) { p = Math.random() < 0.5 ? "1" : "2"; L.push("Empate de Velocidade: a ordem foi sorteada."); }
    else p = (v1 > v2) !== sala ? "1" : "2"; // no Trick Room o mais lento age primeiro
    usar(s, p, L, ctx); passo(p);
    if (ativoDe(s.j[adv(p)]).hpAtual > 0) { usar(s, adv(p), L, ctx); passo(adv(p)); } // derrotado não age
  }
  const ordem = ["1", "2"].sort((a, b) => (velEm(s, b) - velEm(s, a)) * (s.campo.sala > 0 ? -1 : 1));
  residuo(s, ordem, L); contadores(s, L); passo(null);
  for (const k of ["1", "2"]) for (const p of s.j[k].equipe) { p.vol = clone(vol(p)); } // garante dados simples (sem undefined) no Firestore
  s.passos = P; s.passosRod = rod;
  s.escolhas = {"1": null, "2": null}; s.rodada++;
  fimDeBatalha(s, L);
  s.log = s.log.concat(L).slice(-40);
  return s;
}
