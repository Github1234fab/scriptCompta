import { writable } from 'svelte/store';
import { auth } from './firebase.js';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { resetAllStores } from './store.js';

/**
 * @typedef {Object} UserState
 * @property {any} user
 * @property {boolean} loading
 * @property {string|null} error
 */

// Récupération immédiate du cache de session pour affichage instantané sans blocage
const cachedUser = (() => {
  try {
    const raw = localStorage.getItem('saas_compta_auth_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
})();

/** @type {import('svelte/store').Writable<import('firebase/auth').User | null>} */
export const currentUser = writable(cachedUser);
export const authInitialized = writable(false);
export const authLoading = writable(false);
export const authError = writable(null);

onAuthStateChanged(
  auth, 
  (user) => {
    if (user) {
      const serialized = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName
      };
      localStorage.setItem('saas_compta_auth_user', JSON.stringify(serialized));
      currentUser.set(user);
    } else {
      // Déconnecté ou compte supprimé de Firebase
      localStorage.removeItem('saas_compta_auth_user');
      currentUser.set(null);
      resetAllStores();
    }
    authLoading.set(false);
    authInitialized.set(true);
  },
  (error) => {
    console.error("Firebase auth error:", error);
    authLoading.set(false);
    authInitialized.set(true);
  }
);

/**
 * Validation robuste du mot de passe
 * @param {string} password
 * @returns {string | null}
 */
export function validatePassword(password) {
  if (!password || password.length < 8) {
    return 'Le mot de passe doit comporter au moins 8 caractères.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Le mot de passe doit comporter au moins une lettre majuscule.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Le mot de passe doit comporter au moins une lettre minuscule.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Le mot de passe doit comporter au moins un chiffre.';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Le mot de passe doit comporter au moins un caractère spécial (@, #, $, !, %, etc.).';
  }
  return null;
}

/**
 * Inscription Email/Mot de passe
 * @param {string} email
 * @param {string} password
 * @param {string} [displayName]
 */
export async function registerWithEmail(email, password, displayName = '') {
  authLoading.set(true);
  authError.set(null);

  const pwdError = validatePassword(password);
  if (pwdError) {
    authLoading.set(false);
    authError.set(pwdError);
    throw new Error(pwdError);
  }

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
    localStorage.removeItem('saas_compta_auth_user');
    resetAllStores();
    currentUser.set(null);
  } catch (err) {
    console.error('Erreur déconnexion:', err);
  } finally {
    authLoading.set(false);
  }
}

/**
 * Envoi d'un lien de réinitialisation de mot de passe par e-mail
 * @param {string} email
 */
export async function sendResetPassword(email) {
  if (!email) throw new Error("Adresse e-mail requise.");
  await sendPasswordResetEmail(auth, email);
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
