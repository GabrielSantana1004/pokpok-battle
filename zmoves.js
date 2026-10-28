// Golpes Z (funções puras, sem Firebase).
// Um golpe de dano vira o golpe Z do seu TIPO, com poder dado pela tabela oficial. O golpe Z sempre acerta, não tem efeitos secundários,
// tem prioridade 0 e atravessa Protect causando 25% do dano. Cada equipe só usa 1 por batalha e gasta 1 Cristal Z da conta.

export const Z_NOMES = {
  Normal: "Breakneck Blitz", Fighting: "All-Out Pummeling", Flying: "Supersonic Skystrike", Poison: "Acid Downpour", Ground: "Tectonic Rage",
  Rock: "Continental Crush", Bug: "Savage Spin-Out", Ghost: "Never-Ending Nightmare", Steel: "Corkscrew Crash", Fire: "Inferno Overdrive",
  Water: "Hydro Vortex", Grass: "Bloom Doom", Electric: "Gigavolt Havoc", Psychic: "Shattered Psyche", Ice: "Subzero Slammer",
  Dragon: "Devastating Drake", Dark: "Black Hole Eclipse", Fairy: "Twinkle Tackle"
};

// Poder do golpe Z a partir do poder do golpe original (tabela oficial)
export function poderZ(p) {
  return p <= 55 ? 100 : p <= 65 ? 120 : p <= 75 ? 140 : p <= 85 ? 160 : p <= 95 ? 175 : p <= 100 ? 180 : p <= 110 ? 185 : p <= 125 ? 190 : p <= 130 ? 195 : 200;
}

// Só golpes de dano com poder definido viram golpe Z (golpes de status e de dano fixo, não)
export const elegivelZ = m => !!m && m.cat !== "status" && m.poder > 0 && !!Z_NOMES[m.tipo];

// O golpe Z correspondente (ou null)
export const golpeZ = m => elegivelZ(m)
  ? {id: "z-" + (m.id || m.nome), nome: Z_NOMES[m.tipo], tipo: m.tipo, cat: m.cat, poder: poderZ(m.poder), precisao: null, prioridade: 0, efeitos: [], alvoTipo: m.alvoTipo ?? null, nota: `Golpe Z de ${m.nome}`, z: true}
  : null;
