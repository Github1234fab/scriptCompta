import { db } from './firebase.js';
import { doc, getDoc, setDoc } from 'firebase/firestore';

/**
 * Nettoie une chaîne SIRET / SIREN / RNA (supprime espaces, points, tirets)
 * @param {string} val
 * @returns {string}
 */
export function cleanSiret(val) {
  if (!val) return '';
  return val.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

/**
 * Formate un SIRET à la saisie : "123 456 789 00012"
 * @param {string} val
 * @returns {string}
 */
export function formatSiretDisplay(val) {
  const cleaned = cleanSiret(val);
  // Si c'est un numéro RNA (commence par W)
  if (cleaned.startsWith('W')) {
    return cleaned.slice(0, 10);
  }
  // SIRET 14 chiffres groupés : 3 - 3 - 3 - 5
  const parts = [];
  if (cleaned.length > 0) parts.push(cleaned.slice(0, 3));
  if (cleaned.length > 3) parts.push(cleaned.slice(3, 6));
  if (cleaned.length > 6) parts.push(cleaned.slice(6, 9));
  if (cleaned.length > 9) parts.push(cleaned.slice(9, 14));
  return parts.join(' ');
}

/**
 * Vérifie la clé de contrôle de l'algorithme de Luhn officiel INSEE pour un SIRET (14 chiffres)
 * Prend en compte l'exception historique des établissements de La Poste.
 * @param {string} siret
 * @returns {boolean}
 */
export function validateLuhnSiret(siret) {
  const s = cleanSiret(siret);
  if (!/^\d{14}$/.test(s)) return false;

  // Exception officielle La Poste : la somme de tous les chiffres doit être un multiple de 5
  if (s.startsWith('356000000')) {
    let sumPoste = 0;
    for (let i = 0; i < 14; i++) {
      sumPoste += parseInt(s.charAt(i), 10);
    }
    return sumPoste % 5 === 0;
  }

  // Algorithme standard de Luhn (poids alternés 2, 1 de gauche à droite sur 14 positions)
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let digit = parseInt(s.charAt(i), 10);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/**
 * Vérifie si la chaîne ressemble à un numéro RNA valide (W suivi de 9 chiffres)
 * @param {string} val
 * @returns {boolean}
 */
export function isRnaFormat(val) {
  const s = cleanSiret(val);
  return /^W\d{9}$/.test(s);
}

/**
 * Interroge l'API officielle publique Recherche d'entreprises du gouvernement français
 * (DINUM / INSEE / RNE / RNA - gratuit, sans token requis)
 * @param {string} siretOrRna
 * @returns {Promise<{ valid: boolean, error?: string, company?: any }>}
 */
export async function verifySiretApi(siretOrRna) {
  const clean = cleanSiret(siretOrRna);

  if (!clean) {
    return { valid: false, error: 'Numéro requis.' };
  }

  // Si c'est un numéro chiffré mais de longueur invalide
  if (/^\d+$/.test(clean) && clean.length !== 14 && clean.length !== 9) {
    return { valid: false, error: `Un SIRET doit comporter 14 chiffres (ou 9 chiffres pour un SIREN). Actuellement : ${clean.length}.` };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const url = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(clean)}&per_page=1`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      // Si l'API est temporairement indisponible, on accepte le SIRET si Luhn est valide
      if (validateLuhnSiret(clean)) {
        return { 
          valid: true, 
          company: { nom_complet: '', siret: clean, siren: clean.slice(0, 9), offlineValidated: true } 
        };
      }
      return { valid: false, error: "Impossible de joindre le répertoire officiel pour l'instant." };
    }

    const data = await res.json();
    if (!data?.results || data.results.length === 0) {
      return { 
        valid: false, 
        error: "Numéro introuvable au répertoire officiel national (INSEE / SIRENE / RNA). Vérifiez votre saisie." 
      };
    }

    const match = data.results[0];
    const siege = match.siege || {};
    const adresse = [siege.adresse, siege.code_postal, siege.commune].filter(Boolean).join(' ');

    return {
      valid: true,
      company: {
        nom_complet: match.nom_complet || match.nom_raison_sociale || '',
        siren: match.siren || clean.slice(0, 9),
        siret: siege.siret || clean,
        adresse: adresse,
        commune: siege.commune || '',
        code_postal: siege.code_postal || '',
        nature_juridique: match.nature_juridique || '',
        activite: match.activite_principale || '',
        etat: siege.etat_administratif || match.etat_administratif || 'A'
      }
    };
  } catch (err) {
    console.warn("Notice: API Recherche d'entreprises gouv indisponible ou réseau local:", err);
    // Fallback : si la validation locale Luhn est OK, on tolère
    if (validateLuhnSiret(clean) || isRnaFormat(clean)) {
      return {
        valid: true,
        company: { nom_complet: '', siret: clean, siren: clean.slice(0, 9), offlineValidated: true }
      };
    }
    return {
      valid: false,
      error: "Vérification en ligne impossible et format invalide."
    };
  }
}

/**
 * Contrôle anti-abus : vérifie dans Firestore si ce SIRET a déjà bénéficié d'un essai gratuit
 * @param {string} siret
 * @param {string} currentUid
 * @param {boolean} isPremiumUser
 * @returns {Promise<{ allowed: boolean, reason?: string }>}
 */
export async function checkSiretTrialAvailability(siret, currentUid, isPremiumUser = false) {
  if (!siret) return { allowed: true };
  if (isPremiumUser) return { allowed: true }; // Les abonnés payants ont droit à la gestion multi-structures

  const clean = cleanSiret(siret);
  if (!clean) return { allowed: true };

  try {
    const siretRef = doc(db, 'registered_sirets', clean);
    const snap = await getDoc(siretRef);

    if (snap.exists()) {
      const data = snap.data();
      // Si c'est le même utilisateur UID, on le laisse continuer sur sa propre structure
      if (data.firstUsedBy === currentUid) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: "Ce numéro SIRET a déjà bénéficié d'un essai gratuit sous un autre compte. Pour continuer à l'utiliser, connectez-vous avec le compte d'origine ou passez à la formule Illimitée."
      };
    }

    return { allowed: true };
  } catch (err) {
    console.warn("Notice: checkSiretTrialAvailability Firestore offline:", err);
    return { allowed: true };
  }
}

/**
 * Enregistre l'attribution d'un SIRET dans l'index Firestore de contrôle d'unicité
 * @param {string} siret
 * @param {string} uid
 * @param {Record<string, any>} [entityInfo]
 */
export async function registerSiretUsage(siret, uid, entityInfo = {}) {
  const clean = cleanSiret(siret);
  if (!clean || !uid) return;

  try {
    const siretRef = doc(db, 'registered_sirets', clean);
    const snap = await getDoc(siretRef);
    if (!snap.exists()) {
      await setDoc(siretRef, {
        siret: clean,
        firstUsedBy: uid,
        firstUsedAt: new Date().toISOString(),
        entityName: entityInfo.name || '',
        model: entityInfo.model || '',
        updatedAt: new Date().toISOString()
      });
    }
  } catch (err) {
    console.warn("Notice: registerSiretUsage Firestore offline:", err);
  }
}

