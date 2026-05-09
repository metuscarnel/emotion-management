# 🎯 EMOTION MONITORING PLATFORM
## Présentation du Projet

---

## 📌 **Vue d'Ensemble**

Plateforme web collaborative pour **monitorer les émotions des étudiants** lors d'activités pédagogiques.

**Date**: Mai 2026  
**Architecture**: Frontend Web + Firebase Realtime Database + Face-API.js  
**Langue**: Français

---

## 🎓 **Cas d'Usage**

### Pour le Professeur
- ✅ Créer un compte & se connecter
- ✅ Générer une **salle d'activité** avec code unique
- ✅ **Monitorer en temps réel** les émotions des étudiants
- ✅ Voir les résultats agrégés (dashboard)

### Pour l'Étudiant
- ✅ Rejoindre une salle via code
- ✅ Choisir mode de participation :
  - **📷 Webcam** : Détection automatique des émotions via Face-API.js
  - **❓ Questionnaire** : 5 questions format Likert
- ✅ Transmettre ses données en temps réel

---

## 🏗️ **Architecture**

```
┌─────────────────────────────────────────────┐
│        Navigateur Web (HTML/CSS/JS)         │
├─────────────────────────────────────────────┤
│  • Face-API.js (détection faciale client)   │
│  • Firebase SDK (temps réel)                │
│  • LocalStorage (session utilisateur)       │
└──────────────┬──────────────────────────────┘
               │
      ┌────────▼────────┐
      │    Firebase     │
      │  Realtime DB    │
      │                 │
      │  • /professors  │
      │  • /rooms       │
      │  • /results     │
      └─────────────────┘
```

---

## 📂 **Structure Fichiers**

### Flux Professeur
| Page | Fonction |
|------|----------|
| `creesalle.html` | **Inscription** du professeur |
| `identifprof.html` | **Connexion** professeur |
| `creersalle.html` | **Créer** une salle d'activité |
| `salle.html` | **Monitoring** en temps réel |

### Flux Étudiant
| Page | Fonction |
|------|----------|
| `access.html` | **Accès** - rejoindre par code |
| `rejoindresalle.html` | **Choix mode** (Webcam ou Questionnaire) |
| `voirlasalle.html` | **Résultats** affichés après activité |

### Fichiers Techniques
- `firebase-config.js` : Configuration Firebase
- `*.css` : Styles (responsive design)
- `*.js` : Logique métier (validation, API calls, temps réel)

---

## 🚀 **Fonctionnalités Clés**

### 1️⃣ **Authentification**
- Inscription/Connexion professeur avec email + mot de passe
- Profils d'étudiants anonymes ou nominatifs
- Gestion de sessions via Firebase Auth

### 2️⃣ **Gestion des Salles**
- Code d'accès unique généré automatiquement (format: `ABCD1234`)
- Durée configurable
- Statut en temps réel (attente → en cours → terminée)

### 3️⃣ **Détection des Émotions**
- **Mode Webcam** : Face-API.js détecte automatiquement
  - Émotions supportées : 😊 Joy, 😢 Sad, 😠 Angry, 😲 Surprised, 😐 Neutral...
  - Capture continues ~ 10 images/sec
  
- **Mode Questionnaire** : Formulaire Likert (5 points)
  - Questions prédéfinies
  - Réponses sur échelle 1-5

### 4️⃣ **Dashboard Professeur**
- Liste des participants et leur statut
- Graphiques des émotions détectées (en temps réel)
- Export des résultats

---

## 🔧 **Technologies**

| Technologie | Usage |
|-------------|-------|
| **Firebase** | Base données temps réel + authentification |
| **Face-API.js** | Détection faciale côté client |
| **HTML5** | Structure sémantique |
| **CSS3** | Responsive design (Mobile + Desktop) |
| **JavaScript (Vanilla)** | Logique métier, événements temps réel |
| **LocalStorage** | Persistance session utilisateur |

---

## 📊 **Flux de Données**

```
PROFESSEUR                          ÉTUDIANT
    │                                   │
    ├─ Crée salle → Firebase            │
    │              (/rooms/)            │
    │                                   │
    │  Attend code                      │
    │                                   │
    │                              ┌────▼─────┐
    │                              │ Accède    │
    │                              │ avec code │
    │                              └────┬─────┘
    │                                   │
    │  Monitore ◄──────┐          Envoie résultat
    │  (temps réel)    │         (webcam/questionnaire)
    │                  └──────► Firebase
    │                          (/results/)
    │                                   
    └─ Voir dashboard
```

---

## ✅ **État Actuel**

### ✨ Implémentés
- ✓ Interface professeur (création compte + salle)
- ✓ Interface étudiant (accès + modes)
- ✓ Intégration Firebase (auth + realtime DB)
- ✓ Détection Face-API.js
- ✓ Questionnaire Likert
- ✓ Dashboard monitoring
- ✓ Code unique par salle
- ✓ LocalStorage persistence
- ✓ Design responsive

### 🔄 À Tester
- Flux complet bout-à-bout
- Performance multiclient
- Gestion erreurs réseau

---

## 🚦 **Démarrer le Projet**

### 1. Serveur Local
```bash
cd /Users/metusgbogbohoundada/Documents/emotion-management
python3 -m http.server 8000
```

### 2. Accéder
```
http://localhost:8000/trunk/accueil.html
```

### 3. Tester
- **Professeur**: `creesalle.html` → `identifprof.html` → `creersalle.html` → `salle.html`
- **Étudiant**: `access.html` → `rejoindresalle.html` → (webcam/questionnaire)

---

## 📋 **Points Importants**

| Aspect | Détail |
|--------|--------|
| **Base de données** | Firebase (projet: `projetl2t1-767a4`) |
| **Permissions** | Webcam requise pour mode détection |
| **Compatibilité** | Chrome/Firefox/Edge (modern) |
| **Données** | Anonymes ou nominatifs selon choix |
| **Temps réel** | Synchronisation Firebase ≈ <100ms |

---

## 💡 **Prochaines Étapes**

1. Tests d'acceptation complète
2. Optimisation perf (images Face-API)
3. Ajout export PDF/CSV résultats
4. Amélioration UX dashboard
5. Déploiement (Vercel/Firebase Hosting)

---

**Bon courage pour la présentation! 🎉**
