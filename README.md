# GitLab MR Helper

Userscript Tampermonkey qui améliore les listes de merge requests sur gitlab.com :

- permet de marquer manuellement chaque MR comme « vue » (grisée), avec persistance ;
- **remet en avant (ambre) les MRs qui ont eu une activité depuis votre dernière vue** —
  votre signal « action à réaliser » ;
- **met en avant (vert) les MRs prêtes à merger** (approuvées et sans label bloquant
  `Status::*` ni `Don't merge`) ;
- met en retrait vos propres MRs (avec un repère visuel distinct) ;
- grise d'office les MRs « parquées » (label `Don't merge` ou `Status::Work In Progress`) ;
- **trie la liste par état** (tri par défaut, ajouté au menu de tri natif) ;
- **filtre la liste par état** via des boutons colorés avec compteur, à droite des onglets ;
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

Les marques « vue » expirent au bout de **90 jours** (purge du seul stockage
local — le script ne supprime, ne masque ni ne déplace jamais une MR). Une MR
encore ouverte dont la marque a expiré **perd simplement son grisé** et
redevient une ligne normale.

Chaque ligne reçoit un état visuel (par ordre de priorité) :

| État | Condition | Rendu |
|------|-----------|-------|
| **Prête à merger** | approuvée **et** sans label bloquant (`Status::*`, `Don't merge`) | bordure + fond **verts** |
| **Changée** | marquée vue **mais** activité depuis (date de MAJ différente) | bordure + fond **ambre** |
| **Vue** | marquée vue, pas d'activité depuis — **ou** label `Don't merge` / `Status::Work In Progress` | ligne **grisée** |
| **Ma MR** | vous en êtes l'auteur | en retrait + accent pointillé |
| Neutre | aucun des cas ci-dessus | inchangé |

Une MR parquée (`Don't merge`, `Status::Work In Progress`) est grisée sans
marquage, même si elle a bougé ; elle n'a pas de bouton œil.

### Tri par état

Le menu de tri natif gagne une option **« État (MR Helper) »**, active par
défaut : prête à merger → changée → neutre → mes MRs → vue, puis par date de
création (la plus récente d'abord) au sein d'un même état. Choisir une option native la désactive ;
elle reste désactivée tant que l'URL porte un `?sort=…`. Le tri ne porte que
sur la page affichée.

### Filtres par état

À droite des onglets Ouvert / Fusionnées / Fermé / Tous, cinq boutons aux
couleurs des états — **Prêtes à merger, Changées, À review, Mes MRs, En attente** —
affichent le nombre de MRs de la page dans chaque état. Un clic n'affiche que
cet état ; un re-clic réaffiche tout. Le filtre ne porte que sur la page
affichée et n'est pas conservé au rechargement.

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
