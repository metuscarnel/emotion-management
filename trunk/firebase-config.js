import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-analytics.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  set,
  push,
  update,
  onValue,
  get,
  onDisconnect
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyA1ZGfgTl5fEBWBQjTHBThUzDl53mRJfxk",
  authDomain: "projetl2t1-767a4.firebaseapp.com",
  databaseURL: "https://projetl2t1-767a4-default-rtdb.firebaseio.com",
  projectId: "projetl2t1-767a4",
  storageBucket: "projetl2t1-767a4.firebasestorage.app",
  messagingSenderId: "228102026615",
  appId: "1:228102026615:web:531fae710ee4c073ab1d72",
  measurementId: "G-3Z1NJL7E6L"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

let analytics = null;
try {
  analytics = getAnalytics(app);
} catch (error) {
  // Analytics peut ne pas être disponible en contexte local.
  console.warn("Analytics indisponible:", error?.message || error);
}

let authPromise = null;

function ensureAuth() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);

  if (!authPromise) {
    authPromise = signInAnonymously(auth)
      .then((credential) => credential.user)
      .catch((error) => {
        authPromise = null;
        throw error;
      });
  }

  return authPromise;
}

export {
  app,
  analytics,
  auth,
  db,
  ref,
  set,
  push,
  update,
  onValue,
  get,
  onDisconnect,
  ensureAuth
};