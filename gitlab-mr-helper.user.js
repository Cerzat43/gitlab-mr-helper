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
// Accepte un chemin relatif (/alice) ou une URL absolue (https://gitlab.com/alice).
// Renvoie null si l'href est vide ou null.
function usernameFromHref(href) {
  if (!href) return null;
  let path = href;
  try { path = new URL(href).pathname; } catch (e) { /* chemin relatif : on garde href tel quel */ }
  const match = path.match(/^\/?([^/?#]+)/);
  return match ? match[1] : null;
}

// Détermine l'état visuel d'une MR. Priorité : seen > review > mine > neutral.
// - mr        : { key, author, reviewers: [{ username, approved }] }
// - currentUser : username de l'utilisateur courant, ou null si inconnu
// - seenMap   : objet { cléMR: timestamp }
function classifyMr(mr, currentUser, seenMap) {
  if (mr.key && seenMap && mr.key in seenMap) return 'seen';
  if (currentUser) {
    const mine = (mr.reviewers || []).find((r) => r.username === currentUser);
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
 * Couche navigateur (vérifiée manuellement sur gitlab.com)
 * ------------------------------------------------------------------ */

// Adaptateur branchant le store sur le stockage Tampermonkey.
const gmStorage = {
  get: (key, def) => GM_getValue(key, def),
  set: (key, value) => GM_setValue(key, value),
};

// Détecte le username de l'utilisateur connecté.
// 1) objet gon injecté par GitLab ; 2) fallback sur le menu utilisateur ;
// 3) null si rien n'est trouvé (les états mine/review sont alors désactivés).
function detectCurrentUser() {
  try {
    const g = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window).gon;
    if (g && g.current_username) return g.current_username;
  } catch (e) { /* gon inaccessible : on tente le fallback */ }

  const menu = document.querySelector(
    '[data-testid="user-menu-toggle"], .header-user-dropdown-toggle'
  );
  if (menu) {
    const href = menu.getAttribute('href')
      || (menu.querySelector('a') && menu.querySelector('a').getAttribute('href'));
    const fromHref = usernameFromHref(href);
    if (fromHref) return fromHref;
  }
  return null;
}

// Sélecteurs dépendant du markup GitLab, centralisés pour faciliter
// les mises à jour. À vérifier contre le DOM réel (cf. README/plan).
const SELECTORS = {
  listContainer: 'ul.mr-list, ul.issuable-list, [data-testid="issuable-list"]',
  row: 'li.merge-request, li.issuable-row, [data-testid="issuable-item"]',
  titleLink: '[data-testid="issuable-title-link"], .merge-request-title-text a, a.title',
  authorLink: '[data-testid="issuable-author"], .author-link, .issuable-authored a',
  reviewerLink: '[data-testid="reviewer-avatar-link"], .issuable-reviewers a.author-link',
  // Indicateur « a approuvé » porté par/à proximité de l'avatar reviewer.
  approvedMarker: '[data-testid="approval-solid-icon"], .gl-text-green-500, .ci-status-icon-success',
};

// Extrait les données d'une ligne de MR. Renvoie null si le markup est
// inattendu (la ligne sera alors ignorée sans casser les autres).
function parseRow(row) {
  const titleLink = row.querySelector(SELECTORS.titleLink);
  if (!titleLink || !titleLink.getAttribute('href')) return null;

  const key = new URL(titleLink.href, location.origin).pathname;

  const authorLink = row.querySelector(SELECTORS.authorLink);
  const author = authorLink ? usernameFromHref(authorLink.getAttribute('href')) : null;

  const reviewers = Array.from(row.querySelectorAll(SELECTORS.reviewerLink)).map((el) => ({
    username: usernameFromHref(el.getAttribute('href')),
    approved: Boolean(
      el.querySelector(SELECTORS.approvedMarker)
      || (el.parentElement && el.parentElement.querySelector(SELECTORS.approvedMarker))
    ),
  }));

  return { key, author, reviewers };
}

/* ------------------------------------------------------------------ *
 * Export pour les tests Node (ignoré par Tampermonkey)
 * ------------------------------------------------------------------ */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { isMrListUrl, usernameFromHref, classifyMr, createSeenStore };
}
