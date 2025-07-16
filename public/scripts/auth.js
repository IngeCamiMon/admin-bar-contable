// scripts/auth.js
import { auth, db } from "./firebase-config.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// Registro
const registerForm = document.getElementById("registerForm");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const role = document.getElementById("role").value;

    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "usuarios", userCred.user.uid), {
        email,
        role,
        creado: new Date()
      });
      alert("Registro exitoso");
      window.location.href = "login.html";
    } catch (error) {
      alert("Error: " + error.message);
    }
  });
}

// Login
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, "usuarios", userCred.user.uid));
      if (userDoc.exists()) {
        const role = userDoc.data().role;
        localStorage.setItem("role", role);
        localStorage.setItem("uid", userCred.user.uid);
        window.location.href = "dashboard.html";
      } else {
        alert("Usuario sin perfil asociado");
      }
    } catch (error) {
      alert("Error: " + error.message);
    }
  });
}
