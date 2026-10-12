import { writable } from 'svelte/store';
import { auth } from './firebase.js';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  updateProfile
} from 'firebase/auth';

/**
 * @typedef {Object} UserState
 * @property {any} user
 * @property {boolean} loading
 * @property {string|null} error
 */

export const currentUser = writable(null);
export const authLoading = writable(true);
export const authError = writable(null);

// Écoute de l'état d'authentification Firebase
onAuthStateChanged(auth, (user) => {
  currentUser.set(user);
  authLoading.set(false);
});

/**
 * Inscription Email/Mot de passe
 * @param {string} email
 * @param {string} password
 * @param {string} [displayName]
 */
export async function registerWithEmail(email, password, displayName = '') {
  authLoading.set(true);
  authError.set(null);
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName && cred.user) {
      await updateProfile(cred.user, { displayName });
      currentUser.set({ ...cred.user, displayName });
    }
    return cred.user;
  } catch (err) {
    const message = getFriendlyErrorMessage(err);
    authError.set(message);
    throw new Error(message);
  } finally {
    authLoading.set(false);
  }
}

/**
 * Connexion Email/Mot de passe
 * @param {string} email
 * @param {string} password
 */
export async function loginWithEmail(email, password) {
  authLoading.set(true);
  authError.set(null);
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  } catch (err) {
    const message = getFriendlyErrorMessage(err);
    authError.set(message);
    throw new Error(message);
  } finally {
    authLoading.set(false);
  }
}

/**
 * Déconnexion
 */
export async function logoutUser() {
  authLoading.set(true);
  try {
    await signOut(auth);
    currentUser.set(null);
  } catch (err) {
    console.error('Erreur déconnexion:', err);
  } finally {
    authLoading.set(false);
  }
}

/**
 * Traduction conviviale des erreurs Firebase Auth
 * @param {any} err
 */
function getFriendlyErrorMessage(err) {
  const code = err?.code || '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Cette adresse e-mail est déjà associée à un compte.';
    case 'auth/invalid-email':
      return 'L’adresse e-mail saisie n’est pas valide.';
    case 'auth/weak-password':
      return 'Le mot de passe doit comporter au moins 6 caractères.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Identifiants incorrects. Vérifiez votre e-mail et mot de passe.';
    case 'auth/too-many-requests':
      return 'Trop de tentatives infructueuses. Veuillez réessayer dans quelques minutes.';
    default:
      return err?.message || 'Une erreur est survenue lors de l’authentification.';
  }
}
