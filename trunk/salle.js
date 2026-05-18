const nomSalleHeader = document.getElementById("nomSalleHeader");
const codeAffiche = document.getElementById("codeAffiche");
const listeParticipants = document.getElementById("listeParticipants");
const emptyState = document.getElementById("emptyState");
const nbParticipants = document.getElementById("nbParticipants");
const infoDate = document.getElementById("infoDate");
const infoDuree = document.getElementById("infoDuree");
const infoProf = document.getElementById("infoProf");
const optionsActives = document.getElementById("optionsActives");
const btnToggleActivity = document.getElementById("btnToggleActivity");
const hintLancer = document.getElementById("hintLancer");
const dotLive = document.querySelector(".dot-live");
const liveStatusText = document.getElementById("liveStatusText");
const kpiParticipants = document.getElementById("kpiParticipants");
const kpiQuestionnaires = document.getElementById("kpiQuestionnaires");
const kpiSubjectif = document.getElementById("kpiSubjectif");
const kpiObjectif = document.getElementById("kpiObjectif");
const kpiGlobal = document.getElementById("kpiGlobal");
const progressBar = document.getElementById("progressBar");
const progressLabel = document.getElementById("progressLabel");
const emotionRows = document.getElementById("emotionRows");
const liveParticipantCount = document.getElementById("liveParticipantCount");
const liveUpdateTime = document.getElementById("liveUpdateTime");

let firebaseApi = null;
let roomId = "ABCD1234";
let participantsCache = [];
let activeParticipantsCache = []; // Source de vérité unique pour les KPIs
let currentConnectedCount = 0; // Source de vérité unique pour les participants connectés
let emotionsCache = {};
let questionnairesCache = {};
let roomMetaCache = {};
let emotionStats = {
  happy: 0, sad: 0, neutral: 0, angry: 0,
  surprised: 0, fearful: 0, disgusted: 0
};

function logFirebase(message, type = "info") {
  const prefix = `[Firebase][SUIVI][${type.toUpperCase()}]`;
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

function normalizeRoomCode(value) {
  return (value || "").trim().toUpperCase();
}

function resolveRoomId() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = normalizeRoomCode(params.get("room") || "");
  if (fromUrl) {
    // Si on a un code en URL, on s'assure qu'il écrase le stockage pour éviter les fuites
    if (localStorage.getItem("currentRoomCode") !== fromUrl) {
      console.log("[ROOM] Changement de salle détecté via URL:", fromUrl);
      localStorage.setItem("currentRoomCode", fromUrl);
    }
    return fromUrl;
  }

  const fromStorage = normalizeRoomCode(localStorage.getItem("currentRoomCode") || "");
  if (fromStorage) return fromStorage;

  const fromHeader = normalizeRoomCode(codeAffiche?.textContent || "");
  if (fromHeader && fromHeader !== "——") return fromHeader;

  // Pas de fallback silencieux vers ABCD1234 pour éviter la confusion
  return null;
}

function formatDate(timestamp) {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleString("fr-FR");
}

function initialsOf(p) {
  if (p.mode === "anonymous") return "A";
  const first = (p.firstName || "").trim().charAt(0).toUpperCase();
  const last = (p.lastName || "").trim().charAt(0).toUpperCase();
  return `${first}${last}`.trim() || "?";
}

function participantLabel(p) {
  if (p.mode === "anonymous") return "Anonyme";
  const full = [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
  return full || "Anonyme";
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function emotionToScore(emotionLabel) {
  const key = (emotionLabel || "").toLowerCase().trim();

  if (["joie", "happy", "bonheur", "enthousiasme"].includes(key)) return 5;
  if (["surprise", "surprised", "attention", "interest", "interet"].includes(key)) return 4;
  if (["neutre", "neutral"].includes(key)) return 3;
  if (["tristesse", "sad", "peur", "fear", "fearful", "stress", "anxieux", "anxiete"].includes(key)) return 2;
  if (["colere", "anger", "angry", "degout", "disgust", "disgusted"].includes(key)) return 1;

  return 3;
}

function summarizeEmotions(raw) {
  if (!raw) return {};

  if (typeof raw === "object" && !Array.isArray(raw)) {
    const values = Object.values(raw);

    if (values.every((value) => typeof value === "number")) {
      return raw;
    }

    const summary = {};
    values.forEach((entry) => {
      const emotion = entry?.emotion || entry?.label || "inconnu";
      summary[emotion] = (summary[emotion] || 0) + 1;
    });

    return summary;
  }

  return {};
}

function computeSubjectiveAverage(participants) {
  const values = participants
    .map((participant) => toNumber(participant?.subjectiveScore))
    .filter((value) => value !== null);

  if (!values.length) return null;

  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Number(avg.toFixed(2));
}

function computeQuestionnaireCompletion(participants, questionnaires) {
  const questionnaireParticipants = participants.filter(p => p.participationMode !== "webcam");
  const participantCount = questionnaireParticipants.length;

  const completedByFlag = questionnaireParticipants.filter((participant) => participant?.questionnaireCompleted).length;
  const completedByResponses = Object.keys(questionnaires || {}).length;
  const completed = Math.max(completedByFlag, completedByResponses);

  if (!participantCount) {
    return { completed, total: 0, pct: 0 };
  }

  const pct = Math.min(100, Math.round((completed / participantCount) * 100));
  return { completed, total: participantCount, pct };
}

function computeObjectiveAverage(emotionSummary) {
  const entries = Object.entries(emotionSummary || {});
  if (!entries.length) return null;

  let weightedSum = 0;
  let total = 0;

  entries.forEach(([emotion, count]) => {
    const numericCount = Number(count || 0);
    weightedSum += emotionToScore(emotion) * numericCount;
    total += numericCount;
  });

  if (!total) return null;
  return Number((weightedSum / total).toFixed(2));
}

function computeGlobalScore(subjective, objective) {
  if (subjective === null && objective === null) return null;
  if (subjective === null) return objective;
  if (objective === null) return subjective;
  return Number((((subjective + objective) / 2)).toFixed(2));
}

function renderEmotionRows(emotionSummary) {
  emotionRows.innerHTML = "";

  const entries = Object.entries(emotionSummary || {}).sort((a, b) => Number(b[1]) - Number(a[1]));
  const total = entries.reduce((sum, [, count]) => sum + Number(count || 0), 0);

  if (!entries.length || !total) {
    const empty = document.createElement("div");
    empty.className = "emotion-row";
    empty.innerHTML = "<span class='emotion-label'>Aucune donnée</span><div class='emotion-track'><div class='emotion-fill' style='width:0%'></div></div><span class='emotion-value'>0%</span>";
    emotionRows.appendChild(empty);
    return;
  }

  entries.slice(0, 6).forEach(([emotion, count]) => {
    const pct = Math.round((Number(count) / total) * 100);

    const row = document.createElement("div");
    row.className = "emotion-row";
    row.innerHTML = `
      <span class="emotion-label">${emotion}</span>
      <div class="emotion-track"><div class="emotion-fill" style="width:${pct}%"></div></div>
      <span class="emotion-value">${pct}%</span>
    `;

    emotionRows.appendChild(row);
  });
}

function renderActivityStatus() {
  const status = roomMetaCache?.activityStatus || "waiting";

  logFirebase(`DEBUG renderActivityStatus: status=${status}, currentConnectedCount=${currentConnectedCount}`, "info");

  if (status === "running") {
    liveStatusText.textContent = "Activité en cours";
    btnToggleActivity.textContent = "⏸️ Mettre en pause";
    btnToggleActivity.style.background = "#6d0b24";
    btnToggleActivity.style.opacity = "1";
    btnToggleActivity.disabled = false;
    hintLancer.textContent = "L'activité est en cours. Les mesures sont suivies en temps réel.";
    dotLive.classList.add("active");
    logFirebase(`DEBUG btnToggleActivity: disabled=false (activité en cours)`, "info");
    return;
  }

  // ✅ PAUSE: Statut pause
  if (status === "paused") {
    liveStatusText.textContent = "Activité en pause";
    btnToggleActivity.textContent = "▶️ Reprendre";
    btnToggleActivity.style.background = "#f59e0b";
    btnToggleActivity.style.opacity = "1";
    btnToggleActivity.disabled = false;
    hintLancer.textContent = "L'activité est en pause. Les participants sont avertis.";
    dotLive.classList.remove("active");
    logFirebase(`DEBUG btnToggleActivity: disabled=false (activité en pause)`, "info");
    return;
  }

  if (status === "ended") {
    liveStatusText.textContent = "Activité terminée";
    btnToggleActivity.textContent = "Session clôturée";
    btnToggleActivity.style.background = "#94a3b8";
    btnToggleActivity.style.opacity = "1";
    btnToggleActivity.disabled = true;
    hintLancer.textContent = "Cette session est terminée et les résultats sont définitif.";
    dotLive.classList.remove("active");
    logFirebase(`DEBUG btnToggleActivity: disabled=true (activité terminée)`, "info");
    return;
  }

  // Status: waiting - bouton toujours actif
  liveStatusText.textContent = "En attente";
  btnToggleActivity.textContent = "▶️ Lancer l'activité";
  btnToggleActivity.style.background = "#6d0b24";
  btnToggleActivity.style.opacity = "1";
  btnToggleActivity.disabled = false;
  
  logFirebase(`DEBUG btnToggleActivity: disabled=false (${currentConnectedCount} connecté(s))`, "info");
  hintLancer.textContent = currentConnectedCount === 0
    ? "Prêt à lancer. En attente de participants."
    : `Prêt à lancer (${currentConnectedCount} participant(s) connecté(s)).`;
  dotLive.classList.remove("active");
}

function renderParticipants(participants) {
  participantsCache = participants;

  logFirebase(`DEBUG renderParticipants: ${participants.length} participant(s) reçu(s)`, "info");
  if (participants.length > 0) {
    logFirebase(`DEBUG participant[0]: ${JSON.stringify(participants[0])}`, "info");
  }

  // Source de vérité unique : participants "réels" (connectés ou ayant produit une donnée)
  activeParticipantsCache = participants.filter(p =>
    p.connected === true ||
    p.connected === "true" ||
    p.connected === 1 ||
    (p.connected !== false && p.connected !== "false" && p.connected !== 0) || // Si pas explicitement false
    p.objectiveEmotionComplete ||
    p.questionnaireCompleted ||
    (p.subjectiveScore !== undefined && p.subjectiveScore !== null)
  );

  // Calculer et stocker le compte des participants connectés (source de vérité unique)
  // Un participant est "connecté" s'il existe dans la liste (peu importe son champ 'connected')
  currentConnectedCount = activeParticipantsCache.length;

  logFirebase(`DEBUG activeParticipantsCache: ${activeParticipantsCache.length} | currentConnectedCount: ${currentConnectedCount}`, "info");

  // nbParticipants dans le header de la liste = nombre de participants CONNECTÉS
  if (nbParticipants) nbParticipants.textContent = String(currentConnectedCount);

  if (!listeParticipants) return;

  listeParticipants.innerHTML = "";

  if (currentConnectedCount === 0) {
    listeParticipants.innerHTML = `
      <div class="empty-state" id="emptyState">
        <div class="empty-icon">👥</div>
        <p>En attente des participants…</p>
        <small>Partagez le code de la salle pour qu'ils puissent rejoindre.</small>
      </div>`;
  }

  // Tri : Connectés d'abord, puis par nom
  activeParticipantsCache.sort((a, b) => {
    if (a.connected === b.connected) {
      const nameA = participantLabel(a).toLowerCase();
      const nameB = participantLabel(b).toLowerCase();
      return nameA.localeCompare(nameB);
    }
    return a.connected ? -1 : 1;
  });

  activeParticipantsCache.forEach((participant) => {
    const row = document.createElement("div");
    row.className = "participant-row";

    const hasWebcam = participant.objectiveEmotionComplete;
    const hasQuest = participant.questionnaireCompleted || (participant.subjectiveScore !== undefined && participant.subjectiveScore !== null);

    const isConnected = participant.connected === true;
    const statusBadgeClass = isConnected ? "badge-connecte" : "badge-deconnecte";
    const statusText = isConnected ? "Connecté" : "Déconnecté";
    const offlineStyle = isConnected ? "" : "background-color: #ef4444; color: white;";

    const isAnonymous = participant.mode === "anonymous";

    const emotionLabels = { happy: "😊 Heureux", sad: "😢 Triste", neutral: "😐 Neutre", angry: "😠 Colère", surprised: "😲 Surpris", fearful: "😨 Peur", disgusted: "🤢 Dégoûté" };

    // Texte pour Webcam
    let webcamText = "Webcam";
    if (hasWebcam && participant.dominantEmotion) {
      webcamText += ` (${emotionLabels[participant.dominantEmotion] || "Détectée"})`;
    } else {
      webcamText += " (aucune mesure)";
    }

    // Texte pour Questionnaire
    let questText = "Questionnaire";
    if (hasQuest && participant.subjectiveScore) {
      let scoreEmotion = "😐 Neutre";
      if (participant.subjectiveScore >= 4.5) scoreEmotion = "😊 Heureux";
      else if (participant.subjectiveScore >= 3.5) scoreEmotion = "😲 Surpris";
      else if (participant.subjectiveScore >= 2.5) scoreEmotion = "😐 Neutre";
      else if (participant.subjectiveScore >= 1.5) scoreEmotion = "😢 Triste";
      else scoreEmotion = "😠 Colère";
      questText += ` (${scoreEmotion})`;
    } else {
      questText += " (aucune mesure)";
    }

    row.innerHTML = `
      <div class="participant-info" style="${!isConnected ? 'opacity: 0.6;' : ''}">
        <div class="avatar">${initialsOf(participant)}</div>
        <div>
          <div class="participant-nom">${participantLabel(participant)}</div>
          <div class="participant-mat">${isAnonymous ? "Anonyme" : (participant.studentEmail || "Sans email")}</div>
        </div>
      </div>
      <div class="participant-badges">
        <span class="status-badge ${hasWebcam ? 'complete' : 'pending'}">${webcamText}</span>
        <span class="status-badge ${hasQuest ? 'complete' : 'pending'}">${questText}</span>
        <span class="badge ${statusBadgeClass}" style="${offlineStyle}">${statusText}</span>
      </div>
    `;
    listeParticipants.appendChild(row);
  });

  // Appeler renderActivityStatus() pour mettre à jour l'état en fonction du statut de l'activité
  // Elle utilisera currentConnectedCount pour décider si le bouton doit être actif
  renderActivityStatus();
  renderDashboard();
  updateLiveIndicators();
}

function updateLiveIndicators() {
  if (liveParticipantCount) {
    liveParticipantCount.textContent = String(currentConnectedCount);
  }
  if (liveUpdateTime) {
    const now = new Date();
    liveUpdateTime.textContent = now.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }
}

function renderOptionsAndGraph(distLabels) {
  const webcamCount = participantsCache.filter((participant) => participant.participationMode === "webcam").length;
  const questionnaireCount = participantsCache.filter((participant) => (participant.participationMode || "questionnaire") === "questionnaire" || participant.participationMode === "likert").length;

  const emotionEntries = Object.entries(distLabels || {});
  const totalEmotion = emotionEntries.reduce((sum, [, value]) => sum + Number(value || 0), 0);

  optionsActives.innerHTML = "";

  const modeWebcam = document.createElement("span");
  modeWebcam.className = "option-tag on";
  modeWebcam.textContent = `Webcam: ${webcamCount}`;
  optionsActives.appendChild(modeWebcam);

  const modeQuestionnaire = document.createElement("span");
  modeQuestionnaire.className = "option-tag on";
  modeQuestionnaire.textContent = `Questionnaire: ${questionnaireCount}`;
  optionsActives.appendChild(modeQuestionnaire);

  const statusTag = document.createElement("span");
  statusTag.className = roomMetaCache?.activityStatus === "running" ? "option-tag on" : "option-tag off";
  statusTag.textContent = roomMetaCache?.activityStatus === "running" ? "Session: active" : "Session: en attente";
  optionsActives.appendChild(statusTag);

  if (emotionEntries.length && totalEmotion > 0) {
    emotionEntries
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 3)
      .forEach(([emotion, count]) => {
        const pct = Math.round((Number(count) / totalEmotion) * 100);
        const tag = document.createElement("span");
        tag.className = "option-tag off";
        tag.textContent = `${emotion}: ${pct}%`;
        optionsActives.appendChild(tag);
      });
  }
}

function renderDashboard() {
  const subjective = computeSubjectiveAverage(participantsCache);
  const objective = computeObjectiveAverage(emotionsCache);
  const globalScore = computeGlobalScore(subjective, objective);
  const completion = computeQuestionnaireCompletion(participantsCache, questionnairesCache);

  // Tous les KPIs utilisent activeParticipantsCache pour la cohérence
  kpiParticipants.textContent = String(activeParticipantsCache.length);
  kpiQuestionnaires.textContent = String(activeParticipantsCache.filter(p => p.questionnaireCompleted || (p.subjectiveScore !== undefined && p.subjectiveScore !== null)).length);

  const kpiWebcams = document.getElementById("kpiWebcams");
  if (kpiWebcams) {
    kpiWebcams.textContent = String(activeParticipantsCache.filter(p => p.objectiveEmotionComplete).length);
  }

  kpiSubjectif.textContent = subjective === null ? "—" : `${subjective}/5`;
  kpiObjectif.textContent = objective === null ? "—" : `${objective}/5`;
  kpiGlobal.textContent = globalScore === null ? "—" : `${globalScore}/5`;

  if (progressBar) progressBar.style.width = `${completion.pct}%`;
  if (progressLabel) progressLabel.textContent = `${completion.pct}%`;

  const objectiveStats = { happy: 0, sad: 0, neutral: 0, angry: 0, surprised: 0, fearful: 0, disgusted: 0 };
  const subjectiveStats = { happy: 0, sad: 0, neutral: 0, angry: 0, surprised: 0, fearful: 0, disgusted: 0 };

  Object.entries(emotionsCache).forEach(([emo, count]) => {
    if (objectiveStats[emo] !== undefined) objectiveStats[emo] += count;
  });

  participantsCache.forEach(p => {
    if (p.subjectiveScore) {
      let emo = "neutral";
      if (p.subjectiveScore >= 4.5) emo = "happy";
      else if (p.subjectiveScore >= 3.5) emo = "surprised";
      else if (p.subjectiveScore >= 2.5) emo = "neutral";
      else if (p.subjectiveScore >= 1.5) emo = "sad";
      else emo = "angry";
      subjectiveStats[emo] += 1;
    }
  });

  const emotionLabels = { happy: "😊 Heureux", sad: "😢 Triste", neutral: "😐 Neutre", angry: "😠 Colère", surprised: "😲 Surpris", fearful: "😨 Peur", disgusted: "🤢 Dégoûté" };
  const distLabels = {};
  Object.entries(objectiveStats).forEach(([emo, count]) => {
    if (count > 0) distLabels[emotionLabels[emo]] = count;
  });

  renderEmotionRows(distLabels);
  renderOptionsAndGraph(distLabels);
  updateEmotionCharts(objectiveStats, subjectiveStats);

  displayParticipantsEmotions(participantsCache);
  updateLiveIndicators();

}

async function resolveProfessorName(meta) {
  const initialName = meta.createdByName || meta.teacherName || localStorage.getItem("currentTeacherDisplayName") || "Professeur";

  if (initialName && initialName !== meta.createdBy) {
    return initialName;
  }

  if (!meta.createdBy) {
    return initialName;
  }

  try {
    const teacherSnap = await firebaseApi.get(firebaseApi.ref(firebaseApi.db, `teachers/${meta.createdBy}`));
    if (teacherSnap.exists()) {
      const teacher = teacherSnap.val() || {};
      const displayName = [teacher.prenom, teacher.nom].filter(Boolean).join(" ").trim() || teacher.nom || "Professeur";
      if (displayName) {
        localStorage.setItem("currentTeacherDisplayName", displayName);
      }
      return displayName || "Professeur";
    }
  } catch (error) {
    logFirebase(`Echec lecture profil professeur: ${error?.code || error?.message || error}`, "error");
  }

  return localStorage.getItem("currentTeacherDisplayName") || "Professeur";
}

function subscribeRoomMeta() {
  const metaRef = firebaseApi.ref(firebaseApi.db, `rooms/${roomId}/meta`);
  logFirebase(`Abonnement meta salle: rooms/${roomId}/meta`);

  firebaseApi.onValue(metaRef, async (snapshot) => {
    if (!snapshot.exists()) {
      logFirebase(`Meta salle absente pour ${roomId}`, "error");
      return;
    }

    roomMetaCache = snapshot.val() || {};
    infoDate.textContent = formatDate(roomMetaCache.createdAt);
    infoDuree.textContent = roomMetaCache.duree || "—";
    infoProf.textContent = await resolveProfessorName(roomMetaCache);

    renderActivityStatus();
    renderDashboard();

    logFirebase(`Statistiques mises à jour pour salle ${roomId}`, "success");
  }, (error) => {
    logFirebase(`Echec flux meta: ${error?.code || error?.message || error}`, "error");
  });
}

function subscribeParticipants() {
  const participantsRef = firebaseApi.ref(firebaseApi.db, `rooms/${roomId}/participants`);
  logFirebase(`Abonnement presence: rooms/${roomId}/participants`);

  firebaseApi.onValue(participantsRef, (snapshot) => {
    const raw = snapshot.val();
    const participants = raw ? Object.values(raw) : [];
    renderParticipants(participants);
    renderDashboard();
    logFirebase(`Participants synchronisés pour salle ${roomId}`, "success");
  }, (error) => {
    logFirebase(`Echec flux presence: ${error?.code || error?.message || error}`, "error");
  });
}

function subscribeEmotions() {
  const emotionsRef = firebaseApi.ref(firebaseApi.db, `rooms/${roomId}/emotions`);
  logFirebase(`Abonnement emotions: rooms/${roomId}/emotions`);

  firebaseApi.onValue(emotionsRef, (snapshot) => {
    const raw = snapshot.val();
    const sessions = raw ? Object.values(raw) : [];

    emotionStats = {
      happy: 0, sad: 0, neutral: 0, angry: 0,
      surprised: 0, fearful: 0, disgusted: 0
    };

    sessions.forEach((session) => {
      if (session.emotionStats) {
        Object.entries(session.emotionStats).forEach(([emo, count]) => {
          if (emotionStats.hasOwnProperty(emo)) {
            emotionStats[emo] += Number(count);
          }
        });
      }
    });

    emotionsCache = { ...emotionStats };

    renderDashboard();

    logFirebase(`Émotions suivies pour salle ${roomId}`, "success");
  }, (error) => {
    logFirebase(`Echec flux emotions: ${error?.code || error?.message || error}`, "error");
  });
}

function subscribeQuestionnaires() {
  const questionnairesRef = firebaseApi.ref(firebaseApi.db, `rooms/${roomId}/questionnaires`);
  logFirebase(`Abonnement questionnaires: rooms/${roomId}/questionnaires`);

  firebaseApi.onValue(questionnairesRef, (snapshot) => {
    questionnairesCache = snapshot.val() || {};
    renderDashboard();
    logFirebase(`Questionnaires suivis pour salle ${roomId}`, "success");
  }, (error) => {
    logFirebase(`Echec flux questionnaires: ${error?.code || error?.message || error}`, "error");
  });
}

async function mergeRoomMetaPatch(patch) {
  const metaRef = firebaseApi.ref(firebaseApi.db, `rooms/${roomId}/meta`);
  const snap = await firebaseApi.get(metaRef);
  const current = snap.exists() ? snap.val() : { code: roomId };

  await firebaseApi.set(metaRef, {
    ...current,
    ...patch,
    code: roomId,
    lastUpdatedAt: Date.now()
  });
}

window.copierCode = async function copierCode() {
  try {
    await navigator.clipboard.writeText(roomId);
    hintLancer.textContent = `Code ${roomId} copie dans le presse-papiers.`;
    logFirebase(`Code salle copie: ${roomId}`, "success");
  } catch (error) {
    logFirebase(`Echec copie code salle: ${error?.message || error}`, "error");
  }
};

window.lancerActivite = async function lancerActivite() {
  if (!firebaseApi) return;

  try {
    const currentStatus = roomMetaCache?.activityStatus || "waiting";

    await mergeRoomMetaPatch({
      activityStatus: "running",
      activityStartedAt: currentStatus === "waiting" || currentStatus === "ended" ? Date.now() : roomMetaCache.activityStartedAt
    });

    logFirebase(`Activité lancée/reprise pour salle ${roomId}`, "success");
  } catch (error) {
    hintLancer.textContent = "Échec lors du lancement de l'activité.";
    logFirebase(`Échec action activité: ${error?.code || error?.message || error}`, "error");
  }
};

// ✅ PAUSE: Mettre l'activité en pause
window.pauserActivite = async function pauserActivite() {
  if (!firebaseApi) return;

  try {
    await mergeRoomMetaPatch({
      activityStatus: "paused",
      activityPausedAt: Date.now()
    });

    logFirebase(`Activité mise en pause pour salle ${roomId}`, "success");
  } catch (error) {
    logFirebase(`Échec mise en pause: ${error?.code || error?.message || error}`, "error");
  }
};

// ✅ REPRENDRE: Reprendre depuis une pause
window.reprendreActivite = async function reprendreActivite() {
  if (!firebaseApi) return;

  try {
    await mergeRoomMetaPatch({
      activityStatus: "running"
    });

    logFirebase(`Activité reprise pour salle ${roomId}`, "success");
  } catch (error) {
    logFirebase(`Échec reprise activité: ${error?.code || error?.message || error}`, "error");
  }
};

// ✅ QUESTIONNAIRE SUPPLÉMENTAIRE: Envoyer un questionnaire à tout moment
window.sendQuestionnaireToParticipants = async function sendQuestionnaireToParticipants() {
  if (!firebaseApi || !roomId) {
    logFirebase("Impossible d'envoyer le questionnaire: Firebase non initialisé", "error");
    return;
  }

  try {
    // Créer un identifiant unique pour ce questionnaire
    const questionnaireId = `supplementary_${Date.now()}`;
    
    // Envoyer le signal aux participants
    await mergeRoomMetaPatch({
      lastSupplementaryQuestionnaireId: questionnaireId,
      lastSupplementaryQuestionnaireSentAt: Date.now()
    });

    logFirebase(`Questionnaire supplémentaire envoyé (ID: ${questionnaireId})`, "success");
    
    // Feedback visuel
    const btn = document.getElementById("btnSendQuestionnaire");
    if (btn) {
      const originalText = btn.textContent;
      btn.textContent = "✅ Questionnaire envoyé !";
      btn.disabled = true;
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 3000);
    }
  } catch (error) {
    logFirebase(`Échec envoi questionnaire: ${error?.code || error?.message || error}`, "error");
  }
};


// ✅ METTRE À JOUR LE TEXTE DU BOUTON selon l'état
window.updateActivityButtonText = function updateActivityButtonText() {
  const btn = document.getElementById("btnToggleActivity");
  if (!btn) return;

  const currentStatus = roomMetaCache?.activityStatus || "waiting";

  if (currentStatus === "waiting") {
    btn.textContent = "▶️ Lancer l'activité";
    btn.disabled = false;
  } else if (currentStatus === "running") {
    btn.textContent = "⏸️ Mettre en pause";
    btn.disabled = false;
  } else if (currentStatus === "paused") {
    btn.textContent = "▶️ Reprendre";
    btn.disabled = false;
  } else if (currentStatus === "ended") {
    btn.textContent = "Activité terminée";
    btn.disabled = true;
  }
};

window.toggleActivity = async function toggleActivity() {
  const currentStatus = roomMetaCache?.activityStatus || "waiting";
  
  if (currentStatus === "waiting") {
    // Lancer l'activité
    await window.lancerActivite();
  } else if (currentStatus === "running") {
    // Mettre en pause (au lieu de terminer immédiatement)
    await window.pauserActivite();
  } else if (currentStatus === "paused") {
    // Reprendre depuis la pause
    await window.reprendreActivite();
  }
  // Si status === "ended", le bouton est désactivé donc on ne devrait pas arriver ici
};

window.stopperActivite = function stopperActivite() {
  const modal = document.getElementById("stopModal");
  if (modal) modal.classList.remove("hidden");
};

async function confirmStopperActivite() {
  if (!firebaseApi) return;
  try {
    await mergeRoomMetaPatch({
      activityStatus: "ended",
      activityEndedAt: Date.now()
    });
    logFirebase(`Activité stoppée pour salle ${roomId}`, "success");
    const modal = document.getElementById("stopModal");
    if (modal) modal.classList.add("hidden");
  } catch (error) {
    logFirebase(`Échec stop activité: ${error?.message}`, "error");
  }
}

window.disconnect = function disconnect() {
  const modal = document.getElementById("disconnectModal");
  if (modal) modal.classList.remove("hidden");
};

document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("disconnectModal");
  const cancelBtn = document.getElementById("cancelDisconnectBtn");
  const confirmBtn = document.getElementById("confirmDisconnectBtn");

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      if (modal) modal.classList.add("hidden");
    });
  }

  if (confirmBtn) {
    confirmBtn.addEventListener("click", async () => {
      if (modal) modal.classList.add("hidden");
      const teacherUid = localStorage.getItem("currentTeacherUid");

      if (firebaseApi) {
        try {
          if (teacherUid) {
            await firebaseApi.set(firebaseApi.ref(firebaseApi.db, `teachers/${teacherUid}/lastRoomCode`), null);
          }
          if (typeof roomId !== 'undefined' && roomId) {
            await mergeRoomMetaPatch({ activityStatus: "ended" });
          }
        } catch (err) {
          console.error("Erreur lors du nettoyage Firebase:", err);
        }
      }

      localStorage.removeItem("currentRoomCode");
      localStorage.removeItem("currentTeacherUid");
      localStorage.removeItem("currentTeacherDisplayName");
      localStorage.removeItem("currentUser");

      logFirebase("Déconnexion professeur - Fermeture de la salle");
      logFirebase("Professeur déconnecté avec succès", "success");

      window.location.href = "accueil.html";
    });
  }

  // MODALE STOP
  const stopModal = document.getElementById("stopModal");
  const cancelStopBtn = document.getElementById("cancelStopBtn");
  const confirmStopBtn = document.getElementById("confirmStopBtn");

  if (cancelStopBtn) {
    cancelStopBtn.addEventListener("click", () => {
      if (stopModal) stopModal.classList.add("hidden");
    });
  }

  if (confirmStopBtn) {
    confirmStopBtn.addEventListener("click", () => {
      confirmStopperActivite();
    });
  }

  // ✅ LONG CLIC SUR BOUTON ACTIVITÉ POUR TERMINER
  let pressTimer = null;
  if (btnToggleActivity) {
    btnToggleActivity.addEventListener("mousedown", () => {
      pressTimer = setTimeout(() => {
        // Long clic détecté (500ms)
        const currentStatus = roomMetaCache?.activityStatus || "waiting";
        if (currentStatus === "running" || currentStatus === "paused") {
          // Afficher modale de terminer
          if (stopModal) stopModal.classList.remove("hidden");
        }
      }, 500);
    });

    btnToggleActivity.addEventListener("mouseup", () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    });

    btnToggleActivity.addEventListener("mouseleave", () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    });
  }
});

/* Graphiques Chart.js */
let pieChart = null;
let lineChart = null;
let emotionTimeSeries = {};

function initializeCharts() {
  // Vérifier que Chart est chargé
  if (typeof Chart === "undefined") {
    logFirebase("⚠️ ERREUR CRITIQUE: Chart.js n'est pas chargé dans le navigateur", "error");
    console.error("Chart.js CDN script not loaded. Check <script> tag in HTML.");
    return false;
  }

  const pieCtx = document.getElementById("emotionPieChart")?.getContext("2d");
  const lineCtx = document.getElementById("emotionLineChart")?.getContext("2d");

  if (!pieCtx) {
    logFirebase("⚠️ ERREUR: Canvas #emotionPieChart n'existe pas ou n'est pas visible", "error");
    return false;
  }
  if (!lineCtx) {
    logFirebase("⚠️ ERREUR: Canvas #emotionLineChart n'existe pas ou n'est pas visible", "error");
    return false;
  }

  try {
    // Graphique PIE
    pieChart = new Chart(pieCtx, {
      type: "doughnut",
      data: {
        labels: ["😊 Heureux", "😢 Triste", "😐 Neutre", "😠 Colère", "😲 Surpris", "😨 Peur", "🤢 Dégoûté"],
        datasets: [{
          data: [0, 0, 0, 0, 0, 0, 0],
          backgroundColor: ["#FFEB3B", "#2196F3", "#9E9E9E", "#F44336", "#FF9800", "#673AB7", "#4CAF50"],
          borderColor: "#fff",
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { font: { size: 12 }, padding: 15 }
          }
        }
      }
    });

    logFirebase("✅ Graphique PIE initialisé avec succès", "success");

    // Graphique ÉVOLUTION (Histogramme / Bar Chart)
    lineChart = new Chart(lineCtx, {
      type: "bar",
      data: {
        labels: ["Heureux", "Triste", "Neutre", "Colère", "Surpris", "Peur", "Dégoûté"],
        datasets: [
          {
            label: "Répartition (%)",
            data: [0, 0, 0, 0, 0, 0, 0],
            backgroundColor: ["#FFEB3B", "#2196F3", "#9E9E9E", "#F44336", "#FF9800", "#673AB7", "#4CAF50"]
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, min: 0, max: 100 }
        },
        plugins: {
          legend: { display: false } // Masqué car on affiche un pourcentage unifié
        }
      }
    });

    logFirebase("✅ Graphique ÉVOLUTION (Bar) initialisé avec succès", "success");
    return true;
  } catch (error) {
    logFirebase(`❌ Erreur lors de l'initialisation des graphiques: ${error.message}`, "error");
    console.error("Chart initialization error:", error);
    return false;
  }
}

function updateEmotionCharts(objectiveStats, subjectiveStats) {
  // Vérifier que Chart.js est disponible
  if (typeof Chart === "undefined") {
    logFirebase("⚠️ Chart.js n'est pas chargé", "error");
    return;
  }

  // Si les graphiques ne sont pas initialisés, essayer de les initialiser
  if (!pieChart || !lineChart) {
    logFirebase("⚠️ Graphiques non initialisés, tentative de réinitialisation...", "error");
    const success = initializeCharts();
    if (!success) {
      logFirebase("❌ IMPOSSIBLE d'initialiser les graphiques", "error");
      return;
    }
  }

  const emotionOrder = ["happy", "sad", "neutral", "angry", "surprised", "fearful", "disgusted"];

  // Calculs (Webcam)
  const objCounts = emotionOrder.map(e => objectiveStats[e] || 0);
  const objTotal = objCounts.reduce((a, b) => a + b, 0);
  const objPercentages = objTotal > 0
    ? objCounts.map(count => (count / objTotal) * 100)
    : [0, 0, 0, 0, 0, 0, 0];

  // Calculs (Questionnaires)
  const subCounts = emotionOrder.map(e => subjectiveStats[e] || 0);
  const subTotal = subCounts.reduce((a, b) => a + b, 0);
  const subPercentages = subTotal > 0
    ? subCounts.map(count => (count / subTotal) * 100)
    : [0, 0, 0, 0, 0, 0, 0];

  // Moyenne des pourcentages
  const combinedPercentages = emotionOrder.map((_, i) => {
    if (objTotal > 0 && subTotal > 0) {
      return Math.round((objPercentages[i] + subPercentages[i]) / 2);
    } else if (objTotal > 0) {
      return Math.round(objPercentages[i]);
    } else if (subTotal > 0) {
      return Math.round(subPercentages[i]);
    }
    return 0;
  });

  try {
    // Mise à jour du PIE chart
    pieChart.data.datasets[0].data = objCounts.map(Math.round);
    pieChart.update();
    logFirebase(`📊 Graphique PIE mis à jour avec données webcam`, "info");
  } catch (err) {
    logFirebase(`❌ Erreur mise à jour PIE: ${err.message}`, "error");
  }

  try {
    // Mise à jour de l'histogramme
    lineChart.data.datasets[0].data = combinedPercentages;

    // Si un ancien dataset existe encore en cache, on le supprime
    if (lineChart.data.datasets.length > 1) {
      lineChart.data.datasets.splice(1, 1);
    }

    lineChart.update();
    logFirebase(`📈 Graphique BAR mis à jour`, "info");
  } catch (err) {
    logFirebase(`❌ Erreur mise à jour LINE: ${err.message}`, "error");
  }
}

function displayParticipantsEmotions(participants) {
  const container = document.getElementById("participantsEmotionsList");
  if (!container) return;

  container.innerHTML = "";

  participants.forEach((p) => {
    const isAnonymous = p.mode === "anonymous";

    const avatar = isAnonymous ? "A" : ((p.firstName || "P")[0] + (p.lastName || "")[0] || "?").toUpperCase();

    let statusTag = "En attente";
    if (p.participationMode === "webcam" && p.dominantEmotion) {
      const emotionLabels = { happy: "😊 Heureux", sad: "😢 Triste", neutral: "😐 Neutre", angry: "😠 Colère", surprised: "😲 Surpris", fearful: "😨 Peur", disgusted: "🤢 Dégoûté" };
      statusTag = emotionLabels[p.dominantEmotion] || "Émotion détectée";
    } else if (p.subjectiveScore) {
      if (p.subjectiveScore >= 4.5) statusTag = "😊 Heureux";
      else if (p.subjectiveScore >= 3.5) statusTag = "😲 Surpris";
      else if (p.subjectiveScore >= 2.5) statusTag = "😐 Neutre";
      else if (p.subjectiveScore >= 1.5) statusTag = "😢 Triste";
      else statusTag = "😠 Colère";
    }

    const timeAgo = p.updatedAt ? formatTimeAgo(p.updatedAt) : "—";

    const html = `
      <div class="participant-emotion-item">
        <div class="participant-emotion-info">
          <div class="participant-emotion-avatar">${avatar}</div>
          <div class="participant-emotion-details">
            <h4>${participantLabel(p)}</h4>
            <p>${timeAgo}</p>
          </div>
        </div>
        <div class="participant-emotion-badge">${statusTag}</div>
      </div>
    `;

    container.innerHTML += html;
  });
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return "—";
  let seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 0) seconds = 0;

  if (seconds < 60) return "À l'instant";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `il y a ${hours}h`;
}

async function start() {
  roomId = resolveRoomId();

  codeAffiche.textContent = roomId;
  nomSalleHeader.textContent = `Salle ${roomId}`;

  infoDate.textContent = "Chargement...";
  infoDuree.textContent = "Chargement...";
  infoProf.textContent = "Chargement...";
  liveStatusText.textContent = "Chargement...";

  try {
    logFirebase("Chargement firebase-config.js...");
    firebaseApi = await import("./firebase-config.js");
    logFirebase("Module Firebase charge", "success");

    logFirebase("Tentative de connexion Auth anonyme...");
    await firebaseApi.ensureAuth();
    logFirebase("Connexion Auth OK", "success");

    localStorage.setItem("currentRoomCode", roomId);

    // Afficher le dashboard AVANT d'initialiser les graphiques (pour que le canvas ait des dimensions)
    const dashboard = document.getElementById("emotionDashboard");
    if (dashboard) dashboard.classList.remove("hidden");

    // Utilisation d'un Timeout pour garantir que le CSS a bien affiché le Canvas avant l'initialisation
    setTimeout(() => {
      logFirebase("Initialisation des graphiques Chart.js...", "success");
      initializeCharts();
    }, 150);

    subscribeRoomMeta();
    subscribeParticipants();
    subscribeEmotions();
    subscribeQuestionnaires();

    // Rafraîchir les labels "il y a X min" toutes les 30 secondes
    setInterval(() => {
      displayParticipantsEmotions(participantsCache);
      updateLiveIndicators();
    }, 30000);

  } catch (error) {
    logFirebase(`Echec initialisation ecran suivi: ${error?.code || error?.message || error}`, "error");
    hintLancer.textContent = "Erreur de connexion Firebase.";
  }
}

start();

document.addEventListener("DOMContentLoaded", () => {
  const refreshBtn = document.getElementById("refreshDashboardBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      renderDashboard();
      renderParticipants(participantsCache);

      const originalText = refreshBtn.textContent;
      refreshBtn.textContent = "Actualisé ✓";
      refreshBtn.style.opacity = "0.7";

      setTimeout(() => {
        refreshBtn.textContent = originalText;
        refreshBtn.style.opacity = "1";
      }, 1500);
    });
  }
});
