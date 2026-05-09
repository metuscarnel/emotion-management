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

// Détection d'émotions
let detectionActive = false;
let detectionStartTime = null;
let emotionHistory = [];
let emotionStats = {
  happy: 0, sad: 0, neutral: 0, angry: 0,
  surprised: 0, fearful: 0, disgusted: 0
};
let detectionInterval = null;
let faceApiReady = false;

// === GESTION DE LA DÉCONNEXION ===
async function markAsDisconnected() {
  if (!firebaseApi) return;
  
  try {
    const participantKey = localStorage.getItem("currentParticipantKey");
    const roomId = localStorage.getItem("currentRoomCode");
    
    if (!participantKey || !roomId) return;
    
    const participantRef = firebaseApi.ref(firebaseApi.db, `rooms/${roomId}/participants/${participantKey}`);
    await firebaseApi.update(participantRef, {
      connected: false,
      disconnectedAt: Date.now()
    });
    
    logFirebase(`✓ Participant marqué comme déconnecté`, "success");
    logAudit("Déconnexion participant enregistrée dans Firebase");
  } catch (error) {
    logFirebase(`Erreur lors de la déconnexion: ${error?.message}`, "error");
  }
}

// Marquer comme déconnecté quand l'utilisateur quitte
window.addEventListener("beforeunload", markAsDisconnected);
window.addEventListener("pagehide", markAsDisconnected);

// === GESTION DU BOUTON QUITTER ===
async function handleLeaveRoom() {
  await markAsDisconnected();
  logFirebase("Redirection vers accueil après déconnexion", "success");
  setTimeout(() => {
    window.location.href = "accueil.html";
  }, 300);
}

const leaveBtn = document.getElementById("leaveBtn");
if (leaveBtn) {
  leaveBtn.addEventListener("click", handleLeaveRoom);
}

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
    { label: "Extrêmement", score: 5 }
  ];
}

// === BANQUE DE QUESTIONS SCIENTIFIQUES ===
function getDefaultQuestionsBank() {
  return [
    {
      id: "q001",
      question: "Je me sens engagé(e) par cette activité pédagogique.",
      options: defaultLikertOptions()
    },
    {
      id: "q002",
      question: "Les explications du professeur sont claires et compréhensibles.",
      options: defaultLikertOptions()
    },
    {
      id: "q003",
      question: "Je suis concentré(e) sur la tâche en cours.",
      options: defaultLikertOptions()
    },
    {
      id: "q004",
      question: "Cette activité me plaît beaucoup.",
      options: defaultLikertOptions()
    },
    {
      id: "q005",
      question: "Je ressens de la confiance dans ma capacité à réussir.",
      options: defaultLikertOptions()
    },
    {
      id: "q006",
      question: "J'ai l'impression de progresser et d'apprendre des choses nouvelles.",
      options: defaultLikertOptions()
    },
    {
      id: "q007",
      question: "Je suis stressé(e) ou anxieux(se) en ce moment.",
      options: defaultLikertOptions()
    },
    {
      id: "q008",
      question: "La difficulté de cette activité est adaptée à mon niveau.",
      options: defaultLikertOptions()
    },
    {
      id: "q009",
      question: "Je me sens motivé(e) à poursuivre cette activité.",
      options: defaultLikertOptions()
    },
    {
      id: "q010",
      question: "Je trouve cette activité ennuyeuse ou peu intéressante.",
      options: defaultLikertOptions()
    },
    {
      id: "q011",
      question: "Je suis satisfait(e) de mes performances jusqu'à présent.",
      options: defaultLikertOptions()
    },
    {
      id: "q012",
      question: "Les interactions avec les autres participants m'aident.",
      options: defaultLikertOptions()
    },
    {
      id: "q013",
      question: "Je ressens de la frustration face aux difficultés rencontrées.",
      options: defaultLikertOptions()
    },
    {
      id: "q014",
      question: "Cette activité me donne envie de poursuivre mes apprentissages.",
      options: defaultLikertOptions()
    },
    {
      id: "q015",
      question: "Je suis bien à l'aise avec le format et les outils utilisés.",
      options: defaultLikertOptions()
    }
  ];
}

// === SÉLECTION ALÉATOIRE (Fisher-Yates Shuffle) ===
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function selectRandomQuestions(allQuestions, count = 5) {
  if (!allQuestions || allQuestions.length === 0) {
    throw new Error("Aucune question disponible pour sélection aléatoire");
  }

  const shuffled = shuffleArray(allQuestions);
  const selectedCount = Math.min(count, allQuestions.length);
  return shuffled.slice(0, selectedCount);
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

  let allQuestionsBank = [];

  // Étape 1: Essayer de charger une banque de questions depuis Firebase
  try {
    logFirebase("📚 Tentative de chargement d'une banque de questions depuis Firebase...");
    const questionsRef = firebaseApi.ref(firebaseApi.db, "questionsBank");
    const snapshot = await firebaseApi.get(questionsRef);

    if (snapshot.exists()) {
      const rawBank = snapshot.val();
      allQuestionsBank = normalizeQuestions(rawBank);
      logFirebase(`✅ Banque Firebase chargée: ${allQuestionsBank.length} questions disponibles`, "success");
    } else {
      logFirebase("ℹ️ Pas de banque dans Firebase, utilisation des questions par défaut", "info");
    }
  } catch (fbError) {
    logFirebase(`⚠️ Erreur lecture Firebase: ${fbError?.message}. Utilisation des questions par défaut.`, "error");
  }

  // Étape 2: Utiliser la banque par défaut si aucune depuis Firebase
  if (allQuestionsBank.length === 0) {
    allQuestionsBank = normalizeQuestions(getDefaultQuestionsBank());
    logFirebase(`📋 Utilisation de la banque par défaut: ${allQuestionsBank.length} questions`, "success");
  }

  // Étape 3: Sélectionner aléatoirement 5 questions
  const selectedCount = 5;
  questionnaireQuestions = selectRandomQuestions(allQuestionsBank, selectedCount);
  questionnaireLoaded = true;

  if (!questionnaireQuestions.length) {
    throw new Error("Impossible de sélectionner les questions aléatoires");
  }

  // Étape 4: Traçabilité scientifique - Enregistrer l'ordre des questions pour audit
  const sessionId = `${currentRoomId}_${Date.now()}`;
  const questionIds = questionnaireQuestions.map(q => q.id).join(", ");
  logAudit(`[RIGUEUR SCIENTIFIQUE] Session ${sessionId} - Questions sélectionnées (aléatoires): ${questionIds}`);
  
  logFirebase(`✅ ${selectedCount} questions sélectionnées aléatoirement sur ${allQuestionsBank.length}`, "success");
  logAudit("Mesure subjective aléatoire: conforme CDC 6.3.1.2 (sélection aléatoire pour rigueur scientifique, pas de biais de sélection).");
  
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

  // Enregistrer l'ordre des questions pour traçabilité scientifique
  const questionsUsed = questionnaireQuestions.map((q, idx) => ({
    position: idx + 1,
    id: q.id,
    text: q.text
  }));

  const responsesRef = firebaseApi.ref(firebaseApi.db, `rooms/${roomId}/questionnaires/${responseKey}`);
  logFirebase(`Ecriture questionnaire rooms/${roomId}/questionnaires/${responseKey} ...`);

  await firebaseApi.set(responsesRef, {
    uid: firebaseApi.auth.currentUser?.uid || "",
    roomId,
    participantKey: participantKey || "",
    submittedAt: Date.now(),
    totalScore: payload.totalScore,
    averageScore: payload.averageScore,
    answers: payload.answers,
    // ✅ TRAÇABILITÉ: Enregistrer l'ordre exact des questions posées
    questionsUsed: questionsUsed,
    questionsCount: questionnaireQuestions.length
  });

  logFirebase(`✅ Questionnaire enregistré (score moyen=${payload.averageScore}) avec ordre des questions`, "success");
  logAudit(`Traçabilité scientifique: ${questionsUsed.length} questions enregistrées avec leurs positions pour audit`);

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

        const submitBtn = form.querySelector("button[type='submit']");
        if (submitBtn) {
          submitBtn.textContent = "Enregistrement en cours...";
          submitBtn.disabled = true;
        }

        await saveQuestionnaire(roomId, result);
        
        const section = document.getElementById("dynamicQuestionnaire");
        if (section) {
          section.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
              <div style="font-size: 60px; margin-bottom: 16px;">✅</div>
              <h2 style="color: #10b981; margin-bottom: 10px; font-size: 24px;">Questionnaire validé !</h2>
              <p style="color: #475569; font-size: 16px; margin-bottom: 25px; line-height: 1.5;">
                Merci pour votre participation.<br>
                Votre score subjectif moyen est de <strong>${result.averageScore}/5</strong>.
              </p>
              <button onclick="window.location.href='accueil.html'" style="background: #830c2a; color: white; padding: 12px 28px; border: none; border-radius: 25px; cursor: pointer; font-size: 15px; font-weight: 600; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">Terminer et quitter</button>
            </div>
          `;
        }
        
        showInlineMessage(""); // Effacer tout message d'erreur précédent
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

    // GESTION ROBUSTE DE LA PRÉSENCE (évite le bug lors du changement de page)
    const participantKey = localStorage.getItem("currentParticipantKey");
    const roomId = localStorage.getItem("currentRoomCode") || currentRoomId;
    
    if (participantKey && roomId) {
      const participantRef = firebaseApi.ref(firebaseApi.db, `rooms/${roomId}/participants/${participantKey}`);
      
      const connectedRef = firebaseApi.ref(firebaseApi.db, ".info/connected");
      firebaseApi.onValue(connectedRef, (snap) => {
        if (snap.val() === true) {
          firebaseApi.onDisconnect(participantRef).update({ connected: false });
          firebaseApi.update(participantRef, { connected: true, updatedAt: Date.now() });
        }
      });
    }
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
        connected: true,
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

/* BOUTON TERMINER DÉTECTION */
document.addEventListener("DOMContentLoaded", () => {
  const endDetectionBtn = document.getElementById("endDetectionBtn");
  if (endDetectionBtn) {
    endDetectionBtn.onclick = stopEmotionDetection;
  }
});

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
    showInlineMessage("Webcam activée... Initialisation de la détection d'émotions en cours.");
    
    // Lancer la détection après un délai court pour laisser la vidéo démarrer
    setTimeout(() => {
      startEmotionDetection();
    }, 500);
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

/* DÉTECTION D'ÉMOTIONS AVEC FACE-API */
async function startEmotionDetection() {
  console.log("[DETECTION] Initialisation démarrage...");
  console.log("[DETECTION] faceApiReady:", faceApiReady);
  console.log("[DETECTION] typeof faceapi:", typeof faceapi);

  // Vérifier que Face-API est prêt
  if (!faceApiReady) {
    logFirebase("Face-API pas encore prêt, attente...", "error");
    showInlineMessage("Détection en cours de chargement... Veuillez patienter.", true);
    
    // Attendre max 5 secondes
    let waitCount = 0;
    while (!faceApiReady && waitCount < 10) {
      await new Promise(resolve => setTimeout(resolve, 500));
      waitCount++;
      console.log("[DETECTION] Attente...", waitCount);
    }

    if (!faceApiReady) {
      logFirebase("Face-API timeout (5s)", "error");
      console.error("[DETECTION] Face-API n'est pas chargé après 5s");
      showInlineMessage("Erreur: Impossible de charger la détection d'émotions. Veuillez essayer le questionnaire.", true);
      return;
    }
  }

  detectionActive = true;
  detectionStartTime = Date.now();
  emotionHistory = [];
  emotionStats = {
    happy: 0, sad: 0, neutral: 0, angry: 0,
    surprised: 0, fearful: 0, disgusted: 0
  };

  const detectionPanel = document.getElementById("detectionPanel");
  detectionPanel.classList.remove("hidden");

  console.log("[DETECTION] Détection lancée ! ✓");
  logFirebase("Démarrage détection Face-API", "success");
  logAudit("Mesure objective des emotions via IA : conforme CDC 6.3.1.1 (detection + enregistrement).");

  // Boucle de détection toutes les 300ms
  detectionInterval = setInterval(() => {
    detectEmotions();
  }, 300);

  console.log("[DETECTION] Intervalle de détection lancé (300ms)");

  // Timer
  const timerInterval = setInterval(() => {
    if (!detectionActive) {
      clearInterval(timerInterval);
      return;
    }
    const elapsed = Math.round((Date.now() - detectionStartTime) / 1000);
    document.getElementById("timerDisplay").textContent = elapsed;
  }, 1000);
}

async function detectEmotions() {
  if (!detectionActive) return;

  try {
    // Vérifier que Face-API est disponible
    if (typeof faceapi === "undefined") {
      logFirebase("Face-API non chargé (undefined)", "error");
      return;
    }

    const canvas = document.getElementById("overlay");
    const ctx = canvas.getContext("2d");

    // Vérifier dimensions vidéo
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      // Vidéo pas encore chargée, c'est normal
      return;
    }

    // Ajuster la taille du canvas
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Dessiner la vidéo sur le canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Détecter les visages et expressions
    const detections = await faceapi
      .detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions())
      .withFaceExpressions();

    if (!detections || detections.length === 0) {
      // Pas de visage détecté, c'est normal - ne pas spammer les logs
      return;
    }

    // Premier visage détecté
    const detection = detections[0];
    const expressions = detection.expressions;

    // Trouver l'émotion dominante
    let maxEmotion = "neutral";
    let maxConfidence = 0;

    Object.entries(expressions).forEach(([emotion, confidence]) => {
      if (confidence > maxConfidence) {
        maxConfidence = confidence;
        maxEmotion = emotion;
      }
    });

    // Enregistrer l'émotion
    recordEmotion(maxEmotion, maxConfidence);
    updateEmotionDisplay();

    // Dessiner boîte de détection (rectangle vert)
    ctx.strokeStyle = "#4ade80";
    ctx.lineWidth = 3;
    const { x, y, width, height } = detection.detection.box;
    ctx.strokeRect(x, y, width, height);

    // Afficher l'émotion au-dessus du visage
    ctx.fillStyle = "#4ade80";
    ctx.font = "bold 16px Arial";
    ctx.fillText(maxEmotion.toUpperCase(), x, y - 10);
  } catch (error) {
    // Ne logger que les erreurs critiques, pas les absences de visage
    if (error.message && !error.message.includes("width") && !error.message.includes("height")) {
      console.error("[FACE-API ERROR]", error);
    }
  }
}

function recordEmotion(emotion, confidence) {
  const emotionMap = {
    happy: "happy",
    sad: "sad",
    neutral: "neutral",
    angry: "angry",
    surprised: "surprised",
    fearful: "fearful",
    disgusted: "disgusted"
  };

  const mappedEmotion = emotionMap[emotion] || emotion;
  emotionStats[mappedEmotion] = (emotionStats[mappedEmotion] || 0) + 1;

  emotionHistory.push({
    emotion: mappedEmotion,
    confidence,
    timestamp: Date.now()
  });

  // Log premier sample
  if (emotionHistory.length === 1) {
    console.log("[EMOTION] Premier sample détecté:", mappedEmotion, confidence);
  }
}

function updateEmotionDisplay() {
  const total = Object.values(emotionStats).reduce((a, b) => a + b, 0);
  if (total === 0) return;

  // Calculer les pourcentages
  const percentages = {
    happy: Math.round((emotionStats.happy / total) * 100),
    sad: Math.round((emotionStats.sad / total) * 100),
    neutral: Math.round((emotionStats.neutral / total) * 100),
    angry: Math.round((emotionStats.angry / total) * 100),
    surprised: Math.round((emotionStats.surprised / total) * 100),
    fearful: Math.round((emotionStats.fearful / total) * 100),
    disgusted: Math.round((emotionStats.disgusted / total) * 100)
  };

  // Mettre à jour les barres
  Object.entries(percentages).forEach(([emotion, pct]) => {
    const fillElement = document.getElementById(`stat-${emotion}`);
    const pctElement = document.getElementById(`stat-${emotion}-pct`);
    if (fillElement) fillElement.style.width = `${pct}%`;
    if (pctElement) pctElement.textContent = `${pct}%`;
  });

  // Émotion dominante
  const dominant = Object.entries(emotionStats).reduce((prev, current) =>
    prev[1] > current[1] ? prev : current
  );
  
  const emotionLabels = {
    happy: "😊 Heureux",
    sad: "😢 Triste",
    neutral: "😐 Neutre",
    angry: "😠 En colère",
    surprised: "😲 Surpris",
    fearful: "😨 Peur",
    disgusted: "🤢 Dégoûté"
  };

  document.getElementById("dominantEmotionDisplay").textContent =
    emotionLabels[dominant[0]] || "En attente...";
}

async function stopEmotionDetection() {
  detectionActive = false;
  clearInterval(detectionInterval);

  const detectionPanel = document.getElementById("detectionPanel");
  detectionPanel.classList.add("hidden");

  const elapsedSeconds = Math.round((Date.now() - detectionStartTime) / 1000);

  logFirebase(
    `Détection terminée: ${elapsedSeconds}s, ${emotionHistory.length} samples`,
    "success"
  );

  // Sauvegarder dans Firebase
  await saveEmotionData(currentRoomId, elapsedSeconds);

  // ✅ AFFICHER LES RÉSULTATS
  displayEmotionResults(elapsedSeconds);
}

async function saveEmotionData(roomId, duration) {
  if (!firebaseApi) return;

  try {
    const participantKey = localStorage.getItem("currentParticipantKey");
    if (!participantKey) {
      logFirebase("Pas de participantKey pour sauvegarder", "error");
      return;
    }

    // ✅ VÉRIFIER LE MODE DU PARTICIPANT
    const participantRef = firebaseApi.ref(
      firebaseApi.db,
      `rooms/${roomId}/participants/${participantKey}`
    );
    const participantSnap = await firebaseApi.get(participantRef);
    
    if (!participantSnap.exists()) {
      logFirebase("Participant non trouvé", "error");
      return;
    }

    const participant = participantSnap.val();
    const isAnonymous = participant.mode === "anonymous";

    // ✅ NE SAUVEGARDER QUE SI ANONYME
    if (!isAnonymous) {
      logFirebase(
        `Participant nommé (${participant.mode}): données d'émotions NON sauvegardées`,
        "success"
      );
      logAudit(
        "Participant non-anonyme: émotions detectées mais non stockées (respect confidentialité)."
      );
      showInlineMessage("Données d'émotions traitées localement (participant non-anonyme).", false);
      return;
    }

    // ✅ SAUVEGARDER POUR LES PARTICIPANTS ANONYMES
    const emotionDataRef = firebaseApi.ref(
      firebaseApi.db,
      `rooms/${roomId}/emotions/${participantKey}`
    );

    const data = {
      participantKey,
      roomId,
      duration,
      totalSamples: emotionHistory.length,
      emotionStats,
      emotionHistory,
      recordedAt: Date.now()
    };

    await firebaseApi.set(emotionDataRef, data);
    logFirebase("Données d'émotions (anonyme) sauvegardées", "success");

    // Mettre à jour le participant
    await firebaseApi.set(participantRef, {
      ...participant,
      objectiveEmotionComplete: true,
      dominantEmotion: Object.entries(emotionStats).reduce((prev, current) =>
        prev[1] > current[1] ? prev : current
      )[0],
      updatedAt: Date.now()
    });

    showInlineMessage("Données d'émotions enregistrées avec succès ✓", false);
  } catch (error) {
    logFirebase(`Erreur sauvegarde émotions: ${error.message}`, "error");
    showInlineMessage("Erreur lors de la sauvegarde.", true);
  }
}

/* AFFICHAGE DES RÉSULTATS */
function displayEmotionResults(duration) {
  const resultsPanel = document.getElementById("resultsPanel");
  const detectionPanel = document.getElementById("detectionPanel");

  // Masquer panel détection, afficher résultats
  detectionPanel.classList.add("hidden");
  resultsPanel.classList.remove("hidden");

  // Calculer l'émotion dominante
  const dominantEmotion = Object.entries(emotionStats).reduce((prev, current) =>
    prev[1] > current[1] ? prev : current
  );

  const emotionLabels = {
    happy: "😊 Heureux",
    sad: "😢 Triste",
    neutral: "😐 Neutre",
    angry: "😠 En colère",
    surprised: "😲 Surpris",
    fearful: "😨 Peur",
    disgusted: "🤢 Dégoûté"
  };

  // 1. Mettre à jour stats clés
  document.getElementById("resultDuration").textContent = `${duration}s`;
  document.getElementById("resultSamples").textContent = emotionHistory.length;
  document.getElementById("resultDominant").textContent = 
    emotionLabels[dominantEmotion[0]] || "Neutre";

  // 2. Générer le graphique
  generateEmotionChart();

  // 3. Remplir le tableau détails
  populateEmotionTable();

  console.log("[RESULTS] Résultats affichés ✓");
}

function generateEmotionChart() {
  const chartContainer = document.getElementById("emotionChart");
  const total = Object.values(emotionStats).reduce((a, b) => a + b, 0);

  if (total === 0) {
    chartContainer.innerHTML = "<p>Aucune émotion détectée</p>";
    return;
  }

  // Créer graphique en barres horizontal avec SVG
  const emotionOrder = ["happy", "sad", "neutral", "angry", "surprised", "fearful", "disgusted"];
  const emotionLabels = {
    happy: "😊 Heureux",
    sad: "😢 Triste",
    neutral: "😐 Neutre",
    angry: "😠 En colère",
    surprised: "😲 Surpris",
    fearful: "😨 Peur",
    disgusted: "🤢 Dégoûté"
  };

  const emotionColors = {
    happy: "#FFEB3B",
    sad: "#2196F3",
    neutral: "#9E9E9E",
    angry: "#F44336",
    surprised: "#FF9800",
    fearful: "#673AB7",
    disgusted: "#4CAF50"
  };

  let svg = '<svg viewBox="0 0 400 280" xmlns="http://www.w3.org/2000/svg">';

  // Titre
  svg += '<text x="200" y="20" font-size="16" font-weight="bold" text-anchor="middle" fill="#333">Répartition des Émotions</text>';

  // Barres
  let yPos = 50;
  emotionOrder.forEach((emotion) => {
    const count = emotionStats[emotion] || 0;
    const percentage = Math.round((count / total) * 100);
    const barWidth = (percentage / 100) * 250;

    // Barre
    svg += `<rect x="100" y="${yPos}" width="${barWidth}" height="20" fill="${emotionColors[emotion]}" rx="3"/>`;

    // Label
    svg += `<text x="10" y="${yPos + 15}" font-size="12" fill="#333">${emotionLabels[emotion]}</text>`;

    // Pourcentage
    svg += `<text x="${105 + barWidth}" y="${yPos + 15}" font-size="11" font-weight="bold" fill="#333">${percentage}%</text>`;

    yPos += 30;
  });

  svg += '</svg>';

  chartContainer.innerHTML = svg;
}

function populateEmotionTable() {
  const tableBody = document.getElementById("emotionTableBody");
  const total = Object.values(emotionStats).reduce((a, b) => a + b, 0);

  const emotionLabels = {
    happy: "😊 Heureux",
    sad: "😢 Triste",
    neutral: "😐 Neutre",
    angry: "😠 En colère",
    surprised: "😲 Surpris",
    fearful: "😨 Peur",
    disgusted: "🤢 Dégoûté"
  };

  tableBody.innerHTML = "";

  const emotionOrder = ["happy", "sad", "neutral", "angry", "surprised", "fearful", "disgusted"];

  emotionOrder.forEach((emotion) => {
    const count = emotionStats[emotion] || 0;
    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

    const row = `
      <tr>
        <td>${emotionLabels[emotion]}</td>
        <td>${count}</td>
        <td>${percentage}%</td>
      </tr>
    `;

    tableBody.innerHTML += row;
  });
}

/* HANDLERS BOUTONS RÉSULTATS */
document.addEventListener("DOMContentLoaded", () => {
  const repeatBtn = document.getElementById("repeatDetectionBtn");
  const returnBtn = document.getElementById("returnHomeBtn");

  if (repeatBtn) {
    repeatBtn.onclick = () => {
      // Réinitialiser et recommencer
      const resultsPanel = document.getElementById("resultsPanel");
      resultsPanel.classList.add("hidden");
      
      detectionActive = false;
      clearInterval(detectionInterval);
      emotionHistory = [];
      emotionStats = {
        happy: 0, sad: 0, neutral: 0, angry: 0,
        surprised: 0, fearful: 0, disgusted: 0
      };

      startEmotionDetection();
    };
  }

  if (returnBtn) {
    returnBtn.onclick = () => {
      // Retour à l'accueil
      window.location.href = "accueil.html";
    };
  }
});

/* PRÊT POUR FACE-API.JS */
async function initializeFaceApi() {
  try {
    if (typeof faceapi === "undefined") {
      logFirebase("Face-API non disponible (script non chargé)", "error");
      faceApiReady = false;
      return;
    }

    logFirebase("Initialisation Face-API...");

    // Charger les modèles depuis le CDN
    const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/";

    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
    ]);

    faceApiReady = true;
    logFirebase("Face-API initialisé avec succès ✓", "success");
  } catch (error) {
    logFirebase(`Erreur initialisation Face-API: ${error.message}`, "error");
    faceApiReady = false;
  }
}

// Initialiser Face-API au chargement de la page
window.addEventListener("load", () => {
  initializeFaceApi();
});

const initialRoomId = resolveRoomId();
if (/^[A-Z]{4}\d{4}$/.test(initialRoomId)) {
  roomCodeInput.value = initialRoomId;
  currentRoomId = initialRoomId;
}

initFirebase();
