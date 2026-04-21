import { db, ref, onValue, ensureAuth } from "./firebase-config.js";

const list = document.getElementById("participantsList");
const summary = document.getElementById("summary");
const totalCount = document.getElementById("totalCount");

const params = new URLSearchParams(window.location.search);
const roomCode = params.get("room") || localStorage.getItem("currentRoomCode") || "TEST124A";

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

  summary.textContent = `→ ${connectedCount} participants connectés | Dernière activité : ${new Date().toLocaleTimeString()}`;
  totalCount.textContent = String(participantsArray.length);
}

async function startRealtimeParticipants() {
  try {
    await ensureAuth();

    const participantsRef = ref(db, `rooms/${roomCode}/participants`);
    onValue(participantsRef, (snapshot) => {
      const data = snapshot.val();
      const participantsArray = data ? Object.values(data) : [];
      renderParticipants(participantsArray);
    });
  } catch (error) {
    console.error(error);
    summary.textContent = "→ Erreur de chargement des participants";
  }
}

startRealtimeParticipants();
