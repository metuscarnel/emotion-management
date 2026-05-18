function renderParticipants(participants) {
  participantsCache = participants;

  // Filtrage des participants "actifs" (connectés ou ayant déjà participé)
  // Cela évite d'afficher des "fantômes" de sessions précédentes si le code de salle a été réutilisé
  const activeParticipants = participants.filter(p => 
    p.connected === true || 
    p.objectiveEmotionComplete || 
    p.questionnaireCompleted || 
    (p.subjectiveScore !== undefined && p.subjectiveScore !== null)
  );

  const connectedCount = activeParticipants.filter(p => p.connected === true).length;
  nbParticipants.textContent = String(connectedCount);

  const listElement = document.getElementById("participantsList");
  if (!listElement) return;

  listElement.innerHTML = "";

  if (activeParticipants.length === 0) {
    listElement.innerHTML = `<div style="text-align:center; padding:30px; color:#94a3b8; font-style: italic;">
      En attente de participants...
    </div>`;
    
    // Mise à jour de l'état d'attente
    btnLancer.disabled = true;
    btnLancer.style.opacity = "0.5";
    hintLancer.textContent = "La salle est vide. En attente de connexions...";
    return;
  }

  // Tri : Connectés d'abord, puis par nom
  activeParticipants.sort((a, b) => {
    if (a.connected === b.connected) {
      const nameA = participantLabel(a).toLowerCase();
      const nameB = participantLabel(b).toLowerCase();
      return nameA.localeCompare(nameB);
    }
    return a.connected ? -1 : 1;
  });

  activeParticipants.forEach((participant) => {
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
    listElement.appendChild(row);
  });

  // Mise à jour de l'état du bouton Lancer
  if (currentActivityStatus === "waiting") {
    btnLancer.disabled = connectedCount === 0;
    btnLancer.style.opacity = connectedCount === 0 ? "0.5" : "1";
    hintLancer.textContent = connectedCount === 0
      ? "En attente d'au moins 1 participant pour lancer."
      : `Prêt à lancer (${connectedCount} participant(s) connecté(s)).`;
  }
}
