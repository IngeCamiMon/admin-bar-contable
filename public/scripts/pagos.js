import { db } from "./firebase-config.js";
import {
  collection, addDoc, getDocs, Timestamp,
  doc, deleteDoc, updateDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

const formPago = document.getElementById("formPago");
const tablaPagos = document.getElementById("tablaPagos");
const modalEditar = document.getElementById("modalEditar");
const formEditarPago = document.getElementById("formEditarPago");

formPago.addEventListener("submit", async (e) => {
  e.preventDefault();

  const beneficiario = document.getElementById("beneficiario").value;
  const monto = parseFloat(document.getElementById("monto").value);
  const categoria = document.getElementById("categoria").value;
  const fechaInput = document.getElementById("fechaPago").value;
  const [year, month, day] = fechaInput.split("-").map(Number);
  const fechaPago = new Date(year, month - 1, day, 12);
  const referencia = document.getElementById("referencia").value;
  const estado = document.getElementById("estadoPago").value;
  const numFactura = document.getElementById("numFactura").value;
  const ordenCompra = document.getElementById("ordenCompra").value;

  try {
    await addDoc(collection(db, "pagos"), {
      beneficiario, monto, categoria,
      fecha: Timestamp.fromDate(fechaPago),
      referencia, estado,
      numFactura, ordenCompra
    });

    alert("Pago registrado correctamente");
    formPago.reset();
    cargarPagos();
  } catch (err) {
    alert("Error al registrar el pago: " + err.message);
  }
});

async function cargarPagos() {
  tablaPagos.innerHTML = "";
  const snapshot = await getDocs(collection(db, "pagos"));
  snapshot.forEach(docSnap => {
    const p = docSnap.data();
    const id = docSnap.id;
    const fechaFormateada = p.fecha?.toDate().toISOString().split("T")[0] || "";

    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${p.beneficiario}</td>
      <td>$${p.monto.toFixed(2)}</td>
      <td>${p.categoria}</td>
      <td>${fechaFormateada}</td>
      <td>${p.estado}</td>
      <td>${p.referencia || ""}</td>
      <td>${p.numFactura || ""}</td>
      <td>${p.ordenCompra || ""}</td>
      <td class="acciones">
        <button onclick="editarPago('${id}')">Editar</button>
        <button onclick="eliminarPago('${id}')">Eliminar</button>
      </td>
    `;
    tablaPagos.appendChild(fila);
  });
}

window.editarPago = async (id) => {
  const docRef = doc(db, "pagos", id);
  const snap = await getDoc(docRef);
  const p = snap.data();
  const fecha = p.fecha?.toDate().toISOString().split("T")[0] || "";

  formEditarPago.innerHTML = `
    <input type="text" id="editBeneficiario" value="${p.beneficiario}" required />
    <input type="number" id="editMonto" value="${p.monto}" required />
    <select id="editCategoria" required>
      <option ${p.categoria === 'Proveedor' ? 'selected' : ''}>Proveedor</option>
      <option ${p.categoria === 'Empleado' ? 'selected' : ''}>Empleado</option>
      <option ${p.categoria === 'Servicios' ? 'selected' : ''}>Servicios</option>
    </select>
    <input type="date" id="editFechaPago" value="${fecha}" required />
    <textarea id="editReferencia">${p.referencia || ''}</textarea>
    <input type="text" id="editNumFactura" value="${p.numFactura || ''}" />
    <input type="text" id="editOrdenCompra" value="${p.ordenCompra || ''}" />
    <select id="editEstado" required>
      <option value="pendiente" ${p.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
      <option value="pagado" ${p.estado === 'pagado' ? 'selected' : ''}>Pagado</option>
      <option value="programado" ${p.estado === 'programado' ? 'selected' : ''}>Programado</option>
    </select>
    <button type="submit">Guardar Cambios</button>
    <button type="button" onclick="document.getElementById('modalEditar').style.display='none'">Cancelar</button>
  `;

  modalEditar.style.display = "flex";

  formEditarPago.onsubmit = async (e) => {
    e.preventDefault();

    try {
      const fechaInput = document.getElementById("editFechaPago").value;
      const [year, month, day] = fechaInput.split("-").map(Number);
      const fechaPago = new Date(year, month - 1, day, 12);

      await updateDoc(docRef, {
        beneficiario: document.getElementById("editBeneficiario").value,
        monto: parseFloat(document.getElementById("editMonto").value),
        categoria: document.getElementById("editCategoria").value,
        fecha: Timestamp.fromDate(fechaPago),
        referencia: document.getElementById("editReferencia").value,
        estado: document.getElementById("editEstado").value,
        numFactura: document.getElementById("editNumFactura").value,
        ordenCompra: document.getElementById("editOrdenCompra").value
      });

      alert("Pago actualizado correctamente");
      modalEditar.style.display = "none";
      cargarPagos();
    } catch (error) {
      alert("Error al actualizar: " + error.message);
    }
  };
};

window.eliminarPago = async (id) => {
  if (confirm("¿Eliminar este pago?")) {
    try {
      await deleteDoc(doc(db, "pagos", id));
      cargarPagos();
    } catch (error) {
      alert("Error al eliminar: " + error.message);
    }
  }
};

cargarPagos();
