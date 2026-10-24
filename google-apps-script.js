/**
 * GOOGLE APPS SCRIPT — ECOMM GROWTH LEAD CAPTURE (MULTI-ABA)
 * 
 * Planilha: https://docs.google.com/spreadsheets/d/1agWhzz4Z04uFC-pZqu6AP_9Vi49ZNke4iVwGNl4LoBQ/edit#gid=936492758
 * 
 * Separação automática:
 * - Leads de E-commerce (vindos de /ecommerce.html) -> Aba "E-commerce"
 * - Leads de Incorporadoras / Imóveis (vindos de /index.html) -> Aba "Imóveis"
 * 
 * ============================================================================
 * PASSO A PASSO PARA ATIVAR (1 MINUTO):
 * ============================================================================
 * 1. Abra sua planilha do Google Sheets.
 * 2. No menu superior, clique em: Extensões > Apps Script.
 * 3. Apague todo o código existente na janela e cole ESTE código completo.
 * 4. Clique no ícone de Salvar (ícone do disquete 💾 ou Ctrl+S).
 * 5. No canto superior direito, clique em "Implantar" (Deploy) > "Nova implantação" (New deployment).
 * 6. Na engrenagem ao lado de "Selecione o tipo", escolha "App da Web" (Web app).
 * 7. Configure os campos:
 *    - Descrição: Webhook Leads Ecomm Growth
 *    - Executar como: "Eu" (seu e-mail Google)
 *    - Quem pode acessar: "Qualquer pessoa" (Anyone) -> ESSENCIAL para receber os dados do site
 * 8. Clique em "Implantar" (Deploy) e autorize o acesso com sua conta Google.
 * 9. Copie a "URL do app da Web" (termina com /exec).
 * 10. Cole essa URL na constante WEBHOOK_URL do arquivo lead-modal.js (ou passe para mim que eu coloco para você).
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  // Aguarda até 10 segundos para evitar concorrência de múltiplos envios ao mesmo tempo
  lock.tryLock(10000);

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // Interpretar payload JSON enviado pelo modal
    var data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (err) {
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    // Identificar se o lead é de E-commerce ou Imóveis
    var segmento = data.segmento || "";
    var pageUrl = data.page_url || "";
    var sheet = getTargetSheet(ss, segmento, pageUrl);

    // Se a aba estiver sem cabeçalho, cria e estiliza automaticamente
    if (sheet.getLastRow() === 0) {
      var headers = [
        "Data/Hora",
        "Segmento",
        "Nome Completo",
        "Primeiro Nome",
        "Sobrenome",
        "WhatsApp",
        "WhatsApp (E.164)",
        "E-mail",
        "Empresa / Loja",
        "Investimento Mídia",
        "Cidade",
        "Estado (UF)",
        "CEP",
        "Mensagem",
        "Local do Botão",
        "Página de Origem",
        "Referrer",
        "UTM Source",
        "UTM Medium",
        "UTM Campaign",
        "UTM Content",
        "UTM Term",
        "GCLID",
        "FBCLID",
        "_fbp",
        "_fbc",
        "Event ID (Meta CAPI)",
        "External ID (Visitante)",
        "User Agent"
      ];
      sheet.appendRow(headers);

      // Estilização com o visual dark & neon do Ecomm Growth
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground("#111111");
      headerRange.setFontColor("#c8da42");
      headerRange.setFontWeight("bold");
      headerRange.setFontSize(10);
      sheet.setFrozenRows(1);
    }

    var userData = data.user_data || {};
    var address = userData.address || {};
    var nowStr = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss");

    var row = [
      nowStr,
      data.segmento ? data.segmento.toUpperCase() : "GERAL",
      data.nome || "",
      address.first_name || "",
      address.last_name || "",
      data.whatsapp || "",
      userData.phone_number || "",
      data.email || userData.email || "",
      data.empresa || "",
      data.investimento || "",
      data.cidade || address.city || "",
      data.estado || address.region || "",
      data.cep || address.postal_code || "",
      data.mensagem || "",
      data.form_location || "",
      data.page_url || "",
      data.referrer || "",
      data.utm_source || "",
      data.utm_medium || "",
      data.utm_campaign || "",
      data.utm_content || "",
      data.utm_term || "",
      data.gclid || "",
      data.fbclid || "",
      data.fbp || "",
      data.fbc || "",
      data.event_id || "",
      data.external_id || "",
      data.user_agent || ""
    ];

    sheet.appendRow(row);

    return ContentService
      .createTextOutput(JSON.stringify({
        status: "success",
        message: "Lead gravado com sucesso na aba " + sheet.getName(),
        sheet: sheet.getName(),
        event_id: data.event_id || ""
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        status: "error",
        message: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: "online",
      service: "Ecomm Growth Lead Webhook",
      timestamp: new Date().toISOString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Roteia para a aba correta com base no segmento ou URL da página
 */
function getTargetSheet(ss, segmento, pageUrl) {
  var isEcommerce = false;
  var seg = (segmento || "").toString().toLowerCase();
  var url = (pageUrl || "").toString().toLowerCase();

  if (seg.includes("ecom") || url.includes("ecommerce")) {
    isEcommerce = true;
  }

  var sheets = ss.getSheets();

  // 1. Procura por nome correspondente nas abas existentes
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName().toLowerCase();
    if (isEcommerce) {
      if (name.includes("ecom") || name.includes("loja") || name.includes("commerce")) {
        return sheets[i];
      }
    } else {
      if (name.includes("imov") || name.includes("imóv") || name.includes("imob") || name.includes("incorpor") || name.includes("lancament")) {
        return sheets[i];
      }
    }
  }

  // 2. Se a planilha tem 2 abas e não achou pelas palavras acima, usa a 1ª ou a 2ª aba
  if (sheets.length >= 2) {
    return isEcommerce ? sheets[0] : sheets[1];
  }

  // 3. Fallback: cria a aba com o nome correto se não existir
  var targetName = isEcommerce ? "E-commerce" : "Imóveis";
  var existing = ss.getSheetByName(targetName);
  if (existing) return existing;

  try {
    return ss.insertSheet(targetName);
  } catch (err) {
    return sheets[0];
  }
}
