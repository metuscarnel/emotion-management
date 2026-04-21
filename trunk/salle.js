const nomSalleHeader = document.getElementById("nomSalleHeader");
const codeAffiche = document.getElementById("codeAffiche");
const listeParticipants = document.getElementById("listeParticipants");
const emptyState = document.getElementById("emptyState");
const nbParticipants = document.getElementById("nbParticipants");
const infoDate = document.getElementById("infoDate");
const infoDuree = document.getElementById("infoDuree");
const infoProf = document.getElementById("infoProf");
const infoWebcam = document.getElementById("infoWebcam");
const optionsActives = document.getElementById("optionsActives");
const btnLancer = document.getElementById("btnLancer");
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
const comparisonBox = document.getElementById("comparisonBox");
const emotionRows = document.getElementById("emotionRows");

let firebaseApi = null;
let roomId = "ABCD1234";
let participantsCache = [];
let emotionsCache = {};
let questionnairesCache = {};
let roomMetaCache = {};

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

function logAudit(message) {
  console.info(`[AUDIT] ${message}`);
}

function normalizeRoomCode(value) {
  return (value || "").trim().toUpperCase();
}

function resolveRoomId() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = normalizeRoomCode(params.get("room") || "");
  if (fromUrl) return fromUrl;

  const fromStorage = normalizeRoomCode(localStorage.getItem("currentRoomCode") || "");
  if (fromStorage) return fromStorage;

  const fromHeader = normalizeRoomCode(codeAffiche?.textContent || "");
  if (fromHeader && fromHeader !== "——") return fromHeader;

  return "ABCD1234";
}

function formatDate(timestamp) {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleString("fr-FR");
}

function initialsOf(p) {
  const first = (p.firstName || "").trim().charAt(0).toUpperCase();
  const last = (p.lastName || "").trim().charAt(0).toUpperCase();
  return `${first}${last}`.trim() || "?";
}

function participantLabel(p) {
  const full = [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
  return full || "Participant anonyme";
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function emotionToScore(emotionLabel) {
  const key = (emotionLabel || "").toLowerCase().trim();

  if (["joie", "happy", "bonheur", "enthousiasme"].includes(key)) return 5;
  if (["surprise", "attention", "interest", "interet"].includes(key)) return 4;
  if (["neutre", "neutral"].includes(key)) return 3;
  if (["tristesse", "sad", "peur", "fear", "stress", "anxieux", "anxiete"].includes(key)) return 2;
  if (["colere", "anger", "degout", "disgust"].includes(key)) return 1;

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
  const participantCount = participants.length;
  const completedByFlag = participants.filter((participant) => participant?.questionnaireCompleted).length;
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

function renderComparison(subjective, objective, globalScore) {
  if (subjective === null || objective === null) {
    comparisonBox.textContent = "Comparaison en attente: il faut des donnees subjectives et objectives pour calculer l'ecart.";
    return;
  }

  const diff = Number((subjective - objective).toFixed(2));
  const absDiff = Math.abs(diff);

  if (absDiff <= 0.6) {
    comparisonBox.textContent = `Comparaison: alignement correct entre ressenti et analyse objective (ecart ${absDiff}/5). Score global ${globalScore}/5.`;
    return;
  }

  if (diff > 0) {
    comparisonBox.textContent = `Comparaison: le ressenti declare est plus eleve que l'analyse objective (ecart ${absDiff}/5). Une verification pedagogique est recommandee.`;
    return;
  }

  comparisonBox.textContent = `Comparaison: l'analyse objective est plus elevee que le ressenti declare (ecart ${absDiff}/5). Cela peut indiquer des signaux non verbaux non percus.`;
}

function renderActivityStatus() {
  const status = roomMetaCache?.activityStatus || "waiting";
  const connectedCount = participantsCache.filter((participant) => participant.connected !== false).length;

  if (status === "running") {
    liveStatusText.textContent = "Activite en cours";
    btnLancer.textContent = "Terminer l'activite";
    btnLancer.disabled = false;
    hintLancer.textContent = "L'activite est en cours. Les mesures sont suivies en temps reel.";
    dotLive.classList.add("active");
    return;
  }

  if (status === "ended") {
    liveStatusText.textContent = "Activite terminee";
    btnLancer.textContent = "Relancer l'activite";
    btnLancer.disabled = connectedCount === 0;
    hintLancer.textContent = connectedCount === 0
      ? "Activite terminee. Aucun participant connecte pour relancer."
      : "Activite terminee. Vous pouvez relancer une nouvelle session.";
    dotLive.classList.toggle("active", connectedCount > 0);
    return;
  }

  liveStatusText.textContent = "En attente";
  btnLancer.textContent = "Lancer l'activite";
  btnLancer.disabled = connectedCount === 0;
  hintLancer.textContent = connectedCount === 0
    ? "En attente d'au moins 1 participant pour lancer."
    : `Pret a lancer (${connectedCount} participant(s) connecte(s)).`;
  dotLive.classList.toggle("active", connectedCount > 0);
}

function renderParticipants(participants) {
  participantsCache = participants;
  const connected = participants.filter((participant) => participant.connected !== false);

  nbParticipants.textContent = String(connected.length);

  if (!participants.length) {
    if (emptyState) emptyState.style.display = "block";
    listeParticipants.innerHTML = "";
    if (emptyState) listeParticipants.appendChild(emptyState);
  } else {
    if (emptyState) emptyState.style.display = "none";
    listeParticipants.innerHTML = "";

    participants.forEach((participant) => {
      const row = document.createElement("div");
      row.className = "participant-row";

      const mode = participant.participationMode || "questionnaire";
      const modeBadgeClass = mode === "webcam" ? "badge-webcam" : "badge-question";
      const modeLabel = mode === "webcam" ? "Webcam" : "Questionnaire";

      row.innerHTML = `
        <div class="participant-info">
          <div class="avatar">${initialsOf(participant)}</div>
          <div>
            <div class="participant-nom">${participantLabel(participant)}</div>
            <div class="participant-mat">${participant.studentEmail || "Sans email"}</div>
          </div>
        </div>
        <div class="participant-badges">
          <span class="badge ${modeBadgeClass}">${modeLabel}</span>
          <span class="badge badge-connecte">${participant.connected === false ? "Deconnecte" : "Connecte"}</span>
        </div>
      `;

      listeParticipants.appendChild(row);
    });
  }

  const webcamCount = participants.filter((participant) => participant.participationMode === "webcam").length;
  const questionnaireCount = participants.filter((participant) => (participant.participationMode || "questionnaire") === "questionnaire").length;
  infoWebcam.textContent = `${webcamCount} webcam / ${questionnaireCount} questionnaire`;

  renderActivityStatus();
  renderDashboard();
}

function renderOptionsAndGraph() {
  const webcamCount = participantsCache.filter((participant) => participant.participationMode === "webcam").length;
  const questionnaireCount = participantsCache.filter((participant) => (participant.participationMode || "questionnaire") === "questionnaire").length;

  const emotionEntries = Object.entries(emotionsCache);
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

  kpiParticipants.textContent = String(participantsCache.length);
  kpiQuestionnaires.textContent = String(completion.completed);
  kpiSubjectif.textContent = subjective === null ? "—" : `${subjective}/5`;
  kpiObjectif.textContent = objective === null ? "—" : `${objective}/5`;
  kpiGlobal.textContent = globalScore === null ? "—" : `${globalScore}/5`;

  progressBar.style.width = `${completion.pct}%`;
  progressLabel.textContent = `${completion.pct}%`;

  renderComparison(subjective, objective, globalScore);
  renderEmotionRows(emotionsCache);
  renderOptionsAndGraph();

  logAudit("Comparaison des resultats subjectifs/objectifs et score global: couverture CDC 6.3.1.4 en temps reel.");
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

    logFirebase("Meta salle mise a jour", "success");
    logAudit("Suivi du statut de session en temps reel: conforme CDC 6.3.2 mode interactif.");
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
    logFirebase(`Presence mise a jour: ${participants.length} participant(s)`, "success");
    logAudit("Salle d'attente temps reel: conforme a l'objectif de suivi interactif (CDC 6.2).");
  }, (error) => {
    logFirebase(`Echec flux presence: ${error?.code || error?.message || error}`, "error");
  });
}

function subscribeEmotions() {
  const emotionsRef = firebaseApi.ref(firebaseApi.db, `rooms/${roomId}/emotions`);
  logFirebase(`Abonnement emotions: rooms/${roomId}/emotions`);

  firebaseApi.onValue(emotionsRef, (snapshot) => {
    const raw = snapshot.val();
    emotionsCache = summarizeEmotions(raw);
    renderDashboard();
    logFirebase("Flux emotions mis a jour en temps reel", "success");
    logAudit("Visualisation statistique temps reel des emotions: CDC 6.3.2.1.");
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
    logFirebase("Flux questionnaires mis a jour en temps reel", "success");
    logAudit("Suivi des questionnaires et progression des reponses: conforme CDC 6.3.1.2 / 6.3.2.");
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
    const connectedCount = participantsCache.filter((participant) => participant.connected !== false).length;
    const isRunning = (roomMetaCache?.activityStatus || "waiting") === "running";

    if (!isRunning && connectedCount === 0) {
      hintLancer.textContent = "Impossible de lancer: aucun participant connecte.";
      return;
    }

    if (isRunning) {
      await mergeRoomMetaPatch({
        activityStatus: "ended",
        activityEndedAt: Date.now()
      });
      logFirebase(`Activite terminee pour salle ${roomId}`, "success");
      logAudit("Notification de fin de session en temps reel: conforme CDC 6.3.2 mode interactif et notifications.");
      return;
    }

    await mergeRoomMetaPatch({
      activityStatus: "running",
      activityStartedAt: Date.now()
    });
    logFirebase(`Activite lancee pour salle ${roomId}`, "success");
    logAudit("Demarrage de session suivi live: conforme CDC 6.3.2 mode interactif.");
  } catch (error) {
    hintLancer.textContent = "Echec lors du changement d'etat de la session.";
    logFirebase(`Echec action activite: ${error?.code || error?.message || error}`, "error");
  }
};

async function start() {
  roomId = resolveRoomId();

  codeAffiche.textContent = roomId;
  nomSalleHeader.textContent = `Salle ${roomId}`;

  infoDate.textContent = "Chargement...";
  infoDuree.textContent = "Chargement...";
  infoProf.textContent = "Chargement...";
  infoWebcam.textContent = "Chargement...";
  liveStatusText.textContent = "Chargement...";

  try {
    logFirebase("Chargement firebase-config.js...");
    firebaseApi = await import("./firebase-config.js");
    logFirebase("Module Firebase charge", "success");

    logFirebase("Tentative de connexion Auth anonyme...");
    await firebaseApi.ensureAuth();
    logFirebase("Connexion Auth OK", "success");

    localStorage.setItem("currentRoomCode", roomId);

    subscribeRoomMeta();
    subscribeParticipants();
    subscribeEmotions();
    subscribeQuestionnaires();
  } catch (error) {
    logFirebase(`Echec initialisation ecran suivi: ${error?.code || error?.message || error}`, "error");
    hintLancer.textContent = "Erreur de connexion Firebase.";
  }
}

start();
