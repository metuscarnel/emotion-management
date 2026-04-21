import { db, ref, set, ensureAuth } from "./firebase-config.js";

document.addEventListener("DOMContentLoaded", function () {

  const copyBtn = document.getElementById("copyBtn");
  const mailBtn = document.getElementById("mailBtn");
  const roomCode = document.getElementById("roomCode");
  const message = document.getElementById("copyMessage");

  const localCode = localStorage.getItem("currentRoomCode");
  if (localCode && localCode.length === 8) {
    roomCode.innerText = localCode;
  }

  (async () => {
    try {
      const user = await ensureAuth();
      const code = roomCode.innerText.trim();

      await set(ref(db, `rooms/${code}/meta`), {
        code,
        createdBy: user.uid,
        createdAt: Date.now()
      });
    } catch (error) {
      console.error("Erreur Firebase (création salle):", error);
    }
  })();

  // ===== COPIE DU CODE (VERSION GARANTIE) =====
  copyBtn.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();

    const code = roomCode.innerText;

    // Création textarea invisible
    const textarea = document.createElement("textarea");
    textarea.value = code;
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, 99999);

    document.execCommand("copy");
    document.body.removeChild(textarea);

    // Message
    message.innerText = "Code copié ✅ avec succès";
    message.style.display = "block";

    setTimeout(() => {
      message.style.display = "none";
    }, 2500);
  });

  // ===== OUVERTURE BOÎTE MAIL =====
  mailBtn.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();

    const code = roomCode.innerText;
    const subject = encodeURIComponent("Code de la salle");
    const body = encodeURIComponent(
      "Bonjour,\n\nVoici le code de la salle : " + code + "\n\nCordialement."
    );

    window.location.href = "mailto:?subject=" + subject + "&body=" + body;
  });

});