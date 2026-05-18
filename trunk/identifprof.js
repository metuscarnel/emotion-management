import { db, ref, onValue, ensureAuth } from "./firebase-config.js";

// Redirection auto si déjà connecté
if (localStorage.getItem("currentTeacherUid")) {
  window.location.href = "dashboard-prof.html";
}

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function normalize(value) {
  return (value || "").trim().toLowerCase();
}

function isValidRoomCode(value) {
  return /^[A-Z]{4}\d{4}$/.test((value || "").trim().toUpperCase());
}

function readTeachersOnce() {
  return new Promise((resolve, reject) => {
    const teachersRef = ref(db, "teachers");

    onValue(
      teachersRef,
      (snapshot) => {
        resolve(snapshot.val() || {});
      },
      {
        onlyOnce: true
      }
    );
  });
}

function getFirebaseErrorMessage(error) {
  const code = error?.code || "";

  if (code === "auth/operation-not-allowed") {
    return "Firebase Auth: activez Anonymous dans Authentication > Sign-in method.";
  }

  if (code === "auth/unauthorized-domain") {
    return "Domaine non autorise: ajoutez localhost dans Authorized domains.";
  }

  if (code === "database/permission-denied") {
    return "Realtime Database refuse la lecture: verifiez vos regles.";
  }

  return "Impossible de verifier le compte professeur pour le moment.";
}

document.getElementById("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";

  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!emailRegex.test(email)) {
    loginError.textContent = "Le format du mail est invalide.";
    return;
  }

  if (!password) {
    loginError.textContent = "Veuillez renseigner le mot de passe.";
    return;
  }

  try {
    await ensureAuth();

    const teachers = await readTeachersOnce();
    const foundEntry = Object.entries(teachers).find(([, teacher]) => {
      return (
        normalize(teacher?.email) === normalize(email) &&
        teacher?.password === password // Case sensitive for password
      );
    });

    if (!foundEntry) {
      loginError.textContent = "Aucun compte trouve avec ce mail et ce mot de passe.";
      return;
    }

    const [teacherUid, teacherData] = foundEntry;
    localStorage.setItem("currentTeacherUid", teacherUid);
    localStorage.setItem("currentTeacherEmail", teacherData?.email || "");

    const teacherDisplayName = [teacherData?.prenom, teacherData?.nom].filter(Boolean).join(" ").trim();
    if (teacherDisplayName) {
      localStorage.setItem("currentTeacherDisplayName", teacherDisplayName);
    }

    const lastRoomCode = (teacherData?.lastRoomCode || "").trim().toUpperCase();
    if (isValidRoomCode(lastRoomCode)) {
      localStorage.setItem("currentRoomCode", lastRoomCode);
    }

    // Toujours rediriger vers le tableau de bord
    window.location.href = "dashboard-prof.html";
  } catch (error) {
    console.error(error);
    loginError.textContent = getFirebaseErrorMessage(error);
  }
});
