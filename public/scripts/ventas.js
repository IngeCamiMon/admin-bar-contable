import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  runTransaction,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// Elementos del DOM
const mesasContainer = document.getElementById("mesasContainer");
const mesaSeleccionadaElem = document.getElementById("mesaSeleccionada");
const detalleVenta = document.getElementById("detalleVenta");
const productoSelect = document.getElementById("productoSelect");
const cantidadInput = document.getElementById("cantidadProducto");
const formVenta = document.getElementById("formVenta");
const tablaDetalle = document.querySelector("#tablaDetalle tbody");
const totalVentaElem = document.getElementById("totalVenta");
const pagoEfectivoInput = document.getElementById("pagoEfectivo");
const pagoNequiInput = document.getElementById("pagoNequi");
const pagoTarjetaInput = document.getElementById("pagoTarjeta");
const btnFinalizarVenta = document.getElementById("btnFinalizarVenta");
const btnCancelarVenta = document.getElementById("btnCancelarVenta");
const btnAgregarMesa = document.getElementById("btnAgregarMesa");

const modal = document.getElementById("modalEditarProducto");
const editarCantidad = document.getElementById("editarCantidad");
const editarPrecio = document.getElementById("editarPrecio");
const guardarCambiosBtn = document.getElementById("guardarCambiosBtn");

let indexEditando = null;
let mesaActual = null;
let ventaActual = [];
let nombresMesas = {};
let ventasPorMesa = {};
let productosInfo = {}; // Cache de información de productos

// ✅ NUEVAS FUNCIONES DE VALIDACIÓN

/**
 * Valida si hay suficiente stock para un producto
 * @param {string} productoId - ID del producto
 * @param {number} cantidadSolicitada - Cantidad que se quiere vender
 * @returns {Promise<{valido: boolean, stockDisponible: number, mensaje?: string}>}
 */
async function validarStock(productoId, cantidadSolicitada) {
  try {
    const productDoc = await getDoc(doc(db, "productos", productoId));

    if (!productDoc.exists()) {
      return {
        valido: false,
        stockDisponible: 0,
        mensaje: "El producto no existe",
      };
    }

    const producto = productDoc.data();
    const stockDisponible = producto.cantidad || 0;

    // Verificar si ya hay productos de este tipo en ventas pendientes
    let cantidadEnVentasPendientes = 0;
    for (const mesaId in ventasPorMesa) {
      const productos = ventasPorMesa[mesaId] || [];
      const productoPendiente = productos.find((p) => p.id === productoId);
      if (productoPendiente) {
        cantidadEnVentasPendientes += productoPendiente.cantidad;
      }
    }

    const stockRealDisponible = stockDisponible - cantidadEnVentasPendientes;

    if (cantidadSolicitada > stockRealDisponible) {
      return {
        valido: false,
        stockDisponible: stockRealDisponible,
        mensaje: `Stock insuficiente. Disponible: ${stockRealDisponible} unidades`,
      };
    }

    return {
      valido: true,
      stockDisponible: stockRealDisponible,
    };
  } catch (error) {
    console.error("Error validando stock:", error);
    return {
      valido: false,
      stockDisponible: 0,
      mensaje: "Error al validar stock",
    };
  }
}

/**
 * Valida todo el stock de una venta antes de procesarla
 * @param {Array} productos - Array de productos a validar
 * @returns {Promise<{valido: boolean, errores: Array}>}
 */
async function validarStockCompleto(productos) {
  const errores = [];

  for (const producto of productos) {
    const validacion = await validarStock(producto.id, producto.cantidad);
    if (!validacion.valido) {
      errores.push(`${producto.nombre}: ${validacion.mensaje}`);
    }
  }

  return {
    valido: errores.length === 0,
    errores,
  };
}

/**
 * Procesa una venta usando transacciones atómicas
 * @param {Array} productos - Productos a vender
 * @param {Object} datosPago - Información de los pagos
 * @param {string} mesaId - ID de la mesa
 * @returns {Promise<boolean>} - true si la venta se procesó correctamente
 */
async function procesarVentaAtomica(productos, datosPago, mesaId) {
  try {
    return await runTransaction(db, async (transaction) => {
      // 1. Leer y validar stock actual de todos los productos
      const productosRefs = productos.map((p) => doc(db, "productos", p.id));
      const productosSnaps = await Promise.all(productosRefs.map((ref) => transaction.get(ref)));

      // Validar que todos los productos existen y tienen stock suficiente
      for (let i = 0; i < productos.length; i++) {
        const snap = productosSnaps[i];
        const producto = productos[i];

        if (!snap.exists()) {
          throw new Error(`El producto ${producto.nombre} ya no existe`);
        }

        const data = snap.data();
        const stockActual = data.cantidad || 0;

        if (stockActual < producto.cantidad) {
          throw new Error(
            `Stock insuficiente para ${producto.nombre}. ` + `Disponible: ${stockActual}, Solicitado: ${producto.cantidad}`
          );
        }
      }

      // 2. Crear la venta
      const ventaRef = doc(collection(db, "ventas"));
      transaction.set(ventaRef, {
        mesa: nombresMesas[mesaId] || `Mesa ${mesaId}`,
        productos: productos,
        total: datosPago.total,
        metodoPago: {
          efectivo: datosPago.efectivo,
          nequi: datosPago.nequi,
          tarjeta: datosPago.tarjeta,
        },
        estado: "pagada",
        fecha: Timestamp.now(),
      });

      // 3. Actualizar inventario de todos los productos
      for (let i = 0; i < productos.length; i++) {
        const snap = productosSnaps[i];
        const producto = productos[i];
        const ref = productosRefs[i];

        const stockActual = snap.data().cantidad || 0;
        const nuevoStock = Math.max(0, stockActual - producto.cantidad);

        transaction.update(ref, { cantidad: nuevoStock });
      }

      // 4. Eliminar venta pendiente
      const ventaPendienteRef = doc(db, "ventasPendientes", mesaId.toString());
      transaction.delete(ventaPendienteRef);

      return true;
    });
  } catch (error) {
    console.error("Error en transacción:", error);
    throw error;
  }
}

// Cargar productos disponibles con información de stock
async function cargarProductos() {
  productoSelect.innerHTML = '<option disabled selected value="">Seleccione un producto</option>';
  try {
    const snap = await getDocs(collection(db, "productos"));
    productosInfo = {}; // Limpiar cache

    snap.forEach((docSnap) => {
      const p = docSnap.data();
      const stock = p.cantidad || 0;

      // Guardar en cache
      productosInfo[docSnap.id] = {
        nombre: p.nombre,
        precio: p.precioVenta,
        stock: stock,
        categoriaId: p.categoriaId || "-",
        nombreCategoria: p.nombreCategoria || "-",
      };

      const opt = document.createElement("option");
      opt.value = docSnap.id;
      opt.textContent = `${p.nombre} - $${p.precioVenta} (Stock: ${stock})`;
      opt.dataset.nombre = p.nombre;
      opt.dataset.precio = p.precioVenta;
      opt.dataset.stock = stock;
      opt.dataset.categoriaId = p.categoriaId || "-";
      opt.dataset.nombreCategoria = p.nombreCategoria || "-";

      // Deshabilitar productos sin stock
      if (stock <= 0) {
        opt.disabled = true;
        opt.textContent += " - SIN STOCK";
      }

      productoSelect.appendChild(opt);
    });
  } catch (err) {
    alert("Error al cargar productos: " + err.message);
  }
  $("#productoSelect").select2({ width: "100%", placeholder: "Seleccione un producto" });
}

function obtenerDetallesProducto(id) {
  const option = [...productoSelect.options].find((opt) => opt.value === id);
  if (!option) return null;

  return {
    id,
    nombre: option.dataset.nombre,
    precio: parseFloat(option.dataset.precio),
    stock: parseInt(option.dataset.stock),
    categoriaId: option.dataset.categoriaId || "-",
    nombreCategoria: option.dataset.nombreCategoria || "-",
  };
}

// Cargar ventas pendientes desde Firestore
async function cargarVentasPendientes() {
  try {
    const snap = await getDocs(collection(db, "ventasPendientes"));
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      ventasPorMesa[data.mesaId] = data.productos;
      nombresMesas[data.mesaId] = data.nombreMesa;
    });
    renderMesas();
  } catch (err) {
    alert("No tienes permisos para leer ventas pendientes.");
    console.error(err);
  }
}

function renderMesas() {
  mesasContainer.innerHTML = "";

  const todasLasMesas = new Set([...Object.keys(nombresMesas), ...Object.keys(ventasPorMesa)]);
  if (todasLasMesas.size === 0) todasLasMesas.add("1");

  [...todasLasMesas].forEach((id) => {
    const nombreMesa = nombresMesas[id] || `Mesa ${id}`;
    const btnWrapper = document.createElement("div");
    btnWrapper.className = "mesa-wrapper";

    const btn = document.createElement("button");
    btn.textContent = nombreMesa;
    btn.className = "mesa";
    btn.onclick = () => seleccionarMesa(id);
    if (ventasPorMesa[id]?.length) {
      btn.style.backgroundColor = "#ffc107";
    }

    const btnEditar = document.createElement("button");
    btnEditar.textContent = "📝";
    btnEditar.className = "btn btn-sm";
    btnEditar.onclick = (e) => {
      e.stopPropagation();
      const nuevoNombre = prompt("Nuevo nombre para la mesa:", nombreMesa);
      if (nuevoNombre) {
        nombresMesas[id] = nuevoNombre;
        renderMesas();
      }
    };

    const btnEliminar = document.createElement("button");
    btnEliminar.textContent = "🗑️";
    btnEliminar.className = "btn btn-sm";
    btnEliminar.onclick = async (e) => {
      e.stopPropagation();
      if (ventasPorMesa[id]?.length > 0) {
        alert("No se puede eliminar la mesa porque tiene productos pendientes.");
        return;
      }
      if (confirm("¿Eliminar esta mesa?")) {
        delete ventasPorMesa[id];
        delete nombresMesas[id];
        try {
          await deleteDoc(doc(db, "ventasPendientes", id));
        } catch (err) {
          console.warn("No se pudo eliminar en Firestore:", err);
        }
        renderMesas();
      }
    };

    btnWrapper.appendChild(btn);
    btnWrapper.appendChild(btnEditar);
    btnWrapper.appendChild(btnEliminar);
    mesasContainer.appendChild(btnWrapper);
  });
}

function seleccionarMesa(id) {
  mesaActual = id;
  ventaActual = ventasPorMesa[id] || [];
  mesaSeleccionadaElem.textContent = nombresMesas[id] || `Mesa ${id}`;
  detalleVenta.style.display = "block";
  renderizarDetalle();
}

function renderizarDetalle() {
  tablaDetalle.innerHTML = "";
  let total = 0;
  ventaActual.forEach((item, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.nombre}</td>
      <td>${item.cantidad}</td>
      <td>$${(item.cantidad * item.precio).toFixed(0)}</td>
      <td>
        <button class="btn-editar" onclick="editarProducto(${idx})">✏️</button>
        <button class="btn-eliminar" onclick="eliminarProducto(${idx})" style="color:red;">🗑️</button>
      </td>`;
    tablaDetalle.appendChild(tr);
    total += item.cantidad * item.precio;
  });

  totalVentaElem.textContent = total.toFixed(0);
  ventasPorMesa[mesaActual] = ventaActual;
  guardarVentaPendiente();
}

async function guardarVentaPendiente() {
  if (!mesaActual) return;
  try {
    await setDoc(doc(db, "ventasPendientes", mesaActual.toString()), {
      mesaId: mesaActual,
      nombreMesa: nombresMesas[mesaActual] || `Mesa ${mesaActual}`,
      productos: ventaActual,
      fecha: Timestamp.now(),
    });
  } catch (err) {
    console.error("Error guardando venta pendiente:", err);
  }
}

// ✅ FORMULARIO CON VALIDACIÓN DE STOCK MEJORADA
formVenta.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!mesaActual) return alert("Selecciona una mesa");

  const cantidad = parseInt(cantidadInput.value);
  const prodId = productoSelect.value;
  const detallesProd = obtenerDetallesProducto(prodId);

  if (!prodId || !detallesProd || isNaN(cantidad) || cantidad <= 0) {
    alert("Por favor selecciona un producto válido y cantidad mayor a 0");
    return;
  }

  // Mostrar indicador de carga
  const submitBtn = formVenta.querySelector('button[type="submit"]');
  const textoOriginal = submitBtn.textContent;
  submitBtn.textContent = "Validando...";
  submitBtn.disabled = true;

  try {
    // Calcular cantidad total incluyendo lo que ya está en la venta
    const existente = ventaActual.find((x) => x.id === prodId);
    const cantidadTotal = existente ? existente.cantidad + cantidad : cantidad;

    // Validar stock
    const validacion = await validarStock(prodId, cantidadTotal);

    if (!validacion.valido) {
      alert(validacion.mensaje);
      return;
    }

    // Agregar producto a la venta
    if (existente) {
      existente.cantidad += cantidad;
    } else {
      ventaActual.push({ ...detallesProd, cantidad });
    }

    renderizarDetalle();
    formVenta.reset();
    cantidadInput.value = 1;
    $("#productoSelect").val(null).trigger("change");
  } catch (error) {
    console.error("Error al agregar producto:", error);
    alert("Error al validar el producto. Intenta de nuevo.");
  } finally {
    // Restaurar botón
    submitBtn.textContent = textoOriginal;
    submitBtn.disabled = false;
  }
});

// ✅ FINALIZAR VENTA CON TRANSACCIONES ATÓMICAS
btnFinalizarVenta.addEventListener("click", async () => {
  if (!mesaActual || ventaActual.length === 0) {
    return alert("Agrega productos para finalizar la venta");
  }

  const pagoE = parseFloat(pagoEfectivoInput.value) || 0;
  const pagoN = parseFloat(pagoNequiInput.value) || 0;
  const pagoT = parseFloat(pagoTarjetaInput.value) || 0;
  const total = ventaActual.reduce((s, i) => s + i.cantidad * i.precio, 0);

  // Validar pagos
  if (pagoE + pagoN + pagoT !== total) {
    return alert(`La suma de pagos ($${pagoE + pagoN + pagoT}) no coincide con el total ($${total})`);
  }

  // Mostrar indicador de procesamiento
  btnFinalizarVenta.textContent = "Procesando...";
  btnFinalizarVenta.disabled = true;

  try {
    // Validar stock completo antes de procesar
    const validacionCompleta = await validarStockCompleto(ventaActual);

    if (!validacionCompleta.valido) {
      alert("Errores de stock:\n" + validacionCompleta.errores.join("\n"));
      return;
    }

    // Procesar venta con transacción atómica
    await procesarVentaAtomica(ventaActual, { total, efectivo: pagoE, nequi: pagoN, tarjeta: pagoT }, mesaActual);

    alert("✅ Venta registrada exitosamente");

    // Limpiar estado local
    delete ventasPorMesa[mesaActual];
    ventaActual = [];
    detalleVenta.style.display = "none";
    pagoEfectivoInput.value = 0;
    pagoNequiInput.value = 0;
    pagoTarjetaInput.value = 0;

    // Recargar productos para actualizar stock
    await cargarProductos();
    renderMesas();
  } catch (error) {
    console.error("Error procesando venta:", error);
    alert("❌ Error al procesar la venta: " + error.message);
  } finally {
    // Restaurar botón
    btnFinalizarVenta.textContent = "Finalizar Venta";
    btnFinalizarVenta.disabled = false;
  }
});

btnCancelarVenta.addEventListener("click", async () => {
  if (!mesaActual) return;
  if (confirm("¿Cancelar esta venta?")) {
    delete ventasPorMesa[mesaActual];
    ventaActual = [];
    detalleVenta.style.display = "none";
    try {
      await deleteDoc(doc(db, "ventasPendientes", mesaActual.toString()));
    } catch (err) {
      console.warn("No se pudo borrar de Firestore:", err);
    }
    renderMesas();
  }
});

// ✅ EDITAR PRODUCTO CON VALIDACIÓN DE STOCK
window.editarProducto = async (idx) => {
  const item = ventaActual[idx];
  editarCantidad.value = item.cantidad;
  editarPrecio.value = item.precio;
  indexEditando = idx;

  // Mostrar stock disponible en el modal
  try {
    const validacion = await validarStock(item.id, 0); // Solo para obtener stock
    const stockInfo = document.getElementById("stockInfo") || document.createElement("div");
    stockInfo.id = "stockInfo";
    stockInfo.innerHTML = `<small>Stock disponible: ${validacion.stockDisponible}</small>`;

    if (!document.getElementById("stockInfo")) {
      editarCantidad.parentNode.appendChild(stockInfo);
    }
  } catch (error) {
    console.error("Error obteniendo stock:", error);
  }

  modal.style.display = "flex";
};

window.eliminarProducto = (idx) => {
  if (confirm("¿Eliminar este producto?")) {
    ventaActual.splice(idx, 1);
    renderizarDetalle();
  }
};

// ✅ GUARDAR CAMBIOS CON VALIDACIÓN
guardarCambiosBtn.addEventListener("click", async () => {
  const nuevaCantidad = parseInt(editarCantidad.value);
  const nuevoPrecio = parseFloat(editarPrecio.value);

  if (isNaN(nuevaCantidad) || nuevaCantidad <= 0 || isNaN(nuevoPrecio) || nuevoPrecio < 0) {
    alert("Por favor ingresa valores válidos");
    return;
  }

  const item = ventaActual[indexEditando];

  try {
    // Validar stock para la nueva cantidad
    const validacion = await validarStock(item.id, nuevaCantidad);

    if (!validacion.valido) {
      alert(validacion.mensaje);
      return;
    }

    // Actualizar producto
    ventaActual[indexEditando].cantidad = nuevaCantidad;
    ventaActual[indexEditando].precio = nuevoPrecio;

    renderizarDetalle();
    cerrarModal();
  } catch (error) {
    console.error("Error validando cambios:", error);
    alert("Error al validar los cambios");
  }
});

window.cerrarModal = () => {
  modal.style.display = "none";
  // Limpiar stock info si existe
  const stockInfo = document.getElementById("stockInfo");
  if (stockInfo) stockInfo.remove();
};

btnAgregarMesa.addEventListener("click", () => {
  const nuevoId = (Math.max(0, ...Object.keys(nombresMesas).map(Number)) + 1).toString();
  nombresMesas[nuevoId] = `Mesa ${nuevoId}`;
  renderMesas();
});

$(document).ready(() => {
  $("#productoSelect").select2({ width: "100%", placeholder: "Seleccione un producto" });
});

// Inicialización
cargarProductos();
cargarVentasPendientes();
