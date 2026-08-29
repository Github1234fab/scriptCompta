<script>
  import { GLOSSARY_DATA } from '../lib/data-sample.js';
</script>

<div class="page-title-section">
  <h1 class="page-title">Dictionnaire Déjargonisé</h1>
  <p class="page-subtitle">La comptabilité traduite dans la langue de tous les jours.</p>
</div>

<div class="pedago-banner" style="margin-bottom: 35px;">
  <div class="pedago-banner-icon">📘</div>
  <div class="pedago-banner-text">
    <h4>Pourquoi ce dictionnaire ?</h4>
    <p>La comptabilité regorge de termes techniques intimidants qui sont en réalité très simples à comprendre quand ils sont traduits sans jargon. Ce dictionnaire vous aide à faire le lien.</p>
  </div>
</div>

<div id="glossary-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; margin-bottom: 40px;">
  {#each GLOSSARY_DATA as item}
    <div class="glossary-item" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 24px; transition: var(--transition-normal);">
      <h4 style="font-family: var(--font-title); font-size: 1.15rem; color: white; margin-bottom: 8px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
        <span>{item.terme}</span>
        <span style="font-size: 0.75rem; color: var(--color-primary-light); background: var(--color-primary-glow); padding: 3px 8px; border-radius: 20px; font-weight: 600;">
          💡 En clair
        </span>
      </h4>
      <div style="font-size: 0.82rem; text-transform: uppercase; font-weight: 700; color: var(--color-success); margin-bottom: 10px; letter-spacing: 0.5px;">
        👉 Traduction : {item.trad}
      </div>
      <p style="font-size: 0.88rem; color: var(--text-secondary); line-height: 1.5;">
        {item.def}
      </p>
    </div>
  {/each}
</div>

<style>
  .glossary-item:hover {
    border-color: var(--border-hover);
    background: var(--bg-card-hover) !important;
    transform: translateY(-2px);
    box-shadow: var(--shadow-sm);
  }
</style>
