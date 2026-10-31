// Contas simples (nickname + senha) guardadas no Firestore, coleção "usuarios".
// Documento: { nick, senha (hash), pokemons: { <id da instância>: {esp, ivs, shiny} }, builds: { <id da instância>: ["Golpe 1", ...até 4] } }
// Atenção: com as regras do Firestore abertas isto identifica quem joga, mas não é segurança de verdade.
import "./firebase.js"; // inicializa o app com o seu firebaseConfig
import { novoPokemon, novoIdPokemon, shinyPorInstancia, shinyPorEspecie, tentativaCaptura } from "./pokemons.js";
import { infoNivel, xpDe, nivelDoPokemon, pontosLivres, caixasLivres } from "./nivel.js";
import { sortearCaixa, itemPorId, copiasLivres } from "./itens.js";
import { REGRAS } from "./regras.js";
const REGRAS_NIVEL_MAX = REGRAS.nivelMax;
import { getFirestore, doc, getDoc, setDoc, updateDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const db = getFirestore();
const CH = "pbb_user";
const ref = k => doc(db, "usuarios", k);
// Várias telas pedem pedaços da mesma conta ao mesmo tempo (pokémons, níveis, status, inventário…): enquanto uma leitura está em andamento,
// as outras dividem o resultado em vez de cada uma custar uma leitura. Nada é guardado depois que a leitura termina, então não há dado velho.
const lidos = new Map();
const lerDoc = k => { let p = lidos.get(k); if (!p) { p = getDoc(ref(k)); lidos.set(k, p); const solta = () => lidos.delete(k); p.then(solta, solta); } return p; };
const escrever = fn => runTransaction(db, fn).finally(() => lidos.clear()); // toda gravação descarta leituras em andamento
export const refUsuario = ref;
const chaveDe = n => n.trim().toLowerCase();

export const usuario = () => { try { const u = JSON.parse(localStorage.getItem(CH)); return u && {...u, nick: u.nick || u.chave}; } catch(e) { return null; } }; // {nick, chave} — se a sessão não tiver nick, usa a chave
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

// ----- Pokémon da conta (instâncias): usuarios/<nick>.pokemons = { idDaInstância: { esp, ivs, shiny } } — ver pokemons.js -----
// O shiny é sorteado (10%) quando o Pokémon é obtido e depois fica guardado em cada instância. Só visual.
export async function lerPokemons(chave) {
  const s = await lerDoc(chave);
  return s.exists() ? s.data().pokemons || {} : {};
}
// Dá um Pokémon novo à conta (IVs e shiny sorteados). Por enquanto vem da tela de admin; captura, caixas e inicial vão usar o mesmo caminho.
export const adicionarPokemon = (chave, espId) => escrever(async tx => {
  const us = await tx.get(ref(chave));
  if (!us.exists()) throw new Error("Conta não encontrada. Confira o nickname.");
  const id = novoIdPokemon(), reg = novoPokemon(espId);
  tx.update(ref(chave), {[`pokemons.${id}`]: reg});
  return {id, ...reg};
});
// Inicial: toda conta nova escolhe 1 entre os 27 iniciais (usuarios/<nick>.inicial guarda a espécie escolhida; só dá para escolher uma vez)
export const inicialEscolhido = async chave => { const s = await lerDoc(chave); return s.exists() && !!s.data().inicial; };
export const escolherInicial = (chave, espId) => escrever(async tx => {
  const us = await tx.get(ref(chave));
  if (!us.exists()) throw new Error("Conta não encontrada. Entre de novo.");
  if (us.data().inicial) throw new Error("Esta conta já escolheu o inicial.");
  const id = novoIdPokemon(), reg = novoPokemon(espId);
  tx.update(ref(chave), {inicial: String(espId), [`pokemons.${id}`]: reg});
  return {id, ...reg};
});
// ----- capturas: usuarios/<nick>.capturas = [{tipo: "bot"|"lendario", esp, sala, tentativas}] — a captura ganha na última vitória, ligada à sala; ela aparece na própria tela de fim da batalha -----
const achar = (caps, sala) => caps.findIndex(c => c.sala === sala);
// A captura desta sala. O lendário da torre só é sorteado aqui (escolherEsp devolve o id da espécie) e fica gravado: recarregar a página não sorteia de novo.
export const prepararCaptura = (chave, escolherEsp, sala) => escrever(async tx => {
  const us = await tx.get(ref(chave));
  if (!us.exists()) throw new Error("Conta não encontrada. Entre de novo.");
  const caps = [...(us.data().capturas || [])], i = achar(caps, sala);
  if (i < 0) return null;
  if (!caps[i].esp) {
    const esp = escolherEsp();
    if (!esp) throw new Error("Não há lendários no catálogo para sortear.");
    caps[i] = {...caps[i], esp: String(esp)}; tx.update(ref(chave), {capturas: caps});
  }
  return {...caps[i]};
});
// Um lançamento de Pokébola (grátis, sem limite): capturou → vira um Pokémon da conta (IVs e shiny sorteados); fugiu → acabou; escapou → continua.
export const tentarCaptura = (chave, sala) => escrever(async tx => {
  const us = await tx.get(ref(chave));
  if (!us.exists()) throw new Error("Conta não encontrada. Entre de novo.");
  const caps = [...(us.data().capturas || [])], i = achar(caps, sala), c = caps[i];
  if (!c?.esp) throw new Error("Você não tem nenhuma captura em andamento.");
  const resultado = tentativaCaptura(c.tipo), tentativas = (c.tentativas || 0) + 1;
  if (resultado === "escapou") { caps[i] = {...c, tentativas}; tx.update(ref(chave), {capturas: caps}); return {resultado, tentativas}; }
  caps.splice(i, 1);
  if (resultado === "fugiu") { tx.update(ref(chave), {capturas: caps}); return {resultado, tentativas, esp: c.esp}; }
  const id = novoIdPokemon(), reg = novoPokemon(c.esp);
  // lendário capturado numa raid: a conta guarda que já o conseguiu por lá (ele não volta a aparecer como chefe, nem se for trocado depois)
  const raid = c.tipo === "raid" ? {raidCapturados: [...new Set([...(us.data().raidCapturados || []), String(c.esp)])]} : {};
  tx.update(ref(chave), {capturas: caps, [`pokemons.${id}`]: reg, ...raid});
  return {resultado, tentativas, esp: c.esp, pokemon: {id, ...reg}};
});
// Raid: espécies que esta conta já capturou pela raid (nunca mais aparecem como chefe)
export async function lerRaidCapturados(chave) {
  const s = await lerDoc(chave);
  return s.exists() ? s.data().raidCapturados || [] : [];
}
// ----- Missões: usuarios/<nick>.missoes = { idDaMissão: true } marca as já resgatadas -----
export async function lerMissoes(chave) {
  const s = await lerDoc(chave);
  return s.exists() ? s.data().missoes || {} : {};
}
// Resgata o lendário de uma missão: confere de novo, dentro da transação, se a conta tem todos os Pokémon exigidos (exigidos = ids de espécie) e se a missão ainda não foi resgatada
export const resgatarMissao = (chave, missaoId, espId, exigidos) => escrever(async tx => {
  const us = await tx.get(ref(chave));
  if (!us.exists()) throw new Error("Conta não encontrada. Entre de novo.");
  const d = us.data();
  if ((d.missoes || {})[missaoId]) throw new Error("Esta missão já foi resgatada.");
  const tem = new Set(Object.values(d.pokemons || {}).map(r => String(r.esp)));
  const faltam = exigidos.filter(e => !tem.has(String(e))).length;
  if (faltam) throw new Error(`Ainda ${faltam === 1 ? "falta 1 Pokémon" : `faltam ${faltam} Pokémon`} para completar esta missão.`);
  const id = novoIdPokemon(), reg = novoPokemon(espId);
  tx.update(ref(chave), {[`pokemons.${id}`]: reg, [`missoes.${missaoId}`]: true});
  return {id, ...reg};
});
// Sair da sala sem terminar a captura: o Pokémon vai embora
export const descartarCaptura = (chave, sala) => escrever(async tx => {
  const us = await tx.get(ref(chave)); if (!us.exists()) return;
  const caps = us.data().capturas || [];
  if (caps.some(c => c.sala === sala)) tx.update(ref(chave), {capturas: caps.filter(c => c.sala !== sala)});
});
// Shiny por instância ({idDaInstância: true}) — usado em Meus Pokémon e na batalha
export const lerShiny = async chave => shinyPorInstancia(await lerPokemons(chave));
// Shiny por espécie ({idDaEspécie: true}) — usado no catálogo: mostra a arte shiny das espécies que a conta tem shiny
export const lerShinyEspecies = async chave => shinyPorEspecie(await lerPokemons(chave));
// Permissão especial: a conta escolhe quais Pokémon dela são shiny (liga e desliga quando quiser, em "Meus Pokémon").
// A permissão é marcada à mão no Firestore: usuarios/<nick>.permissoes = { shinyLivre: true }. Só visual.
export async function podeEscolherShiny(chave) {
  const s = await lerDoc(chave);
  return s.exists() && !!s.data().permissoes?.shinyLivre;
}
// Usado na tela de admin: dá ou tira a permissão (a conta precisa já existir).
export const definirPermissaoShiny = (chave, ligado) => escrever(async tx => {
  const us = await tx.get(ref(chave));
  if (!us.exists()) throw new Error("Conta não encontrada. Confira o nickname.");
  tx.update(ref(chave), {"permissoes.shinyLivre": !!ligado});
  return !!ligado;
});
export const definirShiny = (chave, pokemonId, ligado) => escrever(async tx => {
  const us = await tx.get(ref(chave));
  if (!us.exists()) throw new Error("Conta não encontrada. Entre de novo.");
  if (!us.data().permissoes?.shinyLivre) throw new Error("Esta conta não tem permissão para escolher shiny.");
  const pokemons = us.data().pokemons || {};
  if (!pokemons[pokemonId]) throw new Error("Pokémon não encontrado na conta.");
  tx.update(ref(chave), {[`pokemons.${pokemonId}.shiny`]: !!ligado});
  return shinyPorInstancia({...pokemons, [pokemonId]: {...pokemons[pokemonId], shiny: !!ligado}});
});
export async function criarConta(nick, senha) {
  nick = nick.trim();
  if (!/^[\p{L}\p{N}_.-]{3,20}$/u.test(nick)) throw new Error("O nickname precisa ter de 3 a 20 caracteres (letras, números, _ . -).");
  if (senha.length < 4) throw new Error("A senha precisa ter pelo menos 4 caracteres.");
  const k = chaveDe(nick);
  if ((await getDoc(ref(k))).exists()) throw new Error("Esse nickname já está em uso.");
  await setDoc(ref(k), {nick, senha: await senhaHash(k, senha), builds: {}, pokemons: {}});
  return entrou(nick, k);
}
export async function entrarConta(nick, senha) {
  const k = chaveDe(nick), s = await getDoc(ref(k));
  if (!s.exists() || s.data().senha !== await senhaHash(k, senha)) throw new Error("Nickname ou senha incorretos.");
  return entrou(s.data().nick || k, k); // conta antiga sem o campo nick: usa a chave
}

// builds do usuário: { idDoPokemon: [nomes dos golpes] }
export async function lerBuilds(chave) {
  const s = await lerDoc(chave);
  return s.exists() ? s.data().builds || {} : {};
}
export async function salvarBuild(chave, pokemonId, nomes) { // lista vazia remove a build
  const s = await getDoc(ref(chave));
  if (!s.exists()) throw new Error("Conta não encontrada. Entre de novo.");
  const dados = s.data(), builds = {...(dados.builds || {})};
  if (nomes.length) builds[pokemonId] = nomes; else delete builds[pokemonId];
  await setDoc(ref(chave), {...dados, builds}); lidos.clear();
  return builds;
}

// ----- vitórias, poções e revives -----
// Cada vitória rende 1 Poção; a cada VITORIAS_POR_REVIVER vitórias, também 1 Reviver. Usar um item gasta 1 do estoque.
export const VITORIAS_POR_REVIVER = 20;
export async function lerStatus(chave) {
  const s = await lerDoc(chave), d = s.exists() ? s.data() : {};
  return {vitorias: d.vitorias || 0, pocoes: d.pocoes || 0, revives: d.revives || 0, ...infoNivel(xpDe(d)), pontos: pontosLivres(d), zcristais: d.zcristais || 0, caixas: caixasLivres(d)}; // + xp, nivel, noNivel, falta, pct... e pontos de treino livres
}

// ----- times salvos na conta: [{id, nome, ids: [id do Pokémon, ...até 6]}] -----
export const MAX_TIMES = 10;
export async function lerTimes(chave) {
  const s = await lerDoc(chave);
  return s.exists() ? s.data().times || [] : [];
}
export async function salvarTimes(chave, times) {
  if (times.length > MAX_TIMES) throw new Error(`O máximo é ${MAX_TIMES} times.`);
  lidos.clear(); await updateDoc(ref(chave), {times: times.map(t => ({id: String(t.id), nome: String(t.nome).slice(0, 24), ids: t.ids.slice(0, 6)}))});
  return times;
}

// ----- nível dos Pokémon da conta: niveis = {idDoPokemon: nível}; sem registro = nível inicial (REGRAS.nivel) -----
export async function lerNiveis(chave) {
  const s = await lerDoc(chave);
  return s.exists() ? s.data().niveis || {} : {};
}
// Gasta 1 ponto de treino para subir 1 nível do Pokémon (dentro de uma transação: não dá para gastar o mesmo ponto duas vezes)
export const subirNivelPokemon = (chave, pokemonId) => escrever(async tx => {
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
export const darCristais = (chave, n) => escrever(async tx => {
  const us = await tx.get(ref(chave));
  if (!us.exists()) throw new Error("Conta não encontrada.");
  const total = Math.max(0, (us.data().zcristais || 0) + Math.floor(n));
  tx.update(ref(chave), {zcristais: total});
  return total;
});
export const chaveDeNick = chaveDe;

// ----- habilidade escolhida por Pokémon: habilidades = {idDoPokemon: idDaHabilidade} (efeitos em batalha: etapa seguinte) -----
export async function lerEscolhasHab(chave) {
  const s = await lerDoc(chave);
  return s.exists() ? s.data().habilidades || {} : {};
}
export const salvarEscolhaHab = (chave, pokemonId, habId) => escrever(async tx => {
  const us = await tx.get(ref(chave));
  if (!us.exists()) throw new Error("Conta não encontrada. Entre de novo.");
  const habilidades = {...(us.data().habilidades || {}), [pokemonId]: String(habId).slice(0, 60)};
  tx.update(ref(chave), {habilidades});
  return habilidades;
});

// ----- inventário de itens segurados: itens = {idDoItem: cópias} · itensEq = {idDoPokemon: idDoItem} -----
export async function lerInventario(chave) {
  const s = await lerDoc(chave), d = s.exists() ? s.data() : {};
  return {itens: d.itens || {}, itensEq: d.itensEq || {}};
}
// Abre 1 caixa (cada nível da conta rende 1): 5 coisas entre itens e cristais Z (5+0, 4+1, 3+2 ou 2+3). Tudo na mesma transação, então não dá para abrir a mesma caixa duas vezes.
// escolherEsp: devolve o id da espécie sorteada para a Pokébola da caixa (usa o catálogo, que só a página tem)
export const abrirCaixa = (chave, escolherEsp = null) => escrever(async tx => {
  const us = await tx.get(ref(chave));
  if (!us.exists()) throw new Error("Conta não encontrada. Entre de novo.");
  const d = us.data();
  if (caixasLivres(d) < 1) throw new Error("Você não tem caixas para abrir: cada nível da conta rende 1 caixa.");
  const r = sortearCaixa(), atualiza = {caixasAbertas: (d.caixasAbertas || 0) + 1};
  if (r.cristais) atualiza.zcristais = (d.zcristais || 0) + r.cristais;
  const itens = {...(d.itens || {})}, jaTinha = [];
  for (const id of r.itens) { jaTinha.push((itens[id] || 0) > 0); itens[id] = (itens[id] || 0) + 1; }
  if (r.itens.length) atualiza.itens = itens;
  let pokemon = null; // Pokébola (20%): um Pokémon aleatório já vem para a conta, com IVs e shiny sorteados
  if (r.pokebola) { const esp = escolherEsp?.(); if (esp) { const id = novoIdPokemon(), reg = novoPokemon(esp); atualiza[`pokemons.${id}`] = reg; pokemon = {id, ...reg}; } }
  tx.update(ref(chave), atualiza);
  return {...r, jaTinha, pokemon};
});
// Equipa (ou tira, com null) o item de um Pokémon. Cada cópia do item só segura em 1 Pokémon por vez.
export const equiparItem = (chave, pokemonId, id) => escrever(async tx => {
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
