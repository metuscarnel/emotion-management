import { auth, db, ref, set, ensureAuth } from "./firebase-config.js";

const emailInput = document.getElementById("email");
const submitBtn = document.getElementById("submitBtn");
const errorMessage = document.getElementById("errorMessage");

const emailRegex = /^[a-z]+\.[a-z]+@u-paris\.fr$/;

function getFirebaseErrorMessage(error) {
  const code = error?.code || "";

  if (code === "auth/operation-not-allowed") {
    return "⚠️ Firebase Auth: activez Anonymous dans Authentication > Sign-in method.";
  }

  if (code === "auth/unauthorized-domain") {
    return "⚠️ Domaine non autorisé: ajoutez votre domaine dans Authentication > Settings > Authorized domains.";
  }

  if (code === "auth/network-request-failed") {
    return "⚠️ Réseau indisponible: vérifiez votre connexion internet.";
  }

  if (code === "database/permission-denied") {
    return "⚠️ Realtime Database refuse l'écriture: vérifiez vos règles de sécurité.";
  }

  return "⚠️ Erreur Firebase : impossible d'enregistrer le compte pour le moment.";
}

// Validation en temps réel du mail
emailInput.addEventListener("input", () => {
  if (!emailRegex.test(emailInput.value)) {
    emailInput.classList.add("error-input");
  } else {
    emailInput.classList.remove("error-input");
  }
});

// Validation globale avant navigation
submitBtn.addEventListener("click", async (event) => {
  const inputs = document.querySelectorAll("input");
  let valid = true;

  inputs.forEach(input => {
    if (input.value.trim() === "") {
      input.classList.add("error-input");
      valid = false;
    } else {
      input.classList.remove("error-input");
    }
  });

  if (!emailRegex.test(emailInput.value)) {
    emailInput.classList.add("error-input");
    valid = false;
  }

  if (!valid) {
    errorMessage.style.display = "block";
    event.preventDefault(); // bloque le lien
  } else {
    errorMessage.style.display = "none";

    event.preventDefault();
    try {
      const user = await ensureAuth();
      const teacherRef = ref(db, `teachers/${user.uid}`);

      await set(teacherRef, {
        nom: document.getElementById("nom")?.value.trim() || "",
        prenom: document.getElementById("prenom")?.value.trim() || "",
        email: emailInput.value.trim(),
        matiere: document.getElementById("matiere")?.value.trim() || "",
        uid: auth.currentUser?.uid || user.uid,
        createdAt: Date.now()
      });

      window.location.href = submitBtn.getAttribute("href") || "identifprof.html";
    } catch (error) {
      console.error(error);
      errorMessage.textContent = getFirebaseErrorMessage(error);
      errorMessage.style.display = "block";
    }
  }
});