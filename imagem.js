// Imagens dos Pokémon via PokéAPI (https://pokeapi.co), buscadas pelo nome.
// Cada Pokémon é buscado uma vez e o resultado fica guardado no navegador.
//  - imagemDe / carregarImagens: arte oficial (catálogo, cadastro, miniaturas)
//  - spriteImg / carregarSprites: sprites animados da batalha (frente e costas)
const CHAVE = "pbb_img5"; // 5: guarda também a altura real (alt, em decímetros); 4: imagens shiny
const REPO = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";
let cache = {};
try { cache = JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch(e) {}

export const slug = n => n.toLowerCase().replace(/♀/g, "-f").replace(/♂/g, "-m")
  .replace(/[.'’:]/g, "").replace(/é/g, "e").trim().replace(/\s+/g, "-");
const at = t => String(t).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

// a = arte oficial, f/b = GIF animado de frente/costas, sf/sb = imagem parada de frente/costas
function dadosDe(d) {
  const s = d?.sprites, id = d?.id;
  return {
    a: s?.other?.["official-artwork"]?.front_default || "",
    f: s?.other?.showdown?.front_default || (id ? `${REPO}/other/showdown/${id}.gif` : ""),
    b: s?.other?.showdown?.back_default || (id ? `${REPO}/other/showdown/back/${id}.gif` : ""),
    sf: s?.front_default || "",
    sb: s?.back_default || "",
    as: s?.other?.["official-artwork"]?.front_shiny || (id ? `${REPO}/other/official-artwork/shiny/${id}.png` : ""), // shiny: arte oficial, GIFs e imagens paradas
    fs: s?.other?.showdown?.front_shiny || (id ? `${REPO}/other/showdown/shiny/${id}.gif` : ""),
    bs: s?.other?.showdown?.back_shiny || (id ? `${REPO}/other/showdown/back/shiny/${id}.gif` : ""),
    sfs: s?.front_shiny || "",
    sbs: s?.back_shiny || "",
    n: id || 0, // número do Pokémon (até 649 = pixel art de verdade)
    alt: d?.height || 0 // altura real em decímetros (PokeAPI): define o tamanho do sprite na batalha
  };
}
const temAlgo = d => d && [d.a, d.f, d.b, d.sf, d.sb].some(Boolean);

async function buscar(s) {
  let r = await fetch("https://pokeapi.co/api/v2/pokemon/" + s);
  if (r.ok) return dadosDe(await r.json());
  // espécies com várias formas (ex.: deoxys, giratina): usa a forma padrão
  r = await fetch("https://pokeapi.co/api/v2/pokemon-species/" + s);
  if (!r.ok) return null;
  const v = (await r.json()).varieties.find(v => v.is_default);
  if (!v) return null;
  r = await fetch(v.pokemon.url);
  return r.ok ? dadosDe(await r.json()) : null;
}

const pendentes = {};
export function spritesDe(nome) {
  const s = slug(nome);
  if (cache[s]) return Promise.resolve(cache[s]);
  if (!pendentes[s]) {
    pendentes[s] = buscar(s).catch(() => null).then(d => {
      if (!temAlgo(d)) return null;
      cache[s] = d;
      try { localStorage.setItem(CHAVE, JSON.stringify(cache)); } catch(e) {}
      return d;
    });
  }
  return pendentes[s];
}
export const imagemDe = (nome, shiny = false) => spritesDe(nome).then(d => d ? (shiny ? (d.as || d.sfs || "") : "") || d.a || d.sf || "" : "");

// Preenche todas as <img data-pokemon="Nome"> dentro de "raiz" com a arte oficial
export function carregarImagens(raiz = document) {
  raiz.querySelectorAll("img[data-pokemon]").forEach(img => {
    const shiny = img.dataset.shiny === "1"; // <img data-pokemon="Nome" data-shiny="1"> mostra a arte oficial shiny
    imagemDe(img.dataset.pokemon, shiny).then(u => {
      if (!u) return img.classList.add("sem-foto");
      if (shiny) img.onerror = () => { img.onerror = null; imagemDe(img.dataset.pokemon).then(n => { if (n) img.src = n; }); }; // sem arte shiny: usa a normal
      img.src = u;
    });
  });
}

// ----- sprites da batalha -----
// Ordem de preferência; se uma imagem não existir ou falhar, tenta a próxima:
//   frente: GIF animado → imagem parada → arte oficial
//   costas: GIF de costas → imagem parada de costas → (as de frente)
const filaDe = (d, lado, shiny = false) => {
  const normal = lado === "costas" ? [d.b, d.sb, d.f, d.sf, d.a] : [d.f, d.sf, d.a];
  const brilho = lado === "costas" ? [d.bs, d.sbs, d.fs, d.sfs, d.as] : [d.fs, d.sfs, d.as];
  return (shiny ? [...brilho, ...normal] : normal).filter(Boolean); // shiny que não existir cai para a imagem normal
};

let estilo = false;
function injetarEstilo() {
  if (estilo || typeof document === "undefined") return;
  estilo = true;
  const e = document.createElement("style");
  e.textContent = `
.palco { height: 240px; display: flex; align-items: flex-end; justify-content: center;
  background: radial-gradient(ellipse 38% 9% at 50% 88%, rgba(0,0,0,.22) 0 70%, transparent 72%); }
.sprite { max-height: 215px; max-width: 100%; height: auto; margin-bottom: 12px; object-fit: contain; }
.sprite.pixel { image-rendering: pixelated; }
.sprite.sem-foto { opacity: .3; }`;
  document.head.appendChild(e);
}

// HTML do sprite; se o Pokémon já estiver em cache a imagem entra direto (sem piscar)
export function spriteImg(nome, lado = "frente", shiny = false) {
  injetarEstilo();
  const d = cache[slug(nome)], u = d ? (filaDe(d, lado, shiny)[0] || "") : "";
  return `<img class="sprite" data-sprite="${at(nome)}" data-lado="${lado}"${shiny ? ' data-shiny="1"' : ""}${d ? ` data-n="${d.n || 0}" data-alt="${d.alt || 0}"` : ""} alt=""${u ? ` src="${at(u)}"` : ""}>`;
}

// Tamanho na tela.
//  - na batalha (dentro de .spot): proporcional à ALTURA REAL do Pokémon (PokeAPI), em escala de log:
//    0,2 m ou menos = 30% da caixa, 6 m ou mais = 100% da caixa. Assim Wailord é enorme e Joltik é minúsculo.
//  - fora da batalha (catálogo): o sprite cresce só um pouco com o tamanho original, de forma suave.
//  Nunca passa da caixa onde está (.spot da batalha).
//  - até a 5ª geração (pixel art): escala inteira (2×, 3×...), a mais próxima do tamanho desejado, para ficar nítido
//  - gerações seguintes (imagens suaves): escala contínua, até 2×
export function ajustar(img) {
  const h = img.naturalHeight, w = img.naturalWidth;
  if (!h) return;
  const n = +img.dataset.n || 0, caixa = img.closest ? img.closest(".spot") : null;
  const maxH = caixa && caixa.clientHeight ? caixa.clientHeight * 0.92 : 215, maxW = caixa && caixa.clientWidth ? caixa.clientWidth * 0.96 : 9999;
  let pixel = n > 0 && n <= 649, k;
  const alvo = Math.min(215, maxH, 170 * Math.pow(h / 100, 0.4)), alt = +img.dataset.alt || 0;
  if (caixa && alt > 0) { // proporção pela altura real
    const t = Math.min(1, Math.max(0, (Math.log(alt) - Math.log(2)) / (Math.log(60) - Math.log(2))));
    k = Math.min(maxH * (0.3 + 0.7 * t) / h, maxW / w);
  }
  else if (h > maxH || w > maxW) { pixel = false; k = Math.min(maxH / h, maxW / w); }          // não cabe: reduz até caber
  else if (pixel) { k = 1; for (const c of [2, 3, 4]) if (h * c <= maxH && w * c <= maxW && Math.abs(h * c - alvo) < Math.abs(h * k - alvo)) k = c; }
  else k = Math.min(2, alvo / h, maxW / w);
  img.style.width = Math.round(w * k) + "px";
  img.style.height = "auto";
  img.classList.toggle("pixel", pixel && k > 1);
}

export function carregarSprites(raiz = document) {
  raiz.querySelectorAll("img[data-sprite]").forEach(img => {
    img.onload = () => ajustar(img);
    if (img.complete && img.naturalHeight) ajustar(img);
    spritesDe(img.dataset.sprite).then(d => {
      if (d) { img.dataset.n = d.n || 0; img.dataset.alt = d.alt || 0; if (img.complete && img.naturalHeight) ajustar(img); }
      const fila = d ? filaDe(d, img.dataset.lado, img.dataset.shiny === "1") : [];
      if (!fila.length) { img.classList.add("sem-foto"); return; }
      const atual = img.getAttribute("src");
      let i = Math.max(0, fila.indexOf(atual));
      img.onerror = () => { if (++i < fila.length) img.src = fila[i]; else img.classList.add("sem-foto"); };
      if (atual !== fila[i]) img.src = fila[i];
    });
  });
}
