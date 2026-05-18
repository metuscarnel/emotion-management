// ✅ INITIALISATION DOM SÉCURISÉE - déclaration temporaire
let roomCodeInput = null;
let codeError = null;
let videoBox = null;
let video = null;
let activityStatusBanner = null;

// Fonction pour initialiser les références DOM
function initializeDOMReferences() {
  roomCodeInput = document.getElementById("roomCode");
  codeError = document.getElementById("codeError");
  videoBox = document.getElementById("videoBox");
  video = document.getElementById("video");
  activityStatusBanner = document.getElementById("activityStatusBanner");
}

let useCamera = true;
let firebaseApi = null;
let questionnaireLoaded = false;
let questionnaireQuestions = [];
let questionnaireSection = null;
let currentRoomId = "";
let currentActivityStatus = "waiting";
let hasJoined = false;

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
let lastFacePosition = null;
let movementWarningCount = 0;
let lastSyncTime = 0;

// ✅ PROTECTIONS CONCURRENCE & OPTIMISATION POUR 40+ UTILISATEURS
let cameraStreamActive = false;
let faceDetectionInProgress = false;
let lastSuccessfulSync = 0;
let lastSyncedEmotion = null; // Tracker pour ne syncer que si changement
let syncQueue = null; // Debounce timer

// 🚀 CONSTANTS POUR 40+ UTILISATEURS
const SYNC_RATE_LIMIT = 6000; // 6s entre syncs (au lieu de 3s) - réduit charge Firebase de 50%
const DEBOUNCE_EMOTION_CHANGE = 2000; // Attendre 2s après un changement d'émotion pour syncer
const MIN_CONFIDENCE_SYNC = 0.4; // Ne syncer que si confiance > 40%

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
  } catch (error) {
    logFirebase(`Erreur lors de la déconnexion: ${error?.message}`, "error");
  }
}

// Marquer comme déconnecté quand l'utilisateur quitte
window.addEventListener("beforeunload", markAsDisconnected);
window.addEventListener("pagehide", markAsDisconnected);

// === GESTION DU BOUTON QUITTER ===
const leaveModal = document.getElementById("leaveModal");
const cancelLeaveBtn = document.getElementById("cancelLeaveBtn");
const confirmLeaveBtn = document.getElementById("confirmLeaveBtn");

async function handleLeaveRoom() {
    if (leaveModal) {
        leaveModal.classList.remove("hidden");
    } else {
        // Fallback si pas de modale
        if (confirm("Voulez-vous vraiment quitter la salle ?")) {
            executeLeave();
        }
    }
}

async function executeLeave() {
  await markAsDisconnected();
  logFirebase("Redirection vers accueil après déconnexion", "success");
  setTimeout(() => {
    window.location.href = "accueil.html";
  }, 300);
}

if (cancelLeaveBtn) {
    cancelLeaveBtn.addEventListener("click", () => {
        if (leaveModal) leaveModal.classList.add("hidden");
    });
}

if (confirmLeaveBtn) {
    confirmLeaveBtn.addEventListener("click", () => {
        if (leaveModal) leaveModal.classList.add("hidden");
        executeLeave();
    });
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
    { label: "Pas du tout d'accord", score: 1 },
    { label: "Plutôt pas d'accord", score: 2 },
    { label: "Neutre", score: 3 },
    { label: "Plutôt d'accord", score: 4 },
    { label: "Tout à fait d'accord", score: 5 }
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

  const questionIds = questionnaireQuestions.map((q) => q.id).join(",");
  const sessionId = Date.now().toString(36);
  localStorage.setItem("currentQuestionnaireSession", sessionId);
  localStorage.setItem("currentQuestionnaireIds", questionIds);

  logFirebase(`✅ ${selectedCount} questions sélectionnées aléatoirement sur ${allQuestionsBank.length}`, "success");
  
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

  // ✅ CONTRÔLE: Ne montrer le questionnaire que si l'activité est en cours
  if (currentActivityStatus !== "running") {
    // Afficher un message d'attente
    const waitingMessage = document.createElement("div");
    waitingMessage.style.textAlign = "center";
    waitingMessage.style.padding = "32px 20px";
    waitingMessage.style.color = "#64748b";
    waitingMessage.style.borderRadius = "12px";
    waitingMessage.style.background = "#f1f5f9";
    waitingMessage.style.border = "2px dashed #cbd5e1";
    
    const icon = document.createElement("div");
    icon.style.fontSize = "40px";
    icon.style.marginBottom = "12px";
    icon.textContent = "⏳";
    waitingMessage.appendChild(icon);
    
    const title = document.createElement("h3");
    title.textContent = "Questionnaire";
    title.style.margin = "0 0 8px";
    title.style.fontSize = "18px";
    title.style.color = "#475569";
    waitingMessage.appendChild(title);
    
    const text = document.createElement("p");
    text.textContent = currentActivityStatus === "waiting" 
      ? "Le questionnaire apparaîtra une fois que le professeur aura lancé l'activité."
      : currentActivityStatus === "ended"
      ? "L'activité est terminée. Le questionnaire n'est plus disponible."
      : "L'activité est en pause. Le questionnaire n'est pas accessible pour le moment.";
    text.style.margin = "0";
    text.style.fontSize = "14px";
    waitingMessage.appendChild(text);
    
    section.appendChild(waitingMessage);
    section.style.display = "block";
    return;
  }

  const title = document.createElement("h2");
  title.textContent = "Questionnaire";
  title.style.margin = "0 0 8px";
  title.style.fontSize = "20px";
  section.appendChild(title);

  const subtitle = document.createElement("p");
  subtitle.textContent = `Salle: ${roomId} • Évaluez votre ressenti`;
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
      
      // ✅ CONTRÔLE: Désactiver le style des labels si l'activité n'est pas en cours
      if (currentActivityStatus !== "running") {
        label.style.opacity = "0.5";
        label.style.cursor = "not-allowed";
        label.style.backgroundColor = "#f1f5f9";
      }

      const input = document.createElement("input");
      input.type = "radio";
      input.name = `question_${qIndex}`;
      input.value = String(option.score);
      input.dataset.questionId = question.id;
      input.dataset.questionText = question.text;
      input.dataset.optionLabel = option.label;
      input.dataset.optionIndex = String(optionIndex);
      
      // ✅ CONTRÔLE: Désactiver les radios si l'activité n'est pas en cours
      input.disabled = currentActivityStatus !== "running";

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
  
  // ✅ CONTRÔLE: Désactiver le bouton si l'activité n'est pas en cours
  submitBtn.disabled = currentActivityStatus !== "running";
  if (submitBtn.disabled) {
    submitBtn.style.opacity = "0.5";
    submitBtn.style.cursor = "not-allowed";
  }

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

  let isAnonymous = false;
  let existing = {};

  if (participantKey) {
    const participantRef = firebaseApi.ref(firebaseApi.db, `rooms/${roomId}/participants/${participantKey}`);
    const participantSnap = await firebaseApi.get(participantRef);
    existing = participantSnap.exists() ? participantSnap.val() : {};
    isAnonymous = existing.mode === "anonymous";
  }

  if (!isAnonymous) {
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
      questionsUsed: questionsUsed,
      questionsCount: questionnaireQuestions.length
    });
    logFirebase(`✅ Questionnaire enregistré (score moyen=${payload.averageScore}) avec ordre des questions`, "success");
  } else {
    logFirebase("Participant anonyme : détails du questionnaire non sauvegardés dans la BD.", "info");
  }

  if (participantKey) {
    const participantRef = firebaseApi.ref(firebaseApi.db, `rooms/${roomId}/participants/${participantKey}`);

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
    // ✅ ÉTAPE 1: Charger les questions en premier (indépendamment du statut)
    // Cela les garde en cache pour utilisation ultérieure
    if (!questionnaireLoaded) {
      try {
        const questions = await loadQuestions();
        logFirebase(`✅ Questions chargées et cachées: ${questions.length} questions`, "success");
      } catch (e) {
        logFirebase(`Erreur chargement questions: ${e}`, "error");
      }
    }

    // ✅ ÉTAPE 2: Afficher le questionnaire selon le statut actuel
    if (currentActivityStatus === "waiting") {
      showInlineMessage("En attente du lancement de l'activité par le professeur. Le questionnaire apparaîtra bientôt.", false);
      const section = ensureQuestionnaireSection();
      renderQuestionnaire([], roomId); // Afficher le message d'attente
      return;
    }

    if (currentActivityStatus === "ended") {
      showInlineMessage("La session est terminée. Le questionnaire n'est plus disponible.", true);
      return;
    }

    if (currentActivityStatus === "paused") {
      showInlineMessage("L'activité est en pause. Le questionnaire n'est pas accessible pour le moment.", true);
      return;
    }

    // ✅ STATUS = "running": Afficher le questionnaire complet
    if (questionnaireQuestions.length > 0) {
      renderQuestionnaire(questionnaireQuestions, roomId);

      const form = document.getElementById("questionnaireForm");
      if (form) {
        form.onsubmit = async (event) => {
          event.preventDefault();

          const result = collectQuestionnaireAnswers(questionnaireQuestions);
          if (!result.ok) {
            showInlineMessage(result.error, true);
            return;
          }

          try {
            // ✅ CONTRÔLE: Vérifier à nouveau que l'activité est toujours en cours lors de la soumission
            if (currentActivityStatus !== "running") {
              showInlineMessage("La session n'est plus active. Impossible d'enregistrer le questionnaire.", true);
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
                    Vos réponses au questionnaire ont bien été enregistrées.
                  </p>
                </div>
              `;
            }
            
            showInlineMessage(""); // Effacer tout message d'erreur précédent
          } catch (error) {
            logFirebase(`Echec enregistrement questionnaire: ${error?.code || error?.message || error}`, "error");
            showInlineMessage("Impossible d'enregistrer le questionnaire pour le moment.", true);
          }
        };
      }
    }
  } catch (error) {
    logFirebase(`Echec chargement questionnaire: ${error?.code || error?.message || error}`, "error");
    showInlineMessage("Questionnaire indisponible pour le moment.", true);
  }
}

function resolveRoomId() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = (params.get("room") || "").trim().toUpperCase();
  if (fromUrl) return fromUrl;

  // ✅ PRÉ-REMPLISSAGE: Vérifier le localStorage d'abord
  const fromStorage = (localStorage.getItem("currentRoomCode") || "").trim().toUpperCase();
  if (fromStorage && /^[A-Z]{4}\d{4}$/.test(fromStorage)) {
    return fromStorage;
  }

  const fromInput = (roomCodeInput?.value || "").trim().toUpperCase();
  if (fromInput) return fromInput;

  return null;
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
      
      // ✅ MARQUER LE PARTICIPANT COMME PRÉSENT IMMÉDIATEMENT
      logFirebase(`Marquage du participant comme connecté...`, "info");
      await firebaseApi.update(participantRef, {
        connected: true,
        updatedAt: Date.now()
      });
      logFirebase(`✓ Participant marqué comme connecté`, "success");
      
      const connectedRef = firebaseApi.ref(firebaseApi.db, ".info/connected");
      firebaseApi.onValue(connectedRef, (snap) => {
        if (snap.val() === true) {
          firebaseApi.onDisconnect(participantRef).update({ connected: false });
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

  firebaseApi.onValue(metaRef, async (snapshot) => {
    if (!snapshot.exists()) {
      setActivityBanner("waiting", "En attente de la création de la session par le professeur.");
      return;
    }

    const meta = snapshot.val() || {};
    const status = meta.activityStatus || "waiting";

    if (status === "running") {
      const wasEnded = currentActivityStatus === "ended";
      const wasPaused = currentActivityStatus === "paused";
      currentActivityStatus = "running";
      
      setActivityBanner("running", "Activité démarrée par le professeur. Vous pouvez participer normalement.");
      showInlineMessage("Activité en cours...", false);
      
      // ✅ CONTRÔLE: Réafficher le questionnaire complet quand l'activité démarre
      try {
        await openQuestionnaireFlow(currentRoomId);
      } catch (e) {
        console.error("[QUESTIONNAIRE] Erreur réaffichage:", e);
      }
      
      // ✅ Si la session reprend après avoir été arrêtée (cas rare mais possible si prof relance)
      // On réactive les champs si besoin
      if (wasEnded) {
        const questionnaireForm = document.getElementById("questionnaireForm");
        if (questionnaireForm) {
          questionnaireForm.querySelectorAll("input, button").forEach((field) => {
            field.disabled = false;
          });
        }
      }

      // ✅ Si on reprend depuis une pause, redémarrer la détection
      if (wasPaused && useCamera && detectionActive) {
        console.log("[DETECTION] Reprise de la détection après pause");
        // La détection redémarre automatiquement via le setInterval existant
      }

      // Si la détection était en pause ou si on vient de relancer, on tente de redémarrer
      if (useCamera && !detectionActive && !questionnaireLoaded) {
          const detectionPanel = document.getElementById("detectionPanel");
          // Si on est déjà "dans" la salle (panel détection visible ou prêt)
          if (detectionPanel && !detectionPanel.classList.contains("hidden")) {
              detectionActive = true;
              console.log("[DETECTION] Reprise de la détection");
              
              // Si la caméra a été coupée (cas 'ended' -> 'running'), on tente de la relancer
              if (wasEnded) {
                initCamera(); // Relancer le flux vidéo
              }
          }
      }

      return;
    }

    if (status === "paused") {
      currentActivityStatus = "paused";
      setActivityBanner("paused", "Activité mise en pause par le professeur. Veuillez patienter.");
      showInlineMessage("Activité en pause.", true);
      
      // ✅ CONTRÔLE: Masquer le questionnaire quand l'activité est en pause
      const questionnaireSection = document.getElementById("dynamicQuestionnaire");
      if (questionnaireSection) {
        renderQuestionnaire([], currentRoomId); // Afficher le message de pause
      }
      
      // Suspendre la détection sans arrêter la caméra
      detectionActive = false;
      
      return;
    }

    if (status === "ended") {
      currentActivityStatus = "ended";
      setActivityBanner("ended", "Session terminée par le professeur. La participation est désormais clôturée.");
      showInlineMessage("Session terminée.", true);
      stopCamera();
      detectionActive = false;

      // ✅ CONTRÔLE: Masquer le questionnaire et les champs quand l'activité se termine
      const questionnaireForm = document.getElementById("questionnaireForm");
      if (questionnaireForm) {
        questionnaireForm.querySelectorAll("input, button").forEach((field) => {
          field.disabled = true;
        });
      }
      
      // Mettre à jour l'affichage du questionnaire pour montrer "session terminée"
      const questionnaireSection = document.getElementById("dynamicQuestionnaire");
      if (questionnaireSection) {
        renderQuestionnaire([], currentRoomId); // Afficher le message "session terminée"
      }

      const joinBtn = document.getElementById("joinBtn");
      if (joinBtn) {
        joinBtn.disabled = true;
      }

      return;
    }

    currentActivityStatus = "waiting";
    setActivityBanner("waiting", "La salle est prête. En attente du démarrage de l'activité par le professeur.");
    
    // ✅ CONTRÔLE: Afficher le message d'attente pour le questionnaire
    const questionnaireSection = document.getElementById("dynamicQuestionnaire");
    if (questionnaireSection) {
      renderQuestionnaire([], currentRoomId); // Afficher le message d'attente
    }
  }, (error) => {
    logFirebase(`Echec abonnement statut activité: ${error?.code || error?.message || error}`, "error");
  });
}

// ✅ ÉCOUTER LES QUESTIONNAIRES SUPPLÉMENTAIRES ENVOYÉS PAR LE PROF
function subscribeSupplementaryQuestionnaires(roomId) {
  if (!firebaseApi) return;

  const metaRef = firebaseApi.ref(firebaseApi.db, `rooms/${roomId}/meta`);
  let lastSupplementaryQuestionnaireId = null;

  firebaseApi.onValue(metaRef, async (snapshot) => {
    if (!snapshot.exists()) return;

    const meta = snapshot.val() || {};
    const currentQuestionnaireId = meta.lastSupplementaryQuestionnaireId;

    // ✅ Vérifier si un nouveau questionnaire a été envoyé
    if (currentQuestionnaireId && currentQuestionnaireId !== lastSupplementaryQuestionnaireId) {
      lastSupplementaryQuestionnaireId = currentQuestionnaireId;
      
      logFirebase(`Nouveau questionnaire supplémentaire reçu (ID: ${currentQuestionnaireId})`, "success");
      
      // Afficher le questionnaire principal à nouveau (refresh)
      if (currentActivityStatus === "running") {
        try {
          await openQuestionnaireFlow(roomId);
        } catch (e) {
          console.error("[QUESTIONNAIRE] Erreur affichage questionnaire supplémentaire:", e);
        }
      }
    }
  }, (error) => {
    logFirebase(`Echec abonnement questionnaires supplémentaires: ${error?.message}`, "error");
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

/* TOGGLE OPTIONS - SUPPRIMÉ car mode mixte obligatoire */
// Participation mixte (Webcam + Questionnaire) imposée.
useCamera = true;

/* VALIDATION CODE SALLE */
if (roomCodeInput) {
  roomCodeInput.addEventListener("input", () => {
    roomCodeInput.value = roomCodeInput.value.toUpperCase();

    if (!/^[A-Z]{4}\d{4}$/.test(roomCodeInput.value)) {
      showInlineMessage("Le code doit contenir 4 lettres suivies de 4 chiffres", true);
    } else {
      showInlineMessage("");
    }
  });
}

function requestWebcamConsent() {
  return new Promise((resolve) => {
    const modal = document.getElementById("webcamModal");
    if (!modal) {
      resolve(confirm("Autorisez-vous l’accès à la webcam ? (Aucune image n'est enregistrée)"));
      return;
    }
    modal.classList.remove("hidden");
    
    const cancelBtn = document.getElementById("cancelWebcamBtn");
    const confirmBtn = document.getElementById("confirmWebcamBtn");
    
    const handleCancel = () => {
      modal.classList.add("hidden");
      cleanup();
      resolve(false);
    };
    const handleConfirm = () => {
      modal.classList.add("hidden");
      cleanup();
      resolve(true);
    };
    const cleanup = () => { cancelBtn.removeEventListener("click", handleCancel); confirmBtn.removeEventListener("click", handleConfirm); };
    
    cancelBtn.addEventListener("click", handleCancel);
    confirmBtn.addEventListener("click", handleConfirm);
  });
}

// ✅ NOTE: L'événement onclick du bouton joinBtn est maintenant initialisé dans le DOMContentLoaded
// pour s'assurer que les références DOM sont disponibles

/* WEBCAM */
async function startCamera() {
  try {
    // ✅ PROTECTION: Vérifier si un stream est déjà actif
    if (cameraStreamActive && video.srcObject) {
      logFirebase("Stream caméra déjà actif, réutilisation.", "info");
      videoBox.classList.remove("hidden");
      return;
    }

    // Arrêter tout stream précédent
    if (video.srcObject) {
      video.srcObject.getTracks().forEach((track) => {
        track.stop();
        logFirebase(`Track caméra arrêtée: ${track.kind}`, "info");
      });
    }

    logFirebase("Tentative accès caméra...", "info");
    cameraStreamActive = false; // Marquer comme en attente
    
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: { ideal: 640 },
        height: { ideal: 480 }
      } 
    });
    
    video.srcObject = stream;
    cameraStreamActive = true;
    videoBox.classList.remove("hidden");
    
    logFirebase("✓ Caméra activée avec succès", "success");
  } catch (e) {
    cameraStreamActive = false;
    const errorMsg = e?.name === "NotAllowedError" 
      ? "Accès caméra refusé. Vérifiez les permissions du navigateur."
      : e?.name === "NotFoundError"
      ? "Aucune caméra détectée."
      : `Erreur caméra: ${e?.message || e}`;
    
    logFirebase(`Erreur caméra: ${errorMsg}`, "error");
    showInlineMessage(errorMsg, true);
  }
}

function stopCamera() {
  try {
    if (video.srcObject) {
      video.srcObject.getTracks().forEach((track) => {
        track.stop();
        logFirebase(`Track arrêtée: ${track.kind}`, "info");
      });
      video.srcObject = null;
    }
    cameraStreamActive = false;
    videoBox.classList.add("hidden");
    logFirebase("Caméra arrêtée", "success");
  } catch (e) {
    console.error("[CAMERA] Erreur arrêt caméra:", e);
    cameraStreamActive = false;
  }
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
    
    // ✅ AMÉLIORATION: Attendre max 8 secondes (au lieu de 5) avec meilleur feedback
    let waitCount = 0;
    const maxWait = 16; // 16 * 500ms = 8 secondes
    
    while (!faceApiReady && waitCount < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 500));
      waitCount++;
      console.log("[DETECTION] Attente Face-API... (", waitCount * 500, "ms )");
    }

    if (!faceApiReady) {
      logFirebase("Face-API timeout (8s)", "error");
      console.error("[DETECTION] Face-API n'est pas chargé après 8s");
      showInlineMessage("Erreur: Impossible de charger la détection. Veuillez recharger la page ou utiliser le questionnaire.", true);
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

  // ✅ Suppression du bouton "Fin de mesure" - pas d'affichage

  if (detectionInterval) clearInterval(detectionInterval);
  
  // ✅ PROTECTION: Intervalle de détection avec gestion d'erreur
  detectionInterval = setInterval(() => {
    if (detectionActive) {
      detectEmotions().catch(err => {
        console.error("[DETECTION] Erreur dans la boucle de détection:", err);
      });
    }
  }, 300);

  console.log("[DETECTION] Intervalle de détection lancé (300ms)");

  // ✅ Plus de bouton "Fin de mesure" - l'utilisateur clique sur "Quitter la salle"
  
  // Timer
  const timerInterval = setInterval(() => {
    if (!detectionActive) {
      clearInterval(timerInterval);
      return;
    }
    const elapsed = Math.round((Date.now() - detectionStartTime) / 1000);
    const timerDisplay = document.getElementById("timerDisplay");
    if (timerDisplay) timerDisplay.textContent = elapsed;
  }, 1000);
}

async function detectEmotions() {
  if (!detectionActive) return;

  // ✅ PROTECTION: Empêcher les appels concurrents à Face-API
  if (faceDetectionInProgress) {
    return; // Ignorer l'appel si une détection est déjà en cours
  }

  try {
    faceDetectionInProgress = true;

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

    // Redimensionner les résultats pour le canvas
    const resizedDetections = faceapi.resizeResults(detections, { width: canvas.width, height: canvas.height });
    
    // Dessiner les boîtes de détection et les émotions sur le canvas
    faceapi.draw.drawDetections(canvas, resizedDetections);
    faceapi.draw.drawFaceExpressions(canvas, resizedDetections);

    const positionFeedback = document.getElementById("positionFeedback");

    if (!detections || detections.length === 0) {
      if (positionFeedback) {
        positionFeedback.textContent = "❌ Visage non détecté. Placez-vous bien face à la caméra.";
        positionFeedback.style.color = "#ef4444";
      }
      lastFacePosition = null;
      return;
    }

    // Premier visage détecté
    const detection = detections[0];
    const expressions = detection.expressions;
    const box = detection.detection.box;

    // 1. Vérifier la distance (taille relative du visage)
    // On considère que si le visage occupe moins de 20% de la largeur du canvas, l'utilisateur est trop loin
    const faceWidthRatio = box.width / canvas.width;
    let distanceMessage = "";
    if (faceWidthRatio < 0.25) {
      distanceMessage = " 📏 Rapprochez-vous un peu.";
    }

    // 2. Vérifier le mouvement (stabilité)
    const currentCenter = {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2
    };

    let stabilityMessage = "";
    if (lastFacePosition) {
      const distance = Math.sqrt(
        Math.pow(currentCenter.x - lastFacePosition.x, 2) +
        Math.pow(currentCenter.y - lastFacePosition.y, 2)
      );
      
      // Si le centre a bougé de plus de 10% de la largeur du canvas entre deux frames (300ms)
      if (distance > canvas.width * 0.08) {
        stabilityMessage = " ⚠️ Ne bougez pas trop.";
      }
    }
    lastFacePosition = currentCenter;

    if (positionFeedback) {
      if (distanceMessage || stabilityMessage) {
        positionFeedback.textContent = `💡 ${distanceMessage}${stabilityMessage}`.trim();
        positionFeedback.style.color = "#856404"; // Couleur d'avertissement (jaune/orange)
      } else {
        positionFeedback.textContent = "✅ Positionnement OK";
        positionFeedback.style.color = "#10b981";
      }
    }

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
    
    // Affichage en temps réel
    const liveDisplay = document.getElementById("liveEmotionDisplay");
    const frEmotions = {
        happy: "😊 Heureux",
        sad: "😢 Triste",
        neutral: "😐 Neutre",
        angry: "😠 Colère",
        surprised: "😲 Surpris",
        fearful: "😨 Peur",
        disgusted: "🤢 Dégoûté"
    };

    if (liveDisplay) {
      liveDisplay.textContent = frEmotions[maxEmotion] || maxEmotion;
    }

    // ✅ OPTIMISATION: Rate-limiting réduit pour 40+ utilisateurs (toutes les 6s au lieu de 3s)
    // + Sync basée sur changement d'émotion (debouncée) au lieu de fréquence fixe
    const now = Date.now();
    if (now - lastSyncTime > SYNC_RATE_LIMIT) {
      lastSyncTime = now;
      // Sync périodique light (pas toutes les stats, juste le timestamp)
      syncLiveEmotionsLight();
    }

    // Dessiner boîte de détection (rectangle vert)
    ctx.strokeStyle = "#4ade80";
    ctx.lineWidth = 3;
    const { x, y, width, height } = detection.detection.box;
    ctx.strokeRect(x, y, width, height);

  } catch (error) {
    // Ne logger que les erreurs critiques, pas les absences de visage
    if (error.message && !error.message.includes("width") && !error.message.includes("height")) {
      console.error("[FACE-API ERROR]", error);
    }
  } finally {
    faceDetectionInProgress = false;
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
  
  // ✅ OPTIMISATION: Ne compter que les émotions avec confiance suffisante
  if (confidence >= MIN_CONFIDENCE_SYNC) {
    emotionStats[mappedEmotion] = (emotionStats[mappedEmotion] || 0) + 1;
  }

  emotionHistory.push({
    emotion: mappedEmotion,
    confidence,
    timestamp: Date.now()
  });

  // Log premier sample
  if (emotionHistory.length === 1) {
    console.log("[EMOTION] Premier sample détecté:", mappedEmotion, confidence);
  }
  
  // ✅ OPTIMISATION: Déclencher sync debounced si l'émotion a changé
  if (mappedEmotion !== lastSyncedEmotion && confidence >= MIN_CONFIDENCE_SYNC) {
    debouncedSyncLiveEmotion(mappedEmotion);
  }
}

// ✅ FONCTION DE DEBOUNCING pour réduire les écritures Firebase
function debouncedSyncLiveEmotion(emotion) {
  // Annuler la sync précédente si elle est en attente
  if (syncQueue) {
    clearTimeout(syncQueue);
  }
  
  // Programmer une nouvelle sync avec délai
  syncQueue = setTimeout(() => {
    syncLiveEmotions(emotion);
    syncQueue = null;
  }, DEBOUNCE_EMOTION_CHANGE);
}

async function stopEmotionDetection() {
  // ✅ PROTECTION: Arrêter toute détection en cours
  detectionActive = false;
  faceDetectionInProgress = false; // Débloquer tout appel en attente
  clearInterval(detectionInterval);

  const detectionPanel = document.getElementById("detectionPanel");
  if (detectionPanel) detectionPanel.classList.add("hidden");
  
  // ✅ Suppression du bouton "Fin de mesure" - pas de masquage

  const elapsedSeconds = Math.round((Date.now() - detectionStartTime) / 1000);

  logFirebase(
    `Détection terminée: ${elapsedSeconds}s, ${emotionHistory.length} samples`,
    "success"
  );

  // Sauvegarder dans Firebase
  await saveEmotionData(currentRoomId, elapsedSeconds);

  // Masquer tout et afficher le message de fin neutre
  showWebcamSuccessScreen();
}

async function syncLiveEmotions(currentEmotion) {
  if (!firebaseApi) return;
  const participantKey = localStorage.getItem("currentParticipantKey");
  if (!participantKey) return;

  try {
    lastSyncedEmotion = currentEmotion;
    
    const participantRef = firebaseApi.ref(firebaseApi.db, `rooms/${currentRoomId}/participants/${participantKey}`);
    
    // ✅ OPTIMISATION CRITIQUE POUR 40+ USERS: Une SEULE écriture au lieu de 2
    // Envoyer seulement l'émotion + timestamp (payload minimal)
    await firebaseApi.update(participantRef, {
      dominantEmotion: currentEmotion,
      updatedAt: Date.now()
    });
    
    lastSuccessfulSync = Date.now();
    
  } catch (err) {
    if (err.code === "PERMISSION_DENIED") {
      console.error("[SYNC] Permission refusée Firebase:", err);
    } else {
      console.warn("[SYNC] Échec sync (non-critique):", err.code);
    }
  }
}

// ✅ SYNC LÉGÈRE - Sync périodique heartbeat (toutes les 6s pour 40+ users)
async function syncLiveEmotionsLight() {
  if (!firebaseApi) return;
  const participantKey = localStorage.getItem("currentParticipantKey");
  if (!participantKey) return;

  try {
    const participantRef = firebaseApi.ref(firebaseApi.db, `rooms/${currentRoomId}/participants/${participantKey}`);
    
    // ✅ ULTRA-LÉGER: Juste un heartbeat confirmer présence active
    await firebaseApi.update(participantRef, {
      updatedAt: Date.now()
    });
    
  } catch (err) {
    console.warn("[SYNC-LIGHT] Heartbeat échoué:", err.code);
  }
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

    // Sauvegarder les stats pour alimenter le graphique du prof, 
    // mais utiliser une clé générique pour les anonymes afin de préserver l'anonymat.
    const emotionKey = isAnonymous ? `anon_${Date.now()}` : participantKey;
    const emotionDataRef = firebaseApi.ref(
      firebaseApi.db,
      `rooms/${roomId}/emotions/${emotionKey}`
    );

    const data = {
      roomId,
      duration,
      totalSamples: emotionHistory.length,
      emotionStats,
      recordedAt: Date.now()
    };

    if (!isAnonymous) {
      data.participantKey = participantKey;
      // ✅ OPTIMISATION: Ne pas envoyer l'historique complet (trop lourd pour 40+ users)
      // Gardez juste les stats agrégées
      // Si besoin d'historique, le faire via un endpoint séparé
    }

    await firebaseApi.set(emotionDataRef, data);
    logFirebase(`Données d'émotions (${isAnonymous ? 'anonyme' : 'nommé'}) sauvegardées`, "success");

    // Mettre à jour le participant
    await firebaseApi.set(participantRef, {
      ...participant,
      objectiveEmotionComplete: true,
      dominantEmotion: Object.entries(emotionStats).reduce((prev, current) =>
        prev[1] > current[1] ? prev : current
      )[0],
      updatedAt: Date.now()
    });

    showInlineMessage("Données d'émotions traitées avec succès ✓", false);
  } catch (error) {
    logFirebase(`Erreur sauvegarde émotions: ${error.message}`, "error");
    showInlineMessage("Erreur lors de la sauvegarde.", true);
  }
}

function showWebcamSuccessScreen() {
  const detectionPanel = document.getElementById("detectionPanel");
  const resultsPanel = document.getElementById("resultsPanel");

  const joinPanel = document.getElementById("joinPanel");

  if (detectionPanel) detectionPanel.classList.add("hidden");
  if (joinPanel) joinPanel.classList.add("hidden");
  
  resultsPanel.innerHTML = `
    <div style="text-align: center; padding: 40px 20px;">
      <div style="font-size: 60px; margin-bottom: 16px;">✅</div>
      <h2 style="color: #10b981; margin-bottom: 10px; font-size: 24px;">Détection terminée !</h2>
      <p style="color: #475569; font-size: 16px; margin-bottom: 25px; line-height: 1.5;">
        Merci pour votre participation.<br>
        Vos données ont bien été enregistrées de manière sécurisée.
      </p>
      <button onclick="window.location.href='accueil.html'" style="background: #830c2a; color: white; padding: 12px 28px; border: none; border-radius: 25px; cursor: pointer; font-size: 15px; font-weight: 600; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">Terminer et quitter</button>
    </div>
  `;
  resultsPanel.classList.remove("hidden");
}

/* PRÊT POUR FACE-API.JS */
async function initializeFaceApi() {
  try {
    if (typeof faceapi === "undefined") {
      logFirebase("Face-API non disponible (script non chargé)", "error");
      faceApiReady = false;
      return;
    }

    logFirebase("Initialisation Face-API...");

    // Charger les modèles depuis le CDN avec une version stable
    const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/";

    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
      ]);
      
      faceApiReady = true;
      logFirebase("Face-API initialisé avec succès ✓", "success");
      console.log("[FACE-API] Modèles chargés avec succès");
      
    } catch (networkError) {
      // Erreur réseau lors du chargement des modèles
      console.error("[FACE-API] Erreur réseau chargement modèles:", networkError);
      logFirebase(`Erreur réseau modèles Face-API: ${networkError.message}`, "error");
      faceApiReady = false;
    }
    
  } catch (error) {
    console.error("[FACE-API] Erreur initialisation:", error);
    logFirebase(`Erreur initialisation Face-API: ${error.message}`, "error");
    faceApiReady = false;
  }
}

// Initialiser Face-API au chargement de la page
window.addEventListener("load", () => {
  console.log("[APP] Initialisation Face-API au chargement de la page...");
  initializeFaceApi();
});

// ✅ INITIALISATION COMPLÈTE AU CHARGEMENT DU DOM
document.addEventListener("DOMContentLoaded", () => {
  console.log("[INIT] DOMContentLoaded - initialisation des références DOM...");
  
  // 1. Initialiser les références DOM
  initializeDOMReferences();
  
  // 2. Pré-remplir le code de la salle
  const initialRoomId = resolveRoomId();
  if (initialRoomId && /^[A-Z]{4}\d{4}$/.test(initialRoomId)) {
    if (roomCodeInput) {
      roomCodeInput.value = initialRoomId;
      currentRoomId = initialRoomId;
      console.log("[INIT] Code salle pré-rempli depuis:", 
        localStorage.getItem("currentRoomCode") ? "localStorage" : "URL/input");
    }
  }
  
  // 3. Initialiser le bouton rejoindre
  const joinBtn = document.getElementById("joinBtn");
  if (joinBtn) {
    joinBtn.onclick = async () => {
      if (!firebaseApi) {
        await initFirebase();
      }

      const roomId = roomCodeInput.value.trim();
      currentRoomId = roomId;

      if (!/^[A-Z]{4}\d{4}$/.test(roomId)) {
        showInlineMessage("Code de salle invalide (format attendu: ABCD1234)", true);
        return;
      }

      // Sécurité : Si on change de salle, on oublie l'ancienne identité pour éviter les fuites
      const oldRoom = localStorage.getItem("currentRoomCode");
      if (oldRoom && oldRoom !== roomId) {
        localStorage.removeItem("currentParticipantKey");
        console.log("[JOIN] Nouvelle salle détectée, réinitialisation de l'identité participant.");
      }

      localStorage.setItem("currentRoomCode", roomId);

      subscribeActivityStatus(roomId);
      subscribeSupplementaryQuestionnaires(roomId);

      if (useCamera) {
        document.getElementById("joinBtn").style.display = "none";
        
        const consent = await requestWebcamConsent();

        if (!consent) {
          showInlineMessage("Participation sans webcam. Veuillez remplir le questionnaire ci-dessous.", false);
          await saveJoinMode(roomId, "questionnaire");
          
          // Masquer le panneau de connexion et afficher le bouton quitter
          const joinPanel = document.getElementById("joinPanel");
          if (joinPanel) joinPanel.classList.add("hidden");
          
          // Ouvrir le questionnaire
          await openQuestionnaireFlow(roomId);
          const leaveBtn = document.getElementById("leaveBtn");
          if (leaveBtn) leaveBtn.classList.remove("hidden");
          
          return;
        }

        // ✅ DÉMARRAGE WEBCAM
        await startCamera();
        
        // Masquer le panneau de connexion
        const joinPanel = document.getElementById("joinPanel");
        if (joinPanel) joinPanel.classList.add("hidden");
        
        // Afficher la vidéo
        if (videoBox) videoBox.classList.remove("hidden");
        
        // Charger les questions (indépendant du statut d'activité)
        await openQuestionnaireFlow(roomId);
        
        // ✅ LANCER LA DÉTECTION SEULEMENT SI L'ACTIVITÉ EST RUNNING
        if (currentActivityStatus === "running") {
          showInlineMessage("Webcam activée... Veuillez également remplir le questionnaire ci-dessous.");
          await startEmotionDetection();
        } else {
          showInlineMessage("Webcam activée. En attente du lancement de l'activité par le professeur...");
        }

        // Afficher le bouton quitter
        const leaveBtn = document.getElementById("leaveBtn");
        if (leaveBtn) leaveBtn.classList.remove("hidden");
      }
    };
  }
});

initFirebase();
