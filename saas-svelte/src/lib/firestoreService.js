import { db } from './firebase.js';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  onSnapshot 
} from 'firebase/firestore';

/**
 * Charge ou initialise le profil utilisateur dans Firestore
 * @param {string} uid
 * @param {string} email
 * @param {string} [name]
 */
export async function ensureUserProfile(uid, email, name = '') {
  if (!uid) return null;
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      const initialProfile = {
        email,
        name: name || '',
        createdAt: new Date().toISOString(),
        plan: 'free', // 'free' (limité à 50 écritures) ou 'premium'
        subscriptionStatus: 'inactive',
        structuresCount: 0
      };
      await setDoc(userRef, initialProfile);
      return initialProfile;
    }
    return snap.data();
  } catch (err) {
    console.warn("Notice: ensureUserProfile offline or restricted:", err);
    return null;
  }
}

/**
 * Sauvegarder les données complètes d'une entité (structure)
 * @param {string} uid
 * @param {string} entityId
 * @param {Record<string, any>} payload
 */
export async function saveEntityData(uid, entityId, payload) {
  if (!uid || !entityId) return;
  const ref = doc(db, 'users', uid, 'structures', entityId);
  await setDoc(ref, {
    ...payload,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

/**
 * Écouter la liste des structures en temps réel
 * @param {string} uid
 * @param {(structures: any[]) => void} callback
 */
export function listenUserStructures(uid, callback) {
  if (!uid) return () => {};
  const colRef = collection(db, 'users', uid, 'structures');
  return onSnapshot(colRef, (snapshot) => {
    const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(list);
  }, (err) => {
    console.warn('Erreur écoute structures Firestore:', err);
  });
}

/**
 * Sauvegarder les transactions d'une entité dans Firestore
 * @param {string} uid
 * @param {string} entityId
 * @param {any[]} txList
 */
export async function saveTransactions(uid, entityId, txList) {
  if (!uid || !entityId) return;
  const ref = doc(db, 'users', uid, 'structures', entityId);
  await setDoc(ref, {
    transactions: txList,
    transactionsCount: txList.length,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

/**
 * Sauvegarder n'importe quelle collection clé d'une structure (members, rules, plan, etc.)
 * @param {string} uid
 * @param {string} entityId
 * @param {string} key
 * @param {any} value
 */
export async function saveStructureKey(uid, entityId, key, value) {
  if (!uid || !entityId) return;
  const ref = doc(db, 'users', uid, 'structures', entityId);
  await setDoc(ref, {
    [key]: value,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

/**
 * Écouter les données complètes d'une structure en temps réel
 * @param {string} uid
 * @param {string} entityId
 * @param {(data: any) => void} callback
 */
export function listenStructureData(uid, entityId, callback) {
  if (!uid || !entityId) return () => {};
  const ref = doc(db, 'users', uid, 'structures', entityId);
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      callback(snap.data());
    }
  }, (err) => {
    console.warn(`Erreur écoute structure ${entityId}:`, err);
  });
}

/**
 * Écouter le profil utilisateur (plan, quotas, abonnement)
 * @param {string} uid
 * @param {(profile: any) => void} callback
 */
export function listenUserProfile(uid, callback) {
  if (!uid) return () => {};
  const ref = doc(db, 'users', uid);
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      callback(snap.data());
    }
  }, (err) => {
    console.warn('Erreur écoute profil utilisateur:', err);
  });
}

/**
 * Mettre à jour le plan utilisateur (free ou premium)
 * @param {string} uid
 * @param {'free' | 'premium'} plan
 * @param {'active' | 'inactive'} [subscriptionStatus]
 */
export async function updateUserPlan(uid, plan, subscriptionStatus = 'active') {
  if (!uid) return;
  const ref = doc(db, 'users', uid);
  await setDoc(ref, {
    plan,
    subscriptionStatus,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

