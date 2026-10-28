// Regras da batalha (funções puras: recebem o estado da sala e o alteram).
// Visão geral do estado (tudo cabe no documento da sala):
//   s.campo            {clima:{t,n}|null, terreno:{t,n}|null, sala:n}      clima: chuva sol areia granizo neve
//   s.j[k].lado        armadilhas (rocha, espinhos, venenosa, teia), telas (reflect, luz, veu, vento, protecaoStatus, nevoa), desejo, futuro
//   s.j[k].equipe[i]   hpAtual, cond, conf, tox, sonoRest, est{} e vol{} (efeitos "voláteis": substituto, semente, preso, protegido...)
//   s.j[k].pivo        true quando o jogador precisa escolher um Pokémon para entrar (U-turn, Baton Pass)
import { REGRAS, statsFinais, calcularDano } from "./regras.js";
import { multTipo } from "./common.js";
import { golpeZ } from "./zmoves.js";
import { itemId, multStatItem, danoItemMult, extensao, ehBaga, BAGA_TIPO, GEMA_TIPO, BAGA_ESPERA, ehEscolha, itemPorId } from "./itens.js";
import { habCtx, contatoDe, ehVento, ehSom, ehSoco, habId, multStat, imuneHab, tipoAte, quebraHabilidade, poderMult, efeitoSecundario, danoFinalMult, precisaoHab, bonusPrioridade, bloqueiaCond, bloqueiaQueda, imuneIntimidacao, temContato, CLIMA_HAB, TERRENO_HAB } from "./habilidades.js";

export const adv = k => k === "1" ? "2" : "1";
export const ativoDe = j => j.equipe[j.ativo];
export const vivos = j => j.equipe.map((p, i) => p.hpAtual > 0 ? i : -1).filter(i => i >= 0);
export const precisaTrocar = j => !!j && j.equipe.length > 0 &&
  ((ativoDe(j).hpAtual <= 0 && vivos(j).length > 0) || (!!j.pivo && vivos(j).some(i => i !== j.ativo)));
// preso (Wrap, Mean Look, Ingrain...) não pode trocar, a menos que seja do tipo Ghost
export const podeTrocar = (P, O = null) => { // O = Pokémon adversário em campo (Shadow Tag e Magnet Pull prendem)
  const v = P.vol || {};
  if (P.tipos.includes("Ghost") || P.item?.id === "shed-shell") return true;
  const hO = O && O.hpAtual > 0 ? habId(O) : null;
  if ((hO === "shadow-tag" && habId(P) !== "shadow-tag") || (hO === "magnet-pull" && P.tipos.includes("Steel"))) return false;
  return !(v.preso > 0 || v.naoFugir || v.enraizado);
};

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
  return {id: p.id, nome: p.nome, tipos: p.tipos, nivel, shiny: !!p.shiny, habilidade: p.habilidade ? {id: p.habilidade.id, nome: p.habilidade.nome} : null, item: p.item ? {id: p.item.id, nome: p.item.nome} : null, itemUsado: null, ...s,
    megas: (p.megas || []).map(m => { const f = statsFinais({...m, hp: m.hp || p.hp}, R); return {nome: m.nome, slug: m.slug, tipos: m.tipos, habilidade: m.habilidade ? {id: m.habilidade.id, nome: m.habilidade.nome} : null, atk: f.atk, def: f.def, spa: f.spa, spd: f.spd, spe: f.spe}; }), // formas mega, já no nível da batalha
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
// habilidade em vigor: o Mold Breaker (e parecidas) ignora a habilidade do alvo durante o golpe
let QUEBRA_ALVO = null;
let ATK = null; // quem está agindo agora (Mirror Armor reflete para ele; Corrosion usa a habilidade dele)
const hab = P => P === QUEBRA_ALVO ? null : habId(P);
const semClima = s => ["1", "2"].some(k => { const P = s.j?.[k]?.equipe?.[s.j[k].ativo]; return P?.hpAtual > 0 && ["cloud-nine", "air-lock"].includes(habId(P)); });
const clima = s => semClima(s) ? null : (s.campo?.clima?.t || null);
const terreno = s => s.campo?.terreno?.t || null;
const climaDe = (s, A) => habId(A) === "mega-sol" ? "sol" : clima(s); // Mega Sol: os golpes de quem tem agem como se houvesse sol
const aterrado = P => !P.tipos.includes("Flying") && hab(P) !== "levitate" && hab(P) !== "eelevate" && itemId(P) !== "air-balloon" && !vol(P).invul;
const ef = (m, t) => (m.efeitos || []).find(e => e.t === t);
const efs = (m, t) => (m.efeitos || []).filter(e => e.t === t);
const envDe = s => ({clima: clima(s), terreno: terreno(s)});
const msd = (s, P, stat) => (P === QUEBRA_ALVO ? 1 : multStat(P, stat, envDe(s))) * multStatItem(P, stat); // multiplicador de atributo pela habilidade e pelo item
const velEm = (s, k) => Math.floor(velocidade(ativoDe(s.j[k])) * multStat(ativoDe(s.j[k]), "spe", envDe(s)) * multStatItem(ativoDe(s.j[k]), "spe")) * (ladoDe(s, k).vento > 0 ? 2 : 1);
const derrotado = (P, L) => { if (P.hpAtual === 0) L.push(`${P.nome} foi derrotado!`); };
const perder = (P, v) => { const r = Math.max(0, Math.min(P.hpAtual, v)); P.hpAtual -= r; if (r > 0) vol(P).feridoTurno = true; return r; }; // feridoTurno: Assurance
const curarHp = (P, v) => { const antes = P.hpAtual; P.hpAtual = Math.min(P.hp, P.hpAtual + Math.max(0, v)); return P.hpAtual - antes; };

// ----- itens segurados: gastar (o item some só desta batalha) -----
function gastarItem(P, L, texto) {
  const i = P.item; if (!i) return;
  P.item = null; P.itemUsado = i.id; if (ehBaga(i.id)) P.comeuBaga = true; L.push(texto || `${P.nome} usou ${i.nome}!`);
  if (ehBaga(i.id) && habId(P) === "cheek-pouch" && P.hpAtual > 0 && P.hpAtual < P.hp) L.push(`${P.nome} recuperou ${curarHp(P, Math.floor(P.hp / 3))} de HP (Cheek Pouch).`);
}
const roubar = (de, para, L, quem) => { const i = de.item; para.item = i; de.item = null; de.itemUsado = i.id; L.push(`${quem} roubou ${i.nome} de ${de.nome}!`); };

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
  if (V.recuar) { L.push(`${n} recuou e não conseguiu agir!`); if (habId(A) === "steadfast") { L.push(`${A.nome}: Steadfast!`); mudarEstagio(A, {stat: "spe", n: 1}, L); } return false; }
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
// op = o efeito vem do adversário (Clear Body, Hyper Cutter, Competitive e Defiant só reagem a isso)
function mudarEstagio(P, e, L, op = false) {
  const h = hab(P);
  let n = e.n; if (h === "contrary") n = -n; else if (h === "simple") n *= 2;
  let stat = e.stat;
  if (stat === "aleatorio") {
    const livres = ["atk", "def", "spa", "spd", "spe", "prec", "eva"].filter(x => est(P, x) < 6);
    if (!livres.length) { L.push("Nada mudou."); return; }
    stat = livres[Math.floor(Math.random() * livres.length)];
  }
  if (op && n < 0 && h === "mirror-armor" && ATK && ATK !== P && ATK.hpAtual > 0 && habId(ATK) !== "mirror-armor") { L.push(`${P.nome}: Mirror Armor! A queda foi refletida para ${ATK.nome}.`); mudarEstagio(ATK, {stat, n: e.n}, L, true); return; }
  if (op && n < 0 && itemId(P) === "clear-amulet") { L.push(`${P.nome}: Clear Amulet impede a queda de ${NOME_STAT[stat]}!`); return; }
  if (op && n < 0 && bloqueiaQueda(h, stat)) { L.push(`${P.nome}: ${P.habilidade.nome} impede a queda de ${NOME_STAT[stat]}!`); return; }
  const antes = est(P, stat), novo = Math.max(-6, Math.min(6, antes + n));
  if (novo === antes) { L.push(`${NOME_STAT[stat]} de ${P.nome} não pode ${n > 0 ? "subir" : "descer"} mais!`); return; }
  P.est[stat] = novo;
  L.push(`${NOME_STAT[stat]} de ${P.nome} ${n > 0 ? "subiu" : "caiu"}${MUDOU(n)}!`);
  if (op && n < 0 && itemId(P) === "eject-pack") vol(P).ejetar = true;
  if (op && n < 0 && (h === "competitive" || h === "defiant")) { L.push(`${P.nome}: ${P.habilidade.nome}!`); mudarEstagio(P, {stat: h === "defiant" ? "atk" : "spa", n: 2}, L); }
}
const IMUNE = {queimadura: t => t.includes("Fire"), paralisia: t => t.includes("Electric"), congelamento: t => t.includes("Ice"),
  veneno: t => t.includes("Poison") || t.includes("Steel"), "veneno-grave": t => t.includes("Poison") || t.includes("Steel")};
const PO = new Set(["spore", "sleep-powder", "stun-spore", "poison-powder", "cotton-spore"]); // golpes de pó não afetam o tipo Grass
const TEXTO_COND = {paralisia: "ficou paralisado", queimadura: "se queimou", veneno: "foi envenenado", "veneno-grave": "foi gravemente envenenado", sono: "adormeceu", congelamento: "congelou"};
// k = dono do Pokémon que recebe a condição; propria = o golpe afeta quem o usou (ignora telas e terrenos de proteção)
function condicao(s, k, P, c, m, L, propria = false) {
  if (bloqueiaCond(hab(P), c, clima(s))) { L.push(`${P.nome}: ${P.habilidade.nome} impede isso!`); return false; }
  if (c === "confusao") {
    if (!propria && (ladoDe(s, k).protecaoStatus > 0 || (terreno(s) === "nevoa" && aterrado(P)))) { L.push(`${P.nome} está protegido contra isso.`); return false; }
    if (P.conf > 0) { L.push(`${P.nome} já está confuso!`); return false; }
    P.conf = 2 + Math.floor(Math.random() * 4); L.push(`${P.nome} ficou confuso!`); return true;
  }
  if (P.cond) { L.push(`Não teve efeito: ${P.nome} já tem uma condição.`); return false; }
  const corrosivo = ATK && habId(ATK) === "corrosion" && (c === "veneno" || c === "veneno-grave"); // Corrosion envenena Steel e Poison
  if ((IMUNE[c]?.(P.tipos) && !corrosivo) || (PO.has(m?.id) && (P.tipos.includes("Grass") || itemId(P) === "safety-goggles")) || (m?.id === "thunder-wave" && P.tipos.includes("Ground"))) {
    L.push(`Não afeta ${P.nome}.`); return false;
  }
  if (!propria) {
    if (ladoDe(s, k).protecaoStatus > 0) { L.push(`${P.nome} está protegido pelo Safeguard.`); return false; }
    if (terreno(s) === "nevoa" && aterrado(P)) { L.push(`O Terreno de Névoa protege ${P.nome}.`); return false; }
    if (c === "sono" && terreno(s) === "eletrico" && aterrado(P)) { L.push(`O Terreno Elétrico impede ${P.nome} de dormir.`); return false; }
  }
  if (c === "congelamento" && clima(s) === "sol") { L.push(`O sol forte impede o congelamento.`); return false; }
  const puppeteer = ATK && ATK !== P && habId(ATK) === "poison-puppeteer" && (c === "veneno" || c === "veneno-grave");
  P.cond = c;
  if (c === "sono") { P.sonoRest = 1 + Math.floor(Math.random() * 3); if (habId(P) === "early-bird") P.sonoRest = Math.max(1, Math.floor(P.sonoRest / 2)); } // Early Bird: dorme metade
  if (c === "veneno-grave") P.tox = 1;
  L.push(`${P.nome} ${TEXTO_COND[c]}!`);
  if (!propria && ["queimadura", "paralisia", "veneno", "veneno-grave"].includes(c) && habId(P) === "synchronize") { // Synchronize devolve a condição
    const kO = adv(k), O = ativoDe(s.j[kO]);
    if (O.hpAtual > 0 && !O.cond) { L.push(`${P.nome}: Synchronize!`); condicao(s, kO, O, c, null, L, true); }
  }
  if (puppeteer && P.hpAtual > 0) { L.push(`${ATK.nome}: Poison Puppeteer!`); condicao(s, k, P, "confusao", null, L, true); }
  return true;
}
function curar(P, fracao, L) {
  if (P.hpAtual >= P.hp) { L.push(`${P.nome} já está com o HP cheio!`); return; }
  L.push(`${P.nome} recuperou ${curarHp(P, Math.floor(P.hp * fracao))} de HP.`);
}

// ----- dano em um alvo (substituto, Endure) -----
function danoNoAlvo(D, valor, L, {ignoraSub = false, cat = null, deixa1 = false} = {}) {
  const V = vol(D);
  if (V.subst > 0 && !ignoraSub) {
    const real = Math.min(V.subst, valor); V.subst -= real;
    if (V.subst <= 0) { V.subst = 0; L.push(`O substituto de ${D.nome} foi destruído!`); } else L.push(`O substituto de ${D.nome} absorveu o dano.`);
    return 0;
  }
  let v = valor;
  if (deixa1 && v >= D.hpAtual && D.hpAtual > 1) { v = D.hpAtual - 1; L.push(`${D.nome} aguentou o golpe com 1 de HP!`); } // False Swipe
  const sturdy = hab(D) === "sturdy" && D.hpAtual === D.hp;
  if (v >= D.hpAtual && D.hpAtual > 1) {
    const faixa = itemId(D) === "focus-sash" && D.hpAtual === D.hp, banda = itemId(D) === "focus-band" && percentil() <= 10;
    if (V.endure || sturdy || faixa || banda) {
      v = D.hpAtual - 1;
      if (V.endure) L.push(`${D.nome} aguentou o golpe com 1 de HP!`);
      else if (sturdy) L.push(`${D.nome} aguentou o golpe com 1 de HP graças ao Sturdy!`);
      else { L.push(`${D.nome} aguentou o golpe com 1 de HP graças ao ${D.item.nome}!`); if (faixa) { D.item = null; D.itemUsado = "focus-sash"; } }
    }
  }
  const perdido = perder(D, v);
  if (perdido > 0) V.levouDano = {cat, dano: perdido};
  return perdido;
}

// Stance Change (Aegislash): Blade Forme troca Atk<->Def e AtkEsp<->DefEsp; Zen Mode (Darmanitan): abaixo de metade do HP vira Psychic com Atk<->AtkEsp e Def/DefEsp +nível
const trocaLamina = P => { [P.atk, P.def] = [P.def, P.atk]; [P.spa, P.spd] = [P.spd, P.spa]; P.lamina = !P.lamina; };
function zenDesfaz(P) { [P.atk, P.spa] = [P.spa, P.atk]; P.def -= P.nivel; P.spd -= P.nivel; if (P.zenTipo) P.tipos = P.tipos.filter(t => t !== "Psychic"); P.zen = false; delete P.zenTipo; }
function zen(P, L) {
  if (P.hpAtual <= 0 || habId(P) !== "zen-mode") return;
  if (!P.zen && P.hpAtual * 2 <= P.hp) { P.zen = true; [P.atk, P.spa] = [P.spa, P.atk]; P.def += P.nivel; P.spd += P.nivel; if (!P.tipos.includes("Psychic")) { P.tipos = [...P.tipos, "Psychic"]; P.zenTipo = true; } L.push(`${P.nome}: Zen Mode! Entrou em transe.`); }
  else if (P.zen && P.hpAtual * 2 > P.hp) { zenDesfaz(P); L.push(`${P.nome} saiu do transe.`); }
}
const gasOn = s => ["1", "2"].some(k => { const P = ativoDe(s.j[k]); return P && P.hpAtual > 0 && P.habilidade?.id === "neutralizing-gas"; });
const comGas = (s, f) => { const antes = habCtx.gas; habCtx.gas = gasOn(s); try { return f(); } finally { habCtx.gas = antes; } };
const deltaAtivo = s => ["1", "2"].some(k => { const P = ativoDe(s.j[k]); return P && P.hpAtual > 0 && habId(P) === "delta-stream"; });

// ----- saída e entrada em campo -----
export function sair(s, k) { // ao sair, perde estágios, confusão e efeitos voláteis (as condições ficam)
  const P = ativoDe(s.j[k]), O = ativoDe(s.j[adv(k)]), VO = vol(O);
  if (P.hpAtual > 0) { // Natural Cure cura a condição; Regenerator recupera 1/3 do HP
    if (habId(P) === "natural-cure" && P.cond) { P.cond = null; P.tox = 1; P.sonoRest = 0; }
    if (habId(P) === "regenerator") curarHp(P, Math.floor(P.hp / 3));
  }
  if (VO.presoPor === k) { delete VO.preso; delete VO.presoPor; }
  if (VO.naoFugirPor === k) { delete VO.naoFugir; delete VO.naoFugirPor; }
  if (P.habOriginal) { P.habilidade = P.habOriginal; delete P.habOriginal; } // Trace volta ao normal ao sair
  if (P.lamina) { trocaLamina(P); }
  if (P.zen) zenDesfaz(P);
  Object.assign(P, {est: estadoInicial().est, conf: 0, vol: {}});
  if (P.cond === "veneno-grave") P.tox = 1;
}
export function entrar(s, k, L) { // chamado depois que o novo Pokémon já é o ativo: aplica armadilhas de campo
  const J = s.j[k], P = ativoDe(J), V = vol(P), lado = ladoDe(s, k), n = quem(P, k);
  V.t = 0;
  const botas = itemId(P) === "heavy-duty-boots"; // ignora os perigos de campo
  if (J.passa) { // Baton Pass
    Object.assign(P.est, J.passa.est);
    for (const c of ["subst", "semente", "foco", "aquaring", "enraizado"]) if (J.passa[c]) V[c] = J.passa[c];
    delete J.passa; L.push(`${P.nome} recebeu os efeitos passados.`);
  }
  const dano = (d, de) => { perder(P, Math.max(1, d)); L.push(`${n} sofreu ${Math.max(1, d)} de dano ${de}.${P.hpAtual === 0 ? " " + P.nome + " foi derrotado!" : ""}`); };
  if (!botas && lado.rocha) { const m = P.tipos.reduce((a, t) => a * multTipo("Rock", t), 1); dano(Math.floor(P.hp * m / 8), "das pedras pontiagudas"); }
  if (!botas && P.hpAtual > 0 && lado.espinhos > 0 && aterrado(P)) dano(Math.floor(P.hp / ({1: 8, 2: 6, 3: 4}[lado.espinhos])), "dos espinhos");
  if (!botas && P.hpAtual > 0 && lado.venenosa > 0 && aterrado(P)) {
    if (P.tipos.includes("Poison")) { lado.venenosa = 0; L.push(`${P.nome} absorveu os espinhos venenosos.`); }
    else if (!P.tipos.includes("Steel") && !P.cond) condicao(s, k, P, lado.venenosa >= 2 ? "veneno-grave" : "veneno", null, L, true);
  }
  if (!botas && P.hpAtual > 0 && lado.teia && aterrado(P)) { L.push(`${P.nome} caiu na teia!`); mudarEstagio(P, {stat: "spe", n: -1}, L, true); }
  aoEntrar(s, k, L);
  verificarItens(s, L);
}
// habilidades que agem quando o Pokémon entra em campo (também usado ao megaevoluir e no começo da batalha)
function aoEntrar(s, k, L) {
  const P = ativoDe(s.j[k]), O = ativoDe(s.j[adv(k)]); if (!P || P.hpAtual <= 0 || !P.habilidade) return;
  const h = habId(P), c = campoDe(s), nome = P.habilidade.nome;
  const cl = CLIMA_HAB[h], te = TERRENO_HAB[h];
  if (cl && c.clima?.t !== cl) { c.clima = {t: cl, n: 5 + extensao(P, "clima", cl)}; L.push(`${P.nome}: ${nome}! ${NOME_CLIMA[cl]} começou!`); }
  if (te && c.terreno?.t !== te) { c.terreno = {t: te, n: 5 + extensao(P, "terreno")}; L.push(`${P.nome}: ${nome}! ${NOME_TERRENO[te]} cobriu o campo!`); }
  if (h === "pressure") L.push(`${P.nome} está exercendo pressão!`);
  if (h === "dauntless-shield" && !P.entrouUnico) { P.entrouUnico = true; L.push(`${P.nome}: Dauntless Shield!`); mudarEstagio(P, {stat: "def", n: 1}, L); }
  if (h === "intrepid-sword" && !P.entrouUnico) { P.entrouUnico = true; L.push(`${P.nome}: Intrepid Sword!`); mudarEstagio(P, {stat: "atk", n: 1}, L); }
  if (h === "supersweet-syrup" && !P.entrouUnico && O?.hpAtual > 0) { P.entrouUnico = true; L.push(`${P.nome}: Supersweet Syrup!`); ATK = P; try { mudarEstagio(O, {stat: "eva", n: -1}, L, true); } finally { ATK = null; } }
  if (h === "soul-heart") P.sh = ["1", "2"].reduce((a, kk) => a + s.j[kk].equipe.filter(q => q.hpAtual <= 0).length, 0);
  if (h === "neutralizing-gas") L.push(`${P.nome}: Neutralizing Gas! As outras habilidades pararam de funcionar.`);
  if (h === "delta-stream") { c.clima = null; L.push(`${P.nome}: Delta Stream! Ventos fortes protegem os Pokémon Flying.`); }
  if (h === "download" && O?.hpAtual > 0) { const st = efetivo(O, "def") < efetivo(O, "spd") ? "atk" : "spa"; L.push(`${P.nome}: Download!`); mudarEstagio(P, {stat: st, n: 1}, L); }
  if (h === "forewarn" && O?.hpAtual > 0) { const f = [...O.mv].sort((a, b) => (b.poder || (ef(b, "danofixo") ? 80 : 0)) - (a.poder || (ef(a, "danofixo") ? 80 : 0)))[0]; if (f) L.push(`${P.nome}: Forewarn! ${O.nome} tem ${f.nome}.`); }
  if (h === "anticipation" && O?.hpAtual > 0 && O.mv.some(x => x.cat !== "status" && (ef(x, "danofixo")?.ohko || P.tipos.reduce((a, t) => a * multTipo(x.tipo, t), 1) > 1))) L.push(`${P.nome}: Anticipation! Estremeceu.`);
  if (h === "trace" && O?.hpAtual > 0 && O.habilidade && !["trace", "illusion", "multitype", "disguise", "stance-change", "rks-system", "neutralizing-gas", "zen-mode", "power-of-alchemy", "receiver"].includes(O.habilidade.id)) {
    P.habOriginal = P.habOriginal || P.habilidade; P.habilidade = {...O.habilidade}; L.push(`${P.nome}: Trace! Copiou ${O.habilidade.nome}.`); aoEntrar(s, k, L); return;
  }
  if (h === "frisk" && O?.hpAtual > 0 && O.item) L.push(`${P.nome}: Frisk! ${O.nome} segura ${O.item.nome}.`);
  if (h === "intimidate" && O && O.hpAtual > 0) {
    if (vol(O).subst > 0) L.push(`${P.nome}: Intimidate, mas o substituto de ${O.nome} protege!`);
    else if (imuneIntimidacao(habId(O)) && habId(O) !== "clear-body" && habId(O) !== "hyper-cutter" && habId(O) !== "white-smoke" && habId(O) !== "full-metal-body") L.push(`${P.nome}: Intimidate, mas ${O.habilidade.nome} de ${O.nome} o protege!`);
    else { L.push(`${P.nome}: Intimidate!`); ATK = P; try { mudarEstagio(O, {stat: "atk", n: -1}, L, true); } finally { ATK = null; } }
  }
}
// começo da batalha: quem é mais rápido entra primeiro
export const iniciarBatalha = (s, L) => comGas(s, () => iniciarBatalhaBase(s, L));
function iniciarBatalhaBase(s, L) {
  campoDe(s); for (const k of ["1", "2"]) { ladoDe(s, k); for (const p of s.j[k].equipe) vol(p); }
  const ordem = ["1", "2"].sort((a, b) => velEm(s, b) - velEm(s, a));
  for (const k of ordem) aoEntrar(s, k, L);
}
export const entrarEmCampo = (s, k, L) => comGas(s, () => entrarEmCampoBase(s, k, L));
const entrarEmCampoBase = (s, k, L) => { campoDe(s); ladoDe(s, k); for (const p of s.j[k].equipe) vol(p); aoEntrar(s, k, L); };
// envia o Pokémon idx para o campo (troca normal, troca forçada, Roar...)
export const enviar = (s, k, idx, L, verbo = "trocou para") => comGas(s, () => enviarBase(s, k, idx, L, verbo));
function enviarBase(s, k, idx, L, verbo = "trocou para") {
  const J = s.j[k];
  if (ativoDe(J).hpAtual > 0) sair(s, k); else { const P = ativoDe(J); P.vol = {}; P.est = estadoInicial().est; P.conf = 0; }
  J.ativo = idx; J.pivo = false; if (verbo === "foi puxado para") J.puxado = s.rodada; // quem foi puxado (Roar, Dragon Tail, Red Card) antes de agir perde a ação da rodada
  L.push(`Jogador ${k} ${verbo} ${ativoDe(J).nome}.`);
  entrar(s, k, L);
}

// ----- efeitos de golpes -----
const volatilTexto = {substituto: "criou um substituto", semente: "foi semeado", provocar: "foi provocado", encore: "recebeu um Encore", disable: "teve um golpe bloqueado",
  tormento: "foi atormentado", foco: "está concentrado", mira: "está mirando", bocejo: "ficou sonolento", aquaring: "se envolveu em um anel de água", enraizar: "criou raízes",
  maldicao: "foi amaldiçoado", pesadelo: "está tendo pesadelos", perish: "ouviu a canção da perdição", destino: "quer levar o adversário junto", desejo: "fez um desejo", carregado: "está carregado de eletricidade", salgado: "foi coberto de sal"};
function aplicarVolatil(s, k, P, v, A, L, m) {
  const V = vol(P), ko = adv(k);
  const falha = () => L.push("Mas falhou!");
  switch (v) {
    case "substituto": { const c = Math.floor(P.hp / 4); if (V.subst > 0 || P.hpAtual <= c) return falha(); P.hpAtual -= c; V.subst = c; break; }
    case "semente": if (P.tipos.includes("Grass") || V.semente) return L.push(`Não afeta ${P.nome}.`); V.semente = true; break;
    case "provocar": if (hab(P) === "oblivious") return L.push(`${P.nome}: Oblivious impede isso!`); if (V.provocar > 0) return falha(); V.provocar = 3; break;
    case "encore": if (V.ultimo == null || V.encore) return falha(); V.encore = {n: 3, idx: V.ultimo}; break;
    case "disable": if (V.ultimo == null || V.disable) return falha(); V.disable = {n: 4, idx: V.ultimo}; break;
    case "tormento": if (V.tormento) return falha(); V.tormento = true; break;
    case "foco": if (V.foco) return falha(); V.foco = true; break;
    case "mira": V.mira = true; break;
    case "bocejo": if (V.bocejo > 0 || P.cond || bloqueiaCond(hab(P), "sono", clima(s))) return falha(); V.bocejo = 2; break;
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
    case "carregado": V.carregado = true; break;
    case "salgado": if (V.salgado) return falha(); V.salgado = true; break;
    case "desejo": { const lado = ladoDe(s, k); if (lado.desejo) return falha(); lado.desejo = {n: 2, hp: Math.floor(A.hp / 2)}; break; }
    default: return falha();
  }
  L.push(`${P.nome} ${volatilTexto[v] || v}!`);
}

// aplica UM efeito. ctx = {k, A, D, m, dano (HP perdido pelo alvo), L}
function aplicarEfeito(s, e, ctx) {
  const {k, A, D, m, L} = ctx, ko = adv(k), VD = vol(D), VA = vol(A);
  const alvoEfeito = e.alvo === "self" ? A : D;
  const noOponente = e.alvo === "alvo";
  if (noOponente && itemId(D) === "covert-cloak" && m.cat !== "status" && ["estagio", "condicao", "volatil", "recuar"].includes(e.t)) return; // Covert Cloak
  if (e.chance != null && e.chance < 100) {
    if (noOponente && hab(D) === "shield-dust" && efeitoSecundario(e)) return;
    if (percentil() > (habId(A) === "serene-grace" ? e.chance * 2 : e.chance)) return;
  }
  if (noOponente && ["estagio", "condicao", "volatil", "recuar", "prender"].includes(e.t) && VD.subst > 0 && m.cat === "status") { L.push("Mas o substituto bloqueou!"); return; }
  if (noOponente && ["estagio", "condicao", "volatil", "recuar", "prender"].includes(e.t) && VD.subst > 0 && D.hpAtual > 0 && ctx.sub) return; // substituto em pé: sem efeitos secundários
  if (noOponente && D.hpAtual <= 0) return;
  if (e.seAlvoSubiu && !Object.values(D.est).some(v => v > 0)) return; // Burning Jealousy, Alluring Voice: só se o alvo tem atributos elevados
  switch (e.t) {
    case "estagio":
      if (e.solDobra && clima(s) === "sol") e = {...e, n: e.n * 2}; // Growth
      if (noOponente && e.n < 0 && ladoDe(s, ko).nevoa > 0) { L.push(`${D.nome} está protegido pela névoa.`); return; }
      mudarEstagio(alvoEfeito, e, L, noOponente && e.n < 0); break;
    case "condicao": {
      const c = e.condicao === "trio" ? ["paralisia", "queimadura", "congelamento"][Math.floor(Math.random() * 3)] : e.condicao === "trio2" ? ["veneno", "paralisia", "sono"][Math.floor(Math.random() * 3)] : e.condicao;
      condicao(s, noOponente ? ko : k, alvoEfeito, c, m, L, !noOponente); break;
    }
    case "custoHp": { const c = Math.floor(A.hp * e.fracao); perder(A, c); L.push(`${A.nome} gastou ${c} de HP!`); break; }
    case "curaAtkAlvo": { const c = curarHp(A, Math.max(1, efetivo(D, "atk"))); L.push(c ? `${A.nome} absorveu força e recuperou ${c} de HP!` : `${A.nome} já está com o HP cheio!`); break; } // Strength Sap
    case "curaAlvoCond": if (D.cond === e.cond && D.hpAtual > 0) { D.cond = null; D.sonoRest = 0; L.push(`${D.nome} foi curado de ${nomeCond(e.cond)}!`); } break; // Smelling Salts, Wake-Up Slap, Sparkling Aria
    case "limparTerreno": if (campoDe(s).terreno) { campoDe(s).terreno = null; L.push("O terreno desapareceu!"); } break;
    case "cura": {
      let f = e.fracao;
      if (e.clima === "padrao") { const cx = climaDe(s, A); f = cx === "sol" ? 2 / 3 : cx ? 1 / 4 : 1 / 2; }
      if (e.clima === "areia") f = clima(s) === "areia" ? 2 / 3 : 1 / 2;
      curar(A, f, L); break;
    }
    case "curarCond": {
      const alvos = e.equipe ? s.j[k].equipe : [A];
      for (const P of alvos) { P.cond = null; P.sonoRest = 0; P.tox = 1; if (P === A) P.conf = 0; }
      L.push(e.equipe ? "As condições da equipe foram curadas!" : `${A.nome} curou sua condição!`); break;
    }
    case "perdeTipo": if (A.tipos.includes(e.tipo)) { A.tipos = A.tipos.filter(t => t !== e.tipo); if (!A.tipos.length) A.tipos = ["???"]; L.push(`${A.nome} perdeu o tipo ${e.tipo}!`); } break;
    case "glaive": VA.glaive = true; L.push(`${A.nome} ficou exposto: leva o dobro de dano até agir de novo!`); break;
    case "recuar": if (!VD.agiu && hab(D) !== "inner-focus") VD.recuar = true; break;
    case "volatil": {
      const alvos = e.alvo === "ambos" ? [[k, A], [ko, D]] : e.alvo === "alvo" ? [[ko, D]] : [[k, A]];
      for (const [kk, P] of alvos) aplicarVolatil(s, kk, P, e.v, A, L, m);
      break;
    }
    case "clima": { const c = campoDe(s); if (c.clima?.t === e.clima) { L.push("Mas falhou!"); return; } c.clima = {t: e.clima, n: (e.turnos || 5) + extensao(A, "clima", e.clima)}; L.push(`${NOME_CLIMA[e.clima]} começou!`); break; }
    case "terreno": { const c = campoDe(s); if (c.terreno?.t === e.terreno) { L.push("Mas falhou!"); return; } c.terreno = {t: e.terreno, n: (e.turnos || 5) + extensao(A, "terreno")}; L.push(`${NOME_TERRENO[e.terreno]} cobriu o campo!`); break; }
    case "sala": { const c = campoDe(s); if (c.sala > 0) { c.sala = 0; L.push("A dimensão voltou ao normal!"); } else { c.sala = e.turnos || 5; L.push("A dimensão ficou distorcida (Trick Room)!");
    for (const kk of ["1", "2"]) { const Q = ativoDe(s.j[kk]); if (itemId(Q) === "room-service") { gastarItem(Q, L); mudarEstagio(Q, {stat: "spe", n: -1}, L); } } } break; }
    case "armadilha": {
      const lado = ladoDe(s, ko), cheio = e.a === "espinhos" ? lado.espinhos >= 3 : e.a === "venenosa" ? lado.venenosa >= 2 : lado[e.a];
      if (cheio) { L.push("Mas falhou!"); return; }
      if (e.a === "espinhos" || e.a === "venenosa") lado[e.a]++; else lado[e.a] = true;
      L.push(`${NOME_ARM[e.a]} foi espalhado no lado do Jogador ${ko}!`); break;
    }
    case "tela": {
      const lado = ladoDe(s, k);
      if (lado[e.tela] > 0) { L.push(`Mas falhou! (${NOME_TELA[e.tela]} já está ativo)`); return; }
      if (e.tela === "veu" && !["granizo", "neve"].includes(clima(s))) { L.push("Mas falhou! (Aurora Veil só funciona com Granizo ou Neve em campo)"); return; }
      lado[e.tela] = (e.turnos || 5) + (["reflect", "luz", "veu"].includes(e.tela) ? extensao(A, "tela") : 0); L.push(`${NOME_TELA[e.tela]} protege o lado do Jogador ${k}!`); break;
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
        if (hab(D) === "suction-cups") { L.push(`${D.nome}: Suction Cups! Não pode ser forçado a sair.`); return; }
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
  "climaBola", "usaDef", "defFis", "atkAlvo", "dreno", "recuo", "protecao", "futuro", "requisito", "deixa1", "maiorAtk", "atingeVoador", "tipoExtra", "gelaAgua", "ignoraEst", "superBonus"]);

function acerto(s, m, A, D) { // precisão do golpe × estágios de precisão e evasão
  const VA = vol(A), cl = climaDe(s, A);
  if (m.precisao == null) return {ok: true, txt: ""};
  if (vol(D).glaive) return {ok: true, txt: "alvo exposto"}; // Glaive Rush: o usuário não consegue se esquivar
  if (VA.mira) { VA.mira = false; return {ok: true, txt: "mira certeira"}; }
  const ph = precisaoHab(A, D, hab(D), m, cl, est(D, "eva"));
  if (ph.sempre) return {ok: true, txt: ""};
  let base = m.precisao;
  if (["thunder", "hurricane"].includes(m.id)) { if (cl === "chuva") return {ok: true, txt: ""}; if (cl === "sol") base = 50; }
  if (m.id === "blizzard" && ["granizo", "neve"].includes(cl)) return {ok: true, txt: ""};
  const ohko = ef(m, "danofixo")?.ohko;
  const estPrec = hab(D) === "unaware" ? 0 : est(A, "prec"), estEva = habId(A) === "unaware" ? 0 : ph.eva; // Unaware ignora precisão/evasão do outro
  let ch = ohko ? base : Math.floor(base * mult(Math.max(-6, Math.min(6, estPrec - estEva)), 3));
  let fi = 1; // itens: BrightPowder/Lax Incense (alvo), Wide Lens, Zoom Lens, Micle Berry
  if (["brightpowder", "lax-incense"].includes(itemId(D))) fi *= 0.9;
  if (itemId(A) === "wide-lens") fi *= 1.1;
  if (itemId(A) === "zoom-lens" && vol(D).agiu) fi *= 1.2;
  if (VA.micle) { fi *= 1.2; VA.micle = false; }
  if (!ohko) ch = Math.floor(ch * ph.f * fi);
  if (ch >= 100) return {ok: true, txt: ""};
  const r = percentil();
  return {ok: r <= ch, txt: `precisão ${ch}%, rolou ${r}`};
}
const quantosGolpes = (e, dadosViciados = false, sempreMax = false) => {
  if (e.min >= e.max || sempreMax) return e.max; // Skill Link: sempre o máximo
  if (dadosViciados && e.max === 5) return percentil() <= 50 ? 4 : 5; // Loaded Dice
  if (e.min === 2 && e.max === 5) { const r = percentil(); return r <= 35 ? 2 : r <= 70 ? 3 : r <= 85 ? 4 : 5; }
  return sorteio(e.min, e.max);
};
const climaBola = {sol: "Fire", chuva: "Water", areia: "Rock", granizo: "Ice", neve: "Ice"};

// ao ser atingido por um golpe de dano: contato, estágios e o que acontece quando o golpe derruba
function aposAtingir(s, k, A, D, m, T, total, criticos, fis, L, mt = 1) {
  const hD = hab(D), hA = habId(A), ko = adv(k), unn = hA === "unnerve";
  const sem = itemId(A) === "protective-pads" || (itemId(A) === "punching-glove" && ehSoco(m)); // sem efeitos de contato
  if (contatoDe(A, m) && !sem && A.hpAtual > 0) {
    if (itemId(D) === "rocky-helmet" && hA !== "magic-guard") { const r = perder(A, Math.max(1, Math.floor(A.hp / 6))); L.push(`${A.nome} se machucou na Rocky Helmet de ${D.nome}: ${r} de dano.${A.hpAtual === 0 ? " " + A.nome + " foi derrotado!" : ""}`); }
    if (hD === "pickpocket" && !D.item && A.item && hA !== "sticky-hold") roubar(A, D, L, D.nome);
    if ((hD === "rough-skin" || hD === "iron-barbs") && hA !== "magic-guard") { const r = perder(A, Math.max(1, Math.floor(A.hp / 8))); L.push(`${A.nome} se machucou em ${D.nome} (${D.habilidade.nome}): ${r} de dano.${A.hpAtual === 0 ? " " + A.nome + " foi derrotado!" : ""}`); }
    if (hD === "gooey" && A.hpAtual > 0) { L.push(`${D.nome}: Gooey!`); mudarEstagio(A, {stat: "spe", n: -1}, L, true); }
    if (hD === "effect-spore" && A.hpAtual > 0 && !A.cond && !A.tipos.includes("Grass") && itemId(A) !== "safety-goggles" && percentil() <= 30) { const c2 = ["sono", "paralisia", "veneno"][Math.floor(Math.random() * 3)]; L.push(`${D.nome}: Effect Spore!`); condicao(s, k, A, c2, null, L); }
    if (hD === "aftermath" && D.hpAtual === 0 && A.hpAtual > 0 && hA !== "magic-guard" && !["1", "2"].some(kk => habId(ativoDe(s.j[kk])) === "damp")) { const r = perder(A, Math.max(1, Math.floor(A.hp / 4))); L.push(`${D.nome}: Aftermath! ${A.nome} perdeu ${r} de HP.${A.hpAtual === 0 ? " " + A.nome + " foi derrotado!" : ""}`); }
    const c = {static: "paralisia", "flame-body": "queimadura", "poison-point": "veneno"}[hD];
    if (c && A.hpAtual > 0 && !A.cond && percentil() <= 30) { L.push(`${D.nome}: ${D.habilidade.nome}!`); condicao(s, k, A, c, null, L); }
    if (hA === "poison-touch" && D.hpAtual > 0 && !D.cond && percentil() <= 30) { L.push(`${A.nome}: Poison Touch!`); condicao(s, adv(k), D, "veneno", null, L); }
  }
  if (hA === "magician" && !A.item && D.item && A.hpAtual > 0 && hD !== "sticky-hold") roubar(D, A, L, A.nome);
  if (itemId(D) === "air-balloon") { D.item = null; D.itemUsado = "air-balloon"; L.push(`O Air Balloon de ${D.nome} estourou!`); }
  if (D.hpAtual > 0) {
    if (itemId(D) === "weakness-policy" && mt > 1) { gastarItem(D, L); mudarEstagio(D, {stat: "atk", n: 2}, L); mudarEstagio(D, {stat: "spa", n: 2}, L); }
    if (itemId(D) === "enigma-berry" && mt > 1 && !unn && D.hpAtual < D.hp) { gastarItem(D, L); L.push(`${D.nome} recuperou ${curarHp(D, Math.floor(D.hp / 4))} de HP.`); }
    if (((itemId(D) === "jaboca-berry" && m.cat === "fisico") || (itemId(D) === "rowap-berry" && m.cat === "especial")) && !unn && A.hpAtual > 0) { gastarItem(D, L); const r = perder(A, Math.max(1, Math.floor(A.hp / 8))); L.push(`${A.nome} perdeu ${r} de HP.${A.hpAtual === 0 ? " " + A.nome + " foi derrotado!" : ""}`); }
    if (hD === "weak-armor" && fis) { L.push(`${D.nome}: Weak Armor!`); mudarEstagio(D, {stat: "def", n: -1}, L); mudarEstagio(D, {stat: "spe", n: 2}, L); }
    if (hD === "justified" && T.tipo === "Dark") { L.push(`${D.nome}: Justified!`); mudarEstagio(D, {stat: "atk", n: 1}, L); }
    zen(D, L);
    if (hD === "cursed-body" && A.hpAtual > 0 && !vol(A).disable && percentil() <= 30) { const ix = A.mv.findIndex(x => x.id === m.id); if (ix >= 0) { vol(A).disable = {n: 4, idx: ix}; L.push(`${D.nome}: Cursed Body! ${m.nome} de ${A.nome} foi bloqueado.`); } }
    if (hD === "wind-power" && ehVento(m)) { vol(D).carregado = true; L.push(`${D.nome}: Wind Power! Ficou carregado de eletricidade.`); }
    if (hD === "steam-engine" && (T.tipo === "Fire" || T.tipo === "Water")) { L.push(`${D.nome}: Steam Engine!`); mudarEstagio(D, {stat: "spe", n: 6}, L); }
    if (D.hpAtual * 2 <= D.hp && (D.hpAtual + total) * 2 > D.hp) { // cruzou a metade do HP
      if (hD === "anger-shell") { L.push(`${D.nome}: Anger Shell!`); for (const [st, v] of [["atk", 1], ["spa", 1], ["spe", 1], ["def", -1], ["spd", -1]]) mudarEstagio(D, {stat: st, n: v}, L); }
      if (hD === "emergency-exit" && vivos(s.j[ko]).some(i => i !== s.j[ko].ativo) && !s.j[ko].pivo) { s.j[ko].pivo = true; L.push(`${D.nome}: Emergency Exit! Vai voltar. O Jogador ${ko} escolherá o próximo Pokémon.`); }
      if (hD === "berserk") { L.push(`${D.nome}: Berserk!`); mudarEstagio(D, {stat: "spa", n: 1}, L); }
    }
    if (hD === "stamina") { L.push(`${D.nome}: Stamina!`); mudarEstagio(D, {stat: "def", n: 1}, L); }
    if (hD === "anger-point" && criticos > 0 && est(D, "atk") < 6) { D.est.atk = 6; L.push(`${D.nome}: Anger Point! O Ataque foi ao máximo!`); }
    const JD = s.j[ko], JA = s.j[k];
    if (itemId(D) === "eject-button" && vivos(JD).some(i => i !== JD.ativo) && !JD.pivo) { gastarItem(D, L); JD.pivo = true; L.push(`${D.nome} vai voltar! O Jogador ${ko} escolherá o próximo Pokémon.`); }
    else if (itemId(D) === "red-card" && A.hpAtual > 0 && vivos(JA).some(i => i !== JA.ativo) && !vol(A).enraizado) {
      gastarItem(D, L); const op = vivos(JA).filter(i => i !== JA.ativo); enviar(s, k, op[Math.floor(Math.random() * op.length)], L, "foi puxado para");
    }
  } else if (A.hpAtual > 0) {
    if (hD === "innards-out" && A.hpAtual > 0 && hA !== "magic-guard") { const r = perder(A, Math.max(1, total)); L.push(`${D.nome}: Innards Out! ${A.nome} perdeu ${r} de HP.${A.hpAtual === 0 ? " " + A.nome + " foi derrotado!" : ""}`); }
    if (hA === "chilling-neigh") { L.push(`${A.nome}: Chilling Neigh!`); mudarEstagio(A, {stat: "atk", n: 1}, L); }
    if (hA === "grim-neigh") { L.push(`${A.nome}: Grim Neigh!`); mudarEstagio(A, {stat: "spa", n: 1}, L); }
    if (hA === "moxie") { L.push(`${A.nome}: Moxie!`); mudarEstagio(A, {stat: "atk", n: 1}, L); }
    if (hA === "beast-boost" || hA === "eelevate") { const st = ["atk", "def", "spa", "spd", "spe"].reduce((a, b) => A[b] > A[a] ? b : a, "atk"); L.push(`${A.nome}: Beast Boost!`); mudarEstagio(A, {stat: st, n: 1}, L); }
  }
}

// Dark Aura / Fairy Aura (de qualquer Pokémon em campo) reforçam golpes Dark/Fairy em 4/3; Aura Break inverte (3/4)
function auras(s) {
  const hs = ["1", "2"].map(k => habId(ativoDe(s.j[k])));
  const q = hs.includes("aura-break") ? 0.75 : 4 / 3, r = {};
  if (hs.includes("dark-aura")) r.Dark = q;
  if (hs.includes("fairy-aura")) r.Fairy = q;
  return r;
}
// Sword of Ruin: a Defesa de todos os outros Pokémon em campo cai 25%
const ruina = (s, P) => ["1", "2"].some(k => { const Q = ativoDe(s.j[k]); return Q !== P && habId(Q) === "sword-of-ruin"; }) ? 0.75 : 1;

function usar(s, k, L, ctx) { // Mold Breaker e parecidas ignoram a habilidade do alvo durante o golpe
  const A = ativoDe(s.j[k]), D = ativoDe(s.j[adv(k)]);
  const golpeAtual = ctx.act[k]?.tipo === "golpe" ? A.mv[ctx.act[k].idx] : null;
  QUEBRA_ALVO = (quebraHabilidade(habId(A)) || (habId(A) === "mycelium-might" && golpeAtual?.cat === "status")) && itemId(D) !== "ability-shield" ? D : null; // Ability Shield protege a habilidade
  habCtx.gas = gasOn(s); ATK = A;
  try { return usarBase(s, k, L, ctx); } finally { QUEBRA_ALVO = null; ATK = null; verificarItens(s, L); }
}
function usarBase(s, k, L, ctx) {
  const ko = adv(k), J = s.j[k], A = ativoDe(J), D = ativoDe(s.j[ko]), VA = vol(A), VD = vol(D), act = ctx.act[k];
  if (A.hpAtual <= 0 || J.puxado === s.rodada) return;
  if (act.tipo === "nada") { if (act.pocao) return; L.push(`${quem(A, k)} ${act.motivo}`); if (act.motivo.includes("recarregar")) VA.recarga = false; return; }
  const idx = act.idx, m = (act.z && golpeZ(A.mv[idx])) || A.mv[idx], n = quem(A, k); // golpe Z: o golpe vira o Z do mesmo tipo
  if (m.z) L.push(`💎 ${A.nome} liberou o poder Z!`);
  if (!podeAgir(A, k, L, m)) { VA.carga = null; VA.invul = null; VA.furia = null; return; }
  if (habId(A) === "truant") { if (VA.mandriao) { VA.mandriao = false; L.push(`${n} está mandrião!`); return; } VA.mandriao = true; } // Truant: age de turno sim, turno não
  if (habId(A) === "stance-change") { if (m.cat !== "status" && !A.lamina) { trocaLamina(A); L.push(`${A.nome}: Stance Change! Blade Forme.`); } else if (m.id === "kings-shield" && A.lamina) { trocaLamina(A); L.push(`${A.nome}: Stance Change! Shield Forme.`); } }
  // restrições de Taunt, Disable e Torment
  if ((VA.provocar > 0 && m.cat === "status") || (VA.disable?.idx === idx && VA.disable.n > 0) || (VA.tormento && VA.ultimo === idx && !act.forcado) || (itemId(A) === "assault-vest" && m.cat === "status")) {
    L.push(`${n} não pode usar ${m.nome} agora!`); return;
  }
  const segundoTurno = VA.carga != null;
  const metro = VA.ultimo === idx ? Math.min(5, (VA.metro || 0) + 1) : 0; VA.metro = metro; // Metronome: usos seguidos do mesmo golpe
  if (ehEscolha(itemId(A)) && VA.escolha == null) VA.escolha = idx; // Choice: fica preso a este golpe até sair de campo
  VA.ultimo = idx; VA.agiu = true; VA.usouProt = false; VA.glaive = false; (VA.usados || (VA.usados = [])).includes(idx) || VA.usados.push(idx);
  const tinhaCarga = !!VA.carregado; VA.carregado = false; // Charge dura até o próximo golpe
  const hA = habId(A), tEf = tipoAte(hA, m) || m.tipo; // Refrigerate, Pixilate...: o golpe Normal muda de tipo
  if ((hA === "protean" || hA === "libero") && m.tipo && !VA.protean && !(A.tipos.length === 1 && A.tipos[0] === m.tipo)) { VA.protean = true; A.tipos = [m.tipo]; L.push(`${A.nome}: ${A.habilidade.nome}! Mudou para o tipo ${m.tipo}.`); }
  const q = `${n} usou ${m.nome}`;
  const damp = ["1", "2"].map(kk => ativoDe(s.j[kk])).find(P => P.hpAtual > 0 && habId(P) === "damp");
  if (damp && ef(m, "explodir") && !QUEBRA_ALVO) { L.push(`${q}, mas ${damp.nome}: Damp impede explosões!`); return; }
  const carga = ef(m, "carga");
  const ervaPoder = carga && !segundoTurno && itemId(A) === "power-herb";
  if (ervaPoder) gastarItem(A, L, `${A.nome} usou a Power Herb: o golpe sai na hora!`);
  if (carga && !segundoTurno && !ervaPoder && carga.chuva && clima(s) === "chuva") for (const a of carga.antes || []) aplicarEfeito(s, a, {k, A, D, m, L}); // Electro Shot na chuva sai na hora
  if (carga && !segundoTurno && !ervaPoder && !(carga.sol && climaDe(s, A) === "sol") && !(carga.chuva && clima(s) === "chuva")) { // primeiro turno de um golpe de 2 turnos
    VA.carga = idx; if (carga.invul) VA.invul = carga.invul;
    for (const a of carga.antes || []) aplicarEfeito(s, a, {k, A, D, m, L});
    L.push(`${q}: ${carga.invul ? "ficou fora de alcance" : "está acumulando energia"}!`); return;
  }
  if (segundoTurno) { VA.carga = null; VA.invul = null; }
  const falha = ef(m, "falhaSe");
  if (falha) {
    const ok = falha.se === "primeiroTurno" ? (VA.t || 0) === 0
      : falha.se === "naoAtacando" ? (ctx.act[ko].tipo === "golpe" && D.mv[ctx.act[ko].idx]?.cat !== "status" && !VD.agiu)
      : falha.se === "alvoPrioridade" ? (ctx.act[ko].tipo === "golpe" && D.mv[ctx.act[ko].idx]?.cat !== "status" && (D.mv[ctx.act[ko].idx]?.prioridade || 0) > 0 && !VD.agiu) // Upper Hand
      : falha.se === "levouFisico" ? VA.levouDano?.cat === "fisico" // Shell Trap
      : falha.se === "repetir" ? metro === 0 // Gigaton Hammer: não pode ser usado duas vezes seguidas
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
    if (VD.protegido && !m.z && !((hA === "unseen-fist" || hA === "piercing-drill") && contatoDe(A, m)) && !["feint", "shadow-force", "phantom-force", "hyperspace-hole", "hyperspace-fury"].includes(m.id)) { // o golpe Z atravessa a proteção (com 25% do dano, mais abaixo)
      L.push(`${q}, mas ${D.nome} se protegeu!`);
      const c = VD.contatoProt;
      if (c && m.cat === "fisico") { // efeitos de contato dos golpes de proteção
        if (c.t === "dano") { perder(A, Math.max(1, Math.floor(A.hp * c.fracao))); L.push(`${A.nome} se machucou ao tocar em ${D.nome}.${A.hpAtual === 0 ? " " + A.nome + " foi derrotado!" : ""}`); }
        else if (c.t === "estagio") mudarEstagio(A, c, L, true);
        else if (c.t === "condicao") condicao(s, k, A, c.condicao, null, L, true);
      }
      VA.furia = null; return;
    }
    if (hab(D) === "queenly-majesty" && !m.z && (m.prioridade || 0) + bonusPrioridade(A, m) > 0) { L.push(`${q}, mas ${D.nome}: Queenly Majesty impede golpes de prioridade!`); VA.furia = null; return; }
    if (terreno(s) === "psiquico" && (m.prioridade || 0) > 0 && aterrado(D)) { L.push(`${q}, mas o Terreno Psíquico protegeu ${D.nome}!`); return; }
    if (PO.has(m.id) && (D.tipos.includes("Grass") || itemId(D) === "safety-goggles")) { L.push(`${q}. Não afeta ${D.nome}.`); return; }
    if (hA === "prankster" && m.cat === "status" && D.tipos.includes("Dark")) { L.push(`${q}, mas não afeta ${D.nome}.`); return; }
    if (dano && tEf === "Ground" && itemId(D) === "air-balloon" && m.id !== "thousand-arrows") { L.push(`${q}, mas ${D.nome} flutua com o Air Balloon!`); VA.furia = null; return; }
    const bloq = imuneHab(hab(D), m, tEf); // Levitate, Flash Fire, Water Absorb, Volt Absorb, Sap Sipper, Soundproof...
    if (bloq) {
      L.push(`${q}, mas ${D.nome} não foi afetado (${D.habilidade.nome})!`);
      if (bloq.acao === "cura") { if (D.hpAtual < D.hp) L.push(`${D.nome} recuperou ${curarHp(D, Math.max(1, Math.floor(D.hp / 4)))} de HP!`); }
      else if (bloq.acao === "estagio") mudarEstagio(D, {stat: bloq.stat, n: bloq.n}, L);
      else if (bloq.acao === "flash") { VD.flash = true; L.push(`${D.nome} ficou mais forte com o fogo!`); }
      VA.furia = null; return;
    }
  }
  if (m.cat === "status" && !m.z && hab(D) === "magic-bounce" && (alveja || (m.efeitos || []).some(e => e.t === "armadilha"))) { // Magic Bounce devolve golpes de status
    L.push(`${q}, mas ${D.nome} refletiu o golpe (Magic Bounce)!`);
    const ctxR = {k: ko, A: D, D: A, m, L, sub: false};
    for (const e of m.efeitos || []) if (!["carga", "falhaSe", "protecao", "futuro", "clima", "terreno", "sala"].includes(e.t) && e.alvo !== "self") aplicarEfeito(s, e, ctxR);
    return;
  }
  const req = ef(m, "requisito"); // golpes que só funcionam em certas condições
  if (req) {
    const ok = {alvoDormindo: D.cond === "sono", alvoComItem: !!D.item, comeuBaga: !!A.comeuBaga, userFogo: A.tipos.includes("Fire"), tiposComuns: A.tipos.some(t => D.tipos.includes(t)),
      alvoEnvenenado: D.cond === "veneno" || D.cond === "veneno-grave", usouTodos: A.mv.every((x, i) => i === idx || (VA.usados || []).includes(i)), temTerreno: !!terreno(s), hpAlto: A.hpAtual > Math.floor(A.hp * (req.fracao || 0.5))}[req.se];
    const porque = {alvoDormindo: "o alvo não está dormindo", alvoComItem: "o alvo não tem item", comeuBaga: "nenhuma baga foi comida", userFogo: "o usuário não é do tipo Fire", tiposComuns: "o alvo não divide tipo com o usuário",
      alvoEnvenenado: "o alvo não está envenenado", usouTodos: "ainda não usou todos os outros golpes", temTerreno: "não há terreno em campo", hpAlto: "HP insuficiente"}[req.se];
    if (!ok) { L.push(`${q}, mas falhou! (${porque})`); VA.furia = null; return; }
  }
  const ac = alveja ? acerto(s, m, A, D) : {ok: true, txt: ""};
  if (!ac.ok) { L.push(`${q} [${ac.txt}]: errou!`); VA.furia = null; return; }
  if (ehSom(m) && itemId(A) === "throat-spray") { gastarItem(A, L); mudarEstagio(A, {stat: "spa", n: 1}, L); }
  for (const e of efs(m, "limpar")) if (e.antes) aplicarEfeito(s, e, ctxE);
  if (!dano) { // ----- golpe de status -----
    L.push(`${q}${ac.txt ? " [" + ac.txt + "]" : ""}.`);
    for (const e of m.efeitos || []) if (!["carga", "falhaSe", "protecao", "futuro"].includes(e.t)) aplicarEfeito(s, e, ctxE);
    if (ef(m, "explodir")) { A.hpAtual = 0; derrotado(A, L); }
    return;
  }
  // ----- golpe de dano -----
  const T = {tipo: tEf, poder: m.poder};
  const cl = climaDe(s, A), te = terreno(s), fis = ef(m, "maiorAtk") ? efetivo(A, "atk") >= efetivo(A, "spa") : m.cat === "fisico"; // Photon Geyser usa o maior entre Atk e Atk Esp
  const dobrar = ef(m, "dobrar");
  if (ef(m, "climaBola") && cl) { T.tipo = climaBola[cl]; T.poder = 100; }
  if (ef(m, "poderPorEstagios")) T.poder = 20 + 20 * Object.values(A.est).filter(x => x > 0).reduce((a, b) => a + b, 0);
  if (ef(m, "poderPorHp")) T.poder = Math.max(1, Math.floor(150 * A.hpAtual / A.hp));
  if (dobrar) {
    const ok = {statusUser: !!A.cond, statusAlvo: !!D.cond, venenoAlvo: D.cond === "veneno" || D.cond === "veneno-grave", hpMetadeAlvo: D.hpAtual <= D.hp / 2,
      levouDano: !!VA.levouDano, agiuAntes: !!VD.agiu, sempre: true, alvoFerido: !!VD.feridoTurno, alvoCond: D.cond === dobrar.cond, chance30: percentil() <= 30,
      alvoNaoAgiu: !VD.agiu, userEstagioNeg: Object.values(A.est).some(v => v < 0)}[dobrar.se];
    if (ok) T.poder *= 2;
  }
  if (T.poder > 0) { // golpes que dependem do terreno
    if (m.id === "expanding-force" && te === "psiquico" && aterrado(A)) T.poder = Math.floor(T.poder * 1.5);
    if (m.id === "misty-explosion" && te === "nevoa" && aterrado(A)) T.poder = Math.floor(T.poder * 1.5);
    if (m.id === "rising-voltage" && te === "eletrico" && aterrado(D)) T.poder *= 2;
    if (tinhaCarga && tEf === "Electric") { T.poder *= 2; L.push(`${A.nome} usou a carga elétrica!`); } // Charge
  }
  let tiposAlvo0 = hA === "scrappy" && ["Normal", "Fighting"].includes(T.tipo) ? D.tipos.filter(t => t !== "Ghost") : D.tipos; // Scrappy acerta o tipo Ghost
  const semVoar = (ef(m, "atingeVoador") && T.tipo === "Ground") || (deltaAtivo(s) && ["Electric", "Ice", "Rock"].includes(T.tipo)); // Thousand Arrows; Delta Stream tira as fraquezas do Flying
  const tiposAlvo = semVoar ? tiposAlvo0.filter(t => t !== "Flying") : tiposAlvo0; // Thousand Arrows acerta quem voa
  const secundario = (m.efeitos || []).some(efeitoSecundario), sheer = hA === "sheer-force" && secundario;
  if (T.poder > 0) T.poder = Math.floor(T.poder * poderMult(A, m, T, {clima: cl, contato: contatoDe(A, m), aura: auras(s), recuo: !!ef(m, "recuo"), sheer, ate: tEf !== m.tipo && hA !== "liquid-voice", flash: VA.flash, depois: !!VD.agiu}));
  const extraTipo = ef(m, "tipoExtra"), mtExtra = extraTipo ? tiposAlvo.reduce((a, t) => a * multTipo(extraTipo.tipo, t), 1) : 1; // Flying Press: também é do tipo Flying
  const mtAgua = ef(m, "gelaAgua") ? Math.pow(4, tiposAlvo.filter(t => t === "Water").length) : 1; // Freeze-Dry: super efetivo contra Water
  const mt0 = tiposAlvo.reduce((a, t) => a * multTipo(T.tipo, t), 1) * mtExtra * mtAgua;
  const imune = mt0 === 0;
  const fixo = ef(m, "danofixo");
  if (hab(D) === "wonder-guard" && !fixo && !imune && mt0 <= 1) { L.push(`${q}${ac.txt ? " [" + ac.txt + "]" : ""}: ${D.nome} não foi afetado (Wonder Guard)!`); VA.furia = null; return; }
  const textoEf = mult => mult === 0 ? " Não afeta o alvo." : mult > 1 ? " Super efetivo!" : mult < 1 ? " Pouco efetivo." : "";
  let total = 0, golpes = 0, linhaDados = [], criticos = 0, mult_ = 1;
  if (fixo) {
    if (fixo.ohko && hab(D) === "sturdy") { L.push(`${q}: ${D.nome} não é afetado (Sturdy)!`); VA.furia = null; return; }
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
    const multi = ef(m, "multi"), parental = hA === "parental-bond" && !multi && !m.z && !(m.efeitos || []).some(e => ["carga", "recarga", "furia", "explodir"].includes(e.t)) && !VA.carga, n_ = multi ? quantosGolpes(multi, itemId(A) === "loaded-dice", hA === "skill-link") : parental ? 2 : 1; // Parental Bond: o segundo golpe tem 25% do dano
    const estC = (ef(m, "crit")?.n || 0) + (VA.foco ? 2 : 0) + (["scope-lens", "razor-claw"].includes(itemId(A)) ? 1 : 0) + (hA === "super-luck" ? 1 : 0);
    const critMin = estC >= 3 ? 3 : estC === 2 ? 4 : estC === 1 ? 5 : 6;
    const critSempre = !!ef(m, "critSempre") || (hA === "merciless" && (D.cond === "veneno" || D.cond === "veneno-grave")); // Merciless: crítico contra envenenado
    const lado = ladoDe(s, ko), semCrit = ["shell-armor", "battle-armor"].includes(hab(D)), mtAlvo = mt0;
    const ign = !!ef(m, "ignoraEst"); // Chip Away, Sacred Sword, Darkest Lariat: ignoram as mudanças de atributo do alvo
    for (let i = 0; i < n_ && D.hpAtual > 0; i++) {
      const gema = GEMA_TIPO[itemId(A)] === T.tipo && !m.z ? 1.3 : 1; // gema: só no primeiro golpe, some depois
      const tipoBaga = BAGA_TIPO[itemId(D)], bagaRes = tipoBaga && tipoBaga === T.tipo && (tipoBaga === "Normal" || mt0 > 1) && habId(A) !== "unnerve" ? (habId(D) === "ripen" ? 0.25 : 0.5) : 1;
      const d1 = d6(), d2 = d6(), crit = !semCrit && (critSempre || (d1 >= critMin && d2 >= critMin));
      const kaBase = ef(m, "usaDef") ? "def" : fis ? "atk" : "spa", kd = ef(m, "defFis") || fis || ef(m, "usaDef") ? "def" : "spd";
      const fonte = ef(m, "atkAlvo") ? D : A, kaFonte = ef(m, "atkAlvo") ? "atk" : kaBase;
      let def = efetivo(D, kd, ign || hA === "unaware" ? 0 : crit ? Math.min(0, est(D, kd)) : est(D, kd));
      if (cl === "areia" && D.tipos.includes("Rock") && kd === "spd") def = Math.floor(def * 1.5);
      if (cl === "neve" && D.tipos.includes("Ice") && kd === "def") def = Math.floor(def * 1.5);
      def = Math.floor(def * msd(s, D, kd) * (kd === "def" ? ruina(s, D) : 1));
      let modClima = 1;
      if (cl === "chuva") modClima *= T.tipo === "Water" ? 1.5 : T.tipo === "Fire" ? 0.5 : 1;
      if (cl === "sol") modClima *= T.tipo === "Fire" ? 1.5 : T.tipo === "Water" ? 0.5 : 1;
      if (["solar-beam", "solar-blade"].includes(m.id) && ["chuva", "areia", "granizo", "neve"].includes(cl)) modClima *= 0.5;
      if (te === "eletrico" && T.tipo === "Electric" && aterrado(A)) modClima *= 1.3;
      if (te === "grama" && T.tipo === "Grass" && aterrado(A)) modClima *= 1.3;
      if (te === "psiquico" && T.tipo === "Psychic" && aterrado(A)) modClima *= 1.3;
      if (te === "nevoa" && T.tipo === "Dragon" && aterrado(D)) modClima *= 0.5;
      if (te === "grama" && ["earthquake", "bulldoze", "magnitude"].includes(m.id) && aterrado(D)) modClima *= 0.5;
      const modTela = habId(A) === "infiltrator" ? 1 : (lado.veu > 0 || (fis ? lado.reflect : lado.luz) > 0) ? 0.5 : 1;
      const modFinal = (A.cond === "queimadura" && fis && !(dobrar?.ignoraQueimadura) && hA !== "guts" ? 0.5 : 1) * (m.z && VD.protegido ? 0.25 : 1)
        * danoFinalMult({A, D, hD: hab(D), m, tipo: T.tipo, mult: mtAlvo, fis, stab: A.tipos.includes(T.tipo)}) * danoItemMult({A, m, tipo: T.tipo, mult: mtAlvo, fis, metro}) * gema * bagaRes * (VD.glaive ? 2 : 1) * (hA === "supreme-overlord" ? 1 + 0.1 * Math.min(5, J.equipe.filter(q => q.hpAtual <= 0).length) : 1) * (hA === "sniper" && crit ? 1.5 : 1) * (parental && i === 1 ? 0.25 : 1) * (hA === "piercing-drill" && VD.protegido ? 0.25 : 1) * (ef(m, "superBonus") && mtAlvo > 1 ? 4 / 3 : 1) * mtExtra * mtAgua;
      const estA = hab(D) === "unaware" && fonte === A ? 0 : est(fonte, kaFonte); // Unaware do alvo ignora os aumentos de quem ataca
      const R = calcularDano({nivel: A.nivel || REGRAS.nivel, poder: T.poder,
        atk: Math.floor(efetivo(fonte, kaFonte, crit ? Math.max(0, estA) : estA) * msd(s, fonte, kaFonte)), def,
        stab: A.tipos.includes(T.tipo), tipoGolpe: T.tipo, tiposDef: tiposAlvo, dados: [d1, d2], critMin: semCrit ? 99 : critMin, critForcado: critSempre && !semCrit, modClima, modTela, modFinal});
      mult_ = R.mult;
      if (R.mult === 0) { if (i === 0) { L.push(`${q}${ac.txt ? " [" + ac.txt + "]" : ""}: não afeta ${D.nome}.`); VA.furia = null; return; } break; }
      let dm = R.dano;
      if (hab(D) === "disguise" && !D.disfarceUsado && R.mult > 0) { D.disfarceUsado = true; dm = 0; L.push(`O disfarce de ${D.nome} absorveu o golpe!`); perder(D, Math.max(1, Math.floor(D.hp / 8))); }
      total += dm > 0 ? danoNoAlvo(D, dm, L, {cat: m.cat, ignoraSub: false, deixa1: !!ef(m, "deixa1")}) : 0; golpes++;
      if (gema > 1) gastarItem(A, L, `${A.nome} gastou ${A.item.nome}: o golpe ficou mais forte!`);
      if (bagaRes < 1 && R.mult > 0) gastarItem(D, L, `${D.item.nome} de ${D.nome} enfraqueceu o golpe!`);
      if (R.crit) criticos++;
      linhaDados.push(`${d1}+${d2}${R.crit ? " crítico!" : ""}`);
    }
    const extra = (A.cond === "queimadura" && fis && !dobrar?.ignoraQueimadura && hA !== "guts" ? " (queimado: dano pela metade)" : "") + (multi ? ` (${golpes} golpe${golpes > 1 ? "s" : ""})` : "");
    L.push(`${q} [dados ${linhaDados.join("; ")}${ac.txt ? "; " + ac.txt : ""}]: ${total} de dano em ${D.nome}.${extra}${textoEf(mult_)}${D.hpAtual === 0 ? " " + D.nome + " foi derrotado!" : ""}`);
  }
  // consequências do golpe de dano
  const dr = ef(m, "dreno"), rc = ef(m, "recuo");
  if (dr && total > 0) {
    const quanto = Math.max(1, Math.floor(total * dr.fracao * (itemId(A) === "big-root" ? 1.3 : 1)));
    if (hab(D) === "liquid-ooze") { const r = perder(A, quanto); L.push(`${A.nome} sugou o lodo líquido de ${D.nome} e perdeu ${r} de HP!${A.hpAtual === 0 ? " " + A.nome + " foi derrotado!" : ""}`); }
    else { const c = curarHp(A, quanto); if (c) L.push(`${A.nome} drenou ${c} de HP.`); }
  }
  if (rc && (rc.base === "hp" || total > 0) && !["rock-head", "magic-guard"].includes(hA)) {
    const r = Math.max(1, Math.floor(rc.base === "hp" ? A.hp * rc.fracao : total * rc.fracao));
    perder(A, r); L.push(`${A.nome} sofreu ${r} de dano de recuo.${A.hpAtual === 0 ? " " + A.nome + " foi derrotado!" : ""}`);
  }
  if (itemId(A) === "life-orb" && total > 0 && !sheer && !fixo && habId(A) !== "magic-guard" && A.hpAtual > 0) { perder(A, Math.max(1, Math.floor(A.hp / 10))); L.push(`${A.nome} perdeu HP por causa da Life Orb.${A.hpAtual === 0 ? " " + A.nome + " foi derrotado!" : ""}`); }
  if (total > 0) aposAtingir(s, k, A, D, m, T, total, criticos, fis, L, mt0);
  if (total > 0 && ["kings-rock", "razor-fang"].includes(itemId(A)) && D.hpAtual > 0 && !VD.agiu && !VD.recuar && hab(D) !== "inner-focus" && hab(D) !== "shield-dust" && itemId(D) !== "covert-cloak" && percentil() <= 10) VD.recuar = true;
  if (total > 0 && hA === "stench" && D.hpAtual > 0 && !VD.agiu && !VD.recuar && !(m.efeitos || []).some(e => e.t === "recuar") && !(["inner-focus", "shield-dust"].includes(hab(D))) && percentil() <= 10) VD.recuar = true; // Stench: 10% de recuo
  if (ef(m, "recarga")) VA.recarga = true;
  const fu = ef(m, "furia");
  if (fu) {
    if (!VA.furia) VA.furia = {idx, n: (percentil() <= 50 ? 2 : 3) - 1};
    else { VA.furia.n--; if (VA.furia.n <= 0) { VA.furia = null; if (!A.conf) { A.conf = 2 + Math.floor(Math.random() * 4); L.push(`${A.nome} ficou confuso de cansaço!`); } } }
  }
  ctxE.sub = vol(D).subst > 0; // o substituto ainda está de pé: sem efeitos secundários no alvo
  for (const e of m.efeitos || []) if (!TRATADOS_NO_DANO.has(e.t) && !e.antes && !(sheer && efeitoSecundario(e))) aplicarEfeito(s, e, ctxE);
  if (ef(m, "explodir") && A.hpAtual > 0) { A.hpAtual = 0; derrotado(A, L); }
  if (D.hpAtual === 0 && VD.destino && A.hpAtual > 0) { A.hpAtual = 0; L.push(`${A.nome} foi levado junto pelo laço do destino!`); }
}

// ----- itens no fim da rodada e gatilhos (bagas, ervas, Eject Pack) -----
function itemFim(s, k, P, L) {
  const i = itemId(P); if (!i || P.hpAtual <= 0) return;
  const cura = f => { if (P.hpAtual < P.hp) L.push(`${P.nome} recuperou ${curarHp(P, Math.max(1, Math.floor(P.hp * f)))} de HP (${P.item.nome}).`); };
  if (i === "leftovers") cura(1 / 16);
  if (i === "black-sludge") { if (P.tipos.includes("Poison")) cura(1 / 16); else if (habId(P) !== "magic-guard") { const r = perder(P, Math.max(1, Math.floor(P.hp / 8))); L.push(`${P.nome} sofreu ${r} de dano da Black Sludge.${P.hpAtual === 0 ? " " + P.nome + " foi derrotado!" : ""}`); } }
  if (i === "flame-orb" && !P.cond) condicao(s, k, P, "queimadura", null, L, true);
  if (i === "toxic-orb" && !P.cond) condicao(s, k, P, "veneno-grave", null, L, true);
}
function verificarItens(s, L) {
  const mortos = ["1", "2"].reduce((a, kk) => a + s.j[kk].equipe.filter(q => q.hpAtual <= 0).length, 0);
  for (const kk of ["1", "2"]) { const Q = ativoDe(s.j[kk]); if (Q && Q.hpAtual > 0 && habId(Q) === "soul-heart") { if (Q.sh == null) Q.sh = mortos; for (; Q.sh < mortos; Q.sh++) { L.push(`${Q.nome}: Soul Heart!`); mudarEstagio(Q, {stat: "spa", n: 1}, L); } } }
  for (const k of ["1", "2"]) {
    const J = s.j[k], P = ativoDe(J); if (!P || P.hpAtual <= 0 || !P.item) continue;
    const i = itemId(P); if (!i) continue;
    const V = vol(P), O = ativoDe(s.j[adv(k)]), baga = ehBaga(i);
    if (baga && O?.hpAtual > 0 && habId(O) === "unnerve") continue; // Unnerve: o adversário não come bagas
    const dobro = habId(P) === "ripen" ? 2 : 1, lim = habId(P) === "gluttony" ? 0.5 : 0.25, f = P.hpAtual / P.hp, {BAGA_BAIXO, BAGA_ESTAGIO, CURA_COND} = BAGA_ESPERA;
    const tira = () => { P.cond = null; P.tox = 1; P.sonoRest = 0; };
    if (i === "sitrus-berry" && f <= 0.5) { gastarItem(P, L); L.push(`${P.nome} recuperou ${curarHp(P, Math.floor(P.hp / 4) * dobro)} de HP.`); }
    else if (i === "oran-berry" && f <= 0.5) { gastarItem(P, L); L.push(`${P.nome} recuperou ${curarHp(P, 10 * dobro)} de HP.`); }
    else if (BAGA_BAIXO.includes(i) && f <= lim) { gastarItem(P, L); L.push(`${P.nome} recuperou ${curarHp(P, Math.floor(P.hp / 3) * dobro)} de HP.`); }
    else if (BAGA_ESTAGIO[i] && f <= lim) { const stat = BAGA_ESTAGIO[i]; gastarItem(P, L); mudarEstagio(P, {stat, n: dobro}, L); }
    else if (i === "lansat-berry" && f <= lim) { gastarItem(P, L); V.foco = true; L.push(`${P.nome} ficou mais propenso a críticos!`); }
    else if (i === "starf-berry" && f <= lim) { const livres = ["atk", "def", "spa", "spd", "spe"].filter(x => est(P, x) < 6); gastarItem(P, L); if (livres.length) mudarEstagio(P, {stat: livres[Math.floor(Math.random() * livres.length)], n: 2 * dobro}, L); }
    else if (i === "micle-berry" && f <= lim) { gastarItem(P, L); V.micle = true; }
    else if (i === "custap-berry" && f <= lim) { gastarItem(P, L); V.custap = true; L.push(`${P.nome} vai agir primeiro na próxima rodada!`); }
    else if (i === "lum-berry" && (P.cond || P.conf > 0)) { gastarItem(P, L); tira(); P.conf = 0; L.push(`${P.nome} ficou curado.`); }
    else if (CURA_COND[i]?.includes(P.cond)) { gastarItem(P, L); tira(); L.push(`${P.nome} ficou curado.`); }
    else if (i === "persim-berry" && P.conf > 0) { gastarItem(P, L); P.conf = 0; L.push(`${P.nome} saiu da confusão.`); }
    else if (i === "white-herb" && Object.values(P.est).some(v => v < 0)) { gastarItem(P, L); for (const x of Object.keys(P.est)) if (P.est[x] < 0) P.est[x] = 0; L.push(`Os atributos de ${P.nome} voltaram ao normal.`); }
    else if (i === "mental-herb" && (V.provocar > 0 || V.encore || V.disable || V.tormento)) { gastarItem(P, L); V.provocar = 0; delete V.encore; delete V.disable; V.tormento = false; L.push(`${P.nome} se livrou dos efeitos mentais.`); }
    if (V.ejetar) { V.ejetar = false; if (itemId(P) === "eject-pack" && vivos(J).some(x => x !== J.ativo) && !J.pivo) { gastarItem(P, L); J.pivo = true; L.push(`${P.nome} vai voltar! O Jogador ${k} escolherá o próximo Pokémon.`); } }
  }
}
// Harvest repõe a baga comida (sempre no sol, senão 50%); roda depois das bagas do fim da rodada
function colher(s, L) {
  for (const k of ["1", "2"]) {
    const P = ativoDe(s.j[k]); if (!P || P.hpAtual <= 0 || habId(P) !== "harvest" || P.item || !P.itemUsado || !ehBaga(P.itemUsado)) continue;
    if (clima(s) === "sol" || percentil() <= 50) { const it = itemPorId(P.itemUsado); P.item = {id: it.id, nome: it.nome}; P.itemUsado = null; L.push(`${P.nome}: Harvest! Colheu ${it.nome} de novo.`); }
  }
}
// ----- fim da rodada: habilidades -----
function habFim(P, h, cl, L) {
  if (P.hpAtual <= 0 || !h) return;
  zen(P, L);
  const cura = f => { if (P.hpAtual < P.hp) L.push(`${P.nome} recuperou ${curarHp(P, Math.max(1, Math.floor(P.hp * f)))} de HP (${P.habilidade.nome}).`); };
  const dano = f => { const r = perder(P, Math.max(1, Math.floor(P.hp * f))); L.push(`${P.nome} sofreu ${r} de dano (${P.habilidade.nome}).${P.hpAtual === 0 ? " " + P.nome + " foi derrotado!" : ""}`); };
  const limpar = () => { P.cond = null; P.tox = 1; P.sonoRest = 0; L.push(`${P.nome} curou sua condição (${P.habilidade.nome})!`); };
  if (h === "moody") { const ss = ["atk", "def", "spa", "spd", "spe", "prec", "eva"], su = ss.filter(x => est(P, x) < 6), a = su[Math.floor(Math.random() * su.length)]; L.push(`${P.nome}: Moody!`); if (a) mudarEstagio(P, {stat: a, n: 2}, L); const sd = ss.filter(x => x !== a && est(P, x) > -6), b = sd[Math.floor(Math.random() * sd.length)]; if (b) mudarEstagio(P, {stat: b, n: -1}, L); }
  if (h === "speed-boost") { L.push(`${P.nome}: Speed Boost!`); mudarEstagio(P, {stat: "spe", n: 1}, L); }
  if (h === "ice-body" && (cl === "granizo" || cl === "neve")) cura(1 / 16);
  if (h === "rain-dish" && cl === "chuva") cura(1 / 16);
  if (h === "dry-skin") { if (cl === "chuva") cura(1 / 8); else if (cl === "sol") dano(1 / 8); }
  if (h === "solar-power" && cl === "sol") dano(1 / 8);
  if (P.hpAtual > 0 && P.cond && ((h === "hydration" && cl === "chuva") || (h === "shed-skin" && percentil() <= 33))) limpar();
}
// ----- fim da rodada -----
function residuo(s, ordem, L) {
  const cl = clima(s), te = terreno(s);
  for (const k of ordem) {
    const P = ativoDe(s.j[k]);
    if (P.hpAtual <= 0) continue;
    const V = vol(P), n = quem(P, k), lado = ladoDe(s, k), h = habId(P);
    const sofrer = (d, de) => { if (h === "magic-guard") return; const r = perder(P, Math.max(1, d)); L.push(`${n} sofreu ${r} de dano ${de}.${P.hpAtual === 0 ? " " + P.nome + " foi derrotado!" : ""}`); };
    if (cl === "areia" && !P.tipos.some(t => ["Rock", "Ground", "Steel"].includes(t)) && !["overcoat", "sand-veil", "sand-rush", "sand-force"].includes(h) && itemId(P) !== "safety-goggles") sofrer(Math.floor(P.hp / 16), "da tempestade de areia");
    if (cl === "granizo" && P.hpAtual > 0 && !P.tipos.includes("Ice") && !["overcoat", "snow-cloak", "ice-body", "slush-rush"].includes(h) && itemId(P) !== "safety-goggles") sofrer(Math.floor(P.hp / 16), "do granizo");
    habFim(P, h, cl, L); itemFim(s, k, P, L);
    if (P.hpAtual > 0 && te === "grama" && aterrado(P) && P.hpAtual < P.hp) L.push(`${P.nome} recuperou ${curarHp(P, Math.floor(P.hp / 16))} de HP com o Terreno de Grama.`);
    if (P.hpAtual > 0 && lado.desejo) { lado.desejo.n--; if (lado.desejo.n <= 0) { L.push(`O desejo se realizou: ${P.nome} recuperou ${curarHp(P, lado.desejo.hp)} de HP.`); lado.desejo = null; } }
    if (P.hpAtual > 0 && V.semente) {
      const O = ativoDe(s.j[adv(k)]), r = perder(P, Math.max(1, Math.floor(P.hp / 8)));
      if (O.hpAtual > 0) { if (hab(P) === "liquid-ooze") { perder(O, r); L.push(`${O.nome} sugou lodo líquido e perdeu ${r} de HP!`); } else curarHp(O, r); }
      L.push(`${n} teve ${r} de HP drenado pela semente.${P.hpAtual === 0 ? " " + P.nome + " foi derrotado!" : ""}`);
    }
    if (P.hpAtual > 0 && (V.aquaring || V.enraizado) && P.hpAtual < P.hp) L.push(`${P.nome} recuperou ${curarHp(P, Math.max(1, Math.floor(P.hp / 16)))} de HP com as raízes ou o anel de água.`);
    if (P.hpAtual > 0) {
      if (h === "poison-heal" && (P.cond === "veneno" || P.cond === "veneno-grave")) { if (P.hpAtual < P.hp) L.push(`${P.nome} recuperou ${curarHp(P, Math.max(1, Math.floor(P.hp / 8)))} de HP (Poison Heal).`); }
      else if (P.cond === "queimadura") sofrer(Math.floor(P.hp / 16), "da queimadura");
      else if (P.cond === "veneno") sofrer(Math.floor(P.hp / 8), "do veneno");
      else if (P.cond === "veneno-grave") { const d = Math.max(1, Math.floor(P.hp * P.tox / 16)); P.tox = Math.min(15, P.tox + 1); sofrer(d, "do veneno grave"); }
    }
    if (P.hpAtual > 0 && V.pesadelo) { if (P.cond === "sono") sofrer(Math.floor(P.hp / 4), "do pesadelo"); else V.pesadelo = false; }
    if (P.hpAtual > 0 && P.cond === "sono" && habId(ativoDe(s.j[adv(k)])) === "bad-dreams" && ativoDe(s.j[adv(k)]).hpAtual > 0 && hab(P) !== "magic-guard") sofrer(Math.floor(P.hp / 8), "do Bad Dreams");
    if (P.hpAtual > 0 && V.salgado) sofrer(Math.floor(P.hp / (P.tipos.some(t => t === "Water" || t === "Steel") ? 4 : 8)), "do sal");
    if (P.hpAtual > 0 && V.maldicao) sofrer(Math.floor(P.hp / 4), "da maldição");
    if (P.hpAtual > 0 && V.preso > 0) { sofrer(Math.floor(P.hp / (V.presoPor && itemId(ativoDe(s.j[V.presoPor])) === "binding-band" ? 6 : 8)), "do aprisionamento"); V.preso--; if (V.preso <= 0) { delete V.presoPor; L.push(`${P.nome} se libertou!`); } }
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
    Object.assign(V, {recuar: false, protegido: false, endure: false, agiu: false, levouDano: null, feridoTurno: false, contatoProt: null});
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
    if (!podeTrocar(A, ativoDe(s.j[adv(k)]))) return {tipo: "nada", motivo: "está preso e não pode trocar!"};
    return {tipo: "troca", idx: esc.idx};
  }
  if (V.recarga) return {tipo: "nada", motivo: "precisa recarregar!"};
  if (V.carga != null) return {tipo: "golpe", idx: V.carga, forcado: true};
  if (V.furia) return {tipo: "golpe", idx: V.furia.idx, forcado: true};
  if (V.encore && V.encore.n > 0 && A.mv[V.encore.idx]) return {tipo: "golpe", idx: V.encore.idx, forcado: true};
  if (V.escolha != null && ehEscolha(itemId(A)) && A.mv[V.escolha]) return {tipo: "golpe", idx: V.escolha, forcado: true}; // Choice Band/Specs/Scarf
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
  if (m.habilidade) P.habilidade = {id: m.habilidade.id, nome: m.habilidade.nome}; // a mega traz a própria habilidade
  aoEntrar(s, k, L);
}

export function fimDeBatalha(s, L) { // quem ficou sem Pokémon vivos
  if (s.fase === "fim") return;
  const sem = ["1", "2"].filter(k => !vivos(s.j[k]).length);
  if (sem.length === 2) { s.fase = "fim"; s.vencedor = "empate"; L.push("Os dois jogadores ficaram sem Pokémon: a batalha terminou em empate!"); }
  else if (sem.length === 1) { s.fase = "fim"; s.vencedor = adv(sem[0]); L.push(`Jogador ${s.vencedor} venceu a batalha!`); }
}

export const resolverRodada = s => comGas(s, () => resolverRodadaBase(s));
function resolverRodadaBase(s) {
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
    const pr = k => act[k].tipo === "golpe" && !act[k].z ? (ativoDe(s.j[k]).mv[act[k].idx].prioridade || 0) + bonusPrioridade(ativoDe(s.j[k]), ativoDe(s.j[k]).mv[act[k].idx]) + (ativoDe(s.j[k]).mv[act[k].idx].id === "grassy-glide" && terreno(s) === "grama" && aterrado(ativoDe(s.j[k])) ? 1 : 0) : 0; // golpe Z não tem prioridade
    const sala = s.campo.sala > 0, v1 = velEm(s, "1"), v2 = velEm(s, "2");
    const qc = {"1": itemId(ativoDe(s.j["1"])) === "quick-claw" && percentil() <= 20, "2": itemId(ativoDe(s.j["2"])) === "quick-claw" && percentil() <= 20};
    const bk = k => { const Q = ativoDe(s.j[k]), i = itemId(Q); return vol(Q).custap || qc[k] ? 2 : ["lagging-tail", "full-incense"].includes(i) || habId(Q) === "stall" || (habId(Q) === "mycelium-might" && act[k].tipo === "golpe" && Q.mv[act[k].idx]?.cat === "status") ? 0 : 1; }; // Quick Claw/Custap primeiro, Lagging Tail/Full Incense por último
    let p;
    if (pr("1") !== pr("2")) p = pr("1") > pr("2") ? "1" : "2"; // maior prioridade age primeiro
    else if (bk("1") !== bk("2")) { p = bk("1") > bk("2") ? "1" : "2"; const Q = ativoDe(s.j[p]); if (bk(p) === 2) L.push(`${Q.nome} agiu primeiro (${qc[p] ? "Quick Claw" : "Custap Berry"})!`); }
    else if (v1 === v2) { p = Math.random() < 0.5 ? "1" : "2"; L.push("Empate de Velocidade: a ordem foi sorteada."); }
    else p = (v1 > v2) !== sala ? "1" : "2"; // no Trick Room o mais lento age primeiro
    for (const kk of ["1", "2"]) vol(ativoDe(s.j[kk])).custap = false;
    usar(s, p, L, ctx); passo(p);
    if (ativoDe(s.j[adv(p)]).hpAtual > 0) { usar(s, adv(p), L, ctx); passo(adv(p)); } // derrotado não age
  }
  const ordem = ["1", "2"].sort((a, b) => (velEm(s, b) - velEm(s, a)) * (s.campo.sala > 0 ? -1 : 1));
  residuo(s, ordem, L); verificarItens(s, L); colher(s, L); contadores(s, L); passo(null);
  for (const k of ["1", "2"]) for (const p of s.j[k].equipe) { p.vol = clone(vol(p)); } // garante dados simples (sem undefined) no Firestore
  s.passos = P; s.passosRod = rod;
  s.escolhas = {"1": null, "2": null}; s.rodada++;
  fimDeBatalha(s, L);
  s.log = s.log.concat(L).slice(-40);
  return s;
}
