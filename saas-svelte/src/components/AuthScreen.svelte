<script>
  import { onMount } from 'svelte';
  import { 
    loginWithEmail, 
    registerWithEmail, 
    authLoading, 
    authError 
  } from '../lib/auth.js';
  import { showToast } from '../lib/store.js';

  let mode = $state('login'); // 'login' | 'register'
  let email = $state('');
  let password = $state('');
  let displayName = $state('');
  let localError = $state('');
  let showPassword = $state(false);

  onMount(() => {
    clearErrors();
  });

  function clearErrors() {
    localError = '';
    authError.set(null);
  }

  /** @param {'login' | 'register'} newMode */
  function switchMode(newMode) {
    mode = newMode;
    showPassword = false;
    clearErrors();
  }

  /** @param {any} e */
  async function handleSubmit(e) {
    e.preventDefault();
    clearErrors();

    if (!email || !password) {
      localError = 'Veuillez remplir tous les champs.';
      return;
    }

    try {
      if (mode === 'register') {
        await registerWithEmail(email, password, displayName);
        showToast('Compte créé avec succès ! Bienvenue sur ScriptCompta.');
      } else {
        await loginWithEmail(email, password);
        showToast('Connexion réussie !');
      }
    } catch (err) {
      localError = err?.message || 'Une erreur est survenue.';
    }
  }
</script>

<div class="auth-page-wrapper">
  <div class="auth-card">
    
    <!-- BRANDING -->
    <div class="auth-header">
      <div class="auth-badge">
        SCRIPTCOMPTA
      </div>
      <h1 class="auth-title">
        {mode === 'login' ? 'Connexion à votre espace' : 'Créer votre compte'}
      </h1>
      <p class="auth-subtitle">
        {mode === 'login' 
          ? 'Accédez à votre gestion comptable simplifiée et synchronisée.' 
          : 'Démarrez gratuitement en quelques secondes sans engagement.'}
      </p>
    </div>

    <!-- TABS LOGIN / REGISTER -->
    <div class="auth-tabs">
      <button 
        type="button" 
        class="tab-btn" 
        class:active={mode === 'login'}
        onclick={() => switchMode('login')}
      >
        Se connecter
      </button>
      <button 
        type="button" 
        class="tab-btn" 
        class:active={mode === 'register'}
        onclick={() => switchMode('register')}
      >
        Créer un compte
      </button>
    </div>

    {#if localError || $authError}
      <div class="auth-error-box">
        <i class="fa-solid fa-circle-exclamation"></i>
        <span>{localError || $authError}</span>
      </div>
    {/if}

    <form onsubmit={handleSubmit} class="auth-form">
      {#if mode === 'register'}
        <div class="form-group">
          <label for="auth-name" class="input-label">Nom ou Raison sociale (optionnel)</label>
          <input 
            type="text" 
            id="auth-name"
            bind:value={displayName}
            oninput={clearErrors}
            placeholder="ex: Thomas Martin"
            class="auth-input"
          />
        </div>
      {/if}

      <div class="form-group">
        <label for="auth-email" class="input-label">Adresse e-mail</label>
        <input 
          type="email" 
          id="auth-email"
          bind:value={email}
          oninput={clearErrors}
          required
          placeholder="nom@exemple.fr"
          class="auth-input"
        />
      </div>

      <div class="form-group">
        <label for="auth-pwd" class="input-label">Mot de passe</label>
        <div class="password-input-wrapper">
          <input 
            type={showPassword ? 'text' : 'password'} 
            id="auth-pwd"
            bind:value={password}
            oninput={clearErrors}
            required
            minlength="6"
            placeholder="••••••••"
            class="auth-input password-input"
          />
          <button 
            type="button" 
            class="toggle-password-btn"
            onclick={() => showPassword = !showPassword}
            aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            title={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          >
            <i class="fa-regular {showPassword ? 'fa-eye-slash' : 'fa-eye'}"></i>
          </button>
        </div>
        {#if mode === 'register'}
          <div class="password-requirements">
            <div class="requirement-item" class:valid={password.length >= 6}>
              <i class="fa-solid {password.length >= 6 ? 'fa-circle-check' : 'fa-circle-dot'}"></i>
              <span>6 caractères minimum</span>
            </div>
            <div class="requirement-item valid">
              <i class="fa-solid fa-circle-check"></i>
              <span>Caractères autorisés : lettres, chiffres et symboles (@, #, $, !, %, etc.)</span>
            </div>
          </div>
        {/if}
      </div>

      <button 
        type="submit" 
        class="submit-btn" 
        disabled={$authLoading}
      >
        {#if $authLoading}
          <i class="fa-solid fa-spinner fa-spin"></i> Chargement...
        {:else if mode === 'login'}
          Accéder à mon espace ➔
        {:else}
          Créer mon compte gratuit ➔
        {/if}
      </button>
    </form>

    <div class="auth-footer">
      {#if mode === 'login'}
        <span>Pas encore de compte ?</span>
        <button type="button" class="link-btn" onclick={() => switchMode('register')}>
          Créer un compte gratuit
        </button>
      {:else}
        <span>Déjà un compte ?</span>
        <button type="button" class="link-btn" onclick={() => switchMode('login')}>
          Se connecter
        </button>
      {/if}
    </div>

  </div>
</div>

<style>
  .auth-page-wrapper {
    min-height: 100vh;
    width: 100%;
    background: #2b3240;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 30px 20px;
    box-sizing: border-box;
    font-family: inherit;
  }

  .auth-card {
    max-width: 480px;
    width: 100%;
    background: #ffffff;
    border-radius: 20px;
    padding: 36px 36px 32px 36px;
    box-shadow: 0 20px 45px -10px rgba(0, 0, 0, 0.35);
    box-sizing: border-box;
  }

  .auth-header {
    margin-bottom: 22px;
    text-align: left;
  }

  .auth-badge {
    display: inline-block;
    color: #2563eb;
    font-weight: 800;
    font-size: 0.75rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    margin-bottom: 8px;
  }

  .auth-title {
    font-size: 1.55rem;
    font-weight: 800;
    color: #0f172a;
    margin: 0 0 6px 0;
    letter-spacing: -0.02em;
    line-height: 1.25;
  }

  .auth-subtitle {
    font-size: 0.88rem;
    color: #64748b;
    line-height: 1.45;
    margin: 0;
  }

  .auth-tabs {
    display: flex;
    background: #f1f5f9;
    padding: 4px;
    border-radius: 10px;
    margin-bottom: 22px;
    gap: 4px;
  }

  .tab-btn {
    flex: 1;
    padding: 8px 12px;
    font-size: 0.85rem;
    font-weight: 700;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    background: transparent;
    color: #64748b;
    transition: all 0.18s ease;
  }

  .tab-btn.active {
    background: #ffffff;
    color: #0f172a;
    box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08);
  }

  .auth-error-box {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #b91c1c;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 0.82rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 18px;
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .input-label {
    font-size: 0.84rem;
    font-weight: 700;
    color: #0f172a;
  }

  .auth-input {
    width: 100%;
    padding: 11px 14px;
    font-size: 0.9rem;
    color: #0f172a;
    background: #ffffff;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    box-sizing: border-box;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .auth-input:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
  }

  .password-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
  }

  .password-input {
    padding-right: 44px;
  }

  .toggle-password-btn {
    position: absolute;
    right: 6px;
    background: transparent;
    border: none;
    padding: 8px 10px;
    color: #64748b;
    cursor: pointer;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.95rem;
    transition: color 0.15s ease, background 0.15s ease;
  }

  .toggle-password-btn:hover {
    color: #0f172a;
    background: #f1f5f9;
  }

  .password-requirements {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-top: 4px;
    padding: 10px 12px;
    background: #f8fafc;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
  }

  .requirement-item {
    font-size: 0.76rem;
    color: #64748b;
    display: flex;
    align-items: center;
    gap: 7px;
    line-height: 1.35;
  }

  .requirement-item.valid {
    color: #166534;
  }

  .requirement-item i {
    font-size: 0.72rem;
    flex-shrink: 0;
  }

  .submit-btn {
    margin-top: 6px;
    width: 100%;
    padding: 12px;
    background: #090d16;
    color: #ffffff;
    font-size: 0.92rem;
    font-weight: 700;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    transition: background 0.18s ease, transform 0.12s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .submit-btn:hover:not(:disabled) {
    background: #1e293b;
    transform: translateY(-1px);
  }

  .submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .auth-footer {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid #f1f5f9;
    text-align: center;
    font-size: 0.82rem;
    color: #64748b;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .link-btn {
    background: none;
    border: none;
    color: #2563eb;
    font-weight: 700;
    cursor: pointer;
    padding: 0;
    font-size: inherit;
  }

  .link-btn:hover {
    text-decoration: underline;
  }
</style>
