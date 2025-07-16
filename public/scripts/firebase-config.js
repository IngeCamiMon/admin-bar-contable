// scripts/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBeVENCs0g6GKaC0rCX0oqL4RaMMX9WXn8",
  authDomain: "admin-contable-bar.firebaseapp.com",
  projectId: "admin-contable-bar",
  storageBucket: "admin-contable-bar.firebasestorage.app",
  messagingSenderId: "1078832671503",
  appId: "1:1078832671503:web:3236a74fbd9a06cff2ac7a",
  measurementId: "G-94QSZG5092",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
