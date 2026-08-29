import { writable, get } from 'svelte/store';
import { 
  INITIAL_PLAN_COMPTABLE,
  INITIAL_RULES_LYON,
  INITIAL_MEMBERS_LYON,
  INITIAL_PRODUCTS_LYON,
  INITIAL_DONORS_LYON,
  INITIAL_BILLS_LYON
} from './data-sample.js';

// Visual states
export const activeView = writable('dashboard');
export const toastMessage = writable('');
export const activeTxId = writable(null); // Active transaction in categorization panel
export const showCreateEntityModal = writable(false);

// Entities (Multi-structure)
const savedEntities = localStorage.getItem('saas_compta_entities');
export const entities = writable(savedEntities ? JSON.parse(savedEntities) : [
  { id: 'entity-lyon', name: 'Club de Musique de Lyon', model: 'all' }
]);

const savedActiveEntityId = localStorage.getItem('saas_compta_active_entity_id');
export const activeEntityId = writable(savedActiveEntityId || 'entity-lyon');

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
  if (!entityId) return;

  const m = localStorage.getItem(`saas_compta_closing_month_${entityId}`);
  closingMonth.set(m ? parseInt(m) : 9);

  const p = localStorage.getItem(`saas_compta_plan_${entityId}`);
  planComptable.set(p ? JSON.parse(p) : [...INITIAL_PLAN_COMPTABLE]);

  const r = localStorage.getItem(`saas_compta_rules_${entityId}`);
  if (r) {
    rules.set(JSON.parse(r));
  } else {
    rules.set(entityId === 'entity-lyon' ? [...INITIAL_RULES_LYON] : []);
  }

  const mem = localStorage.getItem(`saas_compta_members_${entityId}`);
  if (mem) {
    members.set(JSON.parse(mem));
  } else {
    members.set(entityId === 'entity-lyon' ? [...INITIAL_MEMBERS_LYON] : []);
  }

  const prod = localStorage.getItem(`saas_compta_products_${entityId}`);
  if (prod) {
    products.set(JSON.parse(prod));
  } else {
    products.set(entityId === 'entity-lyon' ? [...INITIAL_PRODUCTS_LYON] : []);
  }

  const don = localStorage.getItem(`saas_compta_donors_${entityId}`);
  if (don) {
    donors.set(JSON.parse(don));
  } else {
    donors.set(entityId === 'entity-lyon' ? [...INITIAL_DONORS_LYON] : []);
  }

  const b = localStorage.getItem(`saas_compta_bills_${entityId}`);
  if (b) {
    bills.set(JSON.parse(b));
  } else {
    bills.set(entityId === 'entity-lyon' ? [...INITIAL_BILLS_LYON] : []);
  }

  const tx = localStorage.getItem(`saas_compta_transactions_${entityId}`);
  transactions.set(tx ? JSON.parse(tx) : []);
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
  localStorage.setItem(`saas_compta_transactions_${get(activeEntityId)}`, JSON.stringify(val));
}

export function updateClosingMonth(val) {
  closingMonth.set(val);
  localStorage.setItem(`saas_compta_closing_month_${get(activeEntityId)}`, String(val));
}

export function updatePlanComptable(val) {
  planComptable.set(val);
  localStorage.setItem(`saas_compta_plan_${get(activeEntityId)}`, JSON.stringify(val));
}

export function updateRules(val) {
  rules.set(val);
  localStorage.setItem(`saas_compta_rules_${get(activeEntityId)}`, JSON.stringify(val));
}

export function updateMembers(val) {
  members.set(val);
  localStorage.setItem(`saas_compta_members_${get(activeEntityId)}`, JSON.stringify(val));
}

export function updateProducts(val) {
  products.set(val);
  localStorage.setItem(`saas_compta_products_${get(activeEntityId)}`, JSON.stringify(val));
}

export function updateDonors(val) {
  donors.set(val);
  localStorage.setItem(`saas_compta_donors_${get(activeEntityId)}`, JSON.stringify(val));
}

export function updateBills(val) {
  bills.set(val);
  localStorage.setItem(`saas_compta_bills_${get(activeEntityId)}`, JSON.stringify(val));
}

// Toast notification helper
let toastTimeout;
export function showToast(message) {
  toastMessage.set(message);
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastMessage.set('');
  }, 4000);
}
