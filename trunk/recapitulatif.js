import { db, ref, get, ensureAuth } from "./firebase-config.js";

const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const roomDateDisplay = document.getElementById("roomDateDisplay");
const participantsList = document.getElementById("participantsList");
const statsGrid = document.getElementById("statsGrid");

const emotionLabels = {
  happy: "😊 Heureux",
  sad: "😢 Triste",
  neutral: "😐 Neutre",
  angry: "😠 Colère",
  surprised: "😲 Surpris",
  fearful: "😨 Peur",
  disgusted: "🤢 Dégoûté"
};

function resolveRoomId() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = (params.get("room") || "").trim().toUpperCase();
  if (fromUrl) return fromUrl;
  return localStorage.getItem("currentRoomCode") || "";
}

async function loadRecap() {
  const roomId = resolveRoomId();
  if (!roomId) {
    participantsList.innerHTML = "<p>Erreur : Code de salle introuvable.</p>";
    return;
  }

  roomCodeDisplay.textContent = roomId;

  try {
    await ensureAuth();

    // Méta-données de la salle
    const metaSnap = await get(ref(db, `rooms/${roomId}/meta`));
    if (metaSnap.exists()) {
      const meta = metaSnap.val();
      roomDateDisplay.textContent = `Créée le : ${new Date(meta.createdAt).toLocaleString("fr-FR")}`;
    }

    // Participants
    const participantsSnap = await get(ref(db, `rooms/${roomId}/participants`));
    const participants = participantsSnap.exists() ? Object.values(participantsSnap.val()) : [];

    let totalScore = 0;
    let countScore = 0;
    let globalEmotionCounts = {};

    participantsList.innerHTML = "";

    if (participants.length === 0) {
      participantsList.innerHTML = "<p>Aucun participant n'a rejoint cette salle.</p>";
    } else {
      participants.forEach(p => {
        const row = document.createElement("div");
        row.className = "participant-row";
        
        const name = [p.firstName, p.lastName].filter(Boolean).join(" ").trim() || "Participant anonyme";
        const mode = p.participationMode === "webcam" ? "📷 Webcam" : "❓ Questionnaire";
        
        let resultHtml = "";
        
        if (p.subjectiveScore) {
          totalScore += p.subjectiveScore;
          countScore++;
          resultHtml += `<span class="badge">Score subjectif: ${p.subjectiveScore}/5</span>`;
        }
        
        if (p.dominantEmotion) {
          globalEmotionCounts[p.dominantEmotion] = (globalEmotionCounts[p.dominantEmotion] || 0) + 1;
          resultHtml += `<span class="badge" style="margin-left:10px;">Émotion dominante: ${emotionLabels[p.dominantEmotion] || p.dominantEmotion}</span>`;
        }

        row.innerHTML = `
          <div>
            <span class="participant-name">${name}</span>
            <span class="participant-mode">(${mode})</span>
          </div>
          <div>${resultHtml || "<em>Aucune donnée complétée</em>"}</div>
        `;
        participantsList.appendChild(row);
      });
    }

    const avgSubjective = countScore > 0 ? (totalScore / countScore).toFixed(2) + "/5" : "—";
    const dominantGlobal = Object.keys(globalEmotionCounts).length > 0 ? emotionLabels[Object.keys(globalEmotionCounts).reduce((a, b) => globalEmotionCounts[a] > globalEmotionCounts[b] ? a : b)] : "—";

    statsGrid.innerHTML = `<div class="stat-card"><h3>Participants</h3><p>${participants.length}</p></div><div class="stat-card"><h3>Score Subjectif Moyen</h3><p>${avgSubjective}</p></div><div class="stat-card"><h3>Émotion Globale Majoritaire</h3><p>${dominantGlobal}</p></div>`;
  } catch (err) {
    participantsList.innerHTML = `<p style="color: red;">Erreur lors du chargement des données : ${err.message}</p>`;
  }
}

loadRecap();