import { db } from "./firebase-config.js";
import {
  collection, addDoc, getDocs, updateDoc, doc, Timestamp, query
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

const mesasContainer = document.getElementById("mesasContainer");
const productoSelect = document.getElementById("productoSelect");
const formVenta = document.getElementById("formVenta");
const tablaDetalle = document.querySelector("#tablaDetalle tbody");
const totalVenta = document.getElementById("totalVenta");
const mesaSeleccionada = document.getElementById("mesaSeleccionada");
const detalleVenta = document.getElementById("detalleVenta");
const btnFinalizarVenta = document.getElementById("btnFinalizarVenta");
const btnAgregarMesa = document.getElementById("btnAgregarMesa");
const btnCancelarVenta = document.getElementById("btnCancelarVenta");

let mesas = 6;
let mesaActual = null;
let ventaActual = [];
let mesaContador = mesas + 1;

let ventasPorMesa = JSON.parse(localStorage.getItem("ventasPorMesa")) || {};

function guardarVentasLocal() {
  localStorage.setItem("ventasPorMesa", JSON.stringify(ventasPorMesa));
}

function crearBotonMesa(num, extra = false) {
  const btn = document.createElement("div");
  btn.style.display = "inline-block";
  btn.style.margin = "5px";

  const mesaBtn = document.createElement("button");
  mesaBtn.textContent = `Mesa ${num}`;
  mesaBtn.onclick = () => seleccionarMesa(num);
  mesaBtn.style.marginRight = "5px";

  if (ventasPorMesa[num]) {
    mesaBtn.style.backgroundColor = "#ffc107";
  }

  btn.appendChild(mesaBtn);

  if (extra) {
    const eliminarBtn = document.createElement("button");
    eliminarBtn.textContent = "❌";
    eliminarBtn.style.backgroundColor = "red";
    eliminarBtn.style.color = "white";
    eliminarBtn.onclick = () => btn.remove();
    btn.appendChild(eliminarBtn);
  }

  mesasContainer.appendChild(btn);
}

function cargarMesas() {
  for (let i = 1; i <= mesas; i++) {
    crearBotonMesa(i);
  }
}

btnAgregarMesa.addEventListener("click", () => {
  crearBotonMesa(mesaContador, true);
  mesaContador++;
});

async function cargarProductos() {
  productoSelect.innerHTML = "";
  const snapshot = await getDocs(collection(db, "productos"));
  snapshot.forEach(docSnap => {
    const p = docSnap.data();
    productoSelect.innerHTML += `<option value="${p.nombre}" data-precio="${p.precioVenta}">${p.nombre} - $${p.precioVenta.toFixed(0)}</option>`;
  });
}

function seleccionarMesa(num) {
  mesaActual = num;
  ventaActual = ventasPorMesa[num] || [];
  mesaSeleccionada.textContent = num;
  detalleVenta.style.display = "block";
  renderizarDetalleVenta();
}

function renderizarDetalleVenta() {
  tablaDetalle.innerHTML = "";

  ventaActual.forEach((item, index) => {
    const fila = document.createElement("tr");

    fila.innerHTML = `
      <td>${item.nombre}</td>
      <td>${item.cantidad}</td>
      <td>$${item.subtotal.toFixed(0)}</td>
      <td>
        <button onclick="editarProducto(${index})">✏️</button>
        <button onclick="eliminarProducto(${index})" style="color:red;">🗑️</button>
      </td>
    `;

    tablaDetalle.appendChild(fila);
  });

  const total = ventaActual.reduce((acc, p) => acc + p.subtotal, 0);
  totalVenta.textContent = total.toFixed(0);

  ventasPorMesa[mesaActual] = ventaActual;
  guardarVentasLocal();
}

window.eliminarProducto = function (index) {
  if (confirm("¿Eliminar este producto?")) {
    ventaActual.splice(index, 1);
    renderizarDetalleVenta();
  }
};

window.editarProducto = function (index) {
  const nuevoCantidad = prompt("Nueva cantidad:", ventaActual[index].cantidad);
  if (nuevoCantidad && !isNaN(nuevoCantidad)) {
    const item = ventaActual[index];
    item.cantidad = parseInt(nuevoCantidad);
    item.subtotal = item.cantidad * item.precio;
    renderizarDetalleVenta();
  }
};

formVenta.addEventListener("submit", (e) => {
  e.preventDefault();
  const nombre = productoSelect.value;
  const precio = parseFloat(productoSelect.selectedOptions[0].dataset.precio);
  const cantidad = parseInt(document.getElementById("cantidadProducto").value);
  const subtotal = cantidad * precio;

  ventaActual.push({ nombre, cantidad, precio, subtotal });
  renderizarDetalleVenta();

  formVenta.reset();
  document.getElementById("cantidadProducto").value = 1;
});

btnFinalizarVenta.addEventListener("click", async () => {
  if (!ventaActual.length) return alert("No hay productos en la venta");

  const total = ventaActual.reduce((acc, p) => acc + p.subtotal, 0);
  const venta = {
    mesa: mesaActual,
    productos: ventaActual,
    total,
    estado: "pagada",
    fecha: Timestamp.now()
  };

  try {
    await addDoc(collection(db, "ventas"), venta);

    for (let item of ventaActual) {
      const q = query(collection(db, "productos"));
      const snapshot = await getDocs(q);

      snapshot.forEach(async docSnap => {
        const data = docSnap.data();
        if (data.nombre === item.nombre) {
          const nuevoStock = (data.cantidad || 0) - item.cantidad;
          const productoRef = doc(db, "productos", docSnap.id);
          await updateDoc(productoRef, { cantidad: nuevoStock });

          await addDoc(collection(db, "movimientosInventario"), {
            producto: item.nombre,
            tipo: "salida",
            cantidad: item.cantidad,
            fecha: Timestamp.now(),
            motivo: `Venta mesa ${mesaActual}`
          });
        }
      });
    }

    alert("Venta registrada y stock actualizado");
    delete ventasPorMesa[mesaActual];
    guardarVentasLocal();
    detalleVenta.style.display = "none";
    ventaActual = [];
  } catch (err) {
    alert("Error: " + err.message);
  }
});

btnCancelarVenta?.addEventListener("click", () => {
  if (!mesaActual) return;

  if (confirm(`¿Cancelar venta en Mesa ${mesaActual}?`)) {
    delete ventasPorMesa[mesaActual];
    guardarVentasLocal();
    ventaActual = [];
    tablaDetalle.innerHTML = "";
    totalVenta.textContent = "0";
    detalleVenta.style.display = "none";
  }
});

cargarMesas();
cargarProductos();
