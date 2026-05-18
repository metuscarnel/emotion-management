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
  const followRoomLink = document.getElementById("followRoomLink");
  const accessResultsBtn = document.getElementById("accessResultsBtn");
  const roomCode = document.getElementById("roomCode");
  const message = document.getElementById("copyMessage");

  const params = new URLSearchParams(window.location.search);
  const forceNewRoom = params.get("new") === "1";
  const urlCode = params.get("room")?.trim() || "";
  const storedCode = (localStorage.getItem("currentRoomCode") || "").trim();
  const roomId = (forceNewRoom ? generateRoomCode() : (urlCode || storedCode || generateRoomCode())).toUpperCase();

  roomCode.innerText = roomId;
  localStorage.setItem("currentRoomCode", roomId);

  // Gestion du rafraîchissement de la page
  if (forceNewRoom || (!urlCode && !storedCode)) {
    const newUrl = new URL(window.location);
    newUrl.searchParams.delete("new");
    newUrl.searchParams.set("room", roomId);
    window.history.replaceState({}, document.title, newUrl);
  }

  const updateNavigationLinks = () => {
    const code = roomCode.innerText.trim();
    if (!code) return;

    if (followRoomLink) {
      followRoomLink.href = `salle.html?room=${encodeURIComponent(code)}`;
    }

    if (accessResultsBtn) {
      accessResultsBtn.href = `recapitulatif.html?room=${encodeURIComponent(code)}`;
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

  // Gestion de la copie du code
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

  // Ouverture du client de messagerie
  mailBtn.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();

    const code = roomCode.innerText;
    const link = window.location.origin + window.location.pathname.replace("create.html", "access.html");

    const subject = encodeURIComponent("🎓 Rejoignez mon activité - Emotion Monitoring");
    const body = encodeURIComponent(
      "Bonjour,\n\n" +
      "Je vous invite à participer à une activité pédagogique interactive.\n\n" +
      "📌 CODE DE LA SALLE : " + code + "\n\n" +
      "🔗 LIEN D'ACCÈS : " + link + "\n\n" +
      "📋 COMMENT PARTICIPER :\n" +
      "1. Cliquez sur le lien ou allez sur la plateforme\n" +
      "2. Choisissez votre mode de participation :\n" +
      "   - 📷 Webcam (détection automatique des émotions)\n" +
      "   - ❓ Questionnaire (5 questions)\n" +
      "3. Entrez le code : " + code + "\n" +
      "4. Suivez les instructions à l'écran\n\n" +
      "💡 NOTES IMPORTANTES :\n" +
      "• Assurez-vous que votre navigateur autorise l'accès à la webcam (si mode webcam)\n" +
      "• Aucune image n'est conservée - tout se fait en temps réel et localement\n" +
      "• Participation anonyme ou nominative selon votre choix\n\n" +
      "Merci de votre participation !\n\n" +
      "---\n" +
      "Emotion Monitoring Platform\n" +
      "Université Paris Cité"
    );

    window.location.href = "mailto:?subject=" + subject + "&body=" + body;
  });

});