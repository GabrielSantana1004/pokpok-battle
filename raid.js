// Modo Raid (funções puras, sem Firebase): a lista de lendários que podem aparecer como chefe e a escolha do chefe de cada conta.
// Regras: o chefe tem 6x o HP normal; o jogador luta com até 6 Pokémon (megas à vontade, golpe Z em Pokémon já megaevoluído); vencer dá a chance
// de capturá-lo, sem risco de fuga. Cada lendário só pode ser conseguido UMA vez pela raid em cada conta (por troca ou pela torre dá para ter mais).
import { chaveNome, ehMissao } from "./pokemons.js";

export const HP_RAID = 6;
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
export const escolherChefe = (catalogo, tem, jaCapturados, rng = Math.random) => { const l = chefesPossiveis(catalogo, tem, jaCapturados); return l.length ? l[Math.floor(rng() * l.length)] : null; };
