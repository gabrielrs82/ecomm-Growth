// ============================================================
// Servidor de E-mails Transacionais — Integração Resend
// ============================================================

const { Resend } = require('resend');
const { createLogger } = require('./logger');

const logger = createLogger('EMAIL_SERVICE');

const resendApiKey = process.env.RESEND_API_KEY;

// Inicializa a biblioteca caso possua a chave setada no .env
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const FROM_EMAIL = process.env.EMAIL_FROM || 'Imob Growth AI <nao-responder@imobgrowth.com.br>';

/**
 * Executa o envio do email aplicando retentativas sob falhas temporárias
 */
async function sendWithRetry(payload, retries = 3, delay = 1000) {
    if (!resend) {
        logger.info('Simulando envio de email (RESEND_API_KEY não configurada).', {
            to: payload.to,
            subject: payload.subject
        });
        return { id: 'mock-email-id-1234', success: true };
    }

    try {
        const { data, error } = await resend.emails.send(payload);
        if (error) throw error;
        return { id: data.id, success: true };
    } catch (err) {
        if (retries > 0) {
            logger.warn(`Falha temporária ao enviar email. Nova tentativa em ${delay}ms...`, {
                to: payload.to,
                error: err.message,
                retriesLeft: retries
            });
            await new Promise(resolve => setTimeout(resolve, delay));
            return sendWithRetry(payload, retries - 1, delay * 2);
        }
        logger.error('Erro definitivo após esgotar retentativas de e-mail.', {
            to: payload.to,
            subject: payload.subject,
            error: err.message
        });
        throw err;
    }
}

/**
 * Função principal assíncrona (fire and forget) para disparar emails em background
 */
async function sendEmail({ to, subject, html }) {
    if (!to || !subject || !html) {
        logger.error('Parâmetros obrigatórios ausentes para envio de e-mail.');
        return;
    }

    const payload = {
        from: FROM_EMAIL,
        to: Array.isArray(to) ? to : [to],
        subject,
        html
    };

    // Dispara em background sem travar a requisição do usuário
    sendWithRetry(payload)
        .then(res => {
            logger.info('Email enviado com sucesso.', {
                to: payload.to,
                subject: payload.subject,
                emailId: res.id
            });
        })
        .catch(err => {
            // Silenciado no fluxo principal, mantido o log de erro no servidor
            logger.error('Erro no processamento do e-mail em background:', {
                message: err.message
            });
        });
}

// Templates HTML Responsivos
function getWelcomeTemplate(name, verificationUrl = 'https://imobgrowth.com.br') {
    return `
    <div style="background:#0d0d0d; color:#e0e0e0; font-family:sans-serif; padding:40px; border-radius:16px; max-width:600px; margin:0 auto; border: 1px solid #222;">
        <div style="text-align:center; margin-bottom:32px;">
            <span style="font-size:28px; font-weight:800; color:#c8da42;">Imob<span style="color:#fff;">Growth</span> AI</span>
        </div>
        <h1 style="color:#ffffff; font-size:22px; margin-bottom:16px;">Bem-vindo ao futuro do marketing imobiliário, ${name}!</h1>
        <p style="color:#aaa; font-size:16px; line-height:1.6;">Sua conta foi criada com sucesso na plataforma operacional líder em inteligência artificial para corretores e incorporadoras.</p>
        <p style="color:#aaa; font-size:16px; line-height:1.6; margin-bottom:20px;">Você ganhou <strong>50 créditos de imagens</strong> e <strong>10 créditos de vídeos</strong> para começar a gerar anúncios de altíssima conversão hoje mesmo.</p>
        <p style="color:#aaa; font-size:16px; line-height:1.6; margin-bottom:32px;">Para confirmar seu e-mail e ativar sua conta, por favor clique no botão abaixo:</p>
        <div style="text-align:center; margin-bottom:32px;">
            <a href="${verificationUrl}" style="background:#c8da42; color:#0d0d0d; font-weight:bold; font-size:16px; padding:16px 40px; border-radius:8px; text-decoration:none; display:inline-block;">Ativar Minha Conta</a>
        </div>
        <p style="color:#555; font-size:12px; border-top:1px solid #222; padding-top:16px; margin-top:32px;">Se você não solicitou este cadastro, por favor desconsidere este e-mail.</p>
    </div>`;
}

function getPasswordRecoveryTemplate(name, resetUrl) {
    return `
    <div style="background:#0d0d0d; color:#e0e0e0; font-family:sans-serif; padding:40px; border-radius:16px; max-width:600px; margin:0 auto; border: 1px solid #222;">
        <div style="text-align:center; margin-bottom:32px;">
            <span style="font-size:28px; font-weight:800; color:#c8da42;">Imob<span style="color:#fff;">Growth</span> AI</span>
        </div>
        <h1 style="color:#ffffff; font-size:22px; margin-bottom:16px;">Recuperação de Senha</h1>
        <p style="color:#aaa; font-size:16px; line-height:1.6;">Olá, ${name}. Recebemos uma solicitação de redefinição de senha para a sua conta.</p>
        <p style="color:#aaa; font-size:16px; line-height:1.6; margin-bottom:32px;">Para cadastrar uma nova senha de acesso, clique no botão seguro abaixo. Este link é válido por 1 hora.</p>
        <div style="text-align:center; margin-bottom:32px;">
            <a href="${resetUrl}" style="background:#c8da42; color:#0d0d0d; font-weight:bold; font-size:16px; padding:16px 40px; border-radius:8px; text-decoration:none; display:inline-block;">Redefinir Minha Senha</a>
        </div>
        <p style="color:#555; font-size:12px; border-top:1px solid #222; padding-top:16px; margin-top:32px;">Se você não solicitou a redefinição de senha, nenhuma ação é necessária e sua senha atual permanece segura.</p>
    </div>`;
}

function getSystemAlertTemplate(title, message) {
    return `
    <div style="background:#0d0d0d; color:#e0e0e0; font-family:sans-serif; padding:40px; border-radius:16px; max-width:600px; margin:0 auto; border: 1px solid #222;">
        <div style="text-align:center; margin-bottom:32px;">
            <span style="font-size:28px; font-weight:800; color:#c8da42;">Imob<span style="color:#fff;">Growth</span> AI</span>
        </div>
        <h1 style="color:#ff6b6b; font-size:20px; margin-bottom:16px;">⚠️ Notificação do Sistema: ${title}</h1>
        <p style="color:#aaa; font-size:16px; line-height:1.6; margin-bottom:32px;">${message}</p>
        <div style="border-top:1px solid #222; padding-top:16px; margin-top:32px; color:#555; font-size:12px; text-align:center;">
            Imob Growth AI S/A — Central de Telemetria de Segurança
        </div>
    </div>`;
}

module.exports = {
    sendEmail,
    getWelcomeTemplate,
    getPasswordRecoveryTemplate,
    getSystemAlertTemplate,
    sendWithRetry // exposto para testes unitários
};
