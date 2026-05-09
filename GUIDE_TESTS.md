# 🧪 GUIDE DE TESTS COMPLET - Emotion Management Platform

## ⚙️ PRÉ-REQUIS

- **Navigateur moderne** (Chrome, Firefox, Edge)
- **Webcam fonctionnelle** pour tests complets
- **Connexion Internet** (Firebase)
- **Firebase Console** accessible pour vérifier les données
- **localStorage** activé dans le navigateur

---

## 📋 DONNÉES DE TEST

### Professeur
```
Email: thomas.martin@u-paris.fr
Mot de passe: TestPassword123
Nom: Thomas
Prénom: Martin
Matière: Mathématiques
```

### Étudiant (Anonyme)
```
Nom: Alex
Prénoms: Jordan
```

### Étudiant (Nommé)
```
Numéro étudiant: 12345678
Nom: Dupont
Prénoms: Marie
Email: marie.dupont@etu.u-paris.fr
```

---

## 🧑‍🏫 TEST 1: FLUX PROFESSEUR

### Étape 1.1 - Accueil
**URL:** `http://localhost:8000/trunk/accueil.html` (ou votre serveur local)

✅ **Points de vérification:**
- [ ] Page s'affiche correctement
- [ ] 2 boutons visibles: "Créer une salle" et "Rejoindre une salle"
- [ ] Pas de redirection automatique (pas encore connecté)

---

### Étape 1.2 - Inscription Professeur
**Clic:** "Créer une salle" → `creesalle.html`

✅ **Points de vérification:**
- [ ] Formulaire s'affiche (Nom, Prénom, Email, Matière, Mot de passe)
- [ ] Lien "Connectez-vous" en bas visible

**Remplissage du formulaire:**
```
Nom: Martin
Prénom: Thomas
Email: thomas.martin@u-paris.fr
Matière: Mathématiques
Mot de passe: TestPassword123
```

**Clic:** "Créer un compte"

✅ **Points de vérification (5-10 secondes):**
- [ ] Message ✅ "Compte créé avec succès ! Redirection..."
- [ ] Pas d'erreur Firebase
- [ ] Redirection vers `identifprof.html`

**Vérifier Firebase Console:**
```
Realtime Database → Voir les données:
  /professors/{uid}
    - email: thomas.martin@u-paris.fr
    - nom: Martin
    - prenom: Thomas
    - matiere: Mathématiques
    - createdAt: [timestamp]
```

---

### Étape 1.3 - Connexion Professeur
**URL actuelle:** `identifprof.html`

✅ **Points de vérification:**
- [ ] Formulaire connexion visible
- [ ] Champs: Email, Mot de passe

**Remplissage:**
```
Email: thomas.martin@u-paris.fr
Mot de passe: TestPassword123
```

**Clic:** "Se connecter"

✅ **Points de vérification:**
- [ ] Message ✅ Connexion réussie (ou redirection directe)
- [ ] Redirection vers `creersalle.html`

**Vérifier localStorage (F12 → Application → Storage):**
```
Key: currentUser
Value: {uid, email, profile}
```

---

### Étape 1.4 - Création de Salle
**URL actuelle:** `creersalle.html`

✅ **Points de vérification:**
- [ ] Titre "Créer une nouvelle salle"
- [ ] Champs visibles:
  - Durée: 30
  - ☑ Questionnaire (checked)
  - ☐ Webcam (unchecked)

**Configuration:**
```
Durée: 30 minutes
✓ Questionnaire
✓ Webcam (COCHER cette fois)
```

**Clic:** "Créer la salle"

✅ **Points de vérification (3-5 secondes):**
- [ ] Pas d'erreur
- [ ] Redirection vers `display-room-code.html`

---

### Étape 1.5 - Affichage du Code Salle
**URL actuelle:** `display-room-code.html`

✅ **Points de vérification:**
- [ ] Titre "Votre salle a été créée !"
- [ ] **Code salle affiché** (8 caractères, ex: "ABC12XYZ")
- [ ] Boutons: "📋 Copier le code" et "📧 Partager par email"
- [ ] Bouton "Accéder à la salle d'attente"

**Actions à tester:**
1. Clic "📋 Copier le code" → Message ✅ "Code copié"
2. Clic "📧 Partager par email" → Ouvre client email
3. **NOTE:** Notez le code salle généré (ex: `ABC12XYZ`)

**Clic:** "Accéder à la salle d'attente"

✅ **Points de vérification:**
- [ ] Redirection vers `salle.html`

---

### Étape 1.6 - Salle d'Attente Professeur
**URL actuelle:** `salle.html`

✅ **Points de vérification initiales:**
- [ ] Titre "Emotion Monitoring Platform - Salle d'attente"
- [ ] Code salle affiché en haut (ABC12XYZ)
- [ ] Section "Participants connectés"
- [ ] Badge "0 participants" (avant que les étudiants rejoignent)
- [ ] **Bouton "Lancer l'activité" DÉSACTIVÉ**
- [ ] Message: "En attente d'au moins 1 participant"

**Vérifier Firebase:**
```
/rooms/{roomId}
  - code: ABC12XYZ
  - professorName: Thomas Martin
  - duration: 30
  - webcam: true
  - questionnaire: true
  - createdAt: [timestamp]
  - participants: {} (vide)
```

**⏸️ PAUSE ICI - Laissez cette page ouverte pour la suite**

---

## 👥 TEST 2: FLUX ÉTUDIANT

### Étape 2.1 - Accueil Étudiant
**Nouvelle fenêtre/onglet:** `accueil.html`

✅ **Points de vérification:**
- [ ] Page accueil s'affiche
- [ ] Pas de redirection (pas connecté en tant qu'étudiant)

**Clic:** "Rejoindre une salle" → `access.html`

---

### Étape 2.2 - Formulaire Rejoindre Salle
**URL actuelle:** `access.html`

✅ **Points de vérification:**
- [ ] Deux modes radio:
  - ☑ Anonyme (sélectionné par défaut)
  - ☐ Non anonyme
- [ ] Champs visibles selon mode

**Mode ANONYME (défaut):**
```
Nom: Alex
Prénoms: Jordan
(Email pré-rempli: anonyme@anonyme.com)
Code de la salle: [VOTRE CODE, ex: ABC12XYZ]
```

**Clic:** "Rejoindre la salle"

✅ **Points de vérification (2-3 secondes):**
- [ ] Pas d'erreur "Code de la salle non trouvé"
- [ ] Redirection vers `rejoindresalle.html`

**Vérifier Firebase:**
```
/rooms/{roomId}/participants/{participantId}
  - name: Jordan Alex
  - anonymous: true
  - joinedAt: [timestamp]
```

**Vérifier page salle.html (onglet professeur):**
- [ ] Badge participants: "1" (devrait passer de 0 à 1)
- [ ] Bouton "Lancer l'activité" devrait être **ACTIVÉ**
- [ ] Liste participant visible avec nom "Jordan Alex"

---

### Étape 2.3 - Choix Webcam/Questionnaire
**URL actuelle:** `rejoindresalle.html`

✅ **Points de vérification:**
- [ ] Code salle affiché (ABC12XYZ)
- [ ] Deux options:
  - 📷 Activer la webcam (par défaut)
  - ❓ Questionnaire uniquement
- [ ] Vidéo box vide (aucune webcam lancée)
- [ ] Bouton "Rejoindre la salle →" visible

**Clic:** sur "📷 Activer la webcam"

✅ **Points de vérification:**
- [ ] Option devient active (background change)
- [ ] Video box s'affiche
- [ ] Demande d'autorisation webcam (navigateur)
- [ ] **Accepter l'accès webcam**

✅ **Points de vérification (après autorisation):**
- [ ] Flux vidéo s'affiche dans la vidéo box
- [ ] Message: "✓ Modèles chargés. Prêt à démarrer."

**Clic:** "Rejoindre la salle →"

✅ **Points de vérification:**
- [ ] Redirection vers `emotion-detection.html`

---

### Étape 2.4 - Détection Émotions (OBJECTIF)
**URL actuelle:** `emotion-detection.html`

✅ **Points de vérification initiales:**
- [ ] Titre "Détection des Émotions"
- [ ] Video box avec webcam
- [ ] Message chargement: "Chargement de la webcam..."
- [ ] Barre "Émotions détectées" avec 7 émotions (0% chacune)
- [ ] Émotion principale: "—"
- [ ] Bouton "Démarrer détection"

**Clic:** "Démarrer détection"

✅ **Points de vérification (1-2 secondes):**
- [ ] Bouton devient "Arrêter"
- [ ] Message: "✓ Détection en cours..."
- [ ] Si visage détecté:
  - [ ] Box vert autour du visage
  - [ ] Les pourcentages commencent à s'afficher
  - [ ] Émotion principale apparaît (ex: "😊 Heureux")
  - [ ] Timer démarre (00:01, 00:02, etc.)

**Laissez tourner 10-15 secondes minimum:**
- Bouton "Continuer au questionnaire →" devrait devenir actif après 10 secondes
- Les barres d'émotions se remplissent

**Clic:** "Continuer au questionnaire →"

✅ **Points de vérification:**
- [ ] Redirection vers `questionnaire.html`
- [ ] Les données sont sauvegardées en localStorage

**Vérifier localStorage:**
```
emotionStats: {totalSamples, duration, dominantEmotion, ...}
emotionHistory: [array d'émotions détectées]
```

---

### Étape 2.5 - Questionnaire Subjectif (Likert)
**URL actuelle:** `questionnaire.html`

✅ **Points de vérification:**
- [ ] Question 1/7 affichée: "À quel point vous sentiez-vous joyeux..."
- [ ] 5 options radio: Pas du tout → Extrêmement
- [ ] Barre de progression: 14% (1/7)
- [ ] Bouton "Suivant →" visible
- [ ] Bouton "Précédent" DÉSACTIVÉ

**Test Questions (parcourir toutes):**

**Q1 - Joie:** Clic "Beaucoup"
**Q2 - Stress:** Clic "Peu"
**Q3 - Engagement:** Clic "Beaucoup"
**Q4 - Confiance:** Clic "Moyen"
**Q5 - Satisfaction:** Clic "Satisfait"
**Q6 - Concentration:** Clic "Beaucoup"

À chaque question:
- [ ] Clic "Suivant →"
- [ ] Progression % augmente
- [ ] Bouton "Précédent" devient actif (à partir de Q2)
- [ ] Option précédente reste sélectionnée si vous revenez

**Q7 - Commentaires:**
```
Textarea optionnel - Entrez: "Activité intéressante!"
```

✅ **Points de vérification (Q7):**
- [ ] Barre: 100%
- [ ] Bouton "Soumettre →" visible
- [ ] Bouton "Suivant →" CACHÉ

**Clic:** "Soumettre →"

✅ **Points de vérification (3-5 secondes):**
- [ ] Message: "Envoi en cours..."
- [ ] Redirection vers `results.html`

**Vérifier Firebase:**
```
/rooms/{roomId}/participants/{participantId}
  - subjectiveData: {joy, stress, engagement, ...}
  - completedAt: [timestamp]
```

---

### Étape 2.6 - Résultats & Analyse
**URL actuelle:** `results.html`

✅ **Points de vérification:**
- [ ] Titre "Résultats de l'Analyse Émotionnelle"
- [ ] 3 sections:
  1. **Analyse Objective (Face-API)**
  2. **Analyse Subjective (Questionnaire)**
  3. **Comparaison**

#### Section Objective:
- [ ] Émotion dominante affichée (ex: "😊 Heureux")
- [ ] Pourcentage
- [ ] Durée (ex: "0m 12s")
- [ ] Nombre d'échantillons
- [ ] Graphique avec toutes les émotions détectées

#### Section Subjective:
- [ ] 6 questions avec réponses Likert
- [ ] Barres colorées selon les réponses
- [ ] Commentaires affichés (si remplis)

#### Section Comparaison:
- [ ] Positivité: Objective vs Subjective
- [ ] Stress: Objective vs Subjective
- [ ] Engagement: Objective vs Subjective
- [ ] **Insight** (message d'analyse)

**Boutons:**
- [ ] "📥 Télécharger rapport" → Télécharge un fichier `.txt`
- [ ] "← Retour à l'accueil" → Redirection vers `accueil.html`

**Clic:** "📥 Télécharger rapport"

✅ **Points de vérification:**
- [ ] Fichier `rapport-emotions.txt` téléchargé
- [ ] Contenu inclut toutes les données (objectif, subjectif, comparaison)

---

## 🧪 TEST 3: TESTS MODE NON-ANONYME

**Recommencer le test 2 (étudiant) mais avec:**

### Étape 3.1 - Mode Non-Anonyme
À l'étape 2.2, au lieu de sélectionner "Anonyme", cliquez **"Non anonyme"**

```
Numéro étudiant: 12345678
Nom: Dupont
Prénoms: Marie
Email: marie.dupont@etu.u-paris.fr
Code salle: [VOTRE CODE]
```

✅ **Points de vérification:**
- [ ] Validation correcte
- [ ] Firebase enregistre:
  ```
  - name: Marie Dupont
  - anonymous: false
  - studentNumber: 12345678
  - email: marie.dupont@etu.u-paris.fr
  ```

---

## 🔄 TEST 4: SALLE PROFESSEUR (Real-time Updates)

**Retour à la fenêtre `salle.html` du professeur**

✅ **Points de vérification:**
- [ ] Participants: "2" (Alex + Marie)
- [ ] Liste affichée:
  ```
  🔒 Jordan Alex [Anonyme]
  👤 Marie Dupont [12345678]
  ```
- [ ] Bouton "Lancer l'activité" reste ACTIF

**Clic:** "Lancer l'activité"

✅ **Points de vérification:**
- [ ] Message: "Activité lancée! Redirection en cours..."
- [ ] Mise à jour Firebase:
  ```
  /rooms/{roomId}
    - status: active
    - startedAt: [timestamp]
  ```

---

## ✅ TEST 5: VALIDATION COMPLÈTE

### Checklist Finale:

#### Authentification ✓
- [ ] Inscription professeur OK
- [ ] Connexion professeur OK
- [ ] localStorage `currentUser` stocké
- [ ] Persistence session (F5 = reste connecté)

#### Salles & Participants ✓
- [ ] Création salle + code unique OK
- [ ] Recherche salle par code OK
- [ ] Ajout participants OK
- [ ] Listeners temps réel OK (compteur participants)

#### Détection Émotions ✓
- [ ] Webcam s'initialise OK
- [ ] Face-API détecte visages OK
- [ ] Émotions s'affichent en temps réel OK
- [ ] Timer fonctionne OK
- [ ] Données sauvegardées Firebase OK

#### Questionnaire ✓
- [ ] 6 questions Likert visibles OK
- [ ] Navigation avant/arrière OK
- [ ] Validation réponses OK
- [ ] Commentaires optionnels OK
- [ ] Données sauvegardées Firebase OK

#### Résultats ✓
- [ ] Section objective affichée OK
- [ ] Section subjective affichée OK
- [ ] Comparaison calculée OK
- [ ] Rapport téléchargeable OK

#### Firebase ✓
- [ ] Professeurs créés OK
- [ ] Salles créées OK
- [ ] Participants ajoutés OK
- [ ] Données émotionnelles sauvegardées OK
- [ ] Données subjectives sauvegardées OK

---

## 🐛 TROUBLESHOOTING

### Problem: "Impossible d'accéder à la webcam"
- [ ] Vérifier permissions navigateur
- [ ] Redémarrer navigateur
- [ ] Vérifier HTTPS ou localhost (Face-API nécessite sécurisé)

### Problem: "Modèles Face-API non chargés"
- [ ] Vérifier connexion Internet
- [ ] Essayer autre navigateur
- [ ] Vérifier console (F12) pour erreurs

### Problem: "Code salle non trouvé"
- [ ] Vérifier le code est exact (8 caractères)
- [ ] Vérifier que la salle professeur existe dans Firebase
- [ ] Console: Rechercher erreur de requête

### Problem: "Participants n'apparaissent pas en temps réel"
- [ ] Vérifier Internet
- [ ] Vérifier règles Firebase
- [ ] Rafraîchir la page salle.html

### Problem: "Données non sauvegardées Firebase"
- [ ] Vérifier que l'utilisateur est authentifié
- [ ] Vérifier règles Firebase
- [ ] Console (F12): Voir erreur Firebase

---

## 📊 DONNÉES ATTENDUES FIREBASE

### Structure finale:
```
/rooms/
  {roomId}/
    code: "ABC12XYZ"
    professorId: "{uid}"
    professorName: "Thomas Martin"
    duration: 30
    createdAt: "2026-05-05T..."
    participants/
      {participantId1}/
        name: "Jordan Alex"
        anonymous: true
        joinedAt: "2026-05-05T..."
        subjectiveData: {...}
        completedAt: "2026-05-05T..."
      {participantId2}/
        name: "Marie Dupont"
        anonymous: false
        studentNumber: "12345678"
        email: "marie.dupont@etu.u-paris.fr"
        joinedAt: "2026-05-05T..."
        subjectiveData: {...}
        completedAt: "2026-05-05T..."
    emotions/
      {emotionId1}/
        participantId: "{participantId1}"
        emotion: "heureux"
        confidence: 87.5
        timestamp: "2026-05-05T..."
      {emotionId2}/
        ...

/professors/
  {uid}/
    email: "thomas.martin@u-paris.fr"
    nom: "Martin"
    prenom: "Thomas"
    matiere: "Mathématiques"
    createdAt: "2026-05-05T..."
```

---

## 🎯 CAS D'ERREUR À TESTER

1. **Email déjà utilisé:** Relancer inscription avec même email
2. **Email invalid:** Tester des emails sans format correct
3. **Mot de passe faible:** Tester avec <6 caractères
4. **Code salle invalide:** Tester avec 7 caractères au lieu de 8
5. **Numéro étudiant invalide:** Tester avec 7 chiffres
6. **Pas de webcam:** Sélectionner questionnaire uniquement

---

## 🎬 DÉMARRER LES TESTS

### Option 1: Serveur local avec Python
```bash
cd /Users/metusgbogbohoundada/Documents/emotion-management
python3 -m http.server 8000
```
Accédez: `http://localhost:8000/trunk/accueil.html`

### Option 2: Serveur Node.js
```bash
npx http-server trunk -p 8000
```

### Option 3: Live Server VS Code
- Extension "Live Server"
- Clic droit `accueil.html` → "Open with Live Server"

---

## ✨ BON COURAGE AUX TESTS! 🚀

Notez tous les bugs/erreurs → Je les corrigerai!
