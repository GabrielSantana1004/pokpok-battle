// Trocas de Pokémon entre contas: coleção "trocas" do Firestore. Fluxo às cegas:
//   1. aguardando: quem propõe escolhe o SEU Pokémon e o nickname do outro jogador (o outro não vê qual foi);
//   2. revelada: o outro escolhe o dele, sem saber o primeiro; só então os dois Pokémon aparecem para os dois;
//   3. aceita: cada um confirma e, quando os dois confirmaram, a troca acontece numa única transação (ninguém fica com os dois nem com nenhum).
// Qualquer um pode desistir antes de a troca acontecer. A lógica de mover o Pokémon (com todas as informações) está em pokemons.js (trocarPokemons).
// Atenção: o "não ver" é só da tela (o documento da troca fica legível); e as regras do Firestore precisam permitir ler/escrever a coleção "trocas".
import "./firebase.js";
import { getFirestore, collection, doc, getDocs, query, where, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { refUsuario } from "./usuarios.js";
import { trocarPokemons } from "./pokemons.js";
const db = getFirestore(), col = collection(db, "trocas"), refT = id => doc(db, "trocas", id);
const foto = r => ({esp: r.esp, shiny: !!r.shiny, ivs: r.ivs || null});

export const propor = (eu, chavePara, dou) => runTransaction(db, async tx => {
  if (chavePara === eu.chave) throw new Error("Você não pode trocar com você mesmo.");
  const a = await tx.get(refUsuario(eu.chave)), b = await tx.get(refUsuario(chavePara));
  if (!b.exists()) throw new Error("Não existe uma conta com esse nickname.");
  const meu = a.exists() && a.data().pokemons?.[dou];
  if (!meu) throw new Error("O seu Pokémon não foi encontrado.");
  tx.set(doc(col), {de: eu.chave, deNick: a.data().nick || eu.chave, para: chavePara, paraNick: b.data().nick || chavePara, dou, meu: foto(meu), status: "aguardando", criada: Date.now()});
});
// O convidado escolhe o dele (sem ter visto o do outro); a partir daqui os dois Pokémon aparecem para os dois
export const escolher = (id, chave, quero) => runTransaction(db, async tx => {
  const s = await tx.get(refT(id)); if (!s.exists()) throw new Error("Essa troca não existe mais.");
  const t = s.data();
  if (t.status !== "aguardando") throw new Error("Essa troca não está mais esperando a sua escolha.");
  if (t.para !== chave) throw new Error("Só quem recebeu o convite escolhe o Pokémon aqui.");
  const b = await tx.get(refUsuario(chave)), dele = b.exists() && b.data().pokemons?.[quero];
  if (!dele) throw new Error("O seu Pokémon não foi encontrado.");
  tx.update(refT(id), {quero, dele: foto(dele), status: "revelada", confDe: false, confPara: false});
});
// Trocas em que a conta participa (mais novas primeiro)
export async function listarTrocas(chave) {
  const [a, b] = await Promise.all([getDocs(query(col, where("de", "==", chave))), getDocs(query(col, where("para", "==", chave)))]);
  const m = new Map(); for (const s of [...a.docs, ...b.docs]) m.set(s.id, {id: s.id, ...s.data()});
  return [...m.values()].sort((x, y) => y.criada - x.criada);
}
// Desistir (quem propôs: "cancelada"; quem recebeu: "recusada") enquanto a troca não aconteceu
export const desistir = (id, chave) => runTransaction(db, async tx => {
  const s = await tx.get(refT(id)); if (!s.exists()) throw new Error("Essa troca não existe mais.");
  const t = s.data();
  if (!["aguardando", "revelada"].includes(t.status)) throw new Error("Essa troca já terminou.");
  if (t.de !== chave && t.para !== chave) throw new Error("Você não participa dessa troca.");
  tx.update(refT(id), {status: t.de === chave ? "cancelada" : "recusada", fim: Date.now()});
});
// Cada um confirma depois de ver os dois Pokémon; quando os dois confirmaram a troca acontece. Devolve "esperando" ou "feita".
export const confirmar = (id, chave) => runTransaction(db, async tx => {
  const s = await tx.get(refT(id)); if (!s.exists()) throw new Error("Essa troca não existe mais.");
  const t = s.data();
  if (t.status !== "revelada") throw new Error("Essa troca não está esperando confirmação.");
  const campo = t.de === chave ? "confDe" : t.para === chave ? "confPara" : null;
  if (!campo) throw new Error("Você não participa dessa troca.");
  const a = await tx.get(refUsuario(t.de)), b = await tx.get(refUsuario(t.para));
  const conf = {confDe: !!t.confDe, confPara: !!t.confPara, [campo]: true};
  if (!(conf.confDe && conf.confPara)) { tx.update(refT(id), conf); return "esperando"; }
  if (!a.exists() || !b.exists()) throw new Error("Uma das contas não existe mais.");
  let r; try { r = trocarPokemons(a.data(), t.dou, b.data(), t.quero); } catch(e) { throw new Error("A troca não é mais possível: um dos Pokémon já não está com o dono."); }
  tx.update(refUsuario(t.de), r.A); tx.update(refUsuario(t.para), r.B);
  tx.update(refT(id), {...conf, status: "aceita", fim: Date.now()});
  return "feita";
});
