// Leitura da coleção "golpes" do Firebase (golpes de status e seus efeitos)
import "./firebase.js"; // inicializa o app com o seu firebaseConfig
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { slugGolpe } from "./golpesapi.js";
const db = getFirestore();

// Devolve { "Nome do golpe": dados } só para os que existem na coleção
export async function golpesDe(nomes) {
  const mapa = {};
  try {
    await Promise.all([...new Set(nomes)].map(async n => {
      const s = await getDoc(doc(db, "golpes", slugGolpe(n)));
      if (s.exists()) mapa[n] = s.data();
    }));
  } catch(e) { throw new Error("Não consegui ler a coleção de golpes. Confira as regras do Firestore (coleção golpes)."); }
  return mapa;
}
