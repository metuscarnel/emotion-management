import { db, ref, onValue, ensureAuth } from "./firebase-config.js";

const emailInput = document.getElementById("email");
const matiereInput = document.getElementById("matiere");
const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");

const emailRegex = /^[a-z]+\.[a-z]+@u-paris\.fr$/i;

function normalize(value) {
  return (value || "").trim().toLowerCase();
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

loginBtn.addEventListener("click", async (event) => {
  event.preventDefault();
  loginError.textContent = "";

  const email = emailInput.value.trim();
  const matiere = matiereInput.value.trim();

  if (!emailRegex.test(email)) {
    loginError.textContent = "Le mail doit etre du type prenom.nom@u-paris.fr";
    return;
  }

  if (!matiere) {
    loginError.textContent = "Veuillez renseigner la matiere.";
    return;
  }

  try {
    await ensureAuth();

    const teachers = await readTeachersOnce();
    const foundEntry = Object.entries(teachers).find(([, teacher]) => {
      return (
        normalize(teacher?.email) === normalize(email) &&
        normalize(teacher?.matiere) === normalize(matiere)
      );
    });

    if (!foundEntry) {
      loginError.textContent = "Aucun compte trouve avec ce mail et cette matiere.";
      return;
    }

    const [teacherUid, teacherData] = foundEntry;
    localStorage.setItem("currentTeacherUid", teacherUid);
    localStorage.setItem("currentTeacherEmail", teacherData?.email || "");
    localStorage.setItem("currentTeacherMatiere", teacherData?.matiere || "");

    window.location.href = "create.html";
  } catch (error) {
    console.error(error);
    loginError.textContent = getFirebaseErrorMessage(error);
  }
});
