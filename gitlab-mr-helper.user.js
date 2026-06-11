// ==UserScript==
// @name         GitLab MR Helper
// @namespace    https://github.com/Cerzat43/gitlab-mr-helper
// @version      0.1.0
// @description  Met en avant les MRs à reviewer, met en retrait les vôtres, et permet de marquer les MRs comme vues.
// @author       Cerzat43
// @homepageURL  https://github.com/Cerzat43/gitlab-mr-helper
// @supportURL   https://github.com/Cerzat43/gitlab-mr-helper/issues
// @downloadURL  https://raw.githubusercontent.com/Cerzat43/gitlab-mr-helper/main/gitlab-mr-helper.user.js
// @updateURL    https://raw.githubusercontent.com/Cerzat43/gitlab-mr-helper/main/gitlab-mr-helper.user.js
// @match        https://gitlab.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// ==/UserScript==

'use strict';

/* ------------------------------------------------------------------ *
 * Couche logique pure (testable sans navigateur)
 * ------------------------------------------------------------------ */

// Vrai uniquement sur les listes de MRs (projet, groupe, dashboard),
// jamais sur une page de détail de MR.
function isMrListUrl(pathname) {
  return /\/-\/merge_requests\/?$/.test(pathname)
    || /^\/dashboard\/merge_requests\/?$/.test(pathname);
}

// Extrait le premier segment de chemin d'un href (= username GitLab).
// Renvoie null si l'href est vide ou null.
function usernameFromHref(href) {
  if (!href) return null;
  const match = href.match(/^\/?([^/?#]+)/);
  return match ? match[1] : null;
}

// Détermine l'état visuel d'une MR. Priorité : seen > review > mine > neutral.
// - mr        : { key, author, reviewers: [{ username, approved }] }
// - currentUser : username de l'utilisateur courant, ou null si inconnu
// - seenMap   : objet { cléMR: timestamp }
function classifyMr(mr, currentUser, seenMap) {
  if (mr.key && seenMap && seenMap[mr.key]) return 'seen';
  if (currentUser) {
    const mine = mr.reviewers.find((r) => r.username === currentUser);
    if (mine && !mine.approved) return 'review';
    if (mr.author === currentUser) return 'mine';
  }
  return 'neutral';
}

// Crée un store des MRs vues au-dessus d'un adaptateur de stockage.
// storage : { get(key, default), set(key, value) }
function createSeenStore(storage) {
  const STORAGE_KEY = 'seenMrs';
  const load = () => storage.get(STORAGE_KEY, {}) || {};
  const save = (map) => storage.set(STORAGE_KEY, map);
  return {
    all: () => load(),
    isSeen: (mrKey) => Boolean(load()[mrKey]),
    count: () => Object.keys(load()).length,
    markSeen: (mrKey, now) => { const m = load(); m[mrKey] = now; save(m); },
    unmarkSeen: (mrKey) => { const m = load(); delete m[mrKey]; save(m); },
    toggle: (mrKey, now) => {
      const m = load();
      let nowSeen;
      if (m[mrKey]) { delete m[mrKey]; nowSeen = false; }
      else { m[mrKey] = now; nowSeen = true; }
      save(m);
      return nowSeen;
    },
    clear: () => save({}),
  };
}

/* ------------------------------------------------------------------ *
 * Export pour les tests Node (ignoré par Tampermonkey)
 * ------------------------------------------------------------------ */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { isMrListUrl, usernameFromHref, classifyMr, createSeenStore };
}
