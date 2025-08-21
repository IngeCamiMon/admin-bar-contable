import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-storage.js";

// 🔧 Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBeVENCs0g6GKaC0rCX0oqL4RaMMX9WXn8",
  authDomain: "admin-contable-bar.firebaseapp.com",
  projectId: "admin-contable-bar",
  storageBucket: "admin-contable-bar.appspot.com",
  messagingSenderId: "1078832671503",
  appId: "1:1078832671503:web:3236a74fbd9a06cff2ac7a",
  measurementId: "G-94QSZG5092",
};

// 🚀 Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// 📊 Obtener ventas entre fechas
export const obtenerVentasEntreFechas = async (desde, hasta) => {
  const ventasRef = collection(db, "ventas");
  const desdeDate = new Date(desde + "T00:00:00");
  const hastaDate = new Date(hasta + "T23:59:59");

  const q = query(
    ventasRef,
    where("estado", "==", "pagada"),
    where("fecha", ">=", Timestamp.fromDate(desdeDate)),
    where("fecha", "<=", Timestamp.fromDate(hastaDate))
  );

  const querySnapshot = await getDocs(q);
  const ventas = [];

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    const fechaStr = data?.fecha?.toDate().toLocaleDateString("sv-SE") || "";

    if (Array.isArray(data.productos)) {
      ventas.push({
        id: doc.id,
        fecha: fechaStr,
        productos: data.productos.map((producto) => ({
          productoId: producto.productoId || "",
          nombre: producto.nombre || "",
          categoriaId: producto.categoriaId || "",
          nombreCategoria: producto.nombreCategoria || "",
          cantidad: Number(producto.cantidad || 0),
          subtotal: Number(producto.subtotal || 0),
        })),
        metodoPago: data.metodoPago || "",
        total: Number(data.total || 0),
      });
    }
  });

  return ventas;
};

// 💸 Obtener gastos entre fechas
export const obtenerGastosEntreFechas = async (desde, hasta) => {
  const gastosRef = collection(db, "gastos");
  const desdeDate = new Date(desde + "T00:00:00");
  const hastaDate = new Date(hasta + "T23:59:59");

  const q = query(
    gastosRef,
    where("fecha", ">=", Timestamp.fromDate(desdeDate)),
    where("fecha", "<=", Timestamp.fromDate(hastaDate))
  );

  const querySnapshot = await getDocs(q);
  const gastos = [];

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    gastos.push({
      id: doc.id,
      valor: Number(data?.valor || 0),
      fecha: data?.fecha?.toDate().toLocaleDateString("sv-SE") || "",
      descripcion: data?.descripcion || "",
      categoria: data?.categoria || "",
    });
  });

  return gastos;
};

// 💳 Obtener pagos entre fechas
export const obtenerPagosEntreFechas = async (desde, hasta) => {
  const pagosRef = collection(db, "pagos");
  const desdeDate = new Date(desde + "T00:00:00");
  const hastaDate = new Date(hasta + "T23:59:59");

  const q = query(
    pagosRef,
    where("fecha", ">=", Timestamp.fromDate(desdeDate)),
    where("fecha", "<=", Timestamp.fromDate(hastaDate))
  );

  const querySnapshot = await getDocs(q);
  const pagos = [];

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    pagos.push({
      id: doc.id,
      valor: Number(data?.monto || 0),
      fecha: data?.fecha?.toDate().toLocaleDateString("sv-SE") || "",
      descripcion: data?.descripcion || "",
      metodo: data?.metodo || "",
      categoria: data?.categoria || "",
    });
  });

  return pagos;
};

// 📦 Obtener productos
export const obtenerProductos = async () => {
  const productosRef = collection(db, "productos");
  const querySnapshot = await getDocs(productosRef);
  const productos = [];

  querySnapshot.forEach((doc) => {
    productos.push({
      id: doc.id,
      ...doc.data(),
    });
  });

  return productos;
};

// 🗂️ Obtener categorías
export const obtenerCategorias = async () => {
  const categoriasRef = collection(db, "categorias");
  const querySnapshot = await getDocs(categoriasRef);
  const categorias = [];

  querySnapshot.forEach((doc) => {
    categorias.push({
      id: doc.id,
      ...doc.data(),
    });
  });

  return categorias;
};

// 🔁 Exportaciones finales
export { db, auth, storage };
