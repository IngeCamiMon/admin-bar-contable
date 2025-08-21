import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
  doc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

const form = document.getElementById("formGasto");
const tabla = document.querySelector("#tablaGastos tbody");

const modal = document.getElementById("modalEditar");
const cerrarModal = document.getElementById("cerrarModal");
const formEditar = document.getElementById("formEditar");

cerrarModal.onclick = () => modal.style.display = "none";
window.onclick = (e) => { if (e.target == modal) modal.style.display = "none"; };

// Registrar gasto
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const descripcion = document.getElementById("descripcion").value.trim();
  const valor = parseFloat(document.getElementById("valor").value);
  const fecha = document.getElementById("fecha").value;
  const categoria = document.getElementById("categoria").value.trim();

  if (!descripcion || isNaN(valor) || !fecha || !categoria) {
    alert("Por favor completa todos los campos correctamente.");
    return;
  }

  const gasto = {
    descripcion,
    valor,
    categoria,
    fecha: Timestamp.fromDate(new Date(fecha)),
  };

  try {
    await addDoc(collection(db, "gastos"), gasto);
    alert("✅ Gasto registrado con éxito.");
    form.reset();
    cargarGastos();
  } catch (err) {
    alert("❌ Error al registrar gasto: " + err.message);
  }
});

// Mostrar gastos
async function cargarGastos() {
  tabla.innerHTML = "";
  const q = query(collection(db, "gastos"), orderBy("fecha", "desc"));
  const snapshot = await getDocs(q);

  snapshot.forEach((docSnap) => {
    const g = docSnap.data();
    const id = docSnap.id;
    const fechaFormateada = g.fecha.toDate().toISOString().split("T")[0];

    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${fechaFormateada}</td>
      <td>${g.descripcion}</td>
      <td>${g.categoria}</td>
      <td>$${Number(g.valor).toFixed(2)}</td>
      <td class="acciones">
        <button onclick="editarGasto('${id}', '${g.descripcion}', '${g.valor}', '${fechaFormateada}', '${g.categoria}')">✏️</button>
        <button onclick="eliminarGasto('${id}')">🗑️</button>
      </td>
    `;
    tabla.appendChild(fila);
  });
}

// Eliminar gasto
window.eliminarGasto = async (id) => {
  if (!confirm("¿Eliminar este gasto?")) return;

  try {
    await deleteDoc(doc(db, "gastos", id));
    alert("✅ Gasto eliminado.");
    cargarGastos();
  } catch (err) {
    alert("❌ Error al eliminar gasto: " + err.message);
  }
};

// Editar gasto (abrir modal con datos)
window.editarGasto = (id, descripcion, valor, fecha, categoria) => {
  document.getElementById("idEditar").value = id;
  document.getElementById("descripcionEditar").value = descripcion;
  document.getElementById("valorEditar").value = valor;
  document.getElementById("fechaEditar").value = fecha;
  document.getElementById("categoriaEditar").value = categoria;
  modal.style.display = "flex";
};

// Guardar cambios al editar
formEditar.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = document.getElementById("idEditar").value;
  const descripcion = document.getElementById("descripcionEditar").value.trim();
  const valor = parseFloat(document.getElementById("valorEditar").value);
  const fecha = document.getElementById("fechaEditar").value;
  const categoria = document.getElementById("categoriaEditar").value;

  if (!descripcion || isNaN(valor) || !fecha || !categoria) {
    alert("Completa todos los campos correctamente.");
    return;
  }

  try {
    const ref = doc(db, "gastos", id);
    await updateDoc(ref, {
      descripcion,
      valor,
      categoria,
      fecha: Timestamp.fromDate(new Date(fecha)),
    });

    alert("✅ Gasto actualizado.");
    modal.style.display = "none";
    cargarGastos();
  } catch (err) {
    alert("❌ Error al actualizar gasto: " + err.message);
  }
});

cargarGastos();
