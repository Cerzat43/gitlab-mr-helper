# GitLab MR Helper

Userscript Tampermonkey qui améliore les listes de merge requests sur gitlab.com :

- permet de marquer manuellement chaque MR comme « vue » (grisée), avec persistance ;
- **remet en avant (ambre) les MRs qui ont eu une activité depuis votre dernière vue** —
  votre signal « action à réaliser » ;
- **met en avant (vert) les MRs prêtes à merger** (approuvées et sans label bloquant
  `Status::*` ni `Don't merge`) ;
- met en retrait vos propres MRs (avec un repère visuel distinct) ;
- fournit un bouton pour réinitialiser toutes les MRs vues.

Aucun appel API, aucun token : tout se base sur le contenu de la page. Le suivi
« activité » repose sur la date de dernière mise à jour affichée dans la liste.

Dépôt : <https://github.com/Cerzat43/gitlab-mr-helper>

## Fonctionnement

Un bouton œil (👁) est ajouté à chaque ligne de MR (sauf les vôtres et les MRs
prêtes à merger, qui se mergent au lieu de se « voir »). Cliquer
marque la MR comme « vue » et **mémorise sa date de dernière activité**. Le
re-clic annule ; si la MR a bougé entre-temps, le clic ré-acquitte avec la
nouvelle date. Une barre au-dessus de la liste affiche le nombre de MRs vues et
un bouton **« Réinitialiser les vues »**.

Chaque ligne reçoit un état visuel (par ordre de priorité) :

| État | Condition | Rendu |
|------|-----------|-------|
| **Prête à merger** | approuvée **et** sans label bloquant (`Status::*`, `Don't merge`) | bordure + fond **verts** |
| **Changée** | marquée vue **mais** activité depuis (date de MAJ différente) | bordure + fond **ambre** |
| **Vue** | marquée vue, pas d'activité depuis | ligne **grisée** |
| **Ma MR** | vous en êtes l'auteur | en retrait + accent pointillé |
| Neutre | aucun des cas ci-dessus | inchangé |

« Approuvée » inclut le cas où **vous** avez approuvé. La liste des labels
bloquants est centralisée dans la fonction `isBlockingLabel` du script.

## Installation

1. Installer l'extension Tampermonkey dans votre navigateur.
2. Installer le script en ouvrant le fichier brut, ce qui déclenche Tampermonkey :
   <https://raw.githubusercontent.com/Cerzat43/gitlab-mr-helper/main/gitlab-mr-helper.user.js>
   (à défaut, copier le contenu de `gitlab-mr-helper.user.js` dans un nouveau script).
3. Naviguer vers une liste de merge requests sur gitlab.com.

Les en-têtes `@downloadURL`/`@updateURL` pointent sur ce fichier : Tampermonkey
vérifie alors automatiquement les mises à jour publiées sur la branche `main`.

## Développement

Lancer les tests de la couche logique :

```bash
npm test
```
