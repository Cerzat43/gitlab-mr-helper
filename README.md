# GitLab MR Helper

Userscript Tampermonkey qui améliore les listes de merge requests sur gitlab.com :

- met en avant les MRs où vous êtes reviewer sans avoir encore approuvé ;
- met en retrait vos propres MRs ;
- permet de marquer manuellement chaque MR comme « vue » (grisée), avec persistance ;
- fournit un bouton pour réinitialiser toutes les MRs vues.

Aucun appel API, aucun token : tout se base sur le contenu de la page.

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
