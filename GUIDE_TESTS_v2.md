# GUIDE DE TESTS - Système de Détection des Émotions
**Date**: 5 mai 2026  
**Version**: 2.0  
**Architecture**: Firebase Realtime Database + Face-API.js (client-side)

---

## 📋 STRUCTURE DU PROJET

### Flux Utilisateur

```
┌─────────────────────────────────────────────────────────────┐
│ PROFESSEUR                   │ ÉTUDIANT                     │
├─────────────────────────────────────────────────────────────┤
│ 1. creesalle.html            │ 1. access.html               │
│    (Inscription)             │    (Rejoindre par code)      │
│                              │                              │
│ 2. identifprof.html          │ 2. rejoindresalle.html       │
│    (Connexion)               │    (Choix mode)              │
│                              │    ├─ Questionnaire Likert   │
│ 3. creersalle.html           │    └─ Détection Face-API     │
│    (Créer salle)             │                              │
│                              │ 3. results affichés via FB   │
│ 4. salle.html                │                              │
│    (Monitoring live)         │                              │
│                              │                              │
│ 5. Display room code         │                              │
│    (Partager code)           │                              │
└─────────────────────────────────────────────────────────────┘
```

### Deux Modes Exclusifs dans `rejoindresalle.html`

| Mode | Détail |
|------|--------|
| **📷 Webcam (Défaut)** | Détection auto d'émotions via Face-API.js |
| **❓ Questionnaire** | Formulaire Likert (5 questions) |

---

## 🚀 PRÉ-REQUIS

### 1. **Serveur Local**
```bash
cd /Users/metusgbogbohoundada/Documents/emotion-management
python3 -m http.server 8000
```

Puis accédez à : **http://localhost:8000/trunk/accueil.html**

### 2. **Firebase Credentials**
- Projet: `projetl2t1-767a4`
- Database URL: `https://projetl2t1-767a4-default-rtdb.firebaseio.com`
- Config en: `firebase-config.js`

### 3. **Permissions Navigateur**
- Webcam (pour mode détection)
- LocalStorage activé

---

## ✅ TEST 1: FLUX PROFESSEUR COMPLET

### Objectif
Vérifier que le professeur peut créer une salle et monitorer les participants en temps réel.

### Étapes

#### 1.1 Inscription Professeur
- URL: `http://localhost:8000/trunk/creesalle.html`
- Remplir: 
  - Prénom: `Jean`
  - Nom: `Dupont`
  - Email: `jean.dupont@example.com`
  - Matière: `Mathématiques`
  - Mot de passe: `Test@1234`
- Clic: **"Créer un compte"**

**✅ Points de vérification**:
- ✓ Pas d'erreurs dans la console
- ✓ Redirection vers `identifprof.html`
- ✓ Données sauvegardées dans Firebase (`/professors/[uid]`)

#### 1.2 Connexion Professeur
- URL: `http://localhost:8000/trunk/identifprof.html`
- Email: `jean.dupont@example.com`
- Mot de passe: `Test@1234`
- Clic: **"Se connecter"**

**✅ Points de vérification**:
- ✓ Connexion réussie (message succès)
- ✓ Redirection vers `creersalle.html`
- ✓ Données stockées en localStorage (`currentUser`)

#### 1.3 Créer une Salle
- URL: `http://localhost:8000/trunk/creersalle.html`
- Paramètres:
  - Durée: `30` (minutes)
  - ✓ Cocher: "Webcam"
- Clic: **"Créer la salle"**

**✅ Points de vérification**:
- ✓ Code généré (format: `ABCD1234`)
- ✓ Sauvegardé dans localStorage (`currentRoomCode`)
- ✓ Structure Firebase: `/rooms/ABCD1234` créée

#### 1.4 Salle d'Attente Professeur
- Affichage automatique après création
- Voir: Code, durée, options

**✅ Points de vérification**:
- ✓ Code visible et copiable
- ✓ Bouton "Lancer l'activité" (inactif avec 0 participants)
- ✓ Page prête pour TEST 2

**⏸️ PAUSE STRATÉGIQUE**: Laisser cette page ouverte pour TEST 4

---

## ✅ TEST 2: FLUX ÉTUDIANT - MODE QUESTIONNAIRE

### Objectif
Vérifier que l'étudiant peut remplir le questionnaire Likert sans webcam.

### Étapes

#### 2.1 Rejoindre la Salle
- **Nouvelle fenêtre navigateur** (ou mode incognito)
- URL: `http://localhost:8000/trunk/access.html`
- Remplir:
  - Mode: **"Anonyme"** (radio button)
  - Prénom: `Alice`
  - Nom: `Martin`
- Clic: **"Rejoindre"**

**✅ Points de vérification**:
- ✓ Pas d'erreur de validation
- ✓ Redirection vers `rejoindresalle.html`
- ✓ Participant ajouté à Firebase

#### 2.2 Sélectionner Mode Questionnaire
- Page: `rejoindresalle.html`
- Voir: Options de mode
- Choisir: **"❓ Questionnaire uniquement"** (clic sur l'option)
- Saisir code: `ABCD1234`
- Clic: **"Rejoindre la salle"**

**✅ Points de vérification**:
- ✓ Option "Questionnaire" devient active (fond coloré)
- ✓ Pas d'accès webcam demandé
- ✓ Questionnaire s'affiche

#### 2.3 Remplir Questionnaire
- Le questionnaire doit s'afficher avec 6 questions:

| # | Question | Réponse Test |
|---|----------|--------------|
| 1 | Joie/Bonheur | 5 - "Extrêmement" |
| 2 | Stress/Anxiété | 2 - "Un peu" |
| 3 | Engagement/Intérêt | 4 - "Beaucoup" |
| 4 | Confiance | 4 - "Beaucoup" |
| 5 | Satisfaction | 5 - "Extrêmement" |
| 6 | Concentration | 3 - "Moyennement" |

- Laisser vide: Commentaires (optionnel)
- Clic: **"Valider le questionnaire"**

**✅ Points de vérification**:
- ✓ Chaque question requiert une réponse
- ✓ Message d'erreur si question vide
- ✓ Score calculé: `(5+2+4+4+5+3)/6 = 3.83`
- ✓ Sauvegardé dans Firebase: `/rooms/ABCD1234/questionnaires/[key]`
- ✓ Message de confirmation visible

---

## ✅ TEST 3: FLUX ÉTUDIANT - MODE DÉTECTION ÉMOTIONS

### Objectif
Vérifier que l'étudiant peut utiliser la détection d'émotions via Face-API.

### Étapes

#### 3.1 Rejoindre - Nouvelle Salle (optionnel) ou Même Salle
- Si vous testez avec la même salle (ABCD1234):
  - URL: `http://localhost:8000/trunk/access.html`
  - Prénom: `Bob`
  - Nom: `Durand`
  - Mode: **Anonyme**
  - Clic: **"Rejoindre"**

#### 3.2 Sélectionner Mode Webcam
- Page: `rejoindresalle.html`
- Code: `ABCD1234`
- Mode: **"📷 Activer la webcam"** (actif par défaut)
- Clic: **"Rejoindre la salle"**

**✅ Points de vérification**:
- ✓ Dialog de consentement webcam s'affiche
- ✓ Message: "Autorisez-vous l'accès à la webcam..."
- ✓ Options: "Accepter" ou "Refuser"

#### 3.3 Accepter Webcam et Lancer Détection
- Clic: **"OK"** (consentement webcam)
- Attendre 2-3 secondes

**✅ Points de vérification**:
- ✓ Vidéo webcam visible en direct
- ✓ Canvas overlay s'affiche (couche de détection)
- ✓ Section détection apparaît:
  - ✓ Titre: "Détection des émotions en cours..."
  - ✓ Timer affiche: "0s" → s'incrémente
  - ✓ "Émotion dominante" visible (en attente...)
  - ✓ 7 barres d'émotions:
    - 😊 Heureux: 0%
    - 😢 Triste: 0%
    - 😐 Neutre: 0%
    - 😠 En colère: 0%
    - 😲 Surpris: 0%
    - 😨 Peur: 0%
    - 🤢 Dégoûté: 0%
  - ✓ Bouton: "Terminer la détection ✓"

#### 3.4 Montrer des Émotions à la Webcam
- **Faire des expressions faciales devant la webcam** (15-30 secondes):
  - Sourire (heureux)
  - Faire une moue (triste)
  - Expression neutre
  - Froncer les sourcils (colère/surprise)

**✅ Points de vérification**:
- ✓ Les émotions se mettent à jour en temps réel
- ✓ Les barres se remplissent
- ✓ L'émotion dominante change
- ✓ Timer continue de compter
- ✓ Console: Messages Face-API OK (pas d'erreurs)

#### 3.5 Terminer la Détection
- Clic: **"Terminer la détection ✓"**
- Attendre 2-3 secondes

**✅ Points de vérification**:
- ✓ Vidéo s'arrête
- ✓ Canvas se cache
- ✓ Message: "Données d'émotions enregistrées avec succès ✓"
- ✓ Données sauvegardées dans Firebase: `/rooms/ABCD1234/emotions/[participantKey]`
- ✓ Participant marqué: `objectiveEmotionComplete: true`

**Données attendues dans Firebase**:
```json
{
  "participantKey": "participant123",
  "roomId": "ABCD1234",
  "duration": 28,
  "totalSamples": 56,
  "emotionStats": {
    "happy": 15,
    "sad": 3,
    "neutral": 25,
    "angry": 5,
    "surprised": 8,
    "fearful": 0,
    "disgusted": 0
  },
  "emotionHistory": [...]
}
```

---

## ✅ TEST 4: MONITORING PROFESSEUR REAL-TIME

### Objectif
Vérifier que le professeur voit les participants en temps réel.

### Étapes

#### 4.1 Vérifier Salle Professeur
- Revenir à la fenêtre **TEST 1** (salle d'attente professeur)
- Page: `salle.html`

**✅ Points de vérification**:
- ✓ Nombre de participants augmente (2 + 2 = 4 au total)
- ✓ Liste des participants visible:
  - Alice Martin (mode questionnaire)
  - Bob Durand (mode détection)
- ✓ Temps d'arrivée affichés
- ✓ Bouton **"Lancer l'activité"** maintenant ACTIF (≥1 participant)

#### 4.2 Lancer l'Activité
- Clic: **"Lancer l'activité →"**

**✅ Points de vérification**:
- ✓ État change à "En direct 🟢"
- ✓ Message: "Activité démarrée par le professeur"
- ✓ Pages étudiants mettent à jour le statut (real-time)

#### 4.3 Vérifier Données Étudiants
- Professionnel voir: Résumé des données
- KPI affichées:
  - ✓ Participants: 2
  - ✓ Questionnaires complétés: 1
  - ✓ Scores subjectifs: 3.83/5
  - ✓ Émotions objectives: 25 échantillons

---

## ✅ TEST 5: MODE REFUS WEBCAM

### Objectif
Vérifier le fallback quand l'utilisateur refuse la webcam.

### Étapes

#### 5.1 Rejoindre avec Refus Webcam
- URL: `http://localhost:8000/trunk/access.html`
- Remplir: Charlie, Bernard, Mode: Anonyme
- Clic: **"Rejoindre"**
- Page: `rejoindresalle.html`
- Code: `ABCD1234`
- Mode: **"📷 Webcam"** (défaut)
- Clic: **"Rejoindre"**
- Dialog: **"Refuser"** (ou "Annuler")

**✅ Points de vérification**:
- ✓ Message: "Veuillez utiliser le mode questionnaire."
- ✓ Pas d'accès webcam
- ✓ Aucune données d'émotions envoyées
- ✓ Page reste sur `rejoindresalle.html`

#### 5.2 Utiliser Mode Questionnaire Ensuite
- Clic: **"❓ Questionnaire uniquement"**
- Même code `ABCD1234`
- Clic: **"Rejoindre"**

**✅ Points de vérification**:
- ✓ Questionnaire s'affiche correctement
- ✓ Peut remplir et soumettre

---

## 🔍 VALIDATION FIREBASE

### Endpoint pour Inspecter les Données

Après les tests, vérifiez la structure Firebase (Firebase Console):

```
projetl2t1-767a4
├── rooms
│   └── ABCD1234
│       ├── meta
│       │   └── activityStatus: "running"
│       ├── participants
│       │   ├── [participant1]
│       │   │   ├── firstName: "Alice"
│       │   │   ├── lastName: "Martin"
│       │   │   ├── participationMode: "questionnaire"
│       │   │   └── questionnaireCompleted: true
│       │   ├── [participant2]
│       │   │   ├── firstName: "Bob"
│       │   │   ├── lastName: "Durand"
│       │   │   ├── participationMode: "webcam"
│       │   │   └── objectiveEmotionComplete: true
│       ├── questionnaires
│       │   └── [response1]
│       │       ├── totalScore: 23
│       │       ├── averageScore: 3.83
│       │       └── answers: [...]
│       └── emotions
│           └── [emotion1]
│               ├── emotionStats: {...}
│               ├── duration: 28
│               └── emotionHistory: [...]
```

---

## 🐛 TROUBLESHOOTING

| Problème | Solution |
|----------|----------|
| Webcam ne marche pas | ✓ Vérifier permissions navigateur ✓ Utiliser HTTPS ou localhost |
| Face-API affiche erreur | ✓ Console: `faceapi` doit être défini ✓ Attendre chargement modèles |
| Firebase connection error | ✓ Vérifier config dans `firebase-config.js` ✓ Vérifier règles Firebase |
| Questionnaire ne s'affiche pas | ✓ Vérifier `/questions` dans Firebase ✓ Pas de JSON malformé |
| Real-time updates absent | ✓ Vérifier listeners actifs ✓ Pas d'erreurs réseau |

---

## 📝 CHECKLIST FINALE

- [ ] TEST 1: Professeur inscription + salle créée
- [ ] TEST 2: Étudiant questionnaire complet
- [ ] TEST 3: Étudiant détection émotions fonctionne
- [ ] TEST 4: Professeur voit participants real-time
- [ ] TEST 5: Refus webcam → Questionnaire
- [ ] Firebase: Tous les chemins de données vérifiés
- [ ] Console: Aucun erreur JavaScript
- [ ] Performance: Détection Face-API fluide (~30fps)

---

## 🚀 NEXT STEPS

1. **Déploiement**: Héberger sur Firebase Hosting
2. **SSL**: HTTPS pour webcam en prod
3. **Optimisation**: Minifier JS, compresser modèles Face-API
4. **Monitoring**: Logger sessions pour analyse
5. **UX**: Ajouter indicateurs connexion réseau
