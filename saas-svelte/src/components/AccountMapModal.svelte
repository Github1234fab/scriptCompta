<script>
  import { ACCOUNT_GUIDE_SECTIONS } from '../lib/accountGuide.js';
  import { planComptable } from '../lib/store.js';

  /** @type {{ open: boolean, onClose: () => void }} */
  let { open = false, onClose } = $props();

  let searchQuery = $state('');
  /** @type {'all' | 'recettes' | 'depenses' | 'transferts'} */
  let activeFilter = $state('all');

  /** @param {string} s */
  function normalize(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  let customAccounts = $derived($planComptable.filter((p) => p.isCustom));

  let filteredSections = $derived((() => {
    const q = normalize(searchQuery.trim());
    return ACCOUNT_GUIDE_SECTIONS
      .filter((sec) => activeFilter === 'all' || sec.id === activeFilter)
      .map((sec) => {
        const groups = sec.groups
          .map((grp) => {
            const accounts = grp.accounts.filter((acc) => {
              if (!q) return true;
              return (
                normalize(acc.compte).includes(q) ||
                normalize(acc.title).includes(q) ||
                normalize(acc.whenToUse).includes(q) ||
                normalize(acc.examples).includes(q) ||
                normalize(acc.watchOut).includes(q)
              );
            });
            return { ...grp, accounts };
          })
          .filter((grp) => grp.accounts.length > 0);
        return { ...sec, groups };
      })
      .filter((sec) => sec.groups.length > 0);
  })());

  let totalVisibleAccounts = $derived(
    filteredSections.reduce((sum, sec) => sum + sec.groups.reduce((gSum, g) => gSum + g.accounts.length, 0), 0)
  );

  /** @param {KeyboardEvent} e */
  function handleKeydown(e) {
    if (e.key === 'Escape' && open) {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    class="acc-map-backdrop"
    role="presentation"
    onclick={onClose}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div
      class="acc-map-card"
      role="dialog"
      aria-modal="true"
      aria-label="Guide et carte complète des comptes comptables"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- En-tête -->
      <div class="acc-map-header">
        <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
          <div class="acc-map-icon">
            <i class="fa-solid fa-map"></i>
          </div>
          <div style="min-width: 0;">
            <h2 class="acc-map-title">Carte des comptes — Recettes & Dépenses</h2>
            <p class="acc-map-subtitle">
              Tous les comptes Tito expliqués simplement avec exemples concrets et pièges à éviter.
            </p>
          </div>
        </div>
        <button
          type="button"
          class="acc-map-close"
          onclick={onClose}
          aria-label="Fermer la carte des comptes"
        >
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <!-- Barre de recherche + Filtres -->
      <div class="acc-map-toolbar">
        <div class="acc-map-search-wrap">
          <i class="fa-solid fa-magnifying-glass acc-map-search-icon"></i>
          <input
            type="text"
            bind:value={searchQuery}
            placeholder="Chercher un mot, un cas ou un numéro (ex : EDF, CPAM, Amazon, prêt, 7061, TVA, essence...)"
            class="acc-map-search-input"
          />
          {#if searchQuery.trim()}
            <button
              type="button"
              onclick={() => (searchQuery = '')}
              class="acc-map-search-clear"
              aria-label="Effacer la recherche"
            >
              ✕
            </button>
          {/if}
        </div>

        <div class="acc-map-filters">
          <button
            type="button"
            class="acc-filter-pill {activeFilter === 'all' ? 'active' : ''}"
            onclick={() => (activeFilter = 'all')}
          >
            Tout voir
          </button>
          <button
            type="button"
            class="acc-filter-pill recettes {activeFilter === 'recettes' ? 'active' : ''}"
            onclick={() => (activeFilter = 'recettes')}
          >
            <i class="fa-solid fa-arrow-trend-up"></i> Recettes (+)
          </button>
          <button
            type="button"
            class="acc-filter-pill depenses {activeFilter === 'depenses' ? 'active' : ''}"
            onclick={() => (activeFilter = 'depenses')}
          >
            <i class="fa-solid fa-arrow-trend-down"></i> Dépenses (-)
          </button>
          <button
            type="button"
            class="acc-filter-pill transferts {activeFilter === 'transferts' ? 'active' : ''}"
            onclick={() => (activeFilter = 'transferts')}
          >
            <i class="fa-solid fa-right-left"></i> Banque & Transferts
          </button>
        </div>
      </div>

      <!-- Corps défilable -->
      <div class="acc-map-body">
        {#if totalVisibleAccounts === 0}
          <div class="acc-map-empty">
            Aucun compte ne correspond à « {searchQuery} ». Essayez un mot simple comme <em>loyer</em>, <em>logiciel</em>, <em>CPAM</em> ou <em>emprunt</em>.
          </div>
        {:else}
          {#each filteredSections as section}
            <section class="acc-section">
              <div
                class="acc-section-banner"
                style="background: {section.bgTint}; border-color: {section.borderTint};"
              >
                <div style="display: flex; align-items: center; gap: 9px;">
                  <i class="fa-solid {section.icon}" style="color: {section.accent}; font-size: 0.95rem;"></i>
                  <h3 style="margin: 0; font-size: 0.98rem; font-weight: 800; color: var(--text-main);">
                    {section.label}
                  </h3>
                </div>
                <p style="margin: 4px 0 0 0; font-size: 0.78rem; color: var(--text-secondary); line-height: 1.4;">
                  {section.intro}
                </p>
              </div>

              {#each section.groups as group}
                <div class="acc-group">
                  <div class="acc-group-title">{group.title}</div>
                  <div class="acc-cards-grid">
                    {#each group.accounts as acc}
                      <article class="acc-item-card">
                        <div class="acc-item-top">
                          <span
                            class="acc-code-badge"
                            style="background: {section.bgTint}; color: {section.accent}; border-color: {section.borderTint};"
                          >
                            {acc.compte}
                          </span>
                          <h4 class="acc-item-name">{acc.title}</h4>
                        </div>

                        <p class="acc-item-when">{acc.whenToUse}</p>

                        <div class="acc-item-examples">
                          <span class="acc-meta-label">Exemples :</span> {acc.examples}
                        </div>

                        {#if acc.watchOut}
                          <div class="acc-item-watchout">
                            <i class="fa-solid fa-lightbulb" style="color: #fbbf24; margin-right: 5px; font-size: 0.72rem;"></i>
                            <span>{acc.watchOut}</span>
                          </div>
                        {/if}
                      </article>
                    {/each}
                  </div>
                </div>
              {/each}
            </section>
          {/each}

          {#if customAccounts.length > 0 && activeFilter === 'all' && !searchQuery.trim()}
            <section class="acc-section">
              <div
                class="acc-section-banner"
                style="background: rgba(168, 85, 247, 0.1); border-color: rgba(168, 85, 247, 0.3);"
              >
                <div style="display: flex; align-items: center; gap: 9px;">
                  <i class="fa-solid fa-sitemap" style="color: #c084fc; font-size: 0.95rem;"></i>
                  <h3 style="margin: 0; font-size: 0.98rem; font-weight: 800; color: var(--text-main);">
                    Vos sous-comptes personnalisés ({customAccounts.length})
                  </h3>
                </div>
              </div>
              <div class="acc-cards-grid">
                {#each customAccounts as sc}
                  <article class="acc-item-card">
                    <div class="acc-item-top">
                      <span
                        class="acc-code-badge"
                        style="background: rgba(168, 85, 247, 0.14); color: #d8b4fe; border-color: rgba(168, 85, 247, 0.35);"
                      >
                        {sc.compte}
                      </span>
                      <h4 class="acc-item-name">{sc.libelle}</h4>
                    </div>
                    {#if sc.desc}
                      <p class="acc-item-when">{sc.desc}</p>
                    {/if}
                  </article>
                {/each}
              </div>
            </section>
          {/if}
        {/if}
      </div>

      <!-- Pied de modale -->
      <div class="acc-map-footer">
        <span style="font-size: 0.76rem; color: var(--text-muted);">
          {totalVisibleAccounts} compte{totalVisibleAccounts > 1 ? 's' : ''} affiché{totalVisibleAccounts > 1 ? 's' : ''} · Plan Comptable Général simplifié
        </span>
        <button type="button" class="acc-map-close-btn" onclick={onClose}>
          Fermer
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .acc-map-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(5, 10, 20, 0.78);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100050;
    padding: 20px;
    box-sizing: border-box;
  }

  .acc-map-card {
    background: var(--bg-modal, #0c1527);
    color: var(--text-main, #f8fafc);
    width: 100%;
    max-width: 980px;
    max-height: 90vh;
    border-radius: 18px;
    border: 1.5px solid var(--border-container, rgba(56, 189, 248, 0.25));
    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.65);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .acc-map-header {
    flex-shrink: 0;
    padding: 18px 24px;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-container);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .acc-map-icon {
    width: 40px;
    height: 40px;
    border-radius: 11px;
    background: rgba(56, 189, 248, 0.14);
    color: var(--color-accent, #38bdf8);
    border: 1px solid rgba(56, 189, 248, 0.32);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.05rem;
    flex-shrink: 0;
  }

  .acc-map-title {
    margin: 0;
    font-family: var(--font-title);
    font-size: 1.15rem;
    font-weight: 800;
    color: var(--text-main) !important;
  }

  .acc-map-subtitle {
    margin: 2px 0 0 0;
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .acc-map-close {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 1.25rem;
    cursor: pointer;
    padding: 6px;
    border-radius: 8px;
  }

  .acc-map-close:hover {
    color: var(--text-main);
  }

  .acc-map-toolbar {
    flex-shrink: 0;
    padding: 14px 24px;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-card);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .acc-map-search-wrap {
    position: relative;
    width: 100%;
  }

  .acc-map-search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
    font-size: 0.82rem;
    pointer-events: none;
  }

  .acc-map-search-input {
    width: 100%;
    box-sizing: border-box;
    padding: 9px 34px 9px 36px;
    border-radius: 10px;
    border: 1.5px solid var(--border-color);
    background: var(--bg-subtle);
    color: var(--text-main);
    font-size: 0.85rem;
    outline: none;
  }

  .acc-map-search-input:focus {
    border-color: var(--color-accent, #38bdf8);
  }

  .acc-map-search-clear {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px 6px;
  }

  .acc-map-filters {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .acc-filter-pill {
    padding: 6px 12px;
    border-radius: 9999px;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    border: 1px solid var(--border-color);
    background: var(--bg-subtle);
    color: var(--text-secondary);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: all 0.15s ease;
  }

  .acc-filter-pill.active {
    background: #4f46e5;
    border-color: #4f46e5;
    color: #ffffff;
  }

  .acc-filter-pill.recettes.active {
    background: #059669;
    border-color: #059669;
  }

  .acc-filter-pill.depenses.active {
    background: #dc2626;
    border-color: #dc2626;
  }

  .acc-filter-pill.transferts.active {
    background: #0284c7;
    border-color: #0284c7;
  }

  .acc-map-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .acc-map-body > * {
    flex-shrink: 0;
  }

  .acc-section {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .acc-section-banner {
    padding: 12px 16px;
    border-radius: 12px;
    border: 1px solid;
  }

  .acc-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .acc-group-title {
    font-size: 0.76rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    padding-left: 2px;
  }

  .acc-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 10px;
  }

  .acc-item-card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 13px 15px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .acc-item-top {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .acc-code-badge {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.76rem;
    font-weight: 800;
    padding: 2px 7px;
    border-radius: 6px;
    border: 1px solid;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .acc-item-name {
    margin: 0;
    font-size: 0.88rem;
    font-weight: 800;
    color: var(--text-main) !important;
    line-height: 1.3;
  }

  .acc-item-when {
    margin: 0;
    font-size: 0.79rem;
    color: var(--text-secondary);
    line-height: 1.45;
  }

  .acc-item-examples {
    font-size: 0.76rem;
    color: var(--text-muted);
    background: var(--bg-subtle);
    padding: 7px 9px;
    border-radius: 7px;
    line-height: 1.4;
  }

  .acc-meta-label {
    font-weight: 700;
    color: var(--text-secondary);
  }

  .acc-item-watchout {
    font-size: 0.74rem;
    color: var(--text-secondary);
    line-height: 1.4;
    padding-top: 4px;
    border-top: 1px dashed var(--border-color);
  }

  .acc-map-empty {
    text-align: center;
    padding: 36px 20px;
    color: var(--text-muted);
    font-size: 0.88rem;
    background: var(--bg-subtle);
    border: 1px dashed var(--border-color);
    border-radius: 12px;
  }

  .acc-map-footer {
    flex-shrink: 0;
    padding: 12px 24px;
    border-top: 1px solid var(--border-color);
    background: var(--bg-container);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .acc-map-close-btn {
    padding: 8px 18px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background: var(--bg-card);
    color: var(--text-main);
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
  }

  @media (max-width: 640px) {
    .acc-map-backdrop {
      padding: 10px;
    }
    .acc-map-header,
    .acc-map-toolbar,
    .acc-map-body,
    .acc-map-footer {
      padding-left: 14px;
      padding-right: 14px;
    }
    .acc-cards-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
