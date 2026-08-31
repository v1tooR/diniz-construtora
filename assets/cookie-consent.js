(() => {
  'use strict';

  const STORAGE_KEY = 'diniz_cookie_consent_v1';
  const VERSION = 1;
  const MAX_AGE = 180 * 24 * 60 * 60 * 1000;
  const defaultPreferences = { necessary: true, external: false };
  let preferences = { ...defaultPreferences };
  let hasChoice = false;
  let lastFocus = null;

  const readChoice = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      const isCurrent = saved?.version === VERSION;
      const isFresh = Date.now() - new Date(saved?.updatedAt).getTime() < MAX_AGE;
      if (!isCurrent || !isFresh || typeof saved?.preferences?.external !== 'boolean') return;
      preferences = { necessary: true, external: saved.preferences.external };
      hasChoice = true;
    } catch (_) {
      /* O site continua funcional quando o armazenamento local está bloqueado. */
    }
  };

  const writeChoice = (next, source) => {
    preferences = { necessary: true, external: Boolean(next.external) };
    hasChoice = true;
    const record = {
      version: VERSION,
      updatedAt: new Date().toISOString(),
      preferences
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(record)); } catch (_) {}
    syncInterface();
    window.dispatchEvent(new CustomEvent('diniz:consentchange', {
      detail: { preferences: { ...preferences }, source }
    }));
  };

  const markup = `
    <div class="cookie-banner" id="cookie-banner" role="region" aria-labelledby="cookie-title" aria-describedby="cookie-description">
      <div class="cookie-banner__inner">
        <div>
          <p class="cookie-banner__eyebrow">Privacidade em primeiro plano</p>
          <h2 id="cookie-title">Você escolhe o que carregar.</h2>
          <p id="cookie-description">Usamos armazenamento local necessário para lembrar sua escolha. Conteúdos externos, como o modelo 3D do Sketchfab, só são carregados com sua autorização. Consulte a <a href="politica-de-privacidade.html">Política de Privacidade</a>.</p>
        </div>
        <div class="cookie-banner__actions" aria-label="Opções de consentimento">
          <button class="cookie-button cookie-button--primary" type="button" data-consent="all">Aceitar todos</button>
          <button class="cookie-button" type="button" data-consent="necessary">Só necessários</button>
          <button class="cookie-button cookie-button--quiet" type="button" data-consent="settings">Personalizar</button>
        </div>
      </div>
    </div>

    <button class="cookie-settings-shortcut" type="button" data-consent="settings" aria-label="Rever preferências de cookies">Cookies</button>

    <dialog class="cookie-dialog" id="cookie-dialog" aria-labelledby="cookie-dialog-title">
      <div class="cookie-dialog__head">
        <div>
          <p class="cookie-dialog__eyebrow">Centro de preferências</p>
          <h2 id="cookie-dialog-title">Controle de cookies</h2>
        </div>
        <button class="cookie-dialog__close" type="button" data-consent="close" aria-label="Fechar preferências">×</button>
      </div>
      <p class="cookie-dialog__intro">Escolha quais tecnologias podem ser usadas. A recusa de recursos opcionais não impede a navegação no site. Você pode mudar esta decisão a qualquer momento pelo botão “Cookies”.</p>

      <div class="cookie-category">
        <div>
          <h3>Estritamente necessários</h3>
          <p>Guardam sua preferência de privacidade no navegador e permitem funções básicas do site. Não podem ser desativados neste painel.</p>
        </div>
        <span class="cookie-category__status">Sempre ativos</span>
      </div>

      <div class="cookie-category">
        <div>
          <h3>Conteúdo externo</h3>
          <p>Permite carregar experiências incorporadas de terceiros, como o visualizador 3D do Sketchfab. Esses fornecedores podem tratar dados técnicos conforme suas próprias políticas.</p>
        </div>
        <label class="cookie-switch">
          <span class="sr-only">Permitir conteúdo externo</span>
          <input id="cookie-external" type="checkbox">
          <span aria-hidden="true"></span>
        </label>
      </div>

      <div class="cookie-dialog__actions">
        <button class="cookie-button" type="button" data-consent="necessary">Só necessários</button>
        <button class="cookie-button" type="button" data-consent="save">Salvar preferências</button>
        <button class="cookie-button cookie-button--primary" type="button" data-consent="all">Aceitar todos</button>
      </div>
    </dialog>`;

  const init = () => {
    readChoice();
    const root = document.createElement('div');
    root.id = 'diniz-cookie-root';
    root.innerHTML = markup;
    document.body.appendChild(root);

    root.addEventListener('click', (event) => {
      const control = event.target.closest('[data-consent]');
      if (!control) return;
      const action = control.dataset.consent;
      if (action === 'all') commit({ external: true }, 'accept-all');
      if (action === 'necessary') commit({ external: false }, 'necessary-only');
      if (action === 'settings') openSettings();
      if (action === 'save') commit({ external: root.querySelector('#cookie-external').checked }, 'custom');
      if (action === 'close') closeSettings();
    });

    root.querySelector('#cookie-dialog').addEventListener('close', () => {
      restoreFocus();
      if (!hasChoice) showBanner();
    });
    document.querySelectorAll('[data-cookie-settings]').forEach((control) => {
      control.addEventListener('click', (event) => {
        event.preventDefault();
        openSettings();
      });
    });

    syncInterface();
    if (!hasChoice) requestAnimationFrame(() => showBanner());
  };

  const rootElement = () => document.querySelector('#diniz-cookie-root');
  const bannerElement = () => document.querySelector('#cookie-banner');
  const dialogElement = () => document.querySelector('#cookie-dialog');

  const syncInterface = () => {
    const root = rootElement();
    if (!root) return;
    root.classList.toggle('has-choice', hasChoice);
    const checkbox = root.querySelector('#cookie-external');
    if (checkbox) checkbox.checked = preferences.external;
  };

  const showBanner = () => {
    bannerElement()?.classList.add('is-visible');
    document.body.classList.add('cookie-banner-open');
  };

  const hideBanner = () => {
    bannerElement()?.classList.remove('is-visible');
    document.body.classList.remove('cookie-banner-open');
  };

  const openSettings = () => {
    const dialog = dialogElement();
    if (!dialog || dialog.open) return;
    lastFocus = document.activeElement;
    dialog.querySelector('#cookie-external').checked = preferences.external;
    hideBanner();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  };

  const closeSettings = () => {
    const dialog = dialogElement();
    if (!dialog) return;
    if (typeof dialog.close === 'function') dialog.close();
    else {
      dialog.removeAttribute('open');
      restoreFocus();
    }
    if (!hasChoice) showBanner();
  };

  const restoreFocus = () => {
    if (lastFocus instanceof HTMLElement) lastFocus.focus({ preventScroll: true });
    lastFocus = null;
  };

  const commit = (next, source) => {
    writeChoice(next, source);
    hideBanner();
    const dialog = dialogElement();
    if (dialog?.open) dialog.close();
  };

  window.DinizConsent = {
    allows: (category) => category === 'necessary' || Boolean(preferences[category]),
    get: () => ({ ...preferences }),
    open: openSettings,
    reset: () => {
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
      preferences = { ...defaultPreferences };
      hasChoice = false;
      syncInterface();
      showBanner();
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
