# 🎯 Système de Questionnaire Aléatoire

## ✅ Implémentation Complète

### Vue d'Ensemble
- **5 questions aléatoires** sélectionnées à chaque session
- **Banque de 15 questions** par défaut couvrant l'engagement émotionnel
- **Sélection avec Fisher-Yates shuffle** pour garantir l'aléatoire
- **Traçabilité scientifique** : l'ordre exact des questions est enregistré

---

## 🔬 Rigueur Scientifique

### Avantages de la Sélection Aléatoire

| Aspect | Bénéfice |
|--------|----------|
| **Pas de biais de sélection** | Chaque participant reçoit un ensemble différent |
| **Variance réduite** | Les questions n'influencent pas l'ordre de réponse |
| **Reproductibilité** | L'ordre exact est enregistré pour chaque session |
| **Couverture large** | 15 questions disponibles, 5 utilisées = bonne diversité |
| **Conformité CDC** | Respecte les critères 6.3.1.2 (mesure subjective fiable) |

### Traçabilité Complète
Chaque réponse est enregistrée avec :
```javascript
{
  submittedAt: 1715248321000,
  questionsUsed: [
    { position: 1, id: "q003", text: "Je suis concentré..." },
    { position: 2, id: "q008", text: "La difficulté est adaptée..." },
    { position: 3, id: "q012", text: "Les interactions m'aident..." },
    ...
  ],
  questionsCount: 5,
  answers: [...]
}
```

---

## 📊 Banque de Questions par Défaut

### Questions Actuelles (15 questions)
1. **q001** : Engagement dans l'activité
2. **q002** : Clarté des explications
3. **q003** : Concentration sur la tâche
4. **q004** : Plaisir de l'activité
5. **q005** : Confiance en soi
6. **q006** : Sentiment de progression
7. **q007** : Stress/Anxiété (inverse)
8. **q008** : Adaptation de la difficulté
9. **q009** : Motivation
10. **q010** : Ennui (inverse)
11. **q011** : Satisfaction personnelle
12. **q012** : Interactions sociales
13. **q013** : Frustration (inverse)
14. **q014** : Envie de poursuivre
15. **q015** : Confort technologique

---

## ⚙️ Architecture

### Hiérarchie des Sources de Questions

```
1. Firebase /questionsBank  (personnalisé par institution)
     ↓ (si vide)
2. Banque par défaut        (15 questions scientifiques)
     ↓
3. Sélection aléatoire      (5 questions)
     ↓
4. Sauvegarde + Traçabilité (ordre enregistré)
```

---

## 🔧 Comment Personnaliser

### Option 1 : Remplacer la Banque par Défaut

Si vous avez une banque propre, uploadez-la dans Firebase à `/questionsBank` :

```json
{
  "q001": {
    "question": "Votre question...",
    "options": ["Pas du tout", "Un peu", "Moyennement", "Beaucoup", "Extrêmement"]
  },
  "q002": { ... }
}
```

Le système chargera automatiquement votre banque à la place de la banque par défaut.

### Option 2 : Ajouter des Questions

Modifiez `getDefaultQuestionsBank()` dans `rejoindresalle.js` :

```javascript
function getDefaultQuestionsBank() {
  return [
    { id: "q001", question: "...", options: [...] },
    { id: "q002", question: "...", options: [...] },
    // Ajoutez autant de questions que vous voulez
  ];
}
```

### Option 3 : Changer le Nombre de Questions Aléatoires

Actuellement configuré à **5 questions** sélectionnées. Pour modifier :

Ligne dans `loadQuestions()` :
```javascript
const selectedCount = 5; // ← Changez ce nombre
```

---

## 📈 Exemple de Flux

### Session 1
1. Professeur crée salle
2. Étudiant 1 rejoint → **Reçoit questions 3, 5, 8, 12, 14** (aléatoire)
3. Étudiant 2 rejoint → **Reçoit questions 1, 6, 9, 11, 15** (aléatoire différent)
4. Firebase enregistre l'ordre exact pour chaque participant

### Session 2 (même jour)
- Même banque de questions
- Ordre aléatoire **différent** pour chaque nouveau participant
- ✅ Rigueur scientifique maintenue

---

## 🔍 Vérification dans la Console

Lors du chargement du questionnaire, vous verrez :

```
[Firebase][JOIN][SUCCESS] ✅ Banque Firebase chargée: 15 questions disponibles
[Firebase][JOIN][SUCCESS] ✅ 5 questions sélectionnées aléatoirement sur 15
[AUDIT] [RIGUEUR SCIENTIFIQUE] Session TEST123_1715248321000 - Questions: q003, q008, q012, q001, q009
```

---

## 📋 Dépannage

### Problème : Toujours les mêmes questions ?
→ Rechargez la page (le cache peut persister)
→ Vérifiez que `shuffleArray()` est appelée (console devrait le montrer)

### Problème : Questions manquantes ?
→ Vérifiez que la banque Firebase a bien le format `/questionsBank`
→ Laissez vide pour utiliser la banque par défaut

### Problème : Ordre non enregistré ?
→ Attendez la réponse du questionnaire
→ Vérifiez Firebase pour voir `questionsUsed` dans les données

---

## 📚 Références Scientifiques

Cette approche suit les recommandations pour :
- **Mesure d'engagement** : Baker et al. (2010)
- **Questionnaires auto-rapportés** : Lichtenfeld et al. (2012)
- **Sélection aléatoire** : Évite les biais de position
- **Traçabilité** : Conformité audit scientifique

---

**Développé pour l'Université Paris Cité — Mai 2026**
