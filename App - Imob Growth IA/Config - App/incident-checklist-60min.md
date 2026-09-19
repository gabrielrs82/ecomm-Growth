---

# 🚨 CHECKLIST DE EMERGÊNCIA — PRIMEIROS 60 MINUTOS
## Imob Growth AI · `ecommgrowth.online`

**ID do Incidente**: `INC-_____________-___________`
**Data/Hora de Detecção**: `_______________________________`
**Comandante do Incidente**: `_______________________________`
**SRE Responsável**: `_______________________________`

> **IMPRIMA ESTA PÁGINA. MARQUE CADA ITEM À MEDIDA QUE EXECUTAR.**
> Não pule etapas. Documente o horário ao lado de cada item concluído.

---

## ⏱️ MINUTO 00–05 · Declaração

| # | Ação | Horário |
|---|---|---|
| 01 | Declarar incidente no canal `#incident-security-critical` com descrição curta | `_____` |
| 02 | Abrir videochamada de guerra room e compartilhar link no canal | `_____` |
| 03 | Designar o **Comandante do Incidente (CI)** | `_____` |
| 04 | Abrir **documento de log** com timestamp inicial e quem detectou | `_____` |
| 05 | Notificar o **DPO** via telefone/WhatsApp | `_____` |
| 06 | ⛔ **NÃO** reiniciar, desligar ou destruir nenhum recurso ainda | — |

---

## ⏱️ MINUTO 06–15 · Isolamento

| # | Ação | Horário |
|---|---|---|
| 07 | **VPS comprometida?** → Pausar instância no painel Hostinger (preservar RAM) | `_____` |
| 08 | **VPS comprometida?** → Criar snapshot imediato no painel Hostinger | `_____` |
| 09 | **VPS comprometida?** → Bloquear tráfego UFW: `ufw default deny incoming/outgoing` | `_____` |
| 10 | **VPS comprometida?** → Isolar container: `docker network disconnect prod-network imob-growth-prod-app` | `_____` |
| 11 | **VPS comprometida?** → Parar proxy: `docker stop imob-growth-proxy` | `_____` |
| 12 | **Vercel comprometida?** → Redirecionar domínio para página de manutenção | `_____` |
| 13 | **Vercel comprometida?** → Revogar deployment suspeito: `vercel remove [id] --yes` | `_____` |

---

## ⏱️ MINUTO 16–30 · Invalidar Sessões

| # | Ação | Horário |
|---|---|---|
| 14 | Supabase SQL Editor → Exportar sessões ativas (evidência forense antes de deletar) | `_____` |
| 15 | Supabase SQL: `DELETE FROM auth.sessions;` | `_____` |
| 16 | Supabase SQL: `DELETE FROM auth.refresh_tokens;` | `_____` |
| 17 | Supabase SQL: `DELETE FROM auth.flow_state;` | `_____` |
| 18 | Redis: `docker exec -it imob-growth-prod-cache redis-cli -a $PASS` | `_____` |
| 19 | Redis: `EVAL "return redis.call('del', unpack(redis.call('keys', 'SESSION:*')))" 0` | `_____` |

---

## ⏱️ MINUTO 31–45 · Rotacionar Secrets

| # | Credencial | Onde Revogar | Horário |
|---|---|---|---|
| 20 | **SUPABASE_ANON_KEY** + **SERVICE_ROLE_KEY** | supabase.com → Settings → API → **Roll API Keys** | `_____` |
| 21 | **Senha PostgreSQL** | supabase.com → Settings → Database → Reset Password | `_____` |
| 22 | **FAL_KEY** | fal.ai → Account → API Keys → Revogar e criar nova | `_____` |
| 23 | **RESEND_API_KEY** | resend.com → API Keys → Revogar e criar nova | `_____` |
| 24 | **JSON2VIDEO_API_KEY** | json2video.com → API Keys → Revogar e criar nova | `_____` |
| 25 | **GitHub Deploy Keys** | GitHub → Repositório → Settings → Deploy Keys → Revogar todas | `_____` |
| 26 | **GitHub PATs** | GitHub → Settings → Developer Settings → PATs → Revogar afetados | `_____` |
| 27 | **Vercel Access Tokens** | vercel.com/account/tokens → Revogar todos | `_____` |
| 28 | **PROD_REDIS_PASSWORD** | Editar `.env` na VPS → `docker compose ... down && up` | `_____` |
| 29 | Atualizar **Vercel Environment Variables** com todas as novas chaves | `_____` | `_____` |

---

## ⏱️ MINUTO 46–60 · Preservar Evidências

| # | Ação | Horário |
|---|---|---|
| 30 | Criar diretório: `mkdir -p /evidence/INC-$(date +%Y%m%d-%H%M)` | `_____` |
| 31 | Exportar logs: `docker logs imob-growth-prod-app --since 24h > app.log` | `_____` |
| 32 | Exportar logs: `docker logs imob-growth-proxy --since 24h > caddy.log` | `_____` |
| 33 | Exportar logs: `docker logs imob-growth-prod-db --since 24h > db.log` | `_____` |
| 34 | Snapshot de processos: `ss -tnp > connections.txt && ps aux > processes.txt` | `_____` |
| 35 | Gerar hashes: `sha256sum /evidence/INC-*/*.log > checksums.sha256` | `_____` |
| 36 | Supabase → Auth Logs → Export CSV | `_____` |
| 37 | Supabase → Database Logs → Export CSV | `_____` |
| 38 | Vercel → Runtime Logs → Download do deployment suspeito | `_____` |
| 39 | Registrar **IP suspeito identificado**: `___________________________` | `_____` |
| 40 | Enviar status update no war room (resumo das ações concluídas até agora) | `_____` |

---

## ✅ CONFIRMAÇÕES FINAIS

| # | Verificação | OK? |
|---|---|---|
| A | Todos os secrets foram rotacionados e registrados no vault? | `☐` |
| B | Todas as sessões de usuário foram invalidadas? | `☐` |
| C | Evidências foram exportadas e hashes SHA-256 gerados? | `☐` |
| D | O DPO foi notificado sobre o potencial impacto em dados pessoais? | `☐` |
| E | O documento de log está completo com timestamps de cada ação? | `☐` |
| F | O CI declarou formalmente o fim da fase de contenção? | `☐` |

---

## 🔁 PRÓXIMOS PASSOS (após 60 minutos)

- [ ] **Fase 3**: Erradicação — Remover acesso do atacante, corrigir vulnerabilidade
- [ ] **Fase 3**: Recuperação — Restaurar de backup limpo e validar integridade
- [ ] **Fase 4**: Avaliar necessidade de notificação à ANPD (prazo: 2 dias úteis)
- [ ] **Fase 4**: Comunicar titulares afetados se dados pessoais foram expostos
- [ ] **Fase 5**: Agendar reunião de Post-Mortem (até 5 dias úteis após contenção)

---

*Runbook completo: `incident-response-runbook.md`*
*Este checklist é parte integrante do Plano de Resposta a Incidentes — Imob Growth AI*
