import { writable, get, derived } from 'svelte/store';
import { auth } from './firebase.js';
import { 
  saveTransactions, 
  saveStructureKey, 
  saveEntityData,
  ADMIN_EMAILS,
  isUserAdmin
} from './firestoreService.js';
import { 
  INITIAL_PLAN_COMPTABLE,
  INITIAL_RULES_LYON,
  INITIAL_MEMBERS_LYON,
  INITIAL_PRODUCTS_LYON,
  INITIAL_DONORS_LYON,
  INITIAL_BILLS_LYON
} from './data-sample.js';

// Quota Freemium
export const FREE_TIER_MAX_TRANSACTIONS = 60;

// User Profile (Plan, Subscription, Role, etc.)
export const userProfile = writable({
  plan: 'free', // 'free' | 'premium'
  role: 'user', // 'user' | 'admin'
  subscriptionStatus: 'inactive',
  structuresCount: 0
});

export const isAdmin = derived(userProfile, ($p) => {
  if ($p?.role === 'admin') return true;
  if ($p?.email && isUserAdmin($p.email)) return true;
  return false;
});

export const isPremium = derived([userProfile, isAdmin], ([$p, $admin]) => {
  if ($admin) return true;
  return $p?.plan === 'premium';
});

export const showUpgradeModal = writable(false);

// Visual states
export const activeView = writable('dashboard');
export const toastMessage = writable('');
export const activeTxId = writable(null); // Active transaction in categorization panel

// Helper sécurisé pour la lecture LocalStorage
export function safeGetJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw || raw === 'undefined' || raw === 'null') return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch (err) {
    console.warn(`Erreur lecture LocalStorage pour "${key}":`, err);
    return fallback;
  }
}

/**
 * Nettoie et sécurise les transactions pour éliminer toute corruption d'importation
 * (ex: date de carte bancaire '040926' ou '110926' parsée en crédit, ou débits/crédits simultanés).
 */
export function sanitizeTransactions(txList) {
  if (!Array.isArray(txList)) return [];
  return txList.map(t => {
    let debit = typeof t.debit === 'number' ? t.debit : (parseFloat(t.debit) || 0);
    let credit = typeof t.credit === 'number' ? t.credit : (parseFloat(t.credit) || 0);

    // Règle 1 : En comptabilité bancaire, une ligne est soit un débit soit un crédit, JAMAIS les deux.
    if (debit > 0 && credit > 0) {
      // Si le crédit correspond à une date de carte (ex: 40926, 90926, 110926), l'annuler
      if (credit >= 10000) {
        credit = 0;
      } else {
        // En cas de conflit, annuler le crédit pour préserver le débit réel du paiement
        credit = 0;
      }
    }

    // Règle 2 : Détection des fausses recettes astronomiques provenant d'informations complémentaires CB (ex: Spotify, Amazon, Thomann, Super U...)
    if (credit >= 10000) {
      const fullTxt = `${t.libelle || ''} ${t.rawLibelle || ''} ${t.info || ''} ${t.reference || ''}`.toUpperCase();
      const isCardOrExpense = fullTxt.includes('CB') || fullTxt.includes('SPOTIFY') || fullTxt.includes('AMAZON') ||
                              fullTxt.includes('THOMANN') || fullTxt.includes('SUPER U') || fullTxt.includes('PRLV') ||
                              fullTxt.includes('FRAIS') || fullTxt.includes('ORANGE') || fullTxt.includes('RETRAIT');
      if (isCardOrExpense) {
        // Si aucun débit n'était renseigné, tenter de récupérer le montant depuis l'info "9049-98,00EUR"
        if (debit === 0) {
          const matchAmount = fullTxt.match(/[-](\d+[,\.]\d{2})EUR/);
          if (matchAmount) {
            debit = parseFloat(matchAmount[1].replace(',', '.'));
          }
        }
        credit = 0;
      }
    }

    if (debit !== t.debit || credit !== t.credit) {
      return { ...t, debit, credit };
    }
    return t;
  });
}

// Entities (Multi-structure)
const DEFAULT_ENTITIES = [];

const savedEntities = safeGetJson('saas_compta_entities', null);
export const showCreateEntityModal = writable(false);
const parsedEntities = (Array.isArray(savedEntities) && savedEntities.length > 0) 
  ? savedEntities 
  : DEFAULT_ENTITIES;
export const entities = writable(parsedEntities);

const savedActiveEntityId = localStorage.getItem('saas_compta_active_entity_id');
export const activeEntityId = writable((savedActiveEntityId && savedActiveEntityId !== 'undefined') ? savedActiveEntityId : (parsedEntities[0]?.id || ''));

/** @type {Record<string, any>} */
export const MANAGEMENT_MODELS = {
  micro: {
    id: 'micro',
    title: 'Micro-entreprise',
    badge: 'Auto-entrepreneur',
    icon: 'fa-user-tie',
    accentColor: '#10b981',
    accentBg: 'rgba(16, 185, 129, 0.12)',
    desc: 'Livre des recettes, registre des achats, jauge franchise TVA (293B) & Urssaf.',
    activityMenu: { label: 'Facturation & Recettes', icon: 'fa-file-invoice-dollar' },
    booksMenu: { label: 'Obligation', icon: 'fa-scale-balanced' },
    dashboardTitle: 'Accueil · Micro-entreprise',
    legalBadge: 'Régime Micro-fiscal (Comptabilité allégée)',
    onboardingTitle: "Nom de l'exploitant / Nom commercial",
    onboardingSubtitle: "En auto-entreprise, les factures portent votre Nom Prénom. Vous pouvez aussi préciser votre nom commercial.",
    onboardingLabel: "Nom et prénom (nom commercial optionnel)",
    onboardingPlaceholder: "ex: Thomas Martin (TM Digital Services)"
  },
  tpe: {
    id: 'tpe',
    title: 'Société / TPE',
    badge: 'SASU, EURL, SARL, SAS',
    icon: 'fa-building',
    accentColor: '#38bdf8',
    accentBg: 'rgba(56, 189, 248, 0.12)',
    desc: 'Comptabilité d’engagement, Livre-journal, Grand-livre, TVA CA3/CA12 & export FEC.',
    activityMenu: { label: 'Facturation & Pilotage', icon: 'fa-briefcase' },
    booksMenu: { label: 'Obligation', icon: 'fa-scale-balanced' },
    dashboardTitle: 'Accueil · Société / TPE',
    legalBadge: "Comptabilité d'engagement",
    onboardingTitle: "Raison sociale de la société",
    onboardingSubtitle: "Dénomination officielle figurant sur votre extrait Kbis et vos statuts.",
    onboardingLabel: "Raison sociale (Nom officiel de la société)",
    onboardingPlaceholder: "ex: Horizon Conseil SASU, Atelier Design EURL..."
  },
  asso: {
    id: 'asso',
    title: 'Association Loi 1901',
    badge: 'Club / Assos',
    icon: 'fa-users',
    accentColor: '#c084fc',
    accentBg: 'rgba(192, 132, 252, 0.12)',
    desc: 'Cotisations adhérents, subventions CERFA 15059, reçus fiscaux dons CERFA 11580.',
    activityMenu: { label: 'Adhérents, Dons & Ventes', icon: 'fa-user-group' },
    booksMenu: { label: 'Obligation', icon: 'fa-scale-balanced' },
    dashboardTitle: 'Accueil · Association',
    legalBadge: 'Association Loi 1901',
    onboardingTitle: "Nom de l'association",
    onboardingSubtitle: "Nom officiel figurant sur le journal officiel (JOAFE) et les statuts déposés en préfecture.",
    onboardingLabel: "Nom complet de l'association",
    onboardingPlaceholder: "ex: Club Sportif & Culturel Lyon Sud, Les Amis du Patrimoine..."
  },
  bnc: {
    id: 'bnc',
    title: 'Profession Libérale',
    badge: 'Déclaration 2035 BNC',
    icon: 'fa-scale-balanced',
    accentColor: '#f59e0b',
    accentBg: 'rgba(245, 158, 11, 0.12)',
    desc: 'Livre-journal BNC, barème kilométrique, amortissements & préparation liasse 2035.',
    activityMenu: { label: 'Activité BNC & Frais', icon: 'fa-scale-balanced' },
    booksMenu: { label: 'Obligation', icon: 'fa-scale-balanced' },
    dashboardTitle: 'Accueil · Profession Libérale',
    legalBadge: 'Régime BNC (Déclaration 2035)',
    onboardingTitle: "Nom du cabinet et du praticien",
    onboardingSubtitle: "Réglementation BNC (avocats, médecins, consultants, architectes).",
    onboardingLabel: "Nom du cabinet et de la profession exercée",
    onboardingPlaceholder: "ex: Cabinet Dr Martin, Maître Dubois Avocat, Julie Renard Kiné..."
  },
  sci: {
    id: 'sci',
    title: 'SCI Familiale',
    badge: 'Impôt sur le Revenu (IR)',
    icon: 'fa-house-chimney',
    accentColor: '#ec4899',
    accentBg: 'rgba(236, 72, 153, 0.12)',
    desc: 'Gestion des loyers, quittances 1-clic, apports CCA & préparation déclaration 2072.',
    activityMenu: { label: 'Gestion Locative SCI', icon: 'fa-house' },
    booksMenu: { label: 'Obligation', icon: 'fa-scale-balanced' },
    dashboardTitle: 'Accueil · SCI Familiale',
    legalBadge: 'Régime des Sociétés de Personnes (2072)',
    onboardingTitle: "Dénomination de la SCI",
    onboardingSubtitle: "Nom figurant sur le Kbis de la Société Civile Immobilière et le bail locatif.",
    onboardingLabel: "Nom de la SCI",
    onboardingPlaceholder: "ex: SCI Les Marronniers, SCI Horizon Immobilier..."
  },
  copro: {
    id: 'copro',
    title: 'Copropriété Bénévole',
    badge: 'Syndic Coopératif',
    icon: 'fa-landmark',
    accentColor: '#6366f1',
    accentBg: 'rgba(99, 102, 241, 0.12)',
    desc: 'Lots & tantièmes, appels de fonds trimestriels, fonds travaux ALUR & régul annuelle.',
    activityMenu: { label: 'Lots & Copropriétaires', icon: 'fa-building-user' },
    booksMenu: { label: 'Obligation', icon: 'fa-scale-balanced' },
    dashboardTitle: 'Accueil · Copropriété',
    legalBadge: 'Syndic Bénévole / Coopératif',
    onboardingTitle: "Nom de la Copropriété / Immeuble",
    onboardingSubtitle: "Nom de la résidence ou adresse de l'immeuble géré en syndic bénévole / coopératif.",
    onboardingLabel: "Désignation de la résidence ou copropriété",
    onboardingPlaceholder: "ex: Résidence Le Victor Hugo, Copropriété 12 rue de la Paix..."
  }
};

// Entity-specific states
export const transactions = writable([]);
export const closingMonth = writable(12);
export const fiscalStartDate = writable('');
export const fiscalEndDate = writable('');
export const planComptable = writable([]);
export const rules = writable([]);
export const members = writable([]);
export const products = writable([]);
export const donors = writable([]);
export const bills = writable([]);

// Variable globale pour gérer l'abonnement Firestore unique de la structure active
let currentStructureUnsub = null;

// Explicit load function
export function loadEntityData(entityId) {
  if (!entityId || entityId === 'undefined') return;

  // 0. Désabonner immédiatement l'écoute de l'ancienne structure pour éviter toute fuite ou écrasement croisé
  if (currentStructureUnsub) {
    try {
      currentStructureUnsub();
    } catch (e) {
      console.warn("Erreur désabonnement structure précédente:", e);
    }
    currentStructureUnsub = null;
  }

  // 1. Chargement instantané depuis LocalStorage (cache local strictement cloisonné par entityId)
  const m = localStorage.getItem(`saas_compta_closing_month_${entityId}`);
  closingMonth.set(m && !isNaN(parseInt(m)) ? parseInt(m) : 12);

  const fStart = localStorage.getItem(`saas_compta_fiscal_start_${entityId}`);
  const fEnd = localStorage.getItem(`saas_compta_fiscal_end_${entityId}`);
  fiscalStartDate.set(fStart || '');
  fiscalEndDate.set(fEnd || '');

  const savedPlan = safeGetJson(`saas_compta_plan_${entityId}`, null);
  const resolvedPlan = savedPlan ? [...savedPlan] : [...INITIAL_PLAN_COMPTABLE];
  if (!resolvedPlan.some(p => p.compte === '707')) {
    resolvedPlan.push({ compte: "707", libelle: "Ventes de marchandises", type: "Produit", group: "entrees", desc: "Ventes de biens et marchandises destinées à la revente." });
  }
  if (!resolvedPlan.some(p => p.compte === '455')) {
    resolvedPlan.push({ compte: "455", libelle: "Compte courant d'associé (Apport / Avance CCA)", type: "Transfert", group: "transferts", desc: "Avances de trésorerie ou apports des associés (SCI / SASU / SARL)." });
  }
  if (!resolvedPlan.some(p => p.compte === '635')) {
    resolvedPlan.push({ compte: "635", libelle: "Impôts & Taxes (Taxe foncière, CFE)", type: "Charge", group: "depenses_courantes", desc: "Taxe foncière, CFE et taxes déductibles." });
  }
  if (!resolvedPlan.some(p => p.compte === '661')) {
    resolvedPlan.push({ compte: "661", libelle: "Intérêts d'emprunt & Charges financières", type: "Charge", group: "depenses_courantes", desc: "Intérêts des crédits bancaires et emprunts immobiliers." });
  }
  const extraSubAccounts = [
    { compte: "7061", libelle: "Honoraires au temps passé (Taux horaire)", type: "Produit", group: "entrees", desc: "Facturation au temps passé selon le taux horaire." },
    { compte: "7062", libelle: "Honoraires de résultat", type: "Produit", group: "entrees", desc: "Honoraires complémentaires de résultat (success fees)." },
    { compte: "7063", libelle: "Consultations & Conseils", type: "Produit", group: "entrees", desc: "Consultations juridiques et rendez-vous conseils." },
    { compte: "7064", libelle: "Plaidoiries & Actes juridiques", type: "Produit", group: "entrees", desc: "Rédaction d'actes, assignations, plaidoiries et conclusions." },
    { compte: "708", libelle: "Frais & Débours refacturés", type: "Produit", group: "entrees", desc: "Frais de greffe, huissier ou déplacements refacturés aux clients." }
  ];
  extraSubAccounts.forEach(sub => {
    if (!resolvedPlan.some(p => p.compte === sub.compte)) {
      resolvedPlan.push(sub);
    }
  });
  const cpt706 = resolvedPlan.find(p => p.compte === '706');
  if (cpt706 && (cpt706.libelle === 'Ventes, Cours & Services' || cpt706.libelle.includes('Cours'))) {
    cpt706.libelle = 'Honoraires généraux / Forfaits';
    cpt706.desc = 'Honoraires forfaitaires, dossiers et missions principales.';
  }
  planComptable.set(resolvedPlan);
  localStorage.setItem(`saas_compta_plan_${entityId}`, JSON.stringify(resolvedPlan));

  const r = safeGetJson(`saas_compta_rules_${entityId}`, null);
  rules.set(r !== null ? r : (entityId === 'entity-lyon' ? [...INITIAL_RULES_LYON] : []));

  const mem = safeGetJson(`saas_compta_members_${entityId}`, null);
  members.set(mem !== null ? mem : (entityId === 'entity-lyon' ? [...INITIAL_MEMBERS_LYON] : []));

  const prod = safeGetJson(`saas_compta_products_${entityId}`, null);
  products.set(prod !== null ? prod : (entityId === 'entity-lyon' ? [...INITIAL_PRODUCTS_LYON] : []));

  const don = safeGetJson(`saas_compta_donors_${entityId}`, null);
  donors.set(don !== null ? don : (entityId === 'entity-lyon' ? [...INITIAL_DONORS_LYON] : []));

  const b = safeGetJson(`saas_compta_bills_${entityId}`, null);
  bills.set(b !== null ? b : (entityId === 'entity-lyon' ? [...INITIAL_BILLS_LYON] : []));

  const rawTx = safeGetJson(`saas_compta_transactions_${entityId}`, []);
  // Assainir immédiatement les écritures locales pour éliminer toute anomalie
  const sanitizedLocalTx = sanitizeTransactions(Array.isArray(rawTx) ? rawTx : []);
  const cleanTx = sanitizedLocalTx.map(t => ({ ...t, entityId }));
  transactions.set(cleanTx);

  // Si le nettoyage a corrigé des anomalies, réécrire immédiatement le cache local et Firestore
  if (JSON.stringify(cleanTx) !== JSON.stringify(rawTx)) {
    localStorage.setItem(`saas_compta_transactions_${entityId}`, JSON.stringify(cleanTx));
    const currentUid = auth.currentUser?.uid;
    if (currentUid) {
      saveTransactions(currentUid, entityId, cleanTx);
    }
  }

  // 2. Hydratation Firestore si connecté
  const uid = auth.currentUser?.uid;
  if (uid) {
    import('./firestoreService.js').then(({ listenStructureData }) => {
      // Vérifier à nouveau qu'on n'a pas basculé sur une autre entité entre-temps
      if (get(activeEntityId) !== entityId) return;

      currentStructureUnsub = listenStructureData(uid, entityId, (remoteData) => {
        if (!remoteData) return;
        // VÉRIFICATION DE SÉCURITÉ CRITIQUE : s'assurer que l'entité reçue est bien celle actuellement affichée
        if (get(activeEntityId) !== entityId) {
          console.warn(`[scriptCompta] Snapshot différé ignoré pour l'ancienne structure ${entityId}.`);
          return;
        }

        if (Array.isArray(remoteData.transactions)) {
          const sanitizedRemoteTx = sanitizeTransactions(remoteData.transactions);
          const cleanRemoteTx = sanitizedRemoteTx.map(t => ({ ...t, entityId }));
          transactions.set(cleanRemoteTx);
          localStorage.setItem(`saas_compta_transactions_${entityId}`, JSON.stringify(cleanRemoteTx));
          if (JSON.stringify(sanitizedRemoteTx) !== JSON.stringify(remoteData.transactions)) {
            saveTransactions(uid, entityId, cleanRemoteTx);
          }
        }
        if (Array.isArray(remoteData.rules)) {
          rules.set(remoteData.rules);
          localStorage.setItem(`saas_compta_rules_${entityId}`, JSON.stringify(remoteData.rules));
        }
        if (Array.isArray(remoteData.members)) {
          members.set(remoteData.members);
          localStorage.setItem(`saas_compta_members_${entityId}`, JSON.stringify(remoteData.members));
        }
        if (remoteData.closingMonth) {
          closingMonth.set(remoteData.closingMonth);
          localStorage.setItem(`saas_compta_closing_month_${entityId}`, String(remoteData.closingMonth));
        }
        if (remoteData.fiscalStartDate !== undefined) {
          fiscalStartDate.set(remoteData.fiscalStartDate || '');
          localStorage.setItem(`saas_compta_fiscal_start_${entityId}`, remoteData.fiscalStartDate || '');
        }
        if (remoteData.fiscalEndDate !== undefined) {
          fiscalEndDate.set(remoteData.fiscalEndDate || '');
          localStorage.setItem(`saas_compta_fiscal_end_${entityId}`, remoteData.fiscalEndDate || '');
        }
      });
    });
  }
}

// Trigger initial load
loadEntityData(get(activeEntityId));

// Nettoyage complet du cache LocalStorage lié à ScriptCompta
export function clearAllLocalComptaData() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('saas_compta_') || key.startsWith('sidebar_width'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (e) {
    console.warn("Erreur nettoyage LocalStorage:", e);
  }
}

// Réinitialisation de tous les stores et caches
export function resetAllStores() {
  clearAllLocalComptaData();
  if (currentStructureUnsub) {
    try {
      currentStructureUnsub();
    } catch (e) {}
    currentStructureUnsub = null;
  }
  entities.set([]);
  activeEntityId.set('');
  transactions.set([]);
  rules.set([]);
  members.set([]);
  products.set([]);
  donors.set([]);
  bills.set([]);
  closingMonth.set(9);
  fiscalStartDate.set('');
  fiscalEndDate.set('');
  userProfile.set({
    plan: 'free',
    subscriptionStatus: 'inactive',
    structuresCount: 0
  });
}

// Explicit update functions that also persist to LocalStorage
export function updateActiveEntityId(id) {
  if (!id) {
    activeEntityId.set('');
    localStorage.removeItem('saas_compta_active_entity_id');
    return;
  }
  activeEntityId.set(id);
  localStorage.setItem('saas_compta_active_entity_id', id);
  loadEntityData(id);
}

export function updateEntities(val) {
  entities.set(val);
  localStorage.setItem('saas_compta_entities', JSON.stringify(val));
}

export function updateTransactions(val) {
  const entId = get(activeEntityId);
  if (!entId) return;

  // Assainir les écritures avant persistance pour garantir l'intégrité comptable
  const sanitized = sanitizeTransactions(val);
  const taggedVal = sanitized.map(t => ({
    ...t,
    entityId: entId
  }));

  transactions.set(taggedVal);
  localStorage.setItem(`saas_compta_transactions_${entId}`, JSON.stringify(taggedVal));
  const uid = auth.currentUser?.uid;
  if (uid && entId) {
    saveTransactions(uid, entId, taggedVal);
  }
}

export function updateClosingMonth(val) {
  closingMonth.set(val);
  const entId = get(activeEntityId);
  localStorage.setItem(`saas_compta_closing_month_${entId}`, String(val));
  const uid = auth.currentUser?.uid;
  if (uid && entId) {
    saveStructureKey(uid, entId, 'closingMonth', val);
  }
}

export function updateFiscalPeriod(startVal, endVal) {
  fiscalStartDate.set(startVal || '');
  fiscalEndDate.set(endVal || '');
  const entId = get(activeEntityId);
  if (entId) {
    localStorage.setItem(`saas_compta_fiscal_start_${entId}`, startVal || '');
    localStorage.setItem(`saas_compta_fiscal_end_${entId}`, endVal || '');
    const uid = auth.currentUser?.uid;
    if (uid) {
      saveStructureKey(uid, entId, 'fiscalStartDate', startVal || '');
      saveStructureKey(uid, entId, 'fiscalEndDate', endVal || '');
    }
  }
}

export function updatePlanComptable(val) {
  planComptable.set(val);
  const entId = get(activeEntityId);
  localStorage.setItem(`saas_compta_plan_${entId}`, JSON.stringify(val));
  const uid = auth.currentUser?.uid;
  if (uid && entId) {
    saveStructureKey(uid, entId, 'planComptable', val);
  }
}

export function updateRules(val) {
  rules.set(val);
  const entId = get(activeEntityId);
  localStorage.setItem(`saas_compta_rules_${entId}`, JSON.stringify(val));
  const uid = auth.currentUser?.uid;
  if (uid && entId) {
    saveStructureKey(uid, entId, 'rules', val);
  }
}

export function updateMembers(val) {
  members.set(val);
  const entId = get(activeEntityId);
  localStorage.setItem(`saas_compta_members_${entId}`, JSON.stringify(val));
  const uid = auth.currentUser?.uid;
  if (uid && entId) {
    saveStructureKey(uid, entId, 'members', val);
  }
}

export function updateProducts(val) {
  products.set(val);
  const entId = get(activeEntityId);
  localStorage.setItem(`saas_compta_products_${entId}`, JSON.stringify(val));
  const uid = auth.currentUser?.uid;
  if (uid && entId) {
    saveStructureKey(uid, entId, 'products', val);
  }
}

export function updateDonors(val) {
  donors.set(val);
  const entId = get(activeEntityId);
  localStorage.setItem(`saas_compta_donors_${entId}`, JSON.stringify(val));
  const uid = auth.currentUser?.uid;
  if (uid && entId) {
    saveStructureKey(uid, entId, 'donors', val);
  }
}

export function updateBills(val) {
  bills.set(val);
  const entId = get(activeEntityId);
  localStorage.setItem(`saas_compta_bills_${entId}`, JSON.stringify(val));
  const uid = auth.currentUser?.uid;
  if (uid && entId) {
    saveStructureKey(uid, entId, 'bills', val);
  }
}

// Notification / Toast flottant temporaire
let toastTimer = null;
export function showToast(message) {
  toastMessage.set(message);
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastMessage.set('');
  }, 3500);
}

// Assainissement proactif au démarrage de toutes les structures stockées dans le cache
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('saas_compta_transactions_')) {
        const raw = safeGetJson(k, []);
        if (Array.isArray(raw) && raw.length > 0) {
          const sanitized = sanitizeTransactions(raw);
          if (JSON.stringify(sanitized) !== JSON.stringify(raw)) {
            localStorage.setItem(k, JSON.stringify(sanitized));
            const entId = k.replace('saas_compta_transactions_', '');
            const uid = auth.currentUser?.uid;
            if (uid && entId) {
              saveTransactions(uid, entId, sanitized);
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn("Erreur auto-nettoyage initial des écritures:", err);
  }
}
