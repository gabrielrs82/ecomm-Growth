# 🛡️ Plano de Resposta a Incidentes de Segurança — Runbook Operacional
## Imob Growth AI · `ecommgrowth.online`

> **Versão**: 2.0 | **Última revisão**: Julho 2026
> **Stack**: Vercel Serverless (Node.js 18+) · Supabase (PostgreSQL + Auth) · Redis · Caddy · VPS Hostinger (Ubuntu/Docker) · GitHub Actions CI/CD

---

## 📋 Sumário

1. [Papéis e Responsabilidades](#papéis-e-responsabilidades)
2. [Classificação de Severidade](#classificação-de-severidade)
3. [Fase 1 — Detecção](#fase-1--detecção)
4. [Fase 2 — Contenção Imediata (Golden Hour)](#fase-2--contenção-imediata-golden-hour)
5. [Fase 3 — Erradicação e Recuperação](#fase-3--erradicação-e-recuperação)
6. [Fase 4 — Comunicação e Notificação LGPD](#fase-4--comunicação-e-notificação-lgpd)
7. [Fase 5 — Pós-Incidente e Lições Aprendidas](#fase-5--pós-incidente-e-lições-aprendidas)

---

## Papéis e Responsabilidades

| Papel | Responsabilidade | Contato de Emergência |
|---|---|---|
| **Comandante do Incidente (CI)** | Coordena a resposta, toma decisões executivas, declara início e fim | Preencher |
| **SRE / Dev On-Call** | Executa os passos técnicos de contenção e erradicação | Preencher |
| **DPO (Encarregado LGPD)** | Avalia impacto em dados pessoais, aciona ANPD e notifica titulares | Preencher |
| **Comunicação / Assessoria** | Gerencia posicionamento público e comunicados externos | Preencher |
| **Jurídico** | Avalia obrigações legais, preservação de evidências | Preencher |

> **Regra de Ouro**: Toda ação técnica durante o incidente deve ser registrada **cronologicamente** em um documento de log compartilhado (Google Docs / Notion) aberto no **Minuto 01**. Sem ação não documentada.

---

## Classificação de Severidade

| Nível | Descrição | Exemplos | Tempo de Resposta |
|---|---|---|---|
| 🔴 **P0 — Crítico** | Dados pessoais comprometidos, exfiltração ativa, sistema fora do ar | `SUPABASE_SERVICE_ROLE_KEY` vazada publicamente; VPS com shell reverso | **Imediato — runbook completo** |
| 🟠 **P1 — Alto** | Acesso não autorizado confirmado a recursos internos | Acesso à API sem autenticação; abuse massivo de créditos | **< 30 minutos** |
| 🟡 **P2 — Médio** | Tentativa bloqueada, comportamento anômalo, alerta automatizado | Rate limit repetido em `/api/auth`; spike de erros 429 | **< 2 horas** |
| 🟢 **P3 — Baixo** | Relatório externo sem exploração confirmada | Researcher reporta vulnerabilidade; scan de reconhecimento | **< 1 dia útil** |

---

## Fase 1 — Detecção

### 1.1 Alertas Automáticos do Sistema

#### Vercel (Serverless Functions)

Padrões nos logs JSON que indicam incidente:

```
ALERT_SUSPICIOUS_REGISTRATION_RATE_LIMIT_EXCEEDED
ALERT_SUSPICIOUS_BOT_LOGIN_ATTEMPT
ALERT_API_CREDITS_ANOMALOUS_CONSUMPTION
HTTP 401 em volume anormal em /api/user/*
Origem de IP incomum (ASN de datacenter) autenticando com sucesso
```

**Como verificar:**
```bash
# Logs das últimas 2h das funções de produção
vercel logs --prod --since 2h --filter error
```

#### Supabase (Auth + Database)

```sql
-- Verificar sessões abertas suspeitas (muitas sessões por IP)
SELECT ip, COUNT(*) as session_count,
  MIN(created_at) as first_seen, MAX(created_at) as last_seen
FROM auth.sessions
GROUP BY ip HAVING COUNT(*) > 10
ORDER BY session_count DESC;

-- Verificar tentativas de login falhadas em massa
SELECT email, COUNT(*) as failed_attempts
FROM auth.audit_log_entries
WHERE payload->>'action' = 'login'
  AND payload->>'error' IS NOT NULL
  AND created_at > now() - interval '1 hour'
GROUP BY email HAVING COUNT(*) > 5
ORDER BY failed_attempts DESC;
```

#### VPS Hostinger (Docker + Caddy)

```bash
# Conexões ativas suspeitas
ss -tnp | grep ESTABLISHED

# Containers em execução
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"

# Logs do Caddy buscando padrões de scan
docker logs imob-growth-proxy --since 30m 2>&1 | grep -E "(4[0-9]{2}|5[0-9]{2})" | tail -50

# IPs banidos pelo Fail2ban
fail2ban-client status sshd
```

---

### 1.2 Sinais de Alerta por Componente

| Componente | Sinal de Alerta | Ação Imediata |
|---|---|---|
| **Fal.ai** (`FAL_KEY`) | Spike de uso ou cobrança fora do padrão | Revogar e rotacionar `FAL_KEY` |
| **Resend** (`RESEND_API_KEY`) | E-mails disparados sem solicitação | Revogar chave, verificar domínio `ecommgrowth.online` |
| **Supabase** | RLS bypass, queries SQL não esperadas nos logs | Executar `DELETE FROM auth.sessions` imediatamente |
| **Redis** | Chave `SESSION:*` com volume anormal | Executar `FLUSHDB` no container `imob-growth-prod-cache` |
| **GitHub Actions** | Workflow acionado por push não reconhecido | Suspender Actions, revogar PATs e deploy keys |
| **Vercel** | Deploy realizado sem PR correspondente | Reverter deployment, verificar acessos no painel |

---

### 1.3 Relatos de Usuários

Canal: `suporte@ecommgrowth.online`

Relatos que devem ser **tratados como P0 imediatamente**:
- "Meu saldo de créditos sumiu sem eu usar nada"
- "Recebi e-mail de redefinição de senha que não solicitei"
- "Vejo conteúdo gerado por minha conta que não criei"
- "Meus dados apareceram em outro lugar"

**Ação**: Qualquer relato nesse padrão → acionar CI imediatamente, abrir war room, tratar como P0 até prova em contrário.

---

## Fase 2 — Contenção Imediata (Golden Hour)

> ⚠️ **Esta fase assume P0 ou P1. Não pule etapas. Documente cada ação com timestamp.**

### ⏱️ MINUTO 00–05: Declaração e Guerra Room

```
[ ] 1. Enviar no canal #incident-security-critical:
       "🚨 INCIDENTE DE SEGURANÇA DECLARADO — [DATA/HORA]
        Descrição: [descrição breve]
        CI: [nome]  |  War Room: [link da videochamada]"

[ ] 2. Abrir documento de log do incidente:
       Título: "INC-[YYYYMMDD-HH]-[descrição curta]"
       Primeiro registro: data/hora, quem detectou, como detectou.

[ ] 3. Notificar o DPO imediatamente via telefone/WhatsApp.

[ ] 4. NÃO desligar, reiniciar ou destruir nenhum recurso ainda.
       (pode destruir evidências forenses)
```

---

### ⏱️ MINUTO 06–15: Isolamento de Infraestrutura

#### Cenário A — VPS Hostinger comprometida

```bash
# 1. NÃO executar `shutdown` ou `reboot` ainda.
#    Painel Hostinger → VPS → Gerenciar → PAUSAR INSTÂNCIA
#    (preserva memória RAM para análise forense)

# 2. Criar snapshot imediato ANTES de qualquer intervenção
#    Painel Hostinger → VPS → Backups → Criar Snapshot Agora

# 3. Bloquear TODO tráfego via UFW (conecte-se à VPS antes)
sudo ufw default deny incoming
sudo ufw default deny outgoing
# Manter sua sessão SSH ativa:
sudo ufw allow from SEU_IP_ATUAL to any port 22

# 4. Isolar container da aplicação da rede Docker sem destruí-lo
docker network disconnect prod-network imob-growth-prod-app

# 5. Parar o reverse proxy para cortar tráfego público
docker stop imob-growth-proxy
```

#### Cenário B — Serverless Vercel comprometida

```bash
# 1. Redirecionar domínio para página de manutenção
vercel alias set maintenance-page.vercel.app ecommgrowth.online

# 2. Ou adicionar rewrite de emergência e fazer deploy imediato:
# { "rewrites": [{ "source": "/(.*)", "destination": "/site/maintenance.html" }] }
vercel --prod

# 3. Revogar o deployment suspeito
vercel remove [deployment-id] --yes
```

#### Cenário C — Credencial/API Key vazada (sem comprometimento de servidor)

```
Ir diretamente para o passo MINUTO 31-45 (rotação de secrets).
Não é necessário isolar infraestrutura inteira.
```

---

### ⏱️ MINUTO 16–30: Invalidar Sessões e Tokens

#### Supabase — Invalidar todas as sessões ativas

```sql
-- ATENÇÃO: Desconecta TODOS os usuários da plataforma.

-- ANTES: Exportar quais usuários estavam ativos (evidência forense)
SELECT user_id, created_at, updated_at, not_after
FROM auth.sessions ORDER BY created_at DESC;

-- 1. Encerrar todas as sessões autenticadas
DELETE FROM auth.sessions;

-- 2. Revogar todos os refresh tokens
DELETE FROM auth.refresh_tokens;

-- 3. Invalidar tokens de recuperação de senha
DELETE FROM auth.flow_state;

-- 4. Invalidar Magic Links não utilizados
DELETE FROM auth.mfa_factors WHERE status = 'unverified';
```

#### Redis — Invalidar cache de sessões

```bash
# Acessar o container Redis de produção
docker exec -it imob-growth-prod-cache redis-cli \
  -a "${PROD_REDIS_PASSWORD}" --no-auth-warning

# Listar chaves de sessão antes de deletar (auditoria)
SCAN 0 MATCH "SESSION:*" COUNT 100

# Deletar todas as sessões em cache
EVAL "return redis.call('del', unpack(redis.call('keys', 'SESSION:*')))" 0

EXIT
```

---

### ⏱️ MINUTO 31–45: Rotacionar Secrets e Credenciais

> Execute na ordem abaixo. Documente cada rotação com timestamp.

#### 1. Supabase — Roll API Keys (MAIS CRÍTICO)

```
[ ] supabase.com/dashboard → Projeto → Settings → API
[ ] Clicar em "Roll API Keys" → Confirmar
    → Nova SUPABASE_ANON_KEY gerada
    → Nova SUPABASE_SERVICE_ROLE_KEY gerada
[ ] Salvar novas chaves imediatamente no vault de senhas
```

#### 2. Supabase — Rotacionar senha do PostgreSQL

```
[ ] Settings → Database → Connection info → Reset Database Password
[ ] Registrar nova senha no vault
```

#### 3. Fal.ai — Revogar e gerar nova API Key

```
[ ] fal.ai → Account → API Keys
[ ] Revogar (delete) a chave comprometida
[ ] Criar nova API Key → registrar no vault
```

#### 4. Resend — Revogar e gerar nova API Key

```
[ ] resend.com → API Keys → Revogar chave comprometida
[ ] Criar nova API Key → registrar no vault
[ ] Verificar se houve envio de e-mails não autorizados no painel
```

#### 5. JSON2Video — Revogar API Key

```
[ ] Painel json2video.com → API Keys → Revogar e gerar nova chave
[ ] Registrar no vault
```

#### 6. GitHub — Revogar Deploy Keys e PATs

```
[ ] GitHub → Repositório → Settings → Deploy Keys → Revogar todas
[ ] GitHub → Conta → Settings → Developer Settings → Personal Access Tokens
    → Revogar todos os PATs com escopo no repositório afetado
[ ] Atualizar Actions Secrets: Settings → Secrets and Variables → Actions
```

#### 7. Vercel — Revogar tokens de acesso

```
[ ] vercel.com/account/tokens → Revogar todos os tokens ativos
[ ] Atualizar Environment Variables com as novas chaves rotacionadas
```

#### 8. Redis — Rotacionar senha de produção

```bash
# Editar .env com nova PROD_REDIS_PASSWORD
docker compose -f vps/docker-compose.prod.yml down production-cache production-app
# Editar .env com nova senha forte
docker compose -f vps/docker-compose.prod.yml up -d production-cache production-app
```

---

### ⏱️ MINUTO 46–60: Preservar Evidências

```bash
# Criar diretório de evidências com timestamp na VPS
INCIDENT_ID="INC-$(date +%Y%m%d-%H%M)"
mkdir -p /evidence/${INCIDENT_ID}

# Exportar logs dos containers (últimas 24h)
docker logs imob-growth-prod-app --since 24h > /evidence/${INCIDENT_ID}/app.log 2>&1
docker logs imob-growth-proxy   --since 24h > /evidence/${INCIDENT_ID}/caddy.log 2>&1
docker logs imob-growth-prod-db --since 24h > /evidence/${INCIDENT_ID}/db.log 2>&1

# Snapshot de conexões e processos no momento da captura
ss -tnp  > /evidence/${INCIDENT_ID}/connections-snapshot.txt
ps aux   > /evidence/${INCIDENT_ID}/processes-snapshot.txt

# Gerar hash SHA-256 de cada arquivo (cadeia de custódia)
sha256sum /evidence/${INCIDENT_ID}/*.log > /evidence/${INCIDENT_ID}/checksums.sha256

# Copiar para storage seguro externo (S3 / Google Drive criptografado)
# aws s3 cp /evidence/${INCIDENT_ID}/ s3://bucket-forense/${INCIDENT_ID}/ --recursive
```

```
No Supabase: Dashboard → Logs → Auth Logs → Export CSV
             Dashboard → Logs → Database Logs → Export CSV
No Vercel:   vercel logs [deployment-url] > /evidence/${INCIDENT_ID}/vercel.log

Registrar no documento de incidente:
- Timestamp exato de detecção e de cada ação
- Primeiro IP suspeito identificado
- Quais credenciais foram rotacionadas e em qual horário
- Quais usuários estavam com sessão ativa no momento do incidente
```

---

## Fase 3 — Erradicação e Recuperação

### 3.1 Remoção do Acesso do Atacante

#### Se a VPS foi comprometida (rootkit, shell reverso, etc.)

```bash
# NÃO tente limpar um servidor comprometido.
# A única ação segura é destruir e reconstruir do zero.

# 1. Tirar snapshot final (evidência forense)
#    Painel Hostinger → Snapshot

# 2. Destruir a instância comprometida APENAS após o snapshot

# 3. Provisionar nova VPS limpa usando o script existente:
#    vps/provision.sh
#    ATENÇÃO: Atualizar AUTHORIZED_KEY_CONTENT com nova chave SSH!

# 4. Deploy dos containers com novas credenciais rotacionadas
cd vps/
docker compose -f docker-compose.prod.yml up -d
```

#### Se o código-fonte foi comprometido

```bash
# 1. Verificar histórico de commits para commits não autorizados
git log --oneline -20
git diff HEAD~5 HEAD

# 2. Criar hotfix branch a partir do último commit limpo conhecido
git checkout -b hotfix/security-remediation [hash-do-último-commit-limpo]

# 3. Aplicar correção da vulnerabilidade explorada

# 4. Verificar backdoors ou arquivos não rastreados
git status
find . -name "*.js" -newer package.json -not -path "*/node_modules/*"

# 5. PR → revisão de segurança → merge → deploy via CI/CD
```

---

### 3.2 Restauração a partir de Backup Limpo

#### Supabase — Restaurar banco de dados

```
[ ] 1. Identificar o ponto de restauração ANTERIOR ao incidente:
       Dashboard → Database → Backups
       (Plano Pro: 7 dias | Plano Enterprise: 30 dias de retenção)

[ ] 2. Restaurar em instância SECUNDÁRIA (nunca direto em produção):
       a. Criar novo projeto Supabase (staging temporário)
       b. Importar o backup selecionado

[ ] 3. Validar integridade no ambiente restaurado:
       SELECT COUNT(*) FROM public.users;
       SELECT COUNT(*) FROM public.credits;
       SELECT MAX(created_at) FROM public.users;

[ ] 4. Comparar com produção para identificar o que foi corrompido/exfiltrado

[ ] 5. Após validação: atualizar SUPABASE_URL nas env vars do Vercel
       para apontar para o novo projeto restaurado
```

#### VPS — Restaurar a partir de snapshot

```
Painel Hostinger → VPS → Snapshots
Selecionar snapshot ANTERIOR ao comprometimento
Restaurar em nova instância VPS

Preferível: Reconstruir do zero (vps/provision.sh) se há suspeita de rootkit antigo.
```

---

### 3.3 Validação de Integridade

```bash
# 1. Executar suite de testes automatizados
npm test

# 2. Executar scan OWASP ZAP (via GitHub Actions — workflow manual)
#    Actions → Security Vulnerability Scan → Run workflow
#    → target_url: URL do ambiente restaurado

# 3. Verificar headers de segurança
curl -I https://ecommgrowth.online | grep -E "(X-Content-Type|X-Frame|Strict-Transport|Content-Security)"

# 4. Testar endpoints críticos manualmente
curl -X POST https://ecommgrowth.online/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"wrongpassword"}'
# Esperado: HTTP 401, sem stack trace exposto

curl https://ecommgrowth.online/api/credits \
  -H "Authorization: Bearer TOKEN_INVALIDO"
# Esperado: HTTP 401, sem dados retornados

# 5. Verificar endpoint de health check
curl https://ecommgrowth.online/api/health

# 6. Documentar teste específico que confirma correção da vulnerabilidade original
# 7. Declarar fim da contenção no documento de incidente
```

---

## Fase 4 — Comunicação e Notificação LGPD

### 4.1 Fluxo de Comunicação Interna

```
Detecção (SRE/Dev/Suporte)
         │
         ▼
Declaração do Incidente → Abertura do War Room
         │
         ▼
Comandante do Incidente (CI)
         ├──► SRE/Dev     → Executa contenção técnica
         ├──► DPO         → Avalia impacto em dados pessoais
         └──► Jurídico    → Avalia obrigações legais e preservação de evidências
                   │
                   ▼
         Dados pessoais afetados?
         ├── NÃO → Registrar no Livro de Incidentes. Encerrar.
         └── SIM → Risco relevante aos titulares?
                   ├── NÃO → Registrar + medidas internas. Encerrar.
                   └── SIM → Notificar ANPD (≤ 2 dias úteis)
                             Notificar titulares afetados
                             Notificar Comunicação/Assessoria
```

---

### 4.2 Gatilho de Notificação Obrigatória à ANPD (Art. 48 LGPD)

**Notificar a ANPD obrigatoriamente se qualquer resposta for SIM:**

| Pergunta | Sim = Notificar ANPD |
|---|---|
| Foram expostos dados pessoais identificáveis (nome, e-mail, CPF, telefone)? | ✅ |
| Foram expostos dados sensíveis (localização, comportamento, financeiro)? | ✅ |
| O número de titulares afetados é superior a 1 pessoa? | ✅ |
| Há risco de dano material (financeiro, reputacional) aos titulares? | ✅ |
| O atacante teve acesso a histórico de pagamentos ou créditos? | ✅ |

**Prazo legal**: **2 dias úteis** a partir da confirmação do incidente (Resolução CD/ANPD 2/2022).

**Portal de Notificação ANPD**: https://www.gov.br/anpd/pt-br/canais_atendimento/comunicacao-de-incidente-de-segurança

---

### 4.3 Modelo de Notificação à ANPD

```
NOTIFICAÇÃO DE INCIDENTE DE SEGURANÇA — ART. 48 LGPD

Controlador: [Razão Social da empresa] | CNPJ: [CNPJ]
Encarregado (DPO): [Nome] | E-mail: [E-mail do DPO]
Data de Detecção: [Data/hora]
Data desta Notificação: [Data/hora]

1. NATUREZA DOS DADOS AFETADOS:
   [ ] Dados de identificação (nome, e-mail, CPF)
   [ ] Dados de acesso (senhas hasheadas/tokens)
   [ ] Dados financeiros (histórico de pagamento, créditos)
   [ ] Dados comportamentais (uso da plataforma, conteúdo gerado)
   [ ] Outros: ___________

2. QUANTIDADE ESTIMADA DE TITULARES AFETADOS: ___________

3. CAUSA DO INCIDENTE: (descrição técnica da vulnerabilidade explorada)

4. MEDIDAS DE SEGURANÇA EXISTENTES ANTES DO INCIDENTE:
   - Autenticação via Supabase Auth (JWT)
   - HTTPS obrigatório (HSTS habilitado)
   - Rate limiting nas APIs de autenticação
   - Fail2ban e UFW na VPS
   - Row Level Security (RLS) no PostgreSQL
   - Revisões semanais de segurança com OWASP ZAP

5. MEDIDAS ADOTADAS APÓS O INCIDENTE:
   (descrever ações de contenção e erradicação executadas)

6. RISCOS IDENTIFICADOS AOS TITULARES:
   (acesso não autorizado a conta, uso indevido de créditos,
    exposição de dados de contato, etc.)

7. MEDIDAS PARA REVERSÃO E MITIGAÇÃO DO DANO:
   (hotfix aplicado, backups restaurados, titulares notificados)
```

---

### 4.4 Modelo de E-mail para Titulares Afetados

```
De: Imob Growth AI <contato@ecommgrowth.online>
Assunto: [IMPORTANTE] Aviso de Segurança — Imob Growth AI

Prezado(a) [Nome do Usuário],

Informamos que identificamos um incidente de segurança que pode ter
afetado sua conta na plataforma Imob Growth AI entre [data de início]
e [data de contenção].

O que aconteceu:
[Descrição em linguagem simples, sem jargão técnico]

Quais dados podem ter sido afetados:
[Listar especificamente: e-mail, nome, histórico de uso, etc.]

O que já fizemos:
- Encerramos o acesso não autorizado em [data/hora]
- Rotacionamos todas as credenciais de segurança da plataforma
- Restauramos o sistema a partir de backup íntegro
- Notificamos a Autoridade Nacional de Proteção de Dados (ANPD)

O que você deve fazer agora:
1. Acessar sua conta e alterar sua senha imediatamente
2. Verificar se há atividade suspeita no seu histórico de uso
3. Entrar em contato pelo e-mail suporte@ecommgrowth.online
   caso identifique qualquer irregularidade

Seus direitos como titular de dados (LGPD):
Você tem o direito de solicitar acesso, correção, exclusão e portabilidade
dos seus dados. Acesse nossa Política de Privacidade em:
https://ecommgrowth.online/indexprivacidade

Lamentamos sinceramente o ocorrido e reforçamos nosso compromisso com a
proteção dos seus dados pessoais.

Atenciosamente,
Equipe Imob Growth AI
suporte@ecommgrowth.online
```

---

## Fase 5 — Pós-Incidente e Lições Aprendidas

### 5.1 Timeline do Post-Mortem

```
Dia 0    → Incidente detectado e contido
Dia 1    → Serviços restaurados e validados
Dia 1–2  → Notificação ANPD (se aplicável)
Dia 3    → Coleta de evidências e construção da timeline detalhada
Dia 5    → Reunião de Post-Mortem (CI + SRE + DPO + Jurídico)
Dia 10   → Relatório final publicado internamente
Dia 30   → Revisão das ações preventivas implementadas
```

---

### 5.2 Análise de Causa Raiz — Template dos 5 Porquês

```
INCIDENTE: [Descrição do evento]

Por que 1: Por que o atacante conseguiu acesso?
Resposta: ___

Por que 2: Por que a proteção X não impediu o acesso?
Resposta: ___

Por que 3: Por que a proteção X não estava configurada corretamente?
Resposta: ___

Por que 4: Por que não identificamos essa lacuna antes?
Resposta: ___

Por que 5: Por que nosso processo de revisão de segurança não capturou isso?
Resposta: ___

CAUSA RAIZ: ___
CATEGORIA: [ ] Erro humano  [ ] Falha de processo  [ ] Falha técnica  [ ] Dependência externa
```

---

### 5.3 Ações Preventivas de Longo Prazo

#### Imediatas (< 7 dias após incidente)
- [ ] Aplicar hotfix da vulnerabilidade explorada
- [ ] Executar `npm audit fix` e atualizar dependências
- [ ] Adicionar teste de regressão cobrindo a vulnerabilidade
- [ ] Rever regras RLS (Row Level Security) do Supabase em todas as tabelas

#### Curto Prazo (< 30 dias)
- [ ] Configurar alertas automáticos no Vercel via Webhooks para picos de erro
- [ ] Implementar rotação de API Keys a cada 90 dias (agenda no calendário)
- [ ] Ativar MFA para todos os administradores da plataforma
- [ ] Configurar UptimeRobot / PagerDuty para alertas de downtime em tempo real
- [ ] Revisar e aplicar princípio de privilégio mínimo em todas as credenciais

#### Médio Prazo (< 90 dias)
- [ ] Contratar pentest externo por empresa especializada
- [ ] Implementar SIEM (Grafana + Loki + Promtail) para correlação de logs
- [ ] Treinar equipe em Security Awareness (phishing, engenharia social)
- [ ] Formalizar e assinar política interna de segurança da informação
- [ ] Estabelecer programa de Responsible Disclosure (VDP) para pesquisadores externos

---

### 5.4 Livro de Registro de Incidentes (LGPD)

Todos os incidentes devem ser registrados, independentemente de gravidade:

| Campo | Descrição |
|---|---|
| ID do Incidente | INC-YYYYMMDD-NNN |
| Data de Detecção | Timestamp exato |
| Data de Resolução | Timestamp exato |
| Severidade | P0 / P1 / P2 / P3 |
| Descrição | Resumo do evento |
| Dados pessoais afetados | Sim/Não + tipos |
| Titulares afetados | Número estimado |
| ANPD notificada | Sim/Não + data |
| Titulares notificados | Sim/Não + data |
| Causa raiz | Resumo da RCA |
| Ações preventivas | Lista de ações aplicadas |
| Responsável | Nome do CI |

---

*Este documento é revisado a cada 6 meses ou após qualquer incidente de segurança.*
*Próxima revisão programada: Janeiro 2027*
