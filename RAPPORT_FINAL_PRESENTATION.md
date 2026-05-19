# 🎓 RAPPORT DE PROJET : Emotion Monitoring Platform

**Projet L2T1 — Université Paris Cité**  
*Observer et comprendre les émotions lors des activités pédagogiques.*

---

## 1. INTRODUCTION ET OBJECTIFS

Dans le contexte éducatif actuel (notamment avec l'essor de l'enseignement hybride), il est souvent difficile pour un professeur de jauger l'engagement et l'état émotionnel global de sa classe. 

**L'objectif principal** de ce projet est de fournir un outil permettant de capter, d'analyser et de restituer en temps réel les émotions des étudiants, afin d'aider l'enseignant à ajuster son approche pédagogique.

**Les engagements fondamentaux du projet :**
- **Temps réel :** Les données remontent instantanément sur le tableau de bord du professeur.
- **Respect de la vie privée (Privacy by design) :** Le traitement des images se fait localement sur la machine de l'étudiant. Aucune image ou flux vidéo n'est envoyé sur un serveur.
- **Accessibilité :** Participation flexible (Anonyme ou Nominative) et multi-modale (Webcam et/ou Questionnaire).

---

## 2. MÉTHODOLOGIE ET CHOIX TECHNOLOGIQUES

Pour répondre à ces exigences, nous avons opté pour une architecture **Serverless** orientée événements.

### 2.1. Frontend (Interface Utilisateur)
- **HTML5 / CSS3 / Vanilla JavaScript :** Choix d'une stack légère sans framework lourd pour garantir des performances optimales et un temps de chargement réduit.
- **Chart.js :** Bibliothèque de dataviz utilisée pour afficher les graphiques dynamiques (camembert et histogramme) en temps réel sur le tableau de bord du professeur.

### 2.2. Backend & Temps Réel (Firebase)
- **Firebase Realtime Database :** Base de données NoSQL synchronisée en temps réel via des WebSockets. Elle permet d'afficher les émotions et le nombre de participants connectés à la seconde près.
- **Firebase Authentication :** 
  - *Pour les professeurs :* Authentification sécurisée (Email/Mot de passe).
  - *Pour les étudiants :* Sessions anonymes transparentes pour sécuriser l'accès à la base de données tout en garantissant l'anonymat.

### 2.3. Intelligence Artificielle & Machine Learning
- **Face-API.js :** Modèle de détection faciale léger fonctionnant directement dans le navigateur (Client-side). Il analyse les expressions du visage (~10 fois par seconde) et catégorise l'émotion dominante (Joie, Tristesse, Neutre, Colère, Surprise, Peur, Dégoût).

---

## 3. ARCHITECTURE ET FLUX DE DONNÉES

Le système repose sur un flux de données bidirectionnel optimisé :

1. **Création de la session :** Le professeur génère une salle (ex: `ABCD1234`). Firebase crée une branche dédiée sécurisée.
2. **Acquisition Client-side :** L'étudiant rejoint. Son navigateur charge les modèles Face-API et analyse son flux vidéo local. 
3. **Synchronisation allégée :** Pour éviter de saturer le réseau avec 40 étudiants simultanés, le script JS compile les émotions détectées et envoie un résumé statistique à Firebase de manière cadencée (Rate-limiting & Debouncing).
4. **Restitution live :** Le dashboard du professeur écoute la base Firebase et met à jour les indicateurs (KPIs) et les graphiques de manière fluide.

---

## 4. FONCTIONNALITÉS DÉVELOPPÉES

### 👨‍🏫 Espace Professeur
- **Création de compte et authentification** sécurisées.
- **Génération de salle** avec code unique (4 lettres, 4 chiffres).
- **Contrôle de l'activité** (Lancement, Pause, Arrêt de la collecte).
- **Tableau de bord interactif** :
  - Nombre de participants connectés (liste avec statut en temps réel).
  - Graphique circulaire (répartition des émotions).
  - Histogramme (évolution/comparaison entre webcam et déclaratif).
  - KPIs de l'humeur globale (note sur 5).

### 👤 Espace Étudiant
- **Parcours d'intégration** (Onboarding) fluide : mode Anonyme ou Nominatif (Numéro étudiant).
- **Mesure objective (Webcam)** : 
  - Demande de consentement explicite.
  - Feedback de positionnement intelligent ("Rapprochez-vous", "Ne bougez pas").
- **Mesure subjective (Questionnaire)** : 
  - 5 questions basées sur l'échelle de Likert pour évaluer l'engagement.
  - Utilisable en complément ou en remplacement de la webcam.

---

## 5. DÉFIS TECHNIQUES ET SOLUTIONS APPORTÉES

Au cours du développement, plusieurs obstacles majeurs ont été franchis avec succès, démontrant la robustesse du code :

### Défi 1 : La surcharge du réseau (Concurrency pour 40+ utilisateurs)
- **Problème :** Si 40 étudiants envoyaient leur émotion à Firebase 10 fois par seconde, la base de données saturait.
- **Solution :** Implémentation d'un système de **Debouncing** et de **Rate-Limiting**. Le client accumule les statistiques (`liveStats`) et ne synchronise avec Firebase que toutes les 1,5 secondes, ou uniquement lors d'un changement d'émotion significatif (taux de confiance > 40%).

### Défi 2 : L'animation et le scintillement des graphiques (Chart.js)
- **Problème :** Mettre à jour le camembert en temps réel redessinait tout le composant, créant un clignotement désagréable.
- **Solution :** Modification directe des données dans l'objet `chart.data.datasets[0].data` plutôt que de forcer un re-rendu, combinée à la désactivation des animations transitoires (`animation: { duration: 0 }`). L'UI est désormais 100% fluide.

### Défi 3 : L'expérience Utilisateur (UX / UI)
- **Problème :** L'interface présentait des ambiguïtés (boutons asymétriques, alertes système natives intrusives, persistance de champs inutiles comme le nom du prof).
- **Solution :** Refonte UI/UX :
  - Utilisation de **Flexbox** pour aligner la taille et la hauteur des cartes et des boutons d'actions.
  - Remplacement des requêtes `window.confirm()` natives par de vraies modales (Pop-ups) stylisées (ex: confirmation de déconnexion, arrêt de session).
  - Suppression des champs redondants pour raccourcir le flux d'accès étudiant.

---

## 6. CONCLUSION ET PERSPECTIVES

Le projet **Emotion Monitoring Platform** est aujourd'hui un prototype pleinement fonctionnel, qui répond à son cahier des charges initial. Il conjugue intelligemment **l'analyse vidéo par IA respectueuse de la RGPD** et **les technologies web temps réel**.

**Améliorations futures envisagées :**
- **Export automatique des résultats :** Génération d'un rapport PDF et CSV complet à la clôture de la session.
- **Métriques avancées :** Croisement temporel des émotions avec un timestamp précis d'un cours (ex: pic de confusion à 10h15 lors d'une explication complexe).
- **Hébergement cloud :** Déploiement en production sur des plateformes telles que Vercel ou Firebase Hosting avec un certificat SSL (HTTPS) obligatoire pour sécuriser l'accès à la webcam sur tous les navigateurs.