import { db } from "./firebase-config.js";
import {
  collection, addDoc, getDocs
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

const formCategoria = document.getElementById("formCategoria");
const tablaCategorias = document.querySelector("#tablaCategorias tbody");

// Guardar categoría
formCategoria.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nombre = document.getElementById("nombreCategoria").value.trim();

  if (!nombre) {
    alert("Ingrese un nombre válido");
    return;
  }

  try {
    await addDoc(collection(db, "categorias"), { nombre });
    alert("Categoría registrada");
    formCategoria.reset();
    cargarCategorias();
  } catch (err) {
    alert("Error al guardar: " + err.message);
  }
});

// Cargar categorías en tabla
async function cargarCategorias() {
  tablaCategorias.innerHTML = "";
  const snapshot = await getDocs(collection(db, "categorias"));
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const fila = `<tr><td>${data.nombre}</td></tr>`;
    tablaCategorias.innerHTML += fila;
  });
}

// Inicialización
cargarCategorias();
