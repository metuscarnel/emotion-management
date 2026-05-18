import { db, ref, set, push, get, ensureAuth, onDisconnect } from "./firebase-config.js";

const anonymousBlock = document.getElementById("anonymousBlock");
const namedBlock = document.getElementById("namedBlock");

const studentNumber = document.getElementById("studentNumber");
const studentEmail = document.getElementById("studentEmail");
const roomCode = document.getElementById("roomCode");
const errorMsg = document.getElementById("errorMsg");

function logFirebase(message, type = "info") {
  const prefix = `[Firebase][ACCESS][${type.toUpperCase()}]`;
  if (type === "error") {
    console.error(prefix, message);
    return;
  }
  if (type === "success") {
    console.log(prefix, message);
    return;
  }
  console.info(prefix, message);
}

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

function normalizeRoomCode(value) {
  return (value || "").trim().toUpperCase();
}

function isValidRoomCode(value) {
  return /^[A-Z]{4}\d{4}$/.test(value);
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

  roomCode.value = normalizeRoomCode(roomCode.value);

  const isNamed = !namedBlock.classList.contains("disabled");

  // Validation pour le mode non anonyme
  if (isNamed) {
    const namedLastNameInput = namedBlock.querySelector(".row input:nth-child(1)");
    const namedFirstNameInput = namedBlock.querySelector(".row input:nth-child(2)");

    if (!namedLastNameInput?.value.trim() || !namedFirstNameInput?.value.trim()) {
      errorMsg.textContent = "Veuillez renseigner votre nom et votre prénom.";
      return;
    }

    // Numéro étudiant : 8 chiffres
    if (!/^\d{8}$/.test(studentNumber.value)) {
      errorMsg.textContent = "Le numéro étudiant doit contenir exactement 8 chiffres.";
      return;
    }

    // Email étudiant
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(studentEmail.value)) {
      errorMsg.textContent = "Le format du mail étudiant est invalide.";
      return;
    }
  }

  // Code salle : 4 lettres + 4 chiffres
  if (!isValidRoomCode(roomCode.value)) {
    errorMsg.textContent = "Le code de la salle doit contenir 4 lettres suivies de 4 chiffres (ex: ABCD1234).";
    return;
  }

  try {
    logFirebase("Tentative de connexion Auth anonyme...");
    const user = await ensureAuth();
    logFirebase(`Connexion Auth OK (uid=${user.uid})`, "success");

    const teacherName = (document.getElementById("teacherName")?.value || "").trim();
    const roomId = roomCode.value.trim();

    logFirebase(`Lecture meta salle rooms/${roomId}/meta ...`);
    const roomMetaRef = ref(db, `rooms/${roomId}/meta`);
    const roomMetaSnapshot = await get(roomMetaRef);
    logFirebase(`Lecture meta salle OK (exists=${roomMetaSnapshot.exists()})`, "success");

    if (!roomMetaSnapshot.exists()) {
      errorMsg.textContent = "Cette salle n'existe pas. Verifiez le code fourni par votre professeur.";
      logFirebase(`Salle inexistante: ${roomId}`, "error");
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
      connected: false,
      joinedAt: Date.now()
    };

    const participantsRef = ref(db, `rooms/${roomId}/participants`);
    const newParticipantRef = push(participantsRef);

    logFirebase(`Ecriture participant dans rooms/${roomId}/participants/${newParticipantRef.key} ...`);
    await set(newParticipantRef, payload);
    logFirebase(`Participant enregistre (key=${newParticipantRef.key})`, "success");

    localStorage.setItem("currentRoomCode", roomId);
    localStorage.setItem("currentParticipantKey", newParticipantRef.key || "");

    window.location.href = `rejoindresalle.html?room=${encodeURIComponent(roomId)}`;
  } catch (error) {
    errorMsg.textContent = getFirebaseErrorMessage(error);
    logFirebase(`Echec connexion/transfert: ${error?.code || error?.message || error}`, "error");
    console.error(error);
    return;
  }
});