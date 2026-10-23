import "./firebase.js"; // inicializa o app com o seu firebaseConfig
import { getFirestore, doc, getDoc, setDoc, runTransaction, onSnapshot, Timestamp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { sortearEquipe } from "./bot.js";
import { BOT, botEscolha, botTroca } from "./botia.js";
import { listar } from "./firebase.js";
import { usuario, refUsuario, VITORIAS_POR_REVIVER } from "./usuarios.js";
import { XP_DERROTA, xpDe, infoNivel, xpTorreTotal, xpVitoriaBot, nivelDoBot, XP_VITORIA } from "./nivel.js";
import { filaTorre, torreAvancar, reescalar, nivelNaTorre, copiaBot } from "./torre.js";
import { golpeZ } from "./zmoves.js";
import { resolverRodada, copiaPokemon, megaBloqueada, adv, ativoDe, precisaTrocar, podeTrocar, enviar, fimDeBatalha } from "./motor.js";

const db = getFirestore();
const ref = c => doc(db, "salas", c);
const LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// Identidade deste navegador e sala em que ele está
export const uid = (() => {
  let u = localStorage.getItem("pbb_uid");
  if (!u) { u = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("pbb_uid", u); }
  return u;
})();
export const sessao = {
  ler() { try { return JSON.parse(localStorage.getItem("pbb_sala")); } catch(e) { return null; } },
  salvar(o) { localStorage.setItem("pbb_sala", JSON.stringify(o)); },
  limpar() { localStorage.removeItem("pbb_sala"); }
};

// Lê a sala, deixa a função "fn" alterá-la e grava tudo de forma atômica
const mudar = (codigo, fn) => runTransaction(db, async tx => {
  const snap = await tx.get(ref(codigo));
  if (!snap.exists()) throw new Error("Sala não encontrada.");
  const s = snap.data(); fn(s); tx.set(ref(codigo), s);
});

// Sala contra bot: o Jogador 2 é o bot, já com 6 Pokémon aleatórios (4 golpes aleatórios cada) e equipe confirmada
async function jogadorBot() {
  const {equipe, mapa} = await sortearEquipe(await listar(), 6);
  return {uid: "bot", bot: true, saiu: false, confirmada: true, ativo: 0, equipe: equipe.map(p => copiaBot(p, mapa))};
}
// Torre: o adversário é um Pokémon por vez; a fila dos próximos (30 andares) já fica pronta na sala
async function jogadorTorre() {
  const fila = await filaTorre(await listar(), sortearEquipe);
  if (!fila.length) throw new Error("Não consegui montar a torre: o catálogo está vazio ou sem golpes sincronizados.");
  const primeiro = fila.shift();
  return {bot: {uid: "bot", bot: true, saiu: false, confirmada: true, ativo: 0, equipe: [primeiro]}, torre: {n: 0, andar: 1, total: fila.length + 1, fila}};
}
export async function criarSala(contraBot = false, nivelBot = "normal", modoTorre = false) {
  const t = modoTorre ? await jogadorTorre() : null, bot = t ? t.bot : contraBot ? await jogadorBot() : null;
  for (let i = 0; i < 5; i++) {
    const c = Array.from({length: 5}, () => LETRAS[Math.floor(Math.random() * LETRAS.length)]).join("");
    const ok = await runTransaction(db, async tx => {
      if ((await tx.get(ref(c))).exists()) return false;
      tx.set(ref(c), {fase:"equipes", rodada:1, j:{"1":null,"2":bot}, escolhas:{"1":null,"2":null}, ...(bot ? {bot:true, botNivel:nivelBot} : {}), ...(t ? {torre: t.torre} : {}),
        log:[], vencedor:null, expiraEm: Timestamp.fromMillis(Date.now() + 7 * 864e5)});
      return true;
    });
    if (ok) return c;
  }
  throw new Error("Não foi possível criar a sala. Tente de novo.");
}
export async function lerSala(codigo) { const s = await getDoc(ref(codigo)); return s.exists() ? s.data() : null; }

export async function entrar(codigo, papel, retomar = false) {
  if (papel === "E") { if (!await lerSala(codigo)) throw new Error("Sala não encontrada."); }
  else await mudar(codigo, s => {
    if (s.bot && papel !== "1") throw new Error("Nesta sala o Jogador 2 é o bot.");
    const outro = s.j[adv(papel)], v = s.j[papel];
    if (outro && outro.uid === uid) throw new Error(outro.saiu
      ? `Você saiu desta sala como Jogador ${adv(papel)} e não pode voltar. Crie uma sala nova.`
      : `Você já está nesta sala como Jogador ${adv(papel)}.`);
    const chave = usuario()?.chave || null; // conta do jogador: vitórias e poções ficam nela
    if (!v) s.j[papel] = {uid, chave, saiu:false, confirmada:false, equipe:[], ativo:0};
    else if (v.uid === uid && !v.saiu) return;
    else if (retomar && !v.saiu) { v.uid = uid; v.chave = chave; }
    else throw new Error("Essa vaga está ocupada ou já foi encerrada.");
  });
  sessao.salvar({codigo, papel});
}

export async function sair(codigo, papel) {
  try {
    if (papel !== "E") await runTransaction(db, async tx => {
      const snap = await tx.get(ref(codigo));
      if (!snap.exists()) return;
      const s = snap.data(), eu = s.j[papel], o = s.j[adv(papel)];
      if (!eu || eu.uid !== uid) return;
      eu.saiu = true;
      if (!o || o.saiu || s.bot) { tx.delete(ref(codigo)); return; } // ninguém mais nela: a sala é apagada
      if (s.fase === "batalha") { s.vencedor = adv(papel); s.desistiu = true; /* desistência não conta como vitória */ s.log = s.log.concat(`Jogador ${papel} saiu da sala.`).slice(-40); }
      if (s.fase !== "fim") s.fase = "fim";
      tx.set(ref(codigo), s);
    });
  } finally { sessao.limpar(); }
}

export const confirmarEquipe = (codigo, papel, equipe, mapa = {}) => mudar(codigo, s => {
  const eu = s.j[papel];
  if (s.fase !== "equipes" || !eu || eu.uid !== uid || eu.confirmada) throw new Error("Não é possível confirmar agora.");
  if (!equipe.length || equipe.length > 6) throw new Error("A equipe precisa ter de 1 a 6 Pokémon.");
  eu.equipe = equipe.map(p => copiaPokemon(p, mapa)); eu.ativo = 0; eu.confirmada = true; // cópia congelada na sala
  if (s.bot && !s.torre && papel === "1") { // bot comum: o nível de todo o time dele acompanha o seu (fácil: menor · normal: média · difícil: maior)
    const lvl = nivelDoBot(s.botNivel || "facil", eu.equipe.map(p => p.nivel || 50));
    for (const p of s.j["2"].equipe) reescalar(p, lvl);
  }
  if (s.torre && papel === "1") { const a = s.j["2"].equipe[0]; reescalar(a, nivelNaTorre(s, a)); } // o 1º adversário acompanha o nível do seu time
  const o = s.j[adv(papel)];
  if (o && o.confirmada && !o.saiu) { s.fase = "batalha"; s.log.push("A batalha começou!"); }
});

// valida e registra a escolha do jogador; quando os dois escolheram, resolve a rodada (roda dentro da transação da sala)
function registrar(s, papel, esc) {
  const eu = s.j[papel];
  if (s.fase !== "batalha" || !eu || eu.uid !== uid) throw new Error("Não é possível agir agora.");
  if (precisaTrocar(s.j["1"]) || precisaTrocar(s.j["2"])) throw new Error("Há uma troca obrigatória pendente.");
  if (s.escolhas[papel]) throw new Error("Você já escolheu.");
  if (esc.tipo === "golpe") {
    const m = ativoDe(eu).mv[esc.idx];
    if (!m) throw new Error("Golpe indisponível.");
  } else if (esc.tipo === "troca") {
    const p = eu.equipe[esc.idx];
    if (!p || p.hpAtual <= 0 || esc.idx === eu.ativo) throw new Error("Troca inválida.");
    if (!podeTrocar(ativoDe(eu))) throw new Error("Seu Pokémon está preso e não pode trocar.");
  } else if (esc.tipo === "pocao") {
    const p = eu.equipe[esc.idx];
    if (!p || p.hpAtual <= 0) throw new Error("A poção não revive: escolha um Pokémon que ainda esteja de pé (ou use um Reviver).");
    if (p.hpAtual >= p.hp) throw new Error(`${p.nome} já está com o HP cheio.`);
  } else if (esc.tipo === "reviver") {
    const p = eu.equipe[esc.idx];
    if (!p || p.hpAtual > 0) throw new Error("O Reviver só funciona em Pokémon derrotados.");
  } else throw new Error("Escolha inválida.");
  if (esc.mega != null) { // megaevolução junto com o golpe (1 por equipe)
    const A = ativoDe(eu);
    if (esc.tipo !== "golpe") throw new Error("Só dá para megaevoluir junto com um golpe.");
    if (megaBloqueada(s, eu)) throw new Error(s.torre ? "Você já tem uma mega em campo ou na equipe: ela precisa cair antes de outra megaevoluir." : "Sua equipe já usou a megaevolução.");
    if (A.slugMega || !A.megas?.[esc.mega]) throw new Error("Este Pokémon não pode megaevoluir agora.");
  }
  if (esc.z) { // golpe Z: 1 por equipe e por batalha (o cristal é gasto na mesma transação, em usarItem)
    const A = ativoDe(eu), V = A.vol || {};
    if (esc.tipo !== "golpe") throw new Error("O golpe Z só vale junto com um golpe.");
    if (esc.mega != null || A.slugMega) throw new Error("Golpe Z e megaevolução não se combinam: um Pokémon megaevoluído não usa golpe Z.");
    if (eu.zUsada) throw new Error("Sua equipe já usou o golpe Z nesta batalha.");
    if (V.recarga || V.carga != null || V.furia || (V.encore && V.encore.n > 0)) throw new Error("Seu Pokémon está com o golpe travado: não dá para usar golpe Z agora.");
    if (!golpeZ(A.mv[esc.idx])) throw new Error("Só golpes de dano viram golpe Z.");
    eu.zUsada = true;
  }
  s.escolhas[papel] = {tipo: esc.tipo, idx: esc.idx, mega: esc.mega ?? null, z: !!esc.z};
  if (s.bot) s.escolhas[BOT] = botEscolha(s); // o bot escolhe um golpe aleatório na hora
  if (s.escolhas["1"] && s.escolhas["2"]) resolverRodada(s); // quem escolhe por último resolve a rodada
  botTroca(s); // se o bot ficou sem Pokémon em campo, ele escolhe o próximo sozinho
  torreAvancar(s); // torre: o Pokémon do andar caiu, entra o próximo
}

// Poção e Reviver gastam 1 do estoque da conta (documento do usuário) na mesma transação que registra a escolha
const ESTOQUE = {pocao: "pocoes", reviver: "revives"}, NOME_ITEM = {pocao: "poções", reviver: "revives"};
const usarItem = (codigo, papel, esc) => runTransaction(db, async tx => {
  const snap = await tx.get(ref(codigo));
  if (!snap.exists()) throw new Error("Sala não encontrada.");
  const s = snap.data(), chave = s.j[papel]?.chave;
  if (!chave) throw new Error("Itens e cristais só existem para quem está logado na conta.");
  const campo = esc.z ? "zcristais" : ESTOQUE[esc.tipo], us = await tx.get(refUsuario(chave)), n = us.exists() ? us.data()[campo] || 0 : 0;
  if (n < 1) throw new Error(`Você não tem ${esc.z ? "cristais Z" : NOME_ITEM[esc.tipo]}.`);
  registrar(s, papel, esc);
  tx.set(ref(codigo), s); tx.update(refUsuario(chave), {[campo]: n - 1});
});
export const escolher = (codigo, papel, esc) => ESTOQUE[esc.tipo] || esc.z ? usarItem(codigo, papel, esc) : mudar(codigo, s => registrar(s, papel, esc));

// Chamada por cada jogador logado quando a batalha acaba (uma única vez por jogador e sala):
//  - XP: vitória +XP_VITORIA, derrota ou empate +XP_DERROTA (desistência não conta)
//  - vitória: +1 vitória, +1 poção e, a cada VITORIAS_POR_REVIVER vitórias, +1 Reviver
// O resultado fica na sala (s.j[papel].resultado) para a tela mostrar "+20 XP" e "subiu de nível".
export const contabilizarResultado = (codigo, papel) => runTransaction(db, async tx => {
  const snap = await tx.get(ref(codigo));
  if (!snap.exists()) return false;
  const s = snap.data(), eu = s.j[papel];
  if (s.torre) { // Torre: só XP (2^n − 1 por n Pokémon derrotados). Sem vitória, poção nem Reviver.
    if (s.fase !== "fim" || !eu || eu.uid !== uid || !eu.chave || eu.resultado) return false;
    const us = await tx.get(refUsuario(eu.chave));
    if (!us.exists()) return false;
    const d = us.data(), ganho = xpTorreTotal(s.torre.n), xp = xpDe(d) + ganho, antes = infoNivel(xpDe(d)).nivel, depois = infoNivel(xp).nivel;
    tx.update(refUsuario(eu.chave), {xp});
    eu.resultado = {xp: ganho, nivelNovo: depois > antes ? depois : null};
    tx.set(ref(codigo), s);
    return {vitorias: d.vitorias || 0, xp, nick: d.nick || eu.chave, chave: eu.chave}; // o XP novo também vai para o ranking
  }
  if (s.fase !== "fim" || !s.vencedor || s.desistiu || !eu || eu.uid !== uid || !eu.chave || eu.resultado) return false;
  const us = await tx.get(refUsuario(eu.chave));
  if (!us.exists()) return false;
  const d = us.data(), venceu = s.vencedor === papel, ganho = venceu ? (s.bot ? xpVitoriaBot(s.botNivel || "facil") : XP_VITORIA) : XP_DERROTA; // contra o bot, a vitória rende 10/20/40 XP (fácil/normal/difícil)
  const xp = xpDe(d) + ganho, nivelAntes = infoNivel(xpDe(d)).nivel, nivelDepois = infoNivel(xp).nivel;
  const vit = (d.vitorias || 0) + (venceu ? 1 : 0), reviver = venceu && vit % VITORIAS_POR_REVIVER === 0; // a cada 20 vitórias, 1 Reviver
  tx.update(refUsuario(eu.chave), {xp, ...(venceu ? {vitorias: vit, pocoes: (d.pocoes || 0) + 1, ...(reviver ? {revives: (d.revives || 0) + 1} : {})} : {})});
  eu.resultado = {xp: ganho, nivelNovo: nivelDepois > nivelAntes ? nivelDepois : null};
  if (venceu) { s.vitoriaContada = true; if (reviver) s.reviverGanho = true; }
  tx.set(ref(codigo), s);
  return {vitorias: vit, xp, nick: d.nick || eu.chave, chave: eu.chave};
}).then(async r => {
  if (!r) return false;
  // ranking público (só nick, vitórias e XP): fora da transação, para que uma falha aqui (ex.: regras do Firestore sem a coleção "ranking")
  // nunca impeça o crédito do resultado
  if (r.vitorias > 0) {
    try { await setDoc(doc(db, "ranking", r.chave), {nick: r.nick, vitorias: r.vitorias, xp: r.xp}); }
    catch(e) { console.warn("Ranking não atualizado (confira as regras do Firestore para a coleção ranking):", e.message); }
  }
  return true;
});

export const trocaForcada = (codigo, papel, idx) => mudar(codigo, s => {
  const eu = s.j[papel];
  if (s.fase !== "batalha" || !eu || eu.uid !== uid || !precisaTrocar(eu)) throw new Error("Troca não permitida.");
  const p = eu.equipe[idx];
  if (!p || p.hpAtual <= 0 || idx === eu.ativo) throw new Error("Escolha um Pokémon que ainda possa lutar.");
  const L = [], verbo = ativoDe(eu).hpAtual > 0 ? "trocou para" : "enviou"; // pivô (U-turn...) ou troca depois de um nocaute
  enviar(s, papel, idx, L, verbo); fimDeBatalha(s, L); // aplica armadilhas de campo e confere se a batalha acabou
  s.log = s.log.concat(L).slice(-40);
  botTroca(s);
  torreAvancar(s);
});

// Torre: sair no meio encerra a subida (o XP já acumulado é creditado em seguida por contabilizarResultado)
export const encerrarTorre = (codigo, papel) => mudar(codigo, s => {
  const eu = s.j[papel];
  if (!s.torre || s.fase !== "batalha" || !eu || eu.uid !== uid) return;
  s.fase = "fim"; s.vencedor = "2"; s.torre.encerrada = true; s.log = s.log.concat("Você deixou a torre.").slice(-40);
});

export const ouvir = (codigo, cb) => onSnapshot(ref(codigo), snap => cb(snap.exists() ? snap.data() : null), () => cb(undefined));
