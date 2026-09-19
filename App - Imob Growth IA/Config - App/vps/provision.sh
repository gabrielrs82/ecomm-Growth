#!/usr/bin/env bash

# ============================================================
# Script de Provisionamento & Hardening — VPS Hostinger (Ubuntu)
# ============================================================
# Executar este script como root logo no primeiro login na VPS.
# ============================================================

set -euo pipefail

# 1. Variáveis de Configuração
NEW_USER="deployer"
SSH_PORT="22" # Altere se desejar mover a porta padrão do SSH
AUTHORIZED_KEY_CONTENT="ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQ..." # COLE A SUA CHAVE PÚBLICA SSH AQUI

echo "[INFO] Atualizando os repositórios do sistema..."
apt update && apt upgrade -y

echo "[INFO] Instalando pacotes básicos de segurança e rede..."
apt install -y curl ufw fail2ban sudo apt-transport-https ca-certificates gnupg lsb-release

echo "[INFO] Criando usuário administrador não-root: ${NEW_USER}..."
# Cria usuário sem senha no login interativo
adduser --disabled-password --gecos "" "${NEW_USER}"
# Adiciona ao grupo sudo para privilégios de admin
usermod -aG sudo "${NEW_USER}"

echo "[INFO] Configurando autorização de chave SSH para o novo usuário..."
mkdir -p "/home/${NEW_USER}/.ssh"
echo "${AUTHORIZED_KEY_CONTENT}" > "/home/${NEW_USER}/.ssh/authorized_keys"
chmod 700 "/home/${NEW_USER}/.ssh"
chmod 600 "/home/${NEW_USER}/.ssh/authorized_keys"
chown -R "${NEW_USER}:${NEW_USER}" "/home/${NEW_USER}/.ssh"

echo "[INFO] Instalando o Docker Engine e Docker Compose..."
# Remove possíveis pacotes conflitantes
for pkg in docker.io docker-doc docker-compose podman-docker containerd runc; do apt-remove-dependency $pkg || true; done

# Instala chaves oficiais do Docker
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Adiciona o usuário do deploy ao grupo docker para não precisar usar sudo
usermod -aG docker "${NEW_USER}"

echo "[INFO] Configurando o Firewall UFW..."
# Bloqueia tudo por padrão (inbound)
ufw default deny incoming
ufw default allow outgoing

# Permite apenas portas seguras e necessárias
ufw allow "${SSH_PORT}/tcp" comment 'SSH Porta'
ufw allow 80/tcp comment 'HTTP Porta'
ufw allow 443/tcp comment 'HTTPS Porta'

# Habilita o firewall
ufw --force enable

echo "[INFO] Configurando o Fail2ban para proteção de SSH..."
cat <<EOF > /etc/fail2ban/jail.local
[sshd]
enabled = true
port = ${SSH_PORT}
filter = sshd
logpath = /var/log/auth.log
maxretry = 5
bantime = 1h
findtime = 10m
EOF

systemctl restart fail2ban

echo "[INFO] Hardening das configurações do Daemon SSH..."
# Desativa autenticação por senha - APENAS chaves são permitidas
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/g' /etc/ssh/sshd_config
sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/g' /etc/ssh/sshd_config
sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/g' /etc/ssh/sshd_config
sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin no/g' /etc/ssh/sshd_config

systemctl reload ssh

echo "[INFO] Provisionamento e Hardening concluídos com sucesso!"
echo "[AVISO] Teste a conexão SSH com o usuário '${NEW_USER}' em outra aba do terminal ANTES de encerrar a sessão root atual!"
