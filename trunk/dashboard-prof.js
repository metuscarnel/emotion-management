import { db, ref, get, ensureAuth } from "./firebase-config.js";

const welcomeMessage = document.getElementById("welcomeMessage");
const logoutBtn = document.getElementById("logoutBtn");
const activeRoomsContainer = document.getElementById("activeRoomsContainer");
const endedRoomsContainer = document.getElementById("endedRoomsContainer");
const activeRoomsCount = document.getElementById("activeRoomsCount");
const endedRoomsCount = document.getElementById("endedRoomsCount");

// 1. Vérifier la connexion
const teacherUid = localStorage.getItem("currentTeacherUid");
if (!teacherUid) {
    window.location.href = "identifprof.html";
}

// Afficher le nom
const displayName = localStorage.getItem("currentTeacherDisplayName");
if (displayName) {
    welcomeMessage.textContent = `Bienvenue, ${displayName}`;
} else {
    welcomeMessage.textContent = "Bienvenue, Professeur";
}

// 2. Déconnexion via Modale
const disconnectModal = document.getElementById("disconnectModal");
const cancelDisconnectBtn = document.getElementById("cancelDisconnectBtn");
const confirmDisconnectBtn = document.getElementById("confirmDisconnectBtn");

logoutBtn.addEventListener("click", () => {
    if (disconnectModal) disconnectModal.classList.remove("hidden");
});

if (cancelDisconnectBtn) {
    cancelDisconnectBtn.addEventListener("click", () => {
        if (disconnectModal) disconnectModal.classList.add("hidden");
    });
}

if (confirmDisconnectBtn) {
    confirmDisconnectBtn.addEventListener("click", () => {
        if (disconnectModal) disconnectModal.classList.add("hidden");
        localStorage.removeItem("currentTeacherUid");
        localStorage.removeItem("currentTeacherEmail");
        localStorage.removeItem("currentTeacherDisplayName");
        localStorage.removeItem("currentRoomCode");
        window.location.href = "accueil.html";
    });
}

// 3. Charger les salles depuis Firebase
async function loadRooms() {
    try {
        await ensureAuth();
        const roomsRef = ref(db, "rooms");
        const snapshot = await get(roomsRef);

        if (!snapshot.exists()) {
            displayEmpty(activeRoomsContainer, "Aucune salle active.");
            displayEmpty(endedRoomsContainer, "Aucun historique disponible.");
            return;
        }

        const roomsData = snapshot.val();
        const activeRooms = [];
        const endedRooms = [];

        // Filtrer les salles du professeur connecté
        Object.entries(roomsData).forEach(([roomId, roomData]) => {
            const meta = roomData.meta || {};
            if (meta.createdBy === teacherUid) {
                const roomInfo = {
                    id: roomId,
                    status: meta.activityStatus || "waiting", // waiting, live, ended
                    createdAt: meta.createdAt || Date.now()
                };

                if (roomInfo.status === "ended") {
                    endedRooms.push(roomInfo);
                } else {
                    activeRooms.push(roomInfo);
                }
            }
        });

        // Trier par date décroissante
        activeRooms.sort((a, b) => b.createdAt - a.createdAt);
        endedRooms.sort((a, b) => b.createdAt - a.createdAt);

        activeRoomsCount.textContent = activeRooms.length;
        endedRoomsCount.textContent = endedRooms.length;

        // Afficher
        renderRooms(activeRoomsContainer, activeRooms, true);
        renderRooms(endedRoomsContainer, endedRooms, false);

    } catch (error) {
        console.error("Erreur lors de la récupération des salles:", error);
        activeRoomsContainer.innerHTML = `<div class="loading-state" style="color:red;">Erreur de chargement.</div>`;
        endedRoomsContainer.innerHTML = `<div class="loading-state" style="color:red;">Erreur de chargement.</div>`;
    }
}

function displayEmpty(container, message) {
    container.innerHTML = `<div class="loading-state">${message}</div>`;
}

function renderRooms(container, rooms, isActive) {
    if (rooms.length === 0) {
        displayEmpty(container, isActive ? "Aucune salle active." : "Aucun historique disponible.");
        return;
    }

    container.innerHTML = ""; // Vider le conteneur

    rooms.forEach(room => {
        const dateStr = new Date(room.createdAt).toLocaleString("fr-FR", {
            day: "2-digit", month: "long", year: "numeric",
            hour: "2-digit", minute: "2-digit"
        });

        let statusClass = "status-ended";
        let statusLabel = "Terminée";
        if (room.status === "live") {
            statusClass = "status-live";
            statusLabel = "En direct";
        } else if (room.status === "waiting") {
            statusClass = "status-waiting";
            statusLabel = "En attente";
        }

        const card = document.createElement("div");
        card.className = "room-card";

        const btnHtml = isActive 
            ? `<a href="salle.html?room=${room.id}" class="btn-card active">Rejoindre la session</a>`
            : `<a href="recapitulatif.html?room=${room.id}" class="btn-card history">📊 Voir le récapitulatif</a>`;

        card.innerHTML = `
            <div class="room-header">
                <p class="room-code">${room.id}</p>
                <span class="room-status ${statusClass}">${statusLabel}</span>
            </div>
            <p class="room-date">📅 ${dateStr}</p>
            <div class="room-actions">
                ${btnHtml}
            </div>
        `;

        container.appendChild(card);
    });
}

// Initialisation
loadRooms();
