// Leitura da coleção "golpes" do Firebase (golpes de status e seus efeitos)
import "./firebase.js"; // inicializa o app com o seu firebaseConfig
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { slugGolpe } from "./golpesapi.js";
import { lerCache, gravarCache } from "./cache.js";
const TTL = 24 * 60 * 60 * 1000; // os efeitos dos golpes quase não mudam: 24 horas
const db = getFirestore();

// Devolve { "Nome do golpe": dados } só para os que existem na coleção.
// Cada golpe é lido uma vez e fica no cache (inclusive "não existe": a maioria dos golpes de dano não está na coleção e antes era relido a cada batalha).
export async function golpesDe(nomes) {
  const mapa = {}, faltam = [];
  await Promise.all([...new Set(nomes)].map(async n => {
    const c = await lerCache("golpe:" + slugGolpe(n), TTL);
    if (c === undefined) faltam.push(n); else if (c) mapa[n] = c;
  }));
  try {
    await Promise.all(faltam.map(async n => {
      const s = await getDoc(doc(db, "golpes", slugGolpe(n))), d = s.exists() ? s.data() : null;
      if (d) mapa[n] = d;
      await gravarCache("golpe:" + slugGolpe(n), d);
    }));
  } catch(e) { throw new Error("Não consegui ler a coleção de golpes. Confira as regras do Firestore (coleção golpes)."); }
  return mapa;
}
