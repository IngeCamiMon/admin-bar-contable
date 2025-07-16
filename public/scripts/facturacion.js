// scripts/facturacion.js
import { db } from "./firebase-config.js";
import { collection, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

const productosContainer = document.getElementById("productosContainer");
const btnAgregarProducto = document.getElementById("agregarProducto");
const facturaForm = document.getElementById("facturaForm");
const facturaPOS = document.getElementById("facturaPOS");

let productos = [];

btnAgregarProducto.addEventListener("click", () => {
  const div = document.createElement("div");
  div.classList.add("producto");

  div.innerHTML = `
    <input type="text" placeholder="Producto" class="nombre" required />
    <input type="number" placeholder="Cantidad" class="cantidad" min="1" required />
    <input type="number" placeholder="Precio" class="precio" min="0" step="0.01" required />
    <button type="button" class="eliminar">❌</button>
  `;
  productosContainer.appendChild(div);

  div.querySelector(".eliminar").addEventListener("click", () => {
    productosContainer.removeChild(div);
  });
});

facturaForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const cliente = document.getElementById("cliente").value;
  const productosHTML = productosContainer.querySelectorAll(".producto");
  productos = [];

  let total = 0;
  productosHTML.forEach(prod => {
    const nombre = prod.querySelector(".nombre").value;
    const cantidad = parseInt(prod.querySelector(".cantidad").value);
    const precio = parseFloat(prod.querySelector(".precio").value);
    const subtotal = cantidad * precio;

    productos.push({ nombre, cantidad, precio, subtotal });
    total += subtotal;
  });

  const factura = {
    cliente,
    productos,
    total,
    fecha: Timestamp.now()
  };

  try {
    const docRef = await addDoc(collection(db, "facturas"), factura);
    alert("Factura registrada");
    mostrarPOS(docRef.id, factura);
  } catch (error) {
    alert("Error al registrar factura: " + error.message);
  }
});

function mostrarPOS(id, factura) {
  facturaPOS.style.display = "block";
  facturaPOS.innerHTML = `
    <div style="font-family:monospace; background:#fff; padding:10px; border:1px solid #ccc;">
      <h3>Factura #${id.slice(0, 8)}</h3>
      <p>Cliente/Mesa: ${factura.cliente}</p>
      <p>Fecha: ${new Date().toLocaleString()}</p>
      <hr/>
      ${factura.productos.map(p => `
        ${p.nombre} x${p.cantidad} @ ${p.precio.toFixed(2)} = $${p.subtotal.toFixed(2)}
      `).join("<br>")}
      <hr/>
      <strong>Total: $${factura.total.toFixed(2)}</strong><br/><br/>
      <button onclick="window.print()">🖨 Imprimir</button>
    </div>
  `;
}
