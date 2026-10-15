import { writable, get, derived } from 'svelte/store';
import { auth } from './firebase.js';
import { saveTransactions, saveStructureKey, saveEntityData } from './firestoreService.js';
import { 
  INITIAL_PLAN_COMPTABLE,
  INITIAL_RULES_LYON,
  INITIAL_MEMBERS_LYON,
  INITIAL_PRODUCTS_LYON,
  INITIAL_DONORS_LYON,
  INITIAL_BILLS_LYON
} from './data-sample.js';

// Quota Freemium
export const FREE_TIER_MAX_TRANSACTIONS = 50;

// User Profile (Plan, Subscription, etc.)
export const userProfile = writable({
  plan: 'free', // 'free' | 'premium'
  subscriptionStatus: 'inactive',
  structuresCount: 0
});

export const isPremium = derived(userProfile, ($p) => $p?.plan === 'premium');
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

// Entities (Multi-structure)
const DEFAULT_ENTITIES = [
  { id: 'entity-lyon', name: 'Test asso', model: 'asso' }
];

const savedEntities = safeGetJson('saas_compta_entities', null);
export const showCreateEntityModal = writable(false);
const parsedEntities = (Array.isArray(savedEntities) && savedEntities.length > 0) 
  ? savedEntities 
  : DEFAULT_ENTITIES;
export const entities = writable(parsedEntities);

const savedActiveEntityId = localStorage.getItem('saas_compta_active_entity_id');
export const activeEntityId = writable((savedActiveEntityId && savedActiveEntityId !== 'undefined') ? savedActiveEntityId : parsedEntities[0].id);

/** @type {Record<string, any>} */
export const MANAGEMENT_MODELS = {
  micro: {
    id: 'micro',
    title: 'Micro-entreprise',
    badge: 'Auto-entrepreneur',
    icon: '🚀',
    accentColor: '#10b981',
    accentBg: 'rgba(16, 185, 129, 0.12)',
    desc: 'Livre des recettes, registre des achats, jauge franchise TVA (293B) & Urssaf.',
    activityMenu: { label: 'Facturation & Recettes', icon: 'fa-file-invoice-dollar' },
    booksMenu: { label: 'Registres Légaux Micro', icon: 'fa-book-journal-whills' },
    dashboardTitle: 'Tableau de bord Micro-entreprise',
    legalBadge: 'Régime Micro-fiscal (Comptabilité allégée)',
    onboardingTitle: "Nom de l'exploitant / Nom commercial",
    onboardingSubtitle: "En auto-entreprise, les factures portent votre Nom Prénom (ex: Dupont Consulting). Vous pouvez aussi préciser votre nom commercial.",
    onboardingLabel: "Nom et prénom (nom commercial optionnel)",
    onboardingPlaceholder: "ex: Thomas Martin (TM Digital Services)"
  },
  tpe: {
    id: 'tpe',
    title: 'Société / TPE',
    badge: 'SASU, EURL, SARL, SAS',
    icon: '🏢',
    accentColor: '#38bdf8',
    accentBg: 'rgba(56, 189, 248, 0.12)',
    desc: 'Comptabilité d’engagement, Livre-journal, Grand-livre, TVA CA3/CA12 & export FEC.',
    activityMenu: { label: 'Facturation & Pilotage', icon: 'fa-briefcase' },
    booksMenu: { label: 'Documents & Clôture FEC', icon: 'fa-file-invoice' },
    dashboardTitle: 'Tableau de bord Société / TPE',
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
    icon: '🤝',
    accentColor: '#c084fc',
    accentBg: 'rgba(192, 132, 252, 0.12)',
    desc: 'Cotisations adhérents, subventions CERFA 15059, reçus fiscaux dons CERFA 11580.',
    activityMenu: { label: 'Adhérents, Dons & Ventes', icon: 'fa-users-heart' },
    booksMenu: { label: 'Registres & Bilan Asso', icon: 'fa-file-contract' },
    dashboardTitle: 'Tableau de bord Association',
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
    icon: '⚖️',
    accentColor: '#f59e0b',
    accentBg: 'rgba(245, 158, 11, 0.12)',
    desc: 'Livre-journal BNC, barème kilométrique, amortissements & préparation liasse 2035.',
    activityMenu: { label: 'Activité BNC & Frais', icon: 'fa-scale-balanced' },
    booksMenu: { label: 'Registres & Déclaration 2035', icon: 'fa-file-lines' },
    dashboardTitle: 'Tableau de bord Profession Libérale',
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
    icon: '🏡',
    accentColor: '#ec4899',
    accentBg: 'rgba(236, 72, 153, 0.12)',
    desc: 'Gestion des loyers, quittances 1-clic, apports CCA & préparation déclaration 2072.',
    activityMenu: { label: 'Gestion Locative SCI', icon: 'fa-house' },
    booksMenu: { label: 'Registre SCI & 2072', icon: 'fa-building' },
    dashboardTitle: 'Tableau de bord SCI Familiale',
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
    icon: '🏛️',
    accentColor: '#6366f1',
    accentBg: 'rgba(99, 102, 241, 0.12)',
    desc: 'Lots & tantièmes, appels de fonds trimestriels, fonds travaux ALUR & régul annuelle.',
    activityMenu: { label: 'Lots & Copropriétaires', icon: 'fa-building-user' },
    booksMenu: { label: 'Grand-Livre & Annexes Copro', icon: 'fa-landmark' },
    dashboardTitle: 'Tableau de bord Copropriété',
    legalBadge: 'Syndic Bénévole / Coopératif',
    onboardingTitle: "Nom de la Copropriété / Immeuble",
    onboardingSubtitle: "Nom de la résidence ou adresse de l'immeuble géré en syndic bénévole / coopératif.",
    onboardingLabel: "Désignation de la résidence ou copropriété",
    onboardingPlaceholder: "ex: Résidence Le Victor Hugo, Copropriété 12 rue de la Paix..."
  }
};

// Entity-specific states
export const transactions = writable([]);
export const closingMonth = writable(9);
export const planComptable = writable([]);
export const rules = writable([]);
export const members = writable([]);
export const products = writable([]);
export const donors = writable([]);
export const bills = writable([]);

// Explicit load function
export function loadEntityData(entityId) {
  if (!entityId || entityId === 'undefined') return;

  // 1. Chargement instantané depuis LocalStorage (cache local)
  const m = localStorage.getItem(`saas_compta_closing_month_${entityId}`);
  closingMonth.set(m && !isNaN(parseInt(m)) ? parseInt(m) : 9);

  planComptable.set(safeGetJson(`saas_compta_plan_${entityId}`, [...INITIAL_PLAN_COMPTABLE]));

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

  transactions.set(safeGetJson(`saas_compta_transactions_${entityId}`, []));

  // 2. Hydratation Firestore si connecté
  const uid = auth.currentUser?.uid;
  if (uid) {
    import('./firestoreService.js').then(({ listenStructureData }) => {
      listenStructureData(uid, entityId, (remoteData) => {
        if (!remoteData) return;
        if (Array.isArray(remoteData.transactions)) {
          transactions.set(remoteData.transactions);
          localStorage.setItem(`saas_compta_transactions_${entityId}`, JSON.stringify(remoteData.transactions));
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
      });
    });
  }
}

// Trigger initial load
loadEntityData(get(activeEntityId));

// Explicit update functions that also persist to LocalStorage
export function updateActiveEntityId(id) {
  activeEntityId.set(id);
  localStorage.setItem('saas_compta_active_entity_id', id);
  loadEntityData(id);
}

export function updateEntities(val) {
  entities.set(val);
  localStorage.setItem('saas_compta_entities', JSON.stringify(val));
}

export function updateTransactions(val) {
  transactions.set(val);
  const entId = get(activeEntityId);
  localStorage.setItem(`saas_compta_transactions_${entId}`, JSON.stringify(val));
  const uid = auth.currentUser?.uid;
  if (uid && entId) {
    saveTransactions(uid, entId, val);
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
