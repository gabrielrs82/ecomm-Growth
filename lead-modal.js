/**
 * LEAD MODAL & ATTRIBUTION ENGINE — ECOMM GROWTH
 * 
 * Rastreamento 100% via Google Tag Manager (dataLayer)
 * Meta Conversions API (CAPI) & Google Enhanced Conversions ready
 * Webhook dispatch (n8n / Google Apps Script) com deduplicação via event_id
 */

(function () {
  'use strict';

  // ==========================================================================
  // CONFIGURAÇÃO DO WEBHOOK
  // ==========================================================================
  // Defina a URL do seu webhook do n8n ou Google Apps Script aqui ou via window.LEAD_MODAL_WEBHOOK_URL
  const WEBHOOK_URL = window.LEAD_MODAL_WEBHOOK_URL || 'https://webhook.site/placeholder-lead-webhook';

  // ==========================================================================
  // UTILITÁRIOS: STORAGE, COOKIES & UUID
  // ==========================================================================
  
  function safeSessionGet(key) {
    try {
      return sessionStorage.getItem(key) || '';
    } catch (e) {
      return '';
    }
  }

  function safeSessionSet(key, value) {
    try {
      if (value) {
        sessionStorage.setItem(key, value);
      }
    } catch (e) {}
  }

  function getCookie(name) {
    try {
      const cookies = document.cookie ? document.cookie.split('; ') : [];
      for (let i = 0; i < cookies.length; i++) {
        const parts = cookies[i].split('=');
        if (decodeURIComponent(parts[0]) === name) {
          return decodeURIComponent(parts.slice(1).join('='));
        }
      }
    } catch (e) {}
    return '';
  }

  function setCookie(name, value, days) {
    try {
      const d = new Date();
      d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
      let cookieStr = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${d.toUTCString()}; path=/; SameSite=Lax`;
      
      const host = window.location.hostname;
      if (host && host.includes('ecommgrowth.online')) {
        cookieStr += '; domain=.ecommgrowth.online';
      }
      document.cookie = cookieStr;
    } catch (e) {}
  }

  function generateUUID() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function removeAccents(str) {
    return (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  // ==========================================================================
  // GESTÃO DE IDENTIFICADORES & ATRIBUIÇÃO (UTMs, GCLID, FBCLID, _fbp, _fbc)
  // ==========================================================================

  // 1. external_id persistente (1 ano em cookie, fallback localStorage)
  function getOrCreateExternalId() {
    let extId = '';
    try {
      extId = getCookie('_external_id');
    } catch (e) {}

    if (!extId) {
      try {
        extId = localStorage.getItem('_external_id') || '';
      } catch (e) {}
    }

    if (!extId) {
      extId = generateUUID();
      try {
        setCookie('_external_id', extId, 365);
      } catch (e) {}
      try {
        localStorage.setItem('_external_id', extId);
      } catch (e) {}
    } else {
      // Revalida prazo de 1 ano
      try { setCookie('_external_id', extId, 365); } catch (e) {}
      try { localStorage.setItem('_external_id', extId); } catch (e) {}
    }
    return extId;
  }

  const externalId = getOrCreateExternalId();

  // 2. Captura inicial de parâmetros de URL e armazenamento em sessionStorage
  (function captureUrlParams() {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const trackParams = [
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_content',
        'utm_term',
        'gclid',
        'fbclid'
      ];

      trackParams.forEach(param => {
        const val = searchParams.get(param);
        if (val) {
          safeSessionSet(`lm_${param}`, val);
        }
      });

      // Gerenciar _fbc cookie
      const fbclid = searchParams.get('fbclid') || safeSessionGet('lm_fbclid');
      const existingFbc = getCookie('_fbc');
      if (!existingFbc && fbclid) {
        const generatedFbc = `fb.1.${Date.now()}.${fbclid}`;
        setCookie('_fbc', generatedFbc, 90);
      }
    } catch (e) {}
  })();

  function getAttributionData() {
    const searchParams = new URLSearchParams(window.location.search);
    const getVal = key => searchParams.get(key) || safeSessionGet(`lm_${key}`) || '';

    const fbclid = getVal('fbclid');
    let fbc = getCookie('_fbc');
    if (!fbc && fbclid) {
      fbc = `fb.1.${Date.now()}.${fbclid}`;
      setCookie('_fbc', fbc, 90);
    }

    return {
      utm_source: getVal('utm_source'),
      utm_medium: getVal('utm_medium'),
      utm_campaign: getVal('utm_campaign'),
      utm_content: getVal('utm_content'),
      utm_term: getVal('utm_term'),
      gclid: getVal('gclid'),
      fbclid: fbclid,
      fbp: getCookie('_fbp') || '',
      fbc: fbc || '',
      page_url: window.location.href,
      referrer: document.referrer || '',
      user_agent: navigator.userAgent || ''
    };
  }

  // ==========================================================================
  // INJEÇÃO AUTOMÁTICA DO MODAL NO DOM
  // ==========================================================================
  
  function injectModalHTML() {
    if (document.getElementById('lead-modal-backdrop')) {
      return; // Já injetado
    }

    const modalMarkup = `
      <div class="lead-modal-backdrop" id="lead-modal-backdrop" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="lead-modal-title">
        <div class="lead-modal-dialog" role="document">
          <button type="button" class="lead-modal-close" id="lead-modal-close" aria-label="Fechar formulário">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>

          <div class="lead-modal-content">
            <div class="lead-modal-header">
              <div class="lead-modal-badge">
                <span class="lead-modal-badge-dot"></span>
                Aceleração de Vendas
              </div>
              <h2 class="lead-modal-title" id="lead-modal-title">Vamos acelerar suas vendas?</h2>
              <p class="lead-modal-subtitle">Preencha os dados abaixo e nosso time de especialistas entrará em contato em até 24h úteis.</p>
            </div>

            <!-- Formulário -->
            <form class="lead-modal-form" id="lead-modal-form" novalidate>
              <!-- Anti-spam Honeypot -->
              <input type="text" name="website_url_hp" id="lm-hp" class="lead-hp-field" tabindex="-1" autocomplete="off" aria-hidden="true">

              <div class="lead-form-grid">
                <!-- Nome Completo -->
                <div class="lead-form-group lead-form-full">
                  <label class="lead-form-label" for="lm-nome">Nome completo <span class="lead-form-req">*</span></label>
                  <input type="text" id="lm-nome" name="nome" class="lead-form-input" placeholder="Ex: Gabriel Silva" required autocomplete="name">
                </div>

                <!-- WhatsApp -->
                <div class="lead-form-group">
                  <label class="lead-form-label" for="lm-whatsapp">WhatsApp <span class="lead-form-req">*</span></label>
                  <input type="tel" id="lm-whatsapp" name="whatsapp" class="lead-form-input" placeholder="(11) 99999-9999" required autocomplete="tel" maxlength="15">
                </div>

                <!-- E-mail -->
                <div class="lead-form-group">
                  <label class="lead-form-label" for="lm-email">E-mail corporativo <span class="lead-form-req">*</span></label>
                  <input type="email" id="lm-email" name="email" class="lead-form-input" placeholder="seu@email.com" required autocomplete="email">
                </div>

                <!-- Empresa -->
                <div class="lead-form-group">
                  <label class="lead-form-label" for="lm-empresa">Empresa / Loja <span class="lead-form-req">*</span></label>
                  <input type="text" id="lm-empresa" name="empresa" class="lead-form-input" placeholder="Nome da sua loja ou marca" required autocomplete="organization">
                </div>

                <!-- Investimento em Mídia -->
                <div class="lead-form-group">
                  <label class="lead-form-label" for="lm-investimento">Investimento mensal em mídia <span class="lead-form-req">*</span></label>
                  <div class="lead-select-wrap">
                    <select id="lm-investimento" name="investimento" class="lead-form-select" required>
                      <option value="" disabled selected>Selecione uma faixa...</option>
                      <option value="Até R$ 10 mil">Até R$ 10 mil</option>
                      <option value="R$ 10–30 mil">R$ 10–30 mil</option>
                      <option value="R$ 30–100 mil">R$ 30–100 mil</option>
                      <option value="Acima de R$ 100 mil">Acima de R$ 100 mil</option>
                    </select>
                    <svg class="lead-select-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </div>
                </div>

                <!-- Cidade -->
                <div class="lead-form-group">
                  <label class="lead-form-label" for="lm-cidade">Cidade <span class="lead-form-req">*</span></label>
                  <input type="text" id="lm-cidade" name="cidade" class="lead-form-input" placeholder="Ex: São Paulo" required autocomplete="address-level2">
                </div>

                <!-- Estado (27 UFs) -->
                <div class="lead-form-group">
                  <label class="lead-form-label" for="lm-estado">Estado (UF) <span class="lead-form-req">*</span></label>
                  <div class="lead-select-wrap">
                    <select id="lm-estado" name="estado" class="lead-form-select" required autocomplete="address-level1">
                      <option value="" disabled selected>Selecione o Estado...</option>
                      <option value="AC">AC - Acre</option>
                      <option value="AL">AL - Alagoas</option>
                      <option value="AP">AP - Amapá</option>
                      <option value="AM">AM - Amazonas</option>
                      <option value="BA">BA - Bahia</option>
                      <option value="CE">CE - Ceará</option>
                      <option value="DF">DF - Distrito Federal</option>
                      <option value="ES">ES - Espírito Santo</option>
                      <option value="GO">GO - Goiás</option>
                      <option value="MA">MA - Maranhão</option>
                      <option value="MT">MT - Mato Grosso</option>
                      <option value="MS">MS - Mato Grosso do Sul</option>
                      <option value="MG">MG - Minas Gerais</option>
                      <option value="PA">PA - Pará</option>
                      <option value="PB">PB - Paraíba</option>
                      <option value="PR">PR - Paraná</option>
                      <option value="PE">PE - Pernambuco</option>
                      <option value="PI">PI - Piauí</option>
                      <option value="RJ">RJ - Rio de Janeiro</option>
                      <option value="RN">RN - Rio Grande do Norte</option>
                      <option value="RS">RS - Rio Grande do Sul</option>
                      <option value="RO">RO - Rondônia</option>
                      <option value="RR">RR - Roraima</option>
                      <option value="SC">SC - Santa Catarina</option>
                      <option value="SP">SP - São Paulo</option>
                      <option value="SE">SE - Sergipe</option>
                      <option value="TO">TO - Tocantins</option>
                    </select>
                    <svg class="lead-select-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </div>
                </div>

                <!-- CEP (opcional) -->
                <div class="lead-form-group lead-form-full">
                  <label class="lead-form-label" for="lm-cep">CEP <span style="font-weight:400; color:var(--lm-text-muted);">(opcional)</span></label>
                  <input type="text" id="lm-cep" name="cep" class="lead-form-input" placeholder="00000-000" autocomplete="postal-code" maxlength="9">
                </div>

                <!-- Mensagem (opcional) -->
                <div class="lead-form-group lead-form-full">
                  <label class="lead-form-label" for="lm-mensagem">Mensagem / Observação <span style="font-weight:400; color:var(--lm-text-muted);">(opcional)</span></label>
                  <textarea id="lm-mensagem" name="mensagem" class="lead-form-textarea" placeholder="Conte brevemente sobre seu momento, nicho ou objetivos..."></textarea>
                </div>
              </div>

              <!-- Checkbox LGPD -->
              <label class="lead-form-checkbox-group">
                <input type="checkbox" id="lm-lgpd" name="lgpd" required>
                <span class="lead-form-checkbox-label">
                  Concordo em ser contatado e que meus dados sejam usados para mensuração de anúncios (Meta e Google), conforme a <a href="/indexprivacidade.html" target="_blank" rel="noopener noreferrer">Política de Privacidade</a>.
                </span>
              </label>

              <!-- Mensagem de Erro -->
              <div class="lead-form-error-msg" id="lead-form-error" role="alert">
                Não foi possível enviar, tente novamente.
              </div>

              <!-- Botão de Envio -->
              <button type="submit" class="lead-form-submit" id="lead-form-submit-btn">
                <span class="lead-btn-spinner" aria-hidden="true"></span>
                <span class="lead-btn-text">Quero acelerar minhas vendas</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </button>
            </form>

            <!-- Estado de Sucesso -->
            <div class="lead-modal-success" id="lead-modal-success" aria-live="polite">
              <div class="lead-success-icon-wrap">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <h3 class="lead-success-title">Recebemos seu contato!</h3>
              <p class="lead-success-desc">Retornamos em até 24h úteis para apresentar nosso diagnóstico e plano de aceleração sob medida para o seu e-commerce.</p>
              <button type="button" class="lead-success-btn" id="lead-success-close-btn">Fechar janela</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalMarkup);
  }

  // ==========================================================================
  // LÓGICA DO MODAL, MÁSCARAS E VALIDAÇÃO
  // ==========================================================================

  let currentFormLocation = '';
  let formStartedFired = false;
  let isSubmitting = false;

  function openModal(triggerElement) {
    injectModalHTML();

    const backdrop = document.getElementById('lead-modal-backdrop');
    if (!backdrop) return;

    // Determinar form_location: <id ou texto do botão> | <página>
    let btnText = '';
    if (triggerElement) {
      btnText = (triggerElement.id || triggerElement.innerText || triggerElement.getAttribute('aria-label') || 'CTA').trim();
      btnText = btnText.replace(/\s+/g, ' ');
    } else {
      btnText = 'CTA';
    }
    const pageName = window.location.pathname || '/index.html';
    currentFormLocation = `${btnText} | ${pageName}`;

    // Reset de estado
    formStartedFired = false;
    isSubmitting = false;

    const errorEl = document.getElementById('lead-form-error');
    if (errorEl) {
      errorEl.classList.remove('is-visible');
      errorEl.textContent = 'Não foi possível enviar, tente novamente.';
    }

    // Travar scroll da página
    document.body.style.overflow = 'hidden';

    // Abrir modal com animação
    backdrop.classList.add('is-active');
    backdrop.setAttribute('aria-hidden', 'false');

    // Foco automático no primeiro campo
    setTimeout(() => {
      const firstInput = document.getElementById('lm-nome');
      if (firstInput) {
        firstInput.focus();
      }
    }, 150);

    // Evento dataLayer: form_open
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'form_open',
      form_id: 'lead_form',
      form_location: currentFormLocation
    });
  }

  function closeModal() {
    const backdrop = document.getElementById('lead-modal-backdrop');
    if (!backdrop) return;

    backdrop.classList.remove('is-active');
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // Máscaras de entrada
  function setupMasks() {
    const phoneInput = document.getElementById('lm-whatsapp');
    if (phoneInput) {
      phoneInput.addEventListener('input', function (e) {
        let v = e.target.value.replace(/\D/g, '');
        if (v.length > 11) v = v.slice(0, 11);

        if (v.length > 10) {
          e.target.value = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
        } else if (v.length > 6) {
          e.target.value = `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
        } else if (v.length > 2) {
          e.target.value = `(${v.slice(0, 2)}) ${v.slice(2)}`;
        } else if (v.length > 0) {
          e.target.value = `(${v}`;
        } else {
          e.target.value = '';
        }
      });
    }

    const cepInput = document.getElementById('lm-cep');
    if (cepInput) {
      cepInput.addEventListener('input', function (e) {
        let v = e.target.value.replace(/\D/g, '');
        if (v.length > 8) v = v.slice(0, 8);

        if (v.length > 5) {
          e.target.value = `${v.slice(0, 5)}-${v.slice(5)}`;
        } else {
          e.target.value = v;
        }
      });
    }
  }

  // Rastreamento form_start (disparado uma única vez na primeira interação por abertura)
  function setupFormStartTracking() {
    const form = document.getElementById('lead-modal-form');
    if (!form) return;

    const trackInteraction = () => {
      if (!formStartedFired) {
        formStartedFired = true;
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
          event: 'form_start',
          form_id: 'lead_form'
        });
      }
    };

    form.querySelectorAll('input, select, textarea').forEach(el => {
      if (el.id !== 'lm-hp') {
        el.addEventListener('focus', trackInteraction, { passive: true });
        el.addEventListener('input', trackInteraction, { passive: true });
      }
    });
  }

  // ==========================================================================
  // VALIDAÇÃO & ENVIO DO FORMULÁRIO
  // ==========================================================================

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function setupFormSubmit() {
    const form = document.getElementById('lead-modal-form');
    const submitBtn = document.getElementById('lead-form-submit-btn');
    const btnText = submitBtn ? submitBtn.querySelector('.lead-btn-text') : null;
    const errorEl = document.getElementById('lead-form-error');
    const successEl = document.getElementById('lead-modal-success');

    if (!form) return;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      if (isSubmitting) return;

      // 1. Anti-spam Honeypot Check
      const hp = document.getElementById('lm-hp');
      if (hp && hp.value.trim() !== '') {
        // Robô detectado: simula sucesso silencioso sem disparar webhook ou dataLayer
        form.style.display = 'none';
        if (successEl) successEl.classList.add('is-visible');
        return;
      }

      // 2. Coleta de campos do formulário
      const nomeInput = document.getElementById('lm-nome');
      const whatsappInput = document.getElementById('lm-whatsapp');
      const emailInput = document.getElementById('lm-email');
      const empresaInput = document.getElementById('lm-empresa');
      const investimentoInput = document.getElementById('lm-investimento');
      const cidadeInput = document.getElementById('lm-cidade');
      const estadoInput = document.getElementById('lm-estado');
      const cepInput = document.getElementById('lm-cep');
      const mensagemInput = document.getElementById('lm-mensagem');
      const lgpdInput = document.getElementById('lm-lgpd');

      const rawNome = nomeInput ? nomeInput.value.trim() : '';
      const rawWhatsapp = whatsappInput ? whatsappInput.value.trim() : '';
      const rawEmail = emailInput ? emailInput.value.trim() : '';
      const rawEmpresa = empresaInput ? empresaInput.value.trim() : '';
      const rawInvestimento = investimentoInput ? investimentoInput.value : '';
      const rawCidade = cidadeInput ? cidadeInput.value.trim() : '';
      const rawEstado = estadoInput ? estadoInput.value : '';
      const rawCep = cepInput ? cepInput.value.trim() : '';
      const rawMensagem = mensagemInput ? mensagemInput.value.trim() : '';
      const isLgpdChecked = lgpdInput ? lgpdInput.checked : false;

      // Reset de erros visuais anteriores
      form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
      if (errorEl) errorEl.classList.remove('is-visible');

      let hasError = false;

      if (!rawNome) {
        nomeInput.classList.add('is-invalid');
        hasError = true;
      }

      const phoneDigits = rawWhatsapp.replace(/\D/g, '');
      if (phoneDigits.length < 10) {
        whatsappInput.classList.add('is-invalid');
        hasError = true;
      }

      if (!rawEmail || !validateEmail(rawEmail)) {
        emailInput.classList.add('is-invalid');
        hasError = true;
      }

      if (!rawEmpresa) {
        empresaInput.classList.add('is-invalid');
        hasError = true;
      }

      if (!rawInvestimento) {
        investimentoInput.classList.add('is-invalid');
        hasError = true;
      }

      if (!rawCidade) {
        cidadeInput.classList.add('is-invalid');
        hasError = true;
      }

      if (!rawEstado) {
        estadoInput.classList.add('is-invalid');
        hasError = true;
      }

      if (!isLgpdChecked) {
        if (lgpdInput) lgpdInput.classList.add('is-invalid');
        hasError = true;
      }

      if (hasError) {
        if (errorEl) {
          errorEl.textContent = 'Por favor, preencha todos os campos obrigatórios corretamente.';
          errorEl.classList.add('is-visible');
        }
        return;
      }

      // 3. Normalização dos dados para Meta CAPI e Google Enhanced Conversions
      const cleanEmail = rawEmail.toLowerCase().trim();

      let phoneE164 = phoneDigits;
      if (phoneE164.startsWith('55') && (phoneE164.length === 12 || phoneE164.length === 13)) {
        phoneE164 = `+${phoneE164}`;
      } else if (phoneE164.length === 10 || phoneE164.length === 11) {
        phoneE164 = `+55${phoneE164}`;
      } else {
        phoneE164 = `+${phoneE164}`;
      }

      // Separar Nome completo em first_name e last_name
      const normalizedFullName = removeAccents(rawNome);
      const nameParts = normalizedFullName.split(/\s+/).filter(Boolean);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const cleanCity = removeAccents(rawCidade);
      const cleanRegion = (rawEstado || '').toLowerCase().trim();
      const cleanCep = rawCep.replace(/\D/g, '');

      // 4. Identificadores & IDs de evento
      const eventId = generateUUID();
      const unixTimestamp = Math.floor(Date.now() / 1000);
      const attribution = getAttributionData();

      // Identificar segmento da página: 'ecommerce' vs 'imoveis'
      const isEcomm = window.location.pathname.toLowerCase().includes('ecommerce') ||
        window.location.href.toLowerCase().includes('ecommerce');
      const currentSegmento = isEcomm ? 'ecommerce' : 'imoveis';

      // Payload estruturado para o Webhook (suporta n8n, Google Sheets e automações)
      const webhookPayload = {
        event_id: eventId,
        external_id: externalId,
        timestamp: unixTimestamp,
        form_id: 'lead_form',
        segmento: currentSegmento,
        form_location: currentFormLocation,
        
        // Dados originais
        nome: rawNome,
        whatsapp: rawWhatsapp,
        email: rawEmail,
        empresa: rawEmpresa,
        investimento: rawInvestimento,
        cidade: rawCidade,
        estado: rawEstado,
        cep: rawCep,
        mensagem: rawMensagem,

        // Atribuição & Rastreamento
        utm_source: attribution.utm_source,
        utm_medium: attribution.utm_medium,
        utm_campaign: attribution.utm_campaign,
        utm_content: attribution.utm_content,
        utm_term: attribution.utm_term,
        gclid: attribution.gclid,
        fbclid: attribution.fbclid,
        fbp: attribution.fbp,
        fbc: attribution.fbc,
        page_url: attribution.page_url,
        referrer: attribution.referrer,
        user_agent: attribution.user_agent,

        // Dados normalizados prontos para CAPI / CRM
        user_data: {
          email: cleanEmail,
          phone_number: phoneE164,
          address: {
            first_name: firstName,
            last_name: lastName,
            city: cleanCity,
            region: cleanRegion,
            postal_code: cleanCep,
            country: 'br'
          }
        }
      };

      // 5. Interface em estado de carregamento
      isSubmitting = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('is-loading');
      }
      if (btnText) btnText.textContent = 'Enviando...';

      try {
        const isGoogleAppsScript = WEBHOOK_URL.includes('script.google.com');
        const contentType = isGoogleAppsScript ? 'text/plain;charset=utf-8' : 'application/json';

        const response = await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': contentType
          },
          body: JSON.stringify(webhookPayload)
        });

        if (response.ok || (isGoogleAppsScript && response.type === 'opaque')) {
          // SUCESSO: Dispara SOMENTE AGORA o evento generate_lead no dataLayer
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({
            event: 'generate_lead',
            form_id: 'lead_form',
            segmento: currentSegmento,
            form_location: currentFormLocation,
            investimento: rawInvestimento,
            event_id: eventId,
            external_id: externalId,
            user_data: {
              email: cleanEmail,
              phone_number: phoneE164,
              address: {
                first_name: firstName,
                last_name: lastName,
                city: cleanCity,
                region: cleanRegion,
                postal_code: cleanCep,
                country: 'br'
              }
            }
          });

          // Transição suave para mensagem de sucesso
          form.style.display = 'none';
          if (successEl) {
            successEl.classList.add('is-visible');
          }
        } else {
          throw new Error(`HTTP_${response.status}`);
        }
      } catch (err) {
        console.error('[Lead Modal] Erro ao enviar lead:', err);

        const errorType = err.message && err.message.startsWith('HTTP_')
          ? err.message.replace('HTTP_', '')
          : 'network';

        // Disparo do evento form_error no dataLayer
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
          event: 'form_error',
          form_id: 'lead_form',
          error_type: errorType
        });

        // Exibe mensagem de erro e mantém os dados digitados
        if (errorEl) {
          errorEl.textContent = 'Não foi possível enviar, tente novamente.';
          errorEl.classList.add('is-visible');
        }
      } finally {
        isSubmitting = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.classList.remove('is-loading');
        }
        if (btnText) btnText.textContent = 'Quero acelerar minhas vendas';
      }
    });
  }

  // ==========================================================================
  // INICIALIZAÇÃO E DELEGAÇÃO DE CLIQUES
  // ==========================================================================

  function initLeadModal() {
    injectModalHTML();
    setupMasks();
    setupFormStartTracking();
    setupFormSubmit();

    // Fechar ao clicar no botão X
    document.addEventListener('click', function (e) {
      if (e.target.closest('#lead-modal-close') || e.target.closest('#lead-success-close-btn')) {
        closeModal();
      }
    });

    // Fechar ao clicar no fundo escuro (backdrop fora do diálogo)
    const backdrop = document.getElementById('lead-modal-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', function (e) {
        if (e.target === backdrop) {
          closeModal();
        }
      });
    }

    // Fechar com tecla ESC
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.key === 'Esc') {
        const bd = document.getElementById('lead-modal-backdrop');
        if (bd && bd.classList.contains('is-active')) {
          closeModal();
        }
      }
    });

    // Interceptar cliques em todos os botões CTA do site
    document.addEventListener('click', function (e) {
      const target = e.target.closest('a, button');
      if (!target) return;

      const isModalTrigger =
        target.hasAttribute('data-open-modal') ||
        target.classList.contains('open-lead-modal') ||
        (target.getAttribute('href') && target.getAttribute('href').includes('formester.com'));

      if (isModalTrigger) {
        e.preventDefault();
        openModal(target);
      }
    });
  }

  // Expor API global caso necessário
  window.EcommLeadModal = {
    open: openModal,
    close: closeModal
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLeadModal);
  } else {
    initLeadModal();
  }
})();
