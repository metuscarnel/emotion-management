import { db, ref, set, push, get, ensureAuth } from "./firebase-config.js";

const anonymousBlock = document.getElementById("anonymousBlock");
const namedBlock = document.getElementById("namedBlock");

const studentNumber = document.getElementById("studentNumber");
const studentEmail = document.getElementById("studentEmail");
const roomCode = document.getElementById("roomCode");
const errorMsg = document.getElementById("errorMsg");

function getFirebaseErrorMessage(error) {
  const code = error?.code || "";
  const message = error?.message || "";

  if (code === "auth/operation-not-allowed") {
    return "Firebase Auth: activez Anonymous dans Authentication > Sign-in method.";
  }

  if (code === "auth/unauthorized-domain") {
    return "Domaine non autorise: ajoutez localhost dans Authorized domains.";
  }

  if (code === "auth/network-request-failed") {
    return "Reseau indisponible: verifiez votre connexion internet.";
  }

  if (code === "database/permission-denied") {
    return "Realtime Database refuse l'ecriture: verifiez vos regles.";
  }

  if (code === "database/invalid-path") {
    return "Code salle invalide pour Firebase: utilisez 8 caracteres sans . # $ [ ] /.";
  }

  return `Impossible d'enregistrer la participation (${code || "erreur inconnue"}). ${message}`.trim();
}

document.querySelectorAll('input[name="mode"]').forEach(radio => {
  radio.addEventListener("change", () => {
    if (radio.value === "anonymous" && radio.checked) {
      anonymousBlock.classList.remove("disabled");
      namedBlock.classList.add("disabled");
    }
    if (radio.value === "named" && radio.checked) {
      namedBlock.classList.remove("disabled");
      anonymousBlock.classList.add("disabled");
    }
  });
});

document.getElementById("joinForm").addEventListener("submit", async e => {
  e.preventDefault();
  errorMsg.textContent = "";

  // Numéro étudiant : 8 chiffres
  if (!namedBlock.classList.contains("disabled")) {
    if (!/^\d{8}$/.test(studentNumber.value)) {
      errorMsg.textContent = "Le numéro étudiant doit contenir exactement 8 chiffres.";
      return;
    }

    // Email étudiant
    if (!/^[a-z]+\.[a-z]+@etu\.u-paris\.fr$/i.test(studentEmail.value)) {
      errorMsg.textContent = "Le mail étudiant doit être du type prenom.nom@etu.u-paris.fr";
      return;
    }
  }

  // Code salle : 8 caractères
  if (!/^.{8}$/.test(roomCode.value)) {
    errorMsg.textContent = "Le code de la salle doit contenir exactement 8 caractères.";
    return;
  }

  // Firebase Realtime Database interdit ces caractères dans les clés: . # $ [ ] /
  if (/[.#$\[\]/]/.test(roomCode.value)) {
    errorMsg.textContent = "Le code de la salle doit contenir 8 caractères sans . # $ [ ] /.";
    return;
  }

  try {
    const user = await ensureAuth();
    const isNamed = !namedBlock.classList.contains("disabled");
    const teacherName = (document.getElementById("teacherName")?.value || "").trim();
    const roomCodeValue = roomCode.value.trim();

    const roomMetaRef = ref(db, `rooms/${roomCodeValue}/meta`);
    const roomMetaSnapshot = await get(roomMetaRef);

    if (!roomMetaSnapshot.exists()) {
      errorMsg.textContent = "Cette salle n'existe pas. Verifiez le code fourni par votre professeur.";
      return;
    }

    const anonymousInputs = anonymousBlock.querySelectorAll("input[type='text']");
    const namedLastNameInput = namedBlock.querySelector(".row input:nth-child(1)");
    const namedFirstNameInput = namedBlock.querySelector(".row input:nth-child(2)");

    const payload = {
      uid: user.uid,
      mode: isNamed ? "named" : "anonymous",
      studentNumber: isNamed ? studentNumber.value.trim() : "",
      studentEmail: isNamed ? studentEmail.value.trim() : "",
      lastName: isNamed
        ? (namedLastNameInput?.value || "").trim()
        : (anonymousInputs[0]?.value || "").trim(),
      firstName: isNamed
        ? (namedFirstNameInput?.value || "").trim()
        : (anonymousInputs[1]?.value || "").trim(),
      teacherName,
      connected: true,
      joinedAt: Date.now()
    };

    const participantsRef = ref(db, `rooms/${roomCodeValue}/participants`);
    const newParticipantRef = push(participantsRef);
    await set(newParticipantRef, payload);

    localStorage.setItem("currentRoomCode", roomCodeValue);
    localStorage.setItem("currentParticipantKey", newParticipantRef.key || "");

    window.location.href = `rejoindresalle.html?room=${encodeURIComponent(roomCodeValue)}`;
  } catch (error) {
    errorMsg.textContent = getFirebaseErrorMessage(error);
    console.error(error);
    return;
  }
});