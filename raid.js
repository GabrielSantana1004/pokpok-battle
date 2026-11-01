// Modo Raid (funções puras, sem Firebase): a lista de lendários que podem aparecer como chefe e a escolha do chefe de cada conta.
// Regras: o chefe tem 6x o HP normal; o jogador luta com até 6 Pokémon (megas à vontade, golpe Z em Pokémon já megaevoluído); vencer dá a chance
// de capturá-lo, sem risco de fuga. Cada lendário só pode ser conseguido UMA vez pela raid em cada conta (por troca ou pela torre dá para ter mais).
import { chaveNome, ehMissao } from "./pokemons.js";

export const RAID_LENDARIOS = [
  "Articuno", "Azelf", "Chien-Pao", "Cresselia", "Dialga", "Entei", "Giratina", "Hoopa", "Jirachi", "Latias", "Latios", "Lunala", "Magearna",
  "Manaphy", "Melmetal", "Mesprit", "Mew", "Moltres", "Palkia", "Phione", "Raikou", "Reshiram", "Solgaleo", "Suicune", "Tapu Bulu", "Tapu Fini",
  "Tapu Koko", "Tapu Lele", "Uxie", "Victini", "Volcanion", "Xerneas", "Yveltal", "Zacian", "Zamazenta", "Zapdos", "Zekrom", "Zeraora"
];
const CHAVES = RAID_LENDARIOS.map(chaveNome);
// o nome é da lista ou de uma forma dela (ex.: "Urshifu Rapid Strike", "Giratina Origin")
export const ehRaid = nome => { const k = chaveNome(nome); return CHAVES.some(l => k.startsWith(l)) && !ehMissao(nome); }; // "Mew" é prefixo de "Mewtwo": os de missão são barrados à parte

// Nomes da lista que não aparecem no catálogo (a tela de admin pode usar isto para avisar)
export const raidForaDoCatalogo = catalogo => { const ks = catalogo.map(p => chaveNome(p.nome)); return RAID_LENDARIOS.filter(n => !ks.some(c => c.startsWith(chaveNome(n)))); };

// Espécies que podem ser o chefe desta conta: da lista, com golpes cadastrados, que a conta não tem agora e nunca capturou pela raid
export const chefesPossiveis = (catalogo, tem = new Set(), jaCapturados = []) => {
  const fora = new Set([...tem, ...jaCapturados].map(String));
  return catalogo.filter(p => ehRaid(p.nome) && (p.aprende?.length || p.mv?.length) && !fora.has(String(p.id)));
};
// O Mew é raríssimo: se ele ainda pode aparecer, a chance dele ser o chefe é de só 0,5%; os outros dividem o resto igualmente.
// Devolve null se não há ninguém disponível (ou se só faltava o Mew e ele não saiu no sorteio).
export const CHANCE_MEW = 0.005;
export const ehMew = nome => chaveNome(nome) === "mew";
export const escolherChefe = (catalogo, tem, jaCapturados, rng = Math.random) => {
  const lista = chefesPossiveis(catalogo, tem, jaCapturados), mew = lista.find(p => ehMew(p.nome)), outros = lista.filter(p => !ehMew(p.nome));
  if (mew && rng() < CHANCE_MEW) return mew;
  return outros.length ? outros[Math.floor(rng() * outros.length)] : null;
};

// ----- Pressão da raid: o chefe começa contido e vai se libertando enquanto a luta se arrasta -----
// 1) Começa com Ataque e Ataque Especial reduzidos (RAID.inicio, -2 = metade do dano): a luta começa longa e dá tempo de montar a estratégia.
// 2) Fúria por fases: ao cair para 75%, 50% e 25% do HP ele ganha estágios de ataque (e Speed na 2ª fase) e fica cada vez mais perigoso.
// 3) Passar do tempo: a cada RAID.tempo.cada rodadas ele ganha +1 de Ataque e Ataque Especial, até +RAID.tempo.max. Ficar enrolando não compensa.
// 4) Itens limitados: cada jogador só pode usar RAID.itens itens (Poção + Reviver) na raid inteira. Cristais Z não contam.
// Para ajustar a dificuldade, mexa só em RAID: hp (multiplicador de HP), itens, inicio, tempo e fases.
export const RAID = {
  hp: 8, itens: 15, inicio: {atk: -2, spa: -2}, tempo: {cada: 14, max: 2}, // calibrado em simulações: dá uma luta longa (~23 rodadas) e vencível para um time bem jogado
  fases: [
    {pct: 0.75, est: {atk: 1, spa: 1}, msg: "O chefe se agita e fica mais forte!"},
    {pct: 0.50, est: {atk: 1, spa: 1}, msg: "O chefe está furioso! Ele ataca com mais força!"},
    {pct: 0.25, est: {atk: 1, spa: 1, spe: 1}, msg: "FÚRIA FINAL! O chefe luta com tudo!"}
  ]
};
export const HP_RAID = RAID.hp;
export const LIMITE_ITENS_RAID = RAID.itens;
const sobe = (P, est) => { for (const [k, n] of Object.entries(est)) P.est[k] = Math.max(-6, Math.min(6, (P.est[k] || 0) + n)); };
// Chamada uma vez, quando o chefe é criado (em confirmarEquipe)
export const chefeInicial = boss => sobe(boss, RAID.inicio);
// Chamada depois de cada rodada resolvida (em salas.js). Guarda o progresso na própria sala (s.raidFase, s.raidTempo).
export function pressaoRaid(s) {
  const boss = s.j?.["2"]?.equipe?.[0];
  if (!s.raid || s.fase !== "batalha" || !boss || boss.hpAtual <= 0 || !boss.est) return;
  while ((s.raidFase || 0) < RAID.fases.length && boss.hpAtual / boss.hp <= RAID.fases[s.raidFase || 0].pct) {
    const f = RAID.fases[s.raidFase || 0]; sobe(boss, f.est); s.log.push(`⚠️ ${f.msg}`); s.raidFase = (s.raidFase || 0) + 1;
  }
  const devido = Math.min(RAID.tempo.max, Math.floor(((s.rodada || 1) - 1) / RAID.tempo.cada));
  while ((s.raidTempo || 0) < devido) { sobe(boss, {atk: 1, spa: 1}); s.raidTempo = (s.raidTempo || 0) + 1; s.log.push("⏳ O tempo passa e o chefe fica mais forte! Ataque e Ataque Especial +1."); }
}
