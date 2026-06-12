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
