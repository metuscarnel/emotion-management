import { db, ref, set, get, ensureAuth } from "./firebase-config.js";

function generateRoomCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "0123456789";
  let code = "";

  for (let index = 0; index < 4; index += 1) {
    const randomIndex = Math.floor(Math.random() * letters.length);
    code += letters[randomIndex];
  }

  for (let index = 0; index < 4; index += 1) {
    const randomIndex = Math.floor(Math.random() * digits.length);
    code += digits[randomIndex];
  }

  return code;
}

document.addEventListener("DOMContentLoaded", function () {

  const copyBtn = document.getElementById("copyBtn");
  const mailBtn = document.getElementById("mailBtn");
  const waitingRoomLink = document.getElementById("waitingRoomLink");
  const followRoomLink = document.getElementById("followRoomLink");
  const roomCode = document.getElementById("roomCode");
  const message = document.getElementById("copyMessage");

  const params = new URLSearchParams(window.location.search);
  const forceNewRoom = params.get("new") === "1";
  const urlCode = params.get("room")?.trim() || "";
  const storedCode = (localStorage.getItem("currentRoomCode") || "").trim();
  const roomId = (forceNewRoom ? generateRoomCode() : (urlCode || storedCode || generateRoomCode())).toUpperCase();

  roomCode.innerText = roomId;
  localStorage.setItem("currentRoomCode", roomId);

  const updateNavigationLinks = () => {
    const code = roomCode.innerText.trim();
    if (!code) return;

    if (waitingRoomLink) {
      waitingRoomLink.href = `voirlasalle.html?room=${encodeURIComponent(code)}`;
    }

    if (followRoomLink) {
      followRoomLink.href = `salle.html?room=${encodeURIComponent(code)}`;
    }
  };

  updateNavigationLinks();

  (async () => {
    try {
      const user = await ensureAuth();
      const code = roomCode.innerText.trim();
      const teacherUid = localStorage.getItem("currentTeacherUid") || user.uid;

      let teacherName = "";
      let teacherFirstName = "";

      try {
        const teacherSnap = await get(ref(db, `teachers/${teacherUid}`));
        if (teacherSnap.exists()) {
          const teacherData = teacherSnap.val() || {};
          teacherFirstName = teacherData.prenom || "";
          teacherName = [teacherData.prenom, teacherData.nom].filter(Boolean).join(" ").trim();
          localStorage.setItem("currentTeacherDisplayName", teacherName || teacherData.nom || "Professeur");
        }
      } catch (profileError) {
        console.error("Erreur lecture profil professeur:", profileError);
      }

      if (!teacherName) {
        teacherName = localStorage.getItem("currentTeacherDisplayName") || "Professeur";
      }

      const metaRef = ref(db, `rooms/${code}/meta`);
      const existingMetaSnap = await get(metaRef);

      if (!existingMetaSnap.exists()) {
        await set(metaRef, {
          code,
          createdBy: teacherUid,
          createdByName: teacherName,
          createdByFirstName: teacherFirstName,
          createdAt: Date.now()
        });
      }

      await set(ref(db, `teachers/${teacherUid}/lastRoomCode`), code);

      localStorage.setItem("currentRoomCode", code);

      updateNavigationLinks();
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