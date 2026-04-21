import { db, ref, onValue, ensureAuth, get } from "./firebase-config.js";

const list = document.getElementById("participantsList");
const summary = document.getElementById("summary");
const totalCount = document.getElementById("totalCount");

function logFirebase(message, type = "info") {
  const prefix = `[Firebase][WAITING][${type.toUpperCase()}]`;
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

function resolveRoomId() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = (params.get("room") || "").trim();
  if (fromUrl) return fromUrl;

  const fromStorage = (localStorage.getItem("currentRoomCode") || "").trim();
  if (fromStorage) return fromStorage;

  const titleCode = (document.getElementById("roomCode")?.textContent || "").trim();
  if (titleCode) return titleCode;

  return "TEMP1234";
}

const roomId = resolveRoomId();
let professorDisplayName = localStorage.getItem("currentTeacherDisplayName") || "Professeur";

function getLastLabel(timestamp) {
  if (!timestamp) return "il y a un instant";

  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return "à l'instant";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `il y a ${diffMin} min`;

  const diffHours = Math.floor(diffMin / 60);
  return `il y a ${diffHours} h`;
}

function renderParticipants(participantsArray) {
  list.innerHTML = "";

  let connectedCount = 0;

  participantsArray.forEach((p) => {
    if (p.connected) connectedCount++;

    const displayName = [p.firstName, p.lastName].filter(Boolean).join(" ").trim() || "Participant anonyme";

    const div = document.createElement("div");
    div.className = "participant";

    div.innerHTML = `
      <div>
        <div class="name">
          <span class="status-dot ${p.connected ? "connected" : "disconnected"}"></span>
          <strong>${displayName}</strong>
        </div>
        <div class="small">
          ${p.connected ? "Connecté" : "Déconnecté"} ${getLastLabel(p.joinedAt)}
        </div>
      </div>
      <div class="state ${p.connected ? "connected" : "disconnected"}">
        ${p.connected ? "Connecté" : "Déconnecté"}
      </div>
    `;

    list.appendChild(div);
  });

  summary.textContent = `→ ${connectedCount} participants connectés | Professeur : ${professorDisplayName} | Dernière activité : ${new Date().toLocaleTimeString()}`;
  totalCount.textContent = String(participantsArray.length);
}

async function loadRoomMeta() {
  try {
    const snap = await get(ref(db, `rooms/${roomId}/meta`));
    if (!snap.exists()) {
      logFirebase(`Meta salle absente pour ${roomId}`, "error");
      return;
    }

    const meta = snap.val() || {};
    professorDisplayName = meta.createdByName || meta.teacherName || localStorage.getItem("currentTeacherDisplayName") || "Professeur";

    if ((professorDisplayName === meta.createdBy || professorDisplayName === "Professeur") && meta.createdBy) {
      try {
        const teacherSnap = await get(ref(db, `teachers/${meta.createdBy}`));
        if (teacherSnap.exists()) {
          const teacher = teacherSnap.val() || {};
          professorDisplayName = [teacher.prenom, teacher.nom].filter(Boolean).join(" ").trim() || teacher.nom || meta.createdBy;
          localStorage.setItem("currentTeacherDisplayName", professorDisplayName);
        }
      } catch (teacherError) {
        logFirebase(`Echec lecture profil professeur: ${teacherError?.code || teacherError?.message || teacherError}`, "error");
      }
    }

    if (!professorDisplayName || professorDisplayName === meta.createdBy) {
      professorDisplayName = localStorage.getItem("currentTeacherDisplayName") || "Professeur";
    }

    document.title = `Salle d'attente — ${roomId}`;
    logFirebase(`Profil professeur resolu: ${professorDisplayName}`, "success");
  } catch (error) {
    logFirebase(`Echec lecture meta salle: ${error?.code || error?.message || error}`, "error");
  }
}

async function startRealtimeParticipants() {
  try {
    logFirebase(`Demarrage suivi presence salle=${roomId}`);
    logFirebase("Tentative de connexion Auth anonyme...");
    await ensureAuth();
    logFirebase("Connexion Auth OK", "success");

    await loadRoomMeta();

    const participantsRef = ref(db, `rooms/${roomId}/participants`);
    logFirebase(`Abonnement temps reel: rooms/${roomId}/participants`);

    onValue(participantsRef, (snapshot) => {
      const data = snapshot.val();
      const participantsArray = data ? Object.values(data) : [];
      logFirebase(`Presence mise a jour: ${participantsArray.length} participant(s)`, "success");
      renderParticipants(participantsArray);
    }, (error) => {
      logFirebase(`Echec abonnement presence: ${error?.code || error?.message || error}`, "error");
      summary.textContent = "→ Erreur de chargement des participants";
    });
  } catch (error) {
    logFirebase(`Echec connexion/lecture: ${error?.code || error?.message || error}`, "error");
    console.error(error);
    summary.textContent = "→ Erreur de chargement des participants";
  }
}

startRealtimeParticipants();
