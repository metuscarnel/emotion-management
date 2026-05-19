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
    const allParticipants = participantsSnap.exists() ? Object.values(participantsSnap.val()) : [];
    
    // Filtrer les participants "réels" (ceux qui ont produit une donnée)
    const participants = allParticipants.filter(p => 
      p.objectiveEmotionComplete || 
      p.dominantEmotion ||
      p.questionnaireCompleted || 
      (p.subjectiveScore !== undefined && p.subjectiveScore !== null)
    );

    // Récupérer les données brutes de la webcam (emotions) pour la mesure objective
    const emotionsSnap = await get(ref(db, `rooms/${roomId}/emotions`));
    const emotionsData = emotionsSnap.exists() ? Object.values(emotionsSnap.val()) : [];
    let emotionStats = { happy: 0, sad: 0, neutral: 0, angry: 0, surprised: 0, fearful: 0, disgusted: 0 };
    emotionsData.forEach(session => {
      if (session.emotionStats) {
        Object.entries(session.emotionStats).forEach(([emo, count]) => {
          if (emotionStats[emo] !== undefined) emotionStats[emo] += Number(count);
        });
      }
    });

    // Intégrer également les données en direct (Live) des participants
    participants.forEach(p => {
      if (!p.objectiveEmotionComplete && p.liveStats) {
        Object.entries(p.liveStats).forEach(([emo, count]) => {
          if (emotionStats[emo] !== undefined) emotionStats[emo] += Number(count);
        });
      } else if (!p.objectiveEmotionComplete && p.dominantEmotion && emotionStats[p.dominantEmotion] !== undefined) {
        emotionStats[p.dominantEmotion] += 1;
      }
    });

    let totalScore = 0;
    let countScore = 0;
    let globalEmotionCounts = {};

    participantsList.innerHTML = "";

    // Export CSV
    const exportCsvBtn = document.getElementById("exportCsvBtn");
    if (exportCsvBtn) {
      if (participants.length === 0) {
        exportCsvBtn.disabled = true;
        exportCsvBtn.style.opacity = "0.5";
        exportCsvBtn.style.cursor = "not-allowed";
      } else {
        exportCsvBtn.addEventListener("click", () => {
          let csvContent = "Nom,Participation,Webcam OK,Questionnaire OK,Score Subjectif,Emotion Subjective,Emotion Objective\n";
          
          participants.forEach(p => {
            const isAnonymous = p.mode === "anonymous";
            const name = isAnonymous ? "Anonyme" : ([p.firstName, p.lastName].filter(Boolean).join(" ").trim() || "Anonyme");
            
            const hasWebcam = (p.objectiveEmotionComplete || p.dominantEmotion) ? "OUI" : "NON";
            const hasQuest = (p.questionnaireCompleted || p.subjectiveScore) ? "OUI" : "NON";
            
            let scoreSubjStr = p.subjectiveScore ? p.subjectiveScore.toString() : "";
            let emotionSubjStr = "";
            if (p.subjectiveScore) {
              if (p.subjectiveScore >= 4.5) emotionSubjStr = "Heureux";
              else if (p.subjectiveScore >= 3.5) emotionSubjStr = "Surpris";
              else if (p.subjectiveScore >= 2.5) emotionSubjStr = "Neutre";
              else if (p.subjectiveScore >= 1.5) emotionSubjStr = "Triste";
              else emotionSubjStr = "Colere";
            }
            
            let emotionObjStr = p.dominantEmotion ? (emotionLabels[p.dominantEmotion] || p.dominantEmotion) : "";
            
            const escape = str => `"${String(str).replace(/"/g, '""')}"`;
            csvContent += `${escape(name)},"Mixte (Webcam+Quest.)",${escape(hasWebcam)},${escape(hasQuest)},${escape(scoreSubjStr)},${escape(emotionSubjStr)},${escape(emotionObjStr)}\n`;
          });
          
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.setAttribute("href", url);
          link.setAttribute("download", `resultats_salle_${roomId}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        });
      }
    }

    if (participants.length === 0) {
      participantsList.innerHTML = "<p>Aucun participant n'a rejoint cette salle.</p>";
    } else {
      participants.forEach(p => {
        const row = document.createElement("div");
        row.className = "participant-row";
        
        const isAnonymous = p.mode === "anonymous";
        const name = isAnonymous ? "Anonyme" : ([p.firstName, p.lastName].filter(Boolean).join(" ").trim() || "Anonyme");
        
        const hasWebcam = p.objectiveEmotionComplete || !!p.dominantEmotion;
        const hasQuest = p.questionnaireCompleted || (p.subjectiveScore !== undefined && p.subjectiveScore !== null);
        
        let resultHtml = `
          <div style="display: flex; gap: 5px; margin-bottom: 5px; justify-content: flex-end;">
            <span class="badge" style="font-size: 9px; padding: 2px 5px; border-radius:4px; ${hasWebcam ? 'background:#dcfce7; color:#166534;' : 'background:#f1f5f9; color:#94a3b8; opacity:0.6;'}">Webcam ${hasWebcam ? '✓' : '(aucune mesure)'}</span>
            <span class="badge" style="font-size: 9px; padding: 2px 5px; border-radius:4px; ${hasQuest ? 'background:#dcfce7; color:#166534;' : 'background:#f1f5f9; color:#94a3b8; opacity:0.6;'}">Quest. ${hasQuest ? '✓' : '(aucune mesure)'}</span>
          </div>
        `;
        
        if (p.subjectiveScore) {
          totalScore += p.subjectiveScore;
          countScore++;
          
          let scoreEmotion = "😐 Neutre";
          if (p.subjectiveScore >= 4.5) scoreEmotion = "😊 Heureux";
          else if (p.subjectiveScore >= 3.5) scoreEmotion = "😲 Surpris";
          else if (p.subjectiveScore >= 2.5) scoreEmotion = "😐 Neutre";
          else if (p.subjectiveScore >= 1.5) scoreEmotion = "😢 Triste";
          else scoreEmotion = "😠 Colère";
          
          resultHtml += `<span class="badge" style="margin-right:8px; border: 1px solid #e2e8f0; background: #fff; border-radius:4px; padding:2px 6px;">Subj: ${scoreEmotion}</span>`;
        }
        
        if (p.dominantEmotion) {
          globalEmotionCounts[p.dominantEmotion] = (globalEmotionCounts[p.dominantEmotion] || 0) + 1;
          resultHtml += `<span class="badge" style="border: 1px solid #e2e8f0; background: #fff; border-radius:4px; padding:2px 6px;">Obj: ${emotionLabels[p.dominantEmotion] || p.dominantEmotion}</span>`;
        }

        row.innerHTML = `
          <div>
            <span class="participant-name">${name}</span>
          </div>
          <div style="text-align: right;">${resultHtml || "<em>Aucune donnée complétée</em>"}</div>
        `;
        participantsList.appendChild(row);
      });
    }

    // Calcul des moyennes
    const avgSubjective = countScore > 0 ? Number((totalScore / countScore).toFixed(2)) : null;
    
    let objectiveTotalSum = 0;
    let objectiveTotalCount = 0;
    
    const emoToScore = (e) => {
      if (["happy"].includes(e)) return 5;
      if (["surprised"].includes(e)) return 4;
      if (["neutral"].includes(e)) return 3;
      if (["sad", "fearful"].includes(e)) return 2;
      if (["angry", "disgusted"].includes(e)) return 1;
      return 3;
    };

    Object.entries(emotionStats).forEach(([emo, count]) => {
      objectiveTotalSum += emoToScore(emo) * count;
      objectiveTotalCount += count;
    });

    const avgObjective = objectiveTotalCount > 0 ? Number((objectiveTotalSum / objectiveTotalCount).toFixed(2)) : null;
    
    let globalScore = null;
    if (avgSubjective !== null && avgObjective !== null) globalScore = Number(((avgSubjective + avgObjective) / 2).toFixed(2));
    else if (avgSubjective !== null) globalScore = avgSubjective;
    else if (avgObjective !== null) globalScore = avgObjective;

    const scoreToEmotionStr = (score) => {
      if (score === null) return "—";
      if (score >= 4.5) return "😊 Heureux";
      if (score >= 3.5) return "😲 Surpris";
      if (score >= 2.5) return "😐 Neutre";
      if (score >= 1.5) return "😢 Triste";
      return "😠 Colère";
    };

    statsGrid.innerHTML = `
      <div class="stat-card"><h3>Participants</h3><p>${participants.length}</p></div>
      <div class="stat-card"><h3>Subjectif (Questionnaire)</h3><p>${scoreToEmotionStr(avgSubjective)}</p></div>
      <div class="stat-card"><h3>Objectif (Webcam)</h3><p>${scoreToEmotionStr(avgObjective)}</p></div>
      <div class="stat-card"><h3>Humeur Globale</h3><p>${scoreToEmotionStr(globalScore)}</p></div>
    `;
  } catch (err) {
    participantsList.innerHTML = `<p style="color: red;">Erreur lors du chargement des données : ${err.message}</p>`;
  }
}

loadRecap();