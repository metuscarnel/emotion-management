const roomCodeInput = document.getElementById("roomCode");
const codeError = document.getElementById("codeError");
const enableCam = document.getElementById("enableCam");
const noCam = document.getElementById("noCam");
const videoBox = document.getElementById("videoBox");
const video = document.getElementById("video");
const activityStatusBanner = document.getElementById("activityStatusBanner");

let useCamera = true;
let firebaseApi = null;
let questionnaireLoaded = false;
let questionnaireQuestions = [];
let questionnaireSection = null;
let currentRoomId = "";
let currentActivityStatus = "waiting";

function logFirebase(message, type = "info") {
  const prefix = `[Firebase][JOIN][${type.toUpperCase()}]`;
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

function setActivityBanner(status, message) {
  if (!activityStatusBanner) return;

  currentActivityStatus = status || "waiting";
  activityStatusBanner.classList.remove("waiting", "live", "ended");

  if (currentActivityStatus === "running") {
    activityStatusBanner.classList.add("live");
  } else if (currentActivityStatus === "ended") {
    activityStatusBanner.classList.add("ended");
  } else {
    activityStatusBanner.classList.add("waiting");
  }

  activityStatusBanner.textContent = message;
}

function defaultLikertOptions() {
  return [
    { label: "Pas du tout", score: 1 },
    { label: "Un peu", score: 2 },
    { label: "Moyennement", score: 3 },
    { label: "Beaucoup", score: 4 },
    { label: "Extremement", score: 5 }
  ];
}

function normalizeOptions(rawOptions) {
  if (!rawOptions) return defaultLikertOptions();

  const optionsArray = Array.isArray(rawOptions)
    ? rawOptions
    : Object.values(rawOptions);

  const normalized = optionsArray
    .filter((option) => option !== null && option !== undefined && option !== "")
    .map((option, index) => {
    if (typeof option === "string") {
      return { label: option, score: index + 1 };
    }

    if (typeof option === "number") {
      return { label: String(option), score: Number(option) };
    }

    return {
      label: option?.label || option?.text || option?.value || `Option ${index + 1}`,
      score: Number(option?.score ?? option?.value ?? index + 1)
    };
    });

  return normalized.length ? normalized : defaultLikertOptions();
}

function normalizeQuestions(rawQuestions) {
  const list = Array.isArray(rawQuestions)
    ? rawQuestions
    : Object.entries(rawQuestions || {}).map(([key, value]) => ({ id: key, ...value }));

  return list
    .map((question, index) => {
      const text = question?.question || question?.text || question?.label || question?.title || question?.libelle;
      if (!text) return null;

      return {
        id: question?.id || `q${index + 1}`,
        text,
        options: normalizeOptions(question?.options || question?.choices || question?.answers || question?.reponses)
      };
    })
    .filter(Boolean);
}

async function loadQuestions() {
  if (!firebaseApi) {
    throw new Error("Firebase non initialise");
  }

  if (questionnaireLoaded && questionnaireQuestions.length) {
    return questionnaireQuestions;
  }

  logFirebase("Lecture des questions depuis /questions ...");
  const questionsRef = firebaseApi.ref(firebaseApi.db, "questions");
  const snapshot = await firebaseApi.get(questionsRef);

  if (!snapshot.exists()) {
    throw new Error("Aucune question disponible dans Realtime Database (/questions)");
  }

  questionnaireQuestions = normalizeQuestions(snapshot.val());
  questionnaireLoaded = true;

  if (!questionnaireQuestions.length) {
    throw new Error("Le format des questions est invalide ou vide");
  }

  logFirebase(`Questions chargees: ${questionnaireQuestions.length}`, "success");
  logAudit("Mesure subjective par questionnaires : conforme CDC 6.3.1.2 (affichage + echelles + enregistrement + scoring subjectif).");
  return questionnaireQuestions;
}

function ensureQuestionnaireSection() {
  if (questionnaireSection) return questionnaireSection;

  questionnaireSection = document.createElement("section");
  questionnaireSection.id = "dynamicQuestionnaire";
  questionnaireSection.style.marginTop = "24px";
  questionnaireSection.style.padding = "16px";
  questionnaireSection.style.border = "1px solid #e2e8f0";
  questionnaireSection.style.borderRadius = "12px";
  questionnaireSection.style.background = "#ffffff";
  questionnaireSection.style.display = "none";

  const container = document.querySelector(".container");
  container.appendChild(questionnaireSection);
  return questionnaireSection;
}

function renderQuestionnaire(questions, roomId) {
  const section = ensureQuestionnaireSection();

  section.innerHTML = "";

  const title = document.createElement("h2");
  title.textContent = "Questionnaire d'auto-evaluation emotionnelle";
  title.style.margin = "0 0 8px";
  title.style.fontSize = "20px";
  section.appendChild(title);

  const subtitle = document.createElement("p");
  subtitle.textContent = `Salle: ${roomId} • Repondez a toutes les questions`;
  subtitle.style.margin = "0 0 14px";
  subtitle.style.fontSize = "14px";
  subtitle.style.color = "#475569";
  section.appendChild(subtitle);

  const form = document.createElement("form");
  form.id = "questionnaireForm";

  questions.forEach((question, qIndex) => {
    const block = document.createElement("div");
    block.style.marginBottom = "14px";

    const qLabel = document.createElement("p");
    qLabel.textContent = `${qIndex + 1}. ${question.text}`;
    qLabel.style.margin = "0 0 8px";
    qLabel.style.fontWeight = "600";
    block.appendChild(qLabel);

    const optionsRow = document.createElement("div");
    optionsRow.style.display = "flex";
    optionsRow.style.flexWrap = "wrap";
    optionsRow.style.gap = "8px";

    question.options.forEach((option, optionIndex) => {
      const label = document.createElement("label");
      label.style.display = "inline-flex";
      label.style.alignItems = "center";
      label.style.gap = "6px";
      label.style.padding = "6px 10px";
      label.style.border = "1px solid #cbd5e1";
      label.style.borderRadius = "999px";
      label.style.cursor = "pointer";
      label.style.fontSize = "13px";

      const input = document.createElement("input");
      input.type = "radio";
      input.name = `question_${qIndex}`;
      input.value = String(option.score);
      input.dataset.questionId = question.id;
      input.dataset.questionText = question.text;
      input.dataset.optionLabel = option.label;
      input.dataset.optionIndex = String(optionIndex);

      const span = document.createElement("span");
      span.textContent = option.label;

      label.appendChild(input);
      label.appendChild(span);
      optionsRow.appendChild(label);
    });

    block.appendChild(optionsRow);
    form.appendChild(block);
  });

  const submitBtn = document.createElement("button");
  submitBtn.type = "submit";
  submitBtn.textContent = "Valider le questionnaire";
  submitBtn.style.marginTop = "6px";
  submitBtn.style.padding = "10px 14px";
  submitBtn.style.border = "none";
  submitBtn.style.borderRadius = "10px";
  submitBtn.style.background = "#7A0026";
  submitBtn.style.color = "white";
  submitBtn.style.cursor = "pointer";

  form.appendChild(submitBtn);
  section.appendChild(form);
  section.style.display = "block";
}

function collectQuestionnaireAnswers(questions) {
  const answers = [];

  for (let i = 0; i < questions.length; i++) {
    const selected = document.querySelector(`input[name='question_${i}']:checked`);
    if (!selected) {
      return { ok: false, error: `Veuillez repondre a la question ${i + 1}.` };
    }

    answers.push({
      questionId: selected.dataset.questionId,
      questionText: selected.dataset.questionText,
      optionLabel: selected.dataset.optionLabel,
      optionIndex: Number(selected.dataset.optionIndex),
      score: Number(selected.value)
    });
  }

  const totalScore = answers.reduce((sum, answer) => sum + answer.score, 0);
  const averageScore = answers.length ? Number((totalScore / answers.length).toFixed(2)) : 0;

  return {
    ok: true,
    answers,
    totalScore,
    averageScore
  };
}

async function saveQuestionnaire(roomId, payload) {
  const participantKey = localStorage.getItem("currentParticipantKey");
  const responseKey = participantKey || `anon_${Date.now()}`;

  const responsesRef = firebaseApi.ref(firebaseApi.db, `rooms/${roomId}/questionnaires/${responseKey}`);
  logFirebase(`Ecriture questionnaire rooms/${roomId}/questionnaires/${responseKey} ...`);

  await firebaseApi.set(responsesRef, {
    uid: firebaseApi.auth.currentUser?.uid || "",
    roomId,
    participantKey: participantKey || "",
    submittedAt: Date.now(),
    totalScore: payload.totalScore,
    averageScore: payload.averageScore,
    answers: payload.answers
  });

  logFirebase(`Questionnaire enregistre (score moyen=${payload.averageScore})`, "success");

  if (participantKey) {
    const participantRef = firebaseApi.ref(firebaseApi.db, `rooms/${roomId}/participants/${participantKey}`);
    const participantSnap = await firebaseApi.get(participantRef);
    const existing = participantSnap.exists() ? participantSnap.val() : {};

    await firebaseApi.set(participantRef, {
      ...existing,
      subjectiveScore: payload.averageScore,
      questionnaireCompleted: true,
      updatedAt: Date.now()
    });

    logFirebase(`Participant mis a jour avec subjectiveScore=${payload.averageScore}`, "success");
  }
}

async function openQuestionnaireFlow(roomId) {
  try {
    if (currentActivityStatus === "ended") {
      showInlineMessage("La session est terminée. Le questionnaire n'est plus disponible.", true);
      return;
    }

    const questions = await loadQuestions();
    renderQuestionnaire(questions, roomId);

    const form = document.getElementById("questionnaireForm");
    form.onsubmit = async (event) => {
      event.preventDefault();

      const result = collectQuestionnaireAnswers(questions);
      if (!result.ok) {
        showInlineMessage(result.error, true);
        return;
      }

      try {
        if (currentActivityStatus === "ended") {
          showInlineMessage("La session est terminée. Impossible d'enregistrer un nouveau questionnaire.", true);
          return;
        }

        await saveQuestionnaire(roomId, result);
        showInlineMessage(`Questionnaire enregistre. Score subjectif moyen: ${result.averageScore}/5`, false);
        logAudit("Calcul automatique d'un score emotionnel subjectif : conforme CDC 6.3.1.2.");
      } catch (error) {
        logFirebase(`Echec enregistrement questionnaire: ${error?.code || error?.message || error}`, "error");
        showInlineMessage("Impossible d'enregistrer le questionnaire pour le moment.", true);
      }
    };
  } catch (error) {
    logFirebase(`Echec chargement questionnaire: ${error?.code || error?.message || error}`, "error");
    showInlineMessage("Questionnaire indisponible pour le moment.", true);
  }
}

function resolveRoomId() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = (params.get("room") || "").trim().toUpperCase();
  if (fromUrl) return fromUrl;

  const fromStorage = (localStorage.getItem("currentRoomCode") || "").trim().toUpperCase();
  if (fromStorage) return fromStorage;

  const fromInput = (roomCodeInput?.value || "").trim().toUpperCase();
  if (fromInput) return fromInput;

  return "ABCD1234";
}

function showInlineMessage(message, isError = false) {
  codeError.textContent = message;
  codeError.classList.remove("error", "success");

  if (!message) {
    return;
  }

  codeError.classList.add(isError ? "error" : "success");
}

async function initFirebase() {
  try {
    logFirebase("Chargement firebase-config.js...");
    firebaseApi = await import("./firebase-config.js");
    logFirebase("Module Firebase charge", "success");

    logFirebase("Tentative de connexion Auth anonyme...");
    await firebaseApi.ensureAuth();
    logFirebase("Connexion Auth OK", "success");
  } catch (error) {
    logFirebase(`Echec initialisation Firebase: ${error?.code || error?.message || error}`, "error");
    showInlineMessage("Connexion Firebase impossible pour le moment.", true);
  }
}

function subscribeActivityStatus(roomId) {
  if (!firebaseApi) return;

  const metaRef = firebaseApi.ref(firebaseApi.db, `rooms/${roomId}/meta`);
  logFirebase(`Abonnement statut activité: rooms/${roomId}/meta`);

  firebaseApi.onValue(metaRef, (snapshot) => {
    if (!snapshot.exists()) {
      setActivityBanner("waiting", "En attente de la création de la session par le professeur.");
      return;
    }

    const meta = snapshot.val() || {};
    const status = meta.activityStatus || "waiting";

    if (status === "running") {
      setActivityBanner("running", "Activité démarrée par le professeur. Vous pouvez participer normalement.");
      showInlineMessage("Activité démarrée par le professeur.", false);
      logAudit("Côté étudiant: réception du démarrage de session en temps réel.");
      return;
    }

    if (status === "ended") {
      setActivityBanner("ended", "Session terminée par le professeur. La participation est désormais clôturée.");
      showInlineMessage("Session terminée par le professeur.", true);
      stopCamera();

      const questionnaireForm = document.getElementById("questionnaireForm");
      if (questionnaireForm) {
        questionnaireForm.querySelectorAll("input, button").forEach((field) => {
          field.disabled = true;
        });
      }

      const joinBtn = document.getElementById("joinBtn");
      if (joinBtn) {
        joinBtn.disabled = true;
      }

      logAudit("Côté étudiant: réception de la fin de session en temps réel.");
      return;
    }

    setActivityBanner("waiting", "La salle est prête. En attente du démarrage de l'activité par le professeur.");
  }, (error) => {
    logFirebase(`Echec abonnement statut activité: ${error?.code || error?.message || error}`, "error");
  });
}

async function saveJoinMode(roomId, mode) {
  if (!firebaseApi) return;

  try {
    const participantKey = localStorage.getItem("currentParticipantKey");

    if (participantKey) {
      const participantRef = firebaseApi.ref(firebaseApi.db, `rooms/${roomId}/participants/${participantKey}`);
      logFirebase(`Mise a jour participant rooms/${roomId}/participants/${participantKey} ...`);
      await firebaseApi.set(participantRef, {
        ...(await (async () => {
          const snap = await firebaseApi.get(participantRef);
          return snap.exists() ? snap.val() : {};
        })()),
        roomId,
        participationMode: mode,
        updatedAt: Date.now()
      });
      logFirebase(`Participant mis a jour (mode=${mode})`, "success");
      return;
    }

    const participantsRef = firebaseApi.ref(firebaseApi.db, `rooms/${roomId}/participants`);
    const newParticipantRef = firebaseApi.push(participantsRef);

    logFirebase(`Creation participant fallback rooms/${roomId}/participants/${newParticipantRef.key} ...`);
    await firebaseApi.set(newParticipantRef, {
      uid: firebaseApi.auth.currentUser?.uid || "",
      firstName: "",
      lastName: "Participant",
      roomId,
      connected: true,
      participationMode: mode,
      joinedAt: Date.now(),
      updatedAt: Date.now()
    });

    localStorage.setItem("currentParticipantKey", newParticipantRef.key || "");
    logFirebase(`Participant fallback cree (mode=${mode})`, "success");
  } catch (error) {
    logFirebase(`Echec transfert mode participation: ${error?.code || error?.message || error}`, "error");
    showInlineMessage("Impossible d'enregistrer le mode de participation.", true);
  }
}

/* TOGGLE OPTIONS */
enableCam.onclick = () => {
  enableCam.classList.add("active");
  noCam.classList.remove("active");
  useCamera = true;
};

noCam.onclick = () => {
  noCam.classList.add("active");
  enableCam.classList.remove("active");
  useCamera = false;
  stopCamera();
};

/* VALIDATION CODE SALLE */
roomCodeInput.addEventListener("input", () => {
  roomCodeInput.value = roomCodeInput.value.toUpperCase();

  if (!/^[A-Z]{4}\d{4}$/.test(roomCodeInput.value)) {
    showInlineMessage("Le code doit contenir 4 lettres suivies de 4 chiffres", true);
  } else {
    showInlineMessage("");
  }
});

/* BOUTON REJOINDRE */
document.getElementById("joinBtn").onclick = async () => {
  if (!firebaseApi) {
    await initFirebase();
  }

  const roomId = roomCodeInput.value.trim() || resolveRoomId();
  currentRoomId = roomId;

  if (!/^[A-Z]{4}\d{4}$/.test(roomId)) {
    showInlineMessage("Code de salle invalide (format attendu: ABCD1234)", true);
    return;
  }

  localStorage.setItem("currentRoomCode", roomId);

  subscribeActivityStatus(roomId);

  if (useCamera) {
    const consent = confirm(
      "Autorisez-vous l’accès à la webcam pour la détection des émotions ?\n\n" +
      "Aucune image ne sera enregistrée."
    );

    if (!consent) {
      showInlineMessage("Veuillez utiliser le mode questionnaire.", true);
      logAudit("Autorisation camera refusee : conforme CDC 6.3.1.1 (consentement explicite respecte).");
      return;
    }

    logAudit("Autorisation camera accordee : conforme CDC 6.3.1.1 (gestion autorisations). ");
    await saveJoinMode(roomId, "webcam");
    startCamera();
    showInlineMessage("Webcam activee. Connexion en mode webcam.");
    setTimeout(() => {
      showInlineMessage("");
    }, 2500);
  } else {
    stopCamera();
    await saveJoinMode(roomId, "questionnaire");
    logAudit("Mode questionnaire sans webcam : conforme CDC 6.3.1.2 (questionnaire, echelles, score subjectif, enregistrement). ");
    await openQuestionnaireFlow(roomId);
    showInlineMessage("Mode questionnaire activé. Vous pouvez continuer sans webcam.");
  }
};

/* WEBCAM */
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    videoBox.classList.remove("hidden");
  } catch (e) {
    showInlineMessage("Impossible d'accéder à la webcam.", true);
  }
}

function stopCamera() {
  if (video.srcObject) {
    video.srcObject.getTracks().forEach((t) => t.stop());
  }
  videoBox.classList.add("hidden");
}

/* PRÊT POUR FACE-API.JS */
Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
  faceapi.nets.faceExpressionNet.loadFromUri("/models")
]).then(() => {
  console.log("Face API prête");
});

const initialRoomId = resolveRoomId();
if (initialRoomId && initialRoomId !== "TEMP1234") {
  roomCodeInput.value = initialRoomId;
  currentRoomId = initialRoomId;
}

initFirebase();
