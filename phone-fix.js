/*
 * Ecomm Growth – campo de WhatsApp com seleção de país (Brasil 🇧🇷 / Estados Unidos 🇺🇸).
 *
 * Problemas que resolve:
 *  - gente digitando o 55 do país no lugar do DDD (o campo cortava o fim do número);
 *  - leads dos EUA (anúncios no exterior), que não cabiam na máscara brasileira.
 *
 * Como funciona (junto com o lead-modal.js, sem precisar mexer nele):
 *  - coloca um seletor de país com bandeira antes do campo (Brasil já vem marcado);
 *  - Brasil: mantém a máscara atual "(11) 99999-9999" e confere DDD + 9 + 8 dígitos;
 *  - EUA: máscara "(212) 555-1234" e confere 10 dígitos;
 *  - ao enviar, número de fora do Brasil vai com o código do país na frente ("+1 (212) 555-1234"),
 *    que é o formato que o agente do WhatsApp entende; número do Brasil vai como sempre foi;
 *  - colar um número com +55 ou +1 já escolhe o país e arruma o número;
 *  - número errado mostra o aviso e não deixa enviar.
 *
 * Para adicionar outro país, acrescente uma linha em COUNTRIES.
 *
 * Instalação: coloque este arquivo na raiz do site (ao lado do lead-modal.js) e inclua, logo depois do
 * <script src="/lead-modal.js">, em todas as páginas que têm o formulário:
 *     <script src="/phone-fix.js" defer></script>
 */
(function () {
  "use strict";

  var SELECTOR = '#lm-whatsapp, input[type="tel"][name="whatsapp"]';

  var COUNTRIES = [
    { code: "BR", flag: "🇧🇷", dial: "55", name: "Brasil", placeholder: "(11) 99999-9999",
      hint: "DDD + número, sem o +55" },
    { code: "US", flag: "🇺🇸", dial: "1", name: "Estados Unidos", placeholder: "(212) 555-1234",
      hint: "Area code + number" }
  ];

  function digits(v) { return String(v || "").replace(/\D/g, ""); }
  function country(code) { for (var i = 0; i < COUNTRIES.length; i++) if (COUNTRIES[i].code === code) return COUNTRIES[i]; return COUNTRIES[0]; }

  // ---------------------------------------------------------------- formato e validação por país
  function formatBR(d) {
    d = d.slice(0, 11);
    if (!d) return "";
    if (d.length <= 2) return "(" + d;
    if (d.length <= 6) return "(" + d.slice(0, 2) + ") " + d.slice(2);
    if (d.length <= 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
    return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
  }

  function formatUS(d) {
    d = d.slice(0, 10);
    if (!d) return "";
    if (d.length <= 3) return "(" + d;
    if (d.length <= 6) return "(" + d.slice(0, 3) + ") " + d.slice(3);
    return "(" + d.slice(0, 3) + ") " + d.slice(3, 6) + "-" + d.slice(6);
  }

  function problemBR(value) {
    var d = digits(value);
    if (d.length === 13 && d.indexOf("55") === 0) d = d.slice(2);
    if (d.length < 10) return "Digite o DDD + o número completo do WhatsApp.";
    if (d.length > 11) return "Número com dígitos a mais. Digite só o DDD + número, sem o +55.";
    if (d.length === 11 && d.charAt(2) !== "9") {
      return "Confira o número: digite só o DDD + número, sem o 55 do país. Ex.: (11) 99999-9999";
    }
    if (d.length === 10 && "2345".indexOf(d.charAt(2)) === -1) {
      return "Confira o número: digite o DDD + o número do celular com o 9. Ex.: (11) 99999-9999";
    }
    return "";
  }

  function problemUS(value) {
    var d = digits(value);
    if (d.length === 11 && d.charAt(0) === "1") d = d.slice(1);
    if (d.length !== 10) return "Enter the full number: area code + 7 digits. Ex.: (212) 555-1234";
    if ("01".indexOf(d.charAt(0)) !== -1) return "Check the area code. Ex.: (212) 555-1234";
    return "";
  }

  function problem(input) { return selected(input) === "US" ? problemUS(input.value) : problemBR(input.value); }

  // ---------------------------------------------------------------- seletor de país
  function selectFor(input) { return document.getElementById((input.id || "whatsapp") + "-pais"); }
  function selected(input) { var s = selectFor(input); return s ? s.value : "BR"; }

  function setup(input) {
    if (input.dataset.egPhone) return;
    input.dataset.egPhone = "1";

    var wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;gap:8px;align-items:stretch";
    input.parentNode.insertBefore(wrap, input);

    var sel = document.createElement("select");
    sel.id = (input.id || "whatsapp") + "-pais";
    sel.setAttribute("aria-label", "País do WhatsApp");
    sel.className = input.className;          // mesmo visual do campo
    sel.style.cssText = "flex:0 0 auto;width:auto;min-width:96px;padding-right:8px;cursor:pointer";
    COUNTRIES.forEach(function (c) {
      var o = document.createElement("option");
      o.value = c.code;
      o.textContent = c.flag + " +" + c.dial;
      o.title = c.name;
      sel.appendChild(o);
    });
    wrap.appendChild(sel);
    wrap.appendChild(input);
    input.style.flex = "1 1 auto";
    input.style.minWidth = "0";

    var hint = document.createElement("div");
    hint.id = (input.id || "whatsapp") + "-dica";
    hint.style.cssText = "font-size:12px;opacity:.7;margin-top:4px";
    wrap.insertAdjacentElement("afterend", hint);

    sel.addEventListener("change", function () { applyCountry(input, true); input.focus(); });
    applyCountry(input, false);
  }

  function applyCountry(input, reformat) {
    var c = country(selected(input));
    input.setAttribute("placeholder", c.placeholder);
    var hint = document.getElementById((input.id || "whatsapp") + "-dica");
    if (hint) hint.textContent = c.hint;
    if (reformat) {
      var d = digits(input.value.replace(/^\s*\+\d+\s*/, ""));
      input.value = c.code === "US" ? formatUS(d) : formatBR(d);
      validate(input, false);
    }
  }

  function errorBox(input) {
    var id = (input.id || "whatsapp") + "-erro";
    var box = document.getElementById(id);
    if (!box) {
      box = document.createElement("div");
      box.id = id;
      box.setAttribute("role", "alert");
      box.style.cssText = "color:#e5484d;font-size:13px;line-height:1.35;margin-top:6px;display:none";
      var anchor = document.getElementById((input.id || "whatsapp") + "-dica") || input;
      anchor.insertAdjacentElement("afterend", box);
    }
    return box;
  }

  function validate(input, show) {
    var msg = problem(input);
    input.setCustomValidity(msg);
    var box = errorBox(input);
    if (show) {
      box.textContent = msg;
      box.style.display = msg ? "block" : "none";
    } else if (!msg) {
      box.style.display = "none";
    }
    return !msg;
  }

  function isPhone(el) { return el && el.matches && el.matches(SELECTOR); }

  // Prepara o campo assim que ele aparece (o formulário é criado pelo lead-modal.js)
  function scan() { var els = document.querySelectorAll(SELECTOR); for (var i = 0; i < els.length; i++) setup(els[i]); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan); else scan();
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });

  // Digitação: no Brasil vale a máscara do lead-modal.js; nos EUA usamos a nossa (e paramos a brasileira)
  document.addEventListener("input", function (e) {
    if (!isPhone(e.target)) return;
    if (selected(e.target) === "US") {
      e.stopPropagation();
      e.target.value = formatUS(digits(e.target.value));
    }
    validate(e.target, false);
  }, true);

  // Colar: reconhece +55 e +1 e escolhe o país sozinho
  document.addEventListener("paste", function (e) {
    if (!isPhone(e.target)) return;
    var text = (e.clipboardData || window.clipboardData).getData("text") || "";
    var d = digits(text);
    var sel = selectFor(e.target);
    var code = null;
    if (/^\s*\+?\s*1[\s(]/.test(text) && d.length === 11) { code = "US"; d = d.slice(1); }
    else if (d.indexOf("55") === 0 && d.length >= 12) { code = "BR"; d = d.slice(2); }
    if (code || d.length >= 10) {
      e.preventDefault();
      if (code && sel) sel.value = code;
      applyCountry(e.target, false);
      e.target.value = selected(e.target) === "US" ? formatUS(d) : formatBR(d);
      validate(e.target, true);
    }
  }, true);

  // Ao sair do campo: mostra o aviso se estiver errado
  document.addEventListener("focusout", function (e) {
    if (isPhone(e.target) && digits(e.target.value).length) validate(e.target, true);
  }, true);

  // Ao enviar: bloqueia número errado; número de fora do Brasil vai com "+código do país"
  document.addEventListener("submit", function (e) {
    var input = e.target && e.target.querySelector && e.target.querySelector(SELECTOR);
    if (!input) return;
    var c = country(selected(input));
    input.value = input.value.replace(/^\s*\+\d+\s*/, "");   // não duplica o código se enviar de novo
    if (!validate(input, true)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      input.focus();
      if (input.reportValidity) input.reportValidity();
      return;
    }
    if (c.code !== "BR") input.value = "+" + c.dial + " " + formatUS(digits(input.value));
  }, true);

  // Para teste no console: window.egPhoneFix.problemBR("(55) 31999-5755")
  window.egPhoneFix = { problemBR: problemBR, problemUS: problemUS, formatBR: formatBR, formatUS: formatUS };
})();
