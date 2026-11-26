<script>
  import {
    showTitoChatDrawer,
    focusedChatTx,
    openTitoChat,
    closeTitoChat,
    entities,
    activeEntityId,
    activeView,
    showToast
  } from '../lib/store.js';
  import { currentUser } from '../lib/auth.js';
  import { saveUserQuestion, sendQuestionEmailNotification } from '../lib/firestoreService.js';
  import {
    getTitoRowExplanation,
    getTitoViewSuggestions,
    getLockedTitoChatReply
  } from '../lib/titoExplainer.js';

  let userQuestionText = $state('');
  let contactEmail = $state('');
  let isSubmitting = $state(false);
  let submitSuccess = $state(false);
  let expandedFaqIndex = $state(null);

  // Pré-remplir l'e-mail de contact avec celui de l'utilisateur connecté
  $effect(() => {
    if ($currentUser?.email && !contactEmail) {
      contactEmail = $currentUser.email;
    }
  });

  let activeEntity = $derived(
    $entities.find((/** @type {any} */ e) => e.id === $activeEntityId) ||
    $entities[0] ||
    { id: 'default', name: 'Ma Structure', model: 'micro' }
  );
  let activeEntityModel = $derived(activeEntity?.model || 'micro');

  // Suggestions de questions fréquentes selon l'écran actif
  let viewSuggestions = $derived(getTitoViewSuggestions($activeView, activeEntityModel));

  // Explication de la ligne sélectionnée (si ouverte depuis "💬 Pourquoi ?")
  let txExplanation = $derived(
    $focusedChatTx ? getTitoRowExplanation($focusedChatTx, activeEntityModel, null) : null
  );

  /** @param {number} idx */
  function toggleFaq(idx) {
    expandedFaqIndex = expandedFaqIndex === idx ? null : idx;
  }

  /** @param {string} question */
  function getInstantAnswer(question) {
    const res = getLockedTitoChatReply(question, {
      model: activeEntityModel,
      activeView: $activeView
    });
    return res?.reply || '';
  }

  /** @param {string} text */
  function formatMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #f8fafc; font-weight: 700;">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em style="color: #cbd5e1;">$1</em>');
  }

  async function handleSendQuestion() {
    const q = userQuestionText.trim();
    if (!q) return;

    isSubmitting = true;
    const uid = $currentUser?.uid;
    const userEmail = (contactEmail || $currentUser?.email || '').trim();

    const payload = {
      email: userEmail,
      entityId: $activeEntityId,
      structureName: activeEntity?.name || '',
      model: activeEntityModel,
      view: $activeView,
      question: q,
      txContext: $focusedChatTx ? {
        id: $focusedChatTx.id,
        libelle: $focusedChatTx.libelle,
        debit: $focusedChatTx.debit || 0,
        credit: $focusedChatTx.credit || 0,
        compte: $focusedChatTx.compteAttribué || ''
      } : null
    };

    // 1. Sauvegarde dans Firestore
    saveUserQuestion(uid, payload);

    // 2. Envoi direct de l'e-mail vers gralypho@gmail.com
    await sendQuestionEmailNotification(payload);

    isSubmitting = false;
    submitSuccess = true;
    userQuestionText = '';
    showToast("Votre question a été envoyée par e-mail !");
    setTimeout(() => {
      submitSuccess = false;
    }, 6000);
  }
</script>

{#if $showTitoChatDrawer}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    onclick={closeTitoChat}
    style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.55); backdrop-filter: blur(4px); z-index: 100001; display: flex; justify-content: flex-end;"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div
      onclick={(e) => e.stopPropagation()}
      style="width: 100%; max-width: 460px; height: 100%; background: #0f172a; color: #ffffff; border-left: 1px solid rgba(56, 189, 248, 0.3); display: flex; flex-direction: column; box-shadow: -20px 0 50px rgba(0, 0, 0, 0.6);"
    >
      <!-- En-tête du panneau -->
      <div style="padding: 18px 20px; background: #080e1e; border-bottom: 1px solid rgba(255, 255, 255, 0.1); display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #2563eb, #0891b2); display: flex; align-items: center; justify-content: center; font-size: 1rem; color: #ffffff;">
            {#if $focusedChatTx}
              <i class="fa-solid fa-wand-magic-sparkles"></i>
            {:else}
              <i class="fa-solid fa-circle-question"></i>
            {/if}
          </div>
          <div>
            <div style="font-weight: 800; font-size: 1rem; color: #ffffff;">
              {#if $focusedChatTx}
                Analyse Tito
              {:else}
                Poser une question à Tito
              {/if}
            </div>
            <div style="font-size: 0.74rem; color: #38bdf8; margin-top: 1px;">
              {#if $focusedChatTx}
                Détail & justification comptable de l'opération
              {:else}
                Espace {activeEntityModel.toUpperCase()} • Une incompréhension ? Nous vous aidons.
              {/if}
            </div>
          </div>
        </div>
        <button
          type="button"
          onclick={closeTitoChat}
          style="background: rgba(255, 255, 255, 0.08); border: none; color: #cbd5e1; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 1rem; display: flex; align-items: center; justify-content: center;"
          title="Fermer"
        >
          ✕
        </button>
      </div>

      <!-- Corps déroulant -->
      <div style="flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 20px; display: flex; flex-direction: column; gap: 18px;">
        
        {#if $focusedChatTx && txExplanation}
          <!-- ======================================================== -->
          <!-- MODE 1 : ANALYSE EXCLUSIVE DE L'OPÉRATION SÉLECTIONNÉE   -->
          <!-- ======================================================== -->
          <div style="background: rgba(37, 99, 235, 0.1); border: 1.5px solid rgba(56, 189, 248, 0.4); border-radius: 14px; padding: 18px; display: flex; flex-direction: column; gap: 14px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <span style="font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: #38bdf8;">
                Opération sélectionnée
              </span>
              <span style="font-weight: 800; font-size: 1rem; font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: {$focusedChatTx.debit > 0 ? '#f87171' : '#34d399'};">
                {$focusedChatTx.debit > 0 ? '- ' : '+ '}{Number($focusedChatTx.debit || $focusedChatTx.credit || 0).toFixed(2).replace('.', ',')} €
              </span>
            </div>
            
            <div style="font-weight: 800; font-size: 1.05rem; color: #ffffff; line-height: 1.35;">
              {$focusedChatTx.libelle}
            </div>

            <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; padding: 12px; font-size: 0.85rem; color: #e2e8f0; line-height: 1.5;">
              <strong style="color: #38bdf8; display: block; margin-bottom: 4px; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.03em;">
                Ce que fait Tito
              </strong>
              {txExplanation.lineExplanation.replace('Tito a un doute : ', '')}
            </div>

            <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; padding: 12px; font-size: 0.83rem; color: #cbd5e1; line-height: 1.5;">
              <strong style="color: #94a3b8; display: block; margin-bottom: 4px; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.03em;">
                Règle officielle
              </strong>
              {txExplanation.whyLegal}
            </div>

            <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; padding: 12px; font-size: 0.83rem; color: #cbd5e1; line-height: 1.5;">
              <strong style="color: #34d399; display: block; margin-bottom: 4px; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.03em;">
                Impact concret
              </strong>
              {txExplanation.impact}
            </div>
          </div>

          <div style="margin-top: 10px; display: flex; justify-content: center;">
            <button
              type="button"
              onclick={closeTitoChat}
              style="width: 100%; padding: 11px 20px; background: #2563eb; color: #ffffff; border: none; border-radius: 10px; font-weight: 700; font-size: 0.88rem; cursor: pointer; transition: background 0.15s ease;"
              onmouseenter={(e) => { e.currentTarget.style.background = '#1d4ed8'; }}
              onmouseleave={(e) => { e.currentTarget.style.background = '#2563eb'; }}
            >
              Fermer l'analyse
            </button>
          </div>

        {:else}
          <!-- ======================================================== -->
          <!-- MODE 2 : CENTRE D'AIDE GLOBAL & QUESTIONS DE L'UTILISATEUR -->
          <!-- ======================================================== -->

          <!-- ACCORDÉON DES QUESTIONS FRÉQUENTES SUR LA PAGE EN COURS -->
          <div>
            <div style="font-size: 0.74rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 8px;">
              Questions fréquentes sur cet écran
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px;">
              {#each viewSuggestions as item, idx}
                {@const isOpen = expandedFaqIndex === idx}
                <div style="flex-shrink: 0; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; overflow: hidden; transition: border-color 0.15s ease;">
                  <button
                    type="button"
                    onclick={() => toggleFaq(idx)}
                    style="width: 100%; text-align: left; background: transparent; border: none; padding: 12px 14px; color: #e2e8f0; font-weight: 600; font-size: 0.83rem; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px;"
                  >
                    <span style="display: inline-flex; align-items: center; gap: 8px;">
                      {#if item.icon}
                        <i class="fa-solid {item.icon}" style="color: #38bdf8; font-size: 0.8rem; width: 14px;"></i>
                      {/if}
                      <span>{item.label}</span>
                    </span>
                    <i class="fa-solid fa-chevron-down" style="font-size: 0.72rem; color: #94a3b8; transition: transform 0.2s; transform: {isOpen ? 'rotate(180deg)' : 'rotate(0)'};"></i>
                  </button>
                  {#if isOpen}
                    <div style="padding: 0 14px 14px 14px; font-size: 0.8rem; color: #94a3b8; line-height: 1.55; white-space: pre-line; border-top: 1px dashed rgba(255, 255, 255, 0.06); padding-top: 10px;">
                      {@html formatMarkdown(getInstantAnswer(item.question))}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>

          <!-- FORMULAIRE POUR ENVOYER SA QUESTION -->
          <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 14px; padding: 16px;">
            <label for="tito-user-question" style="display: block; font-weight: 700; font-size: 0.88rem; color: #f8fafc; margin-bottom: 6px;">
              Un indicateur ou une règle ne vous paraît pas clair ?
            </label>
            <p style="font-size: 0.78rem; color: #94a3b8; margin: 0 0 12px 0; line-height: 1.4;">
              Posez-nous directement votre question. Notre équipe vous répond et améliore l'application pour que tout soit transparent.
            </p>

            {#if submitSuccess}
              <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 10px; padding: 12px; margin-bottom: 12px; display: flex; align-items: flex-start; gap: 10px;">
                <i class="fa-solid fa-circle-check" style="color: #34d399; font-size: 1.1rem; margin-top: 2px;"></i>
                <div style="font-size: 0.82rem; color: #ecfdf5; line-height: 1.45;">
                  <strong>Bien reçu !</strong> Votre question a été envoyée par e-mail à notre équipe. Nous vous répondrons très rapidement à l'adresse indiquée.
                </div>
              </div>
            {/if}

            <!-- E-mail de contact (pré-rempli) -->
            <div style="margin-bottom: 12px;">
              <label for="tito-user-email" style="display: block; font-size: 0.76rem; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">
                Votre e-mail pour recevoir la réponse :
              </label>
              <input
                id="tito-user-email"
                type="email"
                bind:value={contactEmail}
                placeholder="votre.email@exemple.com"
                style="width: 100%; box-sizing: border-box; background: #080e1e; border: 1.5px solid rgba(255, 255, 255, 0.16); border-radius: 8px; padding: 9px 12px; color: #ffffff; font-size: 0.85rem; font-family: inherit; outline: none;"
              />
            </div>

            <label for="tito-user-question" style="display: block; font-size: 0.76rem; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">
              Votre question :
            </label>
            <textarea
              id="tito-user-question"
              bind:value={userQuestionText}
              placeholder="Ex : Comment ventiler un virement mixte ? ou : Où trouver mon export annuel dans Tito ?"
              rows="4"
              style="width: 100%; box-sizing: border-box; background: #080e1e; border: 1.5px solid rgba(255, 255, 255, 0.16); border-radius: 10px; padding: 12px; color: #ffffff; font-size: 0.86rem; font-family: inherit; line-height: 1.45; resize: vertical; outline: none;"
            ></textarea>

            <div style="display: flex; justify-content: flex-end; margin-top: 12px;">
              <button
                type="button"
                onclick={handleSendQuestion}
                disabled={isSubmitting || !userQuestionText.trim()}
                style="padding: 10px 18px; background: linear-gradient(135deg, #2563eb, #0891b2); color: #ffffff; border: none; border-radius: 9999px; font-weight: 700; font-size: 0.84rem; cursor: {isSubmitting || !userQuestionText.trim() ? 'not-allowed' : 'pointer'}; opacity: {isSubmitting || !userQuestionText.trim() ? 0.6 : 1}; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);"
              >
                {#if isSubmitting}
                  <i class="fa-solid fa-spinner fa-spin"></i>
                  <span>Envoi en cours...</span>
                {:else}
                  <i class="fa-solid fa-paper-plane"></i>
                  <span>Envoyer ma question</span>
                {/if}
              </button>
            </div>

            <!-- Mention légale de non-exercice illégal du conseil personnalisé -->
            <div style="font-size: 0.73rem; color: #64748b; margin-top: 10px; text-align: center; line-height: 1.35;">
              Support technique & aide à l'utilisation du logiciel uniquement (ne constitue pas un conseil comptable ou fiscal personnalisé).
            </div>
          </div>

          <!-- NOTE DE TRANSPARENCE -->
          <div style="margin-top: auto; padding: 12px; background: rgba(255, 255, 255, 0.02); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.05); font-size: 0.72rem; color: #64748b; line-height: 1.4; text-align: center;">
            Tito est conçu pour vulgariser et simplifier votre gestion. Vos retours nous permettent d'affiner chaque explication.
          </div>
        {/if}

      </div>
    </div>
  </div>
{/if}
