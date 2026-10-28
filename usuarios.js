// Contas simples (nickname + senha) guardadas no Firestore, coleção "usuarios".
// Documento: { nick, senha (hash), builds: { <id do Pokémon>: ["Golpe 1", ...até 4] } }
// Atenção: com as regras do Firestore abertas isto identifica quem joga, mas não é segurança de verdade.
import { listar } from "./firebase.js"; // também inicializa o app com o seu firebaseConfig
import { infoNivel, xpDe, nivelDoPokemon, pontosLivres, caixasLivres } from "./nivel.js";
import { sortearCaixa, itemPorId, copiasLivres } from "./itens.js";
import { REGRAS } from "./regras.js";
const REGRAS_NIVEL_MAX = REGRAS.nivelMax;
import { getFirestore, doc, getDoc, setDoc, updateDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const db = getFirestore();
const CH = "pbb_user";
const ref = k => doc(db, "usuarios", k);
export const refUsuario = ref;
const chaveDe = n => n.trim().toLowerCase();

export const usuario = () => { try { return JSON.parse(localStorage.getItem(CH)); } catch(e) { return null; } }; // {nick, chave}
export const sairConta = () => localStorage.removeItem(CH);

async function hash(t) {
  if (globalThis.crypto?.subtle) { // só existe em https ou localhost
    const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
  }
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57; // alternativa simples quando o navegador não tem crypto.subtle
  for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return "s" + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}
const senhaHash = (k, senha) => hash(k + ":" + senha);
const entrou = (nick, chave) => { const u = {nick, chave}; localStorage.setItem(CH, JSON.stringify(u)); return u; };

// Shiny: cada Pokémon do catálogo tem 10% de chance de ser shiny para o usuário. O sorteio é feito uma vez, na criação da conta,
// e guardado em usuarios/<nick>.shiny = { idDoPokemon: true }. Só visual.
export const CHANCE_SHINY = 0.1;
async function sortearShiny() {
  const mapa = {};
  try { for (const p of await listar()) if (Math.random() < CHANCE_SHINY) mapa[p.id] = true; } catch(e) {}
  return mapa;
}
// Lê os shiny do usuário. Contas antigas (sem o campo) são sorteadas agora, na primeira leitura.
export async function lerShiny(chave) {
  const s = await getDoc(ref(chave));
  if (!s.exists()) return {};
  if (s.data().shiny) return s.data().shiny;
  const mapa = await sortearShiny();
  await updateDoc(ref(chave), {shiny: mapa});
  return mapa;
}
export async function criarConta(nick, senha) {
  nick = nick.trim();
  if (!/^[\p{L}\p{N}_.-]{3,20}$/u.test(nick)) throw new Error("O nickname precisa ter de 3 a 20 caracteres (letras, números, _ . -).");
  if (senha.length < 4) throw new Error("A senha precisa ter pelo menos 4 caracteres.");
  const k = chaveDe(nick);
  if ((await getDoc(ref(k))).exists()) throw new Error("Esse nickname já está em uso.");
  await setDoc(ref(k), {nick, senha: await senhaHash(k, senha), builds: {}, shiny: await sortearShiny()});
  return entrou(nick, k);
}
export async function entrarConta(nick, senha) {
  const k = chaveDe(nick), s = await getDoc(ref(k));
  if (!s.exists() || s.data().senha !== await senhaHash(k, senha)) throw new Error("Nickname ou senha incorretos.");
  return entrou(s.data().nick, k);
}

// builds do usuário: { idDoPokemon: [nomes dos golpes] }
export async function lerBuilds(chave) {
  const s = await getDoc(ref(chave));
  return s.exists() ? s.data().builds || {} : {};
}
export async function salvarBuild(chave, pokemonId, nomes) { // lista vazia remove a build
  const s = await getDoc(ref(chave));
  if (!s.exists()) throw new Error("Conta não encontrada. Entre de novo.");
  const dados = s.data(), builds = {...(dados.builds || {})};
  if (nomes.length) builds[pokemonId] = nomes; else delete builds[pokemonId];
  await setDoc(ref(chave), {...dados, builds});
  return builds;
}

// ----- vitórias, poções e revives -----
// Cada vitória rende 1 Poção; a cada VITORIAS_POR_REVIVER vitórias, também 1 Reviver. Usar um item gasta 1 do estoque.
export const VITORIAS_POR_REVIVER = 20;
export async function lerStatus(chave) {
  const s = await getDoc(ref(chave)), d = s.exists() ? s.data() : {};
  return {vitorias: d.vitorias || 0, pocoes: d.pocoes || 0, revives: d.revives || 0, ...infoNivel(xpDe(d)), pontos: pontosLivres(d), zcristais: d.zcristais || 0, caixas: caixasLivres(d)}; // + xp, nivel, noNivel, falta, pct... e pontos de treino livres
}

// ----- times salvos na conta: [{id, nome, ids: [id do Pokémon, ...até 6]}] -----
export const MAX_TIMES = 10;
export async function lerTimes(chave) {
  const s = await getDoc(ref(chave));
  return s.exists() ? s.data().times || [] : [];
}
export async function salvarTimes(chave, times) {
  if (times.length > MAX_TIMES) throw new Error(`O máximo é ${MAX_TIMES} times.`);
  await updateDoc(ref(chave), {times: times.map(t => ({id: String(t.id), nome: String(t.nome).slice(0, 24), ids: t.ids.slice(0, 6)}))});
  return times;
}

// ----- nível dos Pokémon da conta: niveis = {idDoPokemon: nível}; sem registro = nível inicial (REGRAS.nivel) -----
export async function lerNiveis(chave) {
  const s = await getDoc(ref(chave));
  return s.exists() ? s.data().niveis || {} : {};
}
// Gasta 1 ponto de treino para subir 1 nível do Pokémon (dentro de uma transação: não dá para gastar o mesmo ponto duas vezes)
export const subirNivelPokemon = (chave, pokemonId) => runTransaction(db, async tx => {
  const us = await tx.get(ref(chave));
  if (!us.exists()) throw new Error("Conta não encontrada. Entre de novo.");
  const d = us.data(), atual = nivelDoPokemon(d.niveis, pokemonId);
  if (atual >= REGRAS_NIVEL_MAX) throw new Error(`Este Pokémon já está no nível máximo (${REGRAS_NIVEL_MAX}).`);
  if (pontosLivres(d) < 1) throw new Error("Você não tem pontos de treino: cada nível da conta rende 1 ponto.");
  const niveis = {...(d.niveis || {}), [pokemonId]: atual + 1};
  tx.update(ref(chave), {niveis});
  return niveis;
});

// ----- Cristais Z: combustível do golpe Z (1 por batalha em que se usa). Vêm das caixas; por enquanto o administrador pode dar cristais à conta. -----
export const darCristais = (chave, n) => runTransaction(db, async tx => {
  const us = await tx.get(ref(chave));
  if (!us.exists()) throw new Error("Conta não encontrada.");
  const total = Math.max(0, (us.data().zcristais || 0) + Math.floor(n));
  tx.update(ref(chave), {zcristais: total});
  return total;
});
export const chaveDeNick = chaveDe;

// ----- habilidade escolhida por Pokémon: habilidades = {idDoPokemon: idDaHabilidade} (efeitos em batalha: etapa seguinte) -----
export async function lerEscolhasHab(chave) {
  const s = await getDoc(ref(chave));
  return s.exists() ? s.data().habilidades || {} : {};
}
export const salvarEscolhaHab = (chave, pokemonId, habId) => runTransaction(db, async tx => {
  const us = await tx.get(ref(chave));
  if (!us.exists()) throw new Error("Conta não encontrada. Entre de novo.");
  const habilidades = {...(us.data().habilidades || {}), [pokemonId]: String(habId).slice(0, 60)};
  tx.update(ref(chave), {habilidades});
  return habilidades;
});

// ----- inventário de itens segurados: itens = {idDoItem: cópias} · itensEq = {idDoPokemon: idDoItem} -----
export async function lerInventario(chave) {
  const s = await getDoc(ref(chave)), d = s.exists() ? s.data() : {};
  return {itens: d.itens || {}, itensEq: d.itensEq || {}};
}
// Abre 1 caixa (cada nível da conta rende 1): 30% cristais Z (1 a 3) · 70% cinco itens. Tudo na mesma transação, então não dá para abrir a mesma caixa duas vezes.
export const abrirCaixa = chave => runTransaction(db, async tx => {
  const us = await tx.get(ref(chave));
  if (!us.exists()) throw new Error("Conta não encontrada. Entre de novo.");
  const d = us.data();
  if (caixasLivres(d) < 1) throw new Error("Você não tem caixas para abrir: cada nível da conta rende 1 caixa.");
  const r = sortearCaixa(), atualiza = {caixasAbertas: (d.caixasAbertas || 0) + 1};
  if (r.tipo === "cristais") atualiza.zcristais = (d.zcristais || 0) + r.n;
  else { const itens = {...(d.itens || {})}; for (const id of r.itens) itens[id] = (itens[id] || 0) + 1; atualiza.itens = itens; }
  tx.update(ref(chave), atualiza);
  return {...r, jaTinha: r.tipo === "itens" ? r.itens.map(id => (d.itens?.[id] || 0) > 0) : []};
});
// Equipa (ou tira, com null) o item de um Pokémon. Cada cópia do item só segura em 1 Pokémon por vez.
export const equiparItem = (chave, pokemonId, id) => runTransaction(db, async tx => {
  const us = await tx.get(ref(chave));
  if (!us.exists()) throw new Error("Conta não encontrada. Entre de novo.");
  const d = us.data(), eq = {...(d.itensEq || {})};
  if (!id) delete eq[pokemonId];
  else {
    if (!itemPorId(id)) throw new Error("Item desconhecido.");
    if (copiasLivres(d.itens, eq, id, pokemonId) < 1) throw new Error("Você não tem uma cópia livre deste item (todas já estão em outros Pokémon).");
    eq[pokemonId] = id;
  }
  tx.update(ref(chave), {itensEq: eq});
  return eq;
});
