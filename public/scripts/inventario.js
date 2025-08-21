import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

const form = document.getElementById("formProducto");
const tabla = document.querySelector("#tablaInventario tbody");
const categoriaSelect = document.getElementById("categoria");
const filtroCategoria = document.getElementById("filtroCategoria");
const filtroProducto = document.getElementById("filtroProducto");

let categorias = {};

async function cargarCategorias() {
  categoriaSelect.innerHTML = `<option value="">Seleccione una categoría</option>`;
  filtroCategoria.innerHTML = `<option value="">Todas</option>`;
  const snapshot = await getDocs(collection(db, "categorias"));

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    categorias[docSnap.id] = data.nombre;

    const option1 = new Option(data.nombre, docSnap.id);
    const option2 = new Option(data.nombre, docSnap.id);
    categoriaSelect.appendChild(option1);
    filtroCategoria.appendChild(option2);
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nombre = document.getElementById("nombre").value;
  const categoriaId = categoriaSelect.value;
  const categoriaNombre = categoriaSelect.options[categoriaSelect.selectedIndex].text;
  const cantidad = parseInt(document.getElementById("cantidad").value);
  const precioCosto = parseFloat(document.getElementById("precioCosto").value);
  const precioVenta = parseFloat(document.getElementById("precioVenta").value);

  if (!categoriaId) {
    alert("Seleccione una categoría válida");
    return;
  }

  const producto = {
    nombre,
    categoriaId,
    nombreCategoria: categoriaNombre,
    cantidad,
    precioCosto,
    precioVenta,
    creado: new Date(),
  };

  try {
    await addDoc(collection(db, "productos"), producto);
    alert("Producto guardado exitosamente");
    form.reset();
    cargarInventario();
  } catch (err) {
    alert("Error al guardar: " + err.message);
  }
});

filtroCategoria.addEventListener("change", cargarInventario);
filtroProducto.addEventListener("input", cargarInventario);

async function cargarInventario() {
  tabla.innerHTML = "";
  const filtroCat = filtroCategoria.value;
  const filtroNom = filtroProducto.value.toLowerCase();

  const snapshot = await getDocs(collection(db, "productos"));
  const productosPorCategoria = {};

  snapshot.forEach((docSnap) => {
    const p = docSnap.data();
    const id = docSnap.id;

    if (filtroCat && p.categoriaId !== filtroCat) return;
    if (filtroNom && !p.nombre.toLowerCase().includes(filtroNom)) return;

    if (!productosPorCategoria[p.categoriaId]) {
      productosPorCategoria[p.categoriaId] = [];
    }

    productosPorCategoria[p.categoriaId].push({ ...p, id });
  });

  for (const categoriaId in productosPorCategoria) {
    const nombreCategoria = categorias[categoriaId] ?? "Sin categoría";
    const filaCategoria = document.createElement("tr");
    filaCategoria.innerHTML = `<td colspan="5"><strong>${nombreCategoria}</strong></td>`;
    tabla.appendChild(filaCategoria);

    productosPorCategoria[categoriaId].forEach((p) => {
      const alerta = p.cantidad < 5 ? "⚠️ Bajo stock" : "";
      const fila = document.createElement("tr");

      fila.innerHTML = `
  <td>${p.nombre}</td>
  <td>${p.nombreCategoria}</td>
  <td>${p.cantidad}</td>
  <td>$${p.precioCosto?.toFixed(2) ?? "0.00"}</td>
  <td>$${p.precioVenta.toFixed(2)}</td>
  <td>
    ${alerta}
    <button onclick="agregarStock('${p.id}', ${p.cantidad})" title="Agregar stock">➕</button>
    <button onclick="editarProducto('${p.id}')" title="Editar">✏️</button>
    <button onclick="eliminarProducto('${p.id}')" title="Eliminar" style="color:red;">🗑️</button>
  </td>
`;

      tabla.appendChild(fila);
    });
  }
}

// --- FUNCIONALIDAD MODAL DE EDICIÓN ---
let productoIdEditar = "";

window.editarProducto = async function (id) {
  productoIdEditar = id;
  const docRef = doc(db, "productos", id);
  const snap = await getDoc(docRef);
  const producto = snap.data();

  if (!producto) return alert("Producto no encontrado");

  document.getElementById("editarNombre").value = producto.nombre;
  document.getElementById("editarCantidad").value = producto.cantidad;
  document.getElementById("editarPrecioCosto").value = producto.precioCosto;
  document.getElementById("editarPrecioVenta").value = producto.precioVenta;

  const editarCategoria = document.getElementById("editarCategoria");
  editarCategoria.innerHTML = `<option value="">Seleccione categoría</option>`;
  for (const id in categorias) {
    const option = new Option(categorias[id], id);
    if (id === producto.categoriaId) option.selected = true;
    editarCategoria.appendChild(option);
  }

  document.getElementById("modalEditarProducto").style.display = "block";
};

window.cerrarModalEditar = function () {
  document.getElementById("modalEditarProducto").style.display = "none";
};

window.confirmarEdicionProducto = async function () {
  const nombre = document.getElementById("editarNombre").value.trim();
  const cantidad = parseInt(document.getElementById("editarCantidad").value);
  const precioCosto = parseFloat(document.getElementById("editarPrecioCosto").value);
  const precioVenta = parseFloat(document.getElementById("editarPrecioVenta").value);
  const categoriaId = document.getElementById("editarCategoria").value;
  const nombreCategoria = categorias[categoriaId];

  if (!nombre || isNaN(cantidad) || isNaN(precioCosto) || isNaN(precioVenta) || !categoriaId) {
    alert("Complete todos los campos correctamente");
    return;
  }

  const ref = doc(db, "productos", productoIdEditar);

  await updateDoc(ref, {
    nombre,
    cantidad,
    precioCosto,
    precioVenta,
    categoriaId,
    nombreCategoria,
  });

  cerrarModalEditar();
  alert("Producto actualizado correctamente");
  cargarInventario();
};

window.eliminarProducto = async function (id) {
  if (confirm("¿Está seguro de eliminar este producto?")) {
    await deleteDoc(doc(db, "productos", id));
    alert("Producto eliminado");
    cargarInventario();
  }
};

cargarCategorias();
cargarInventario();
