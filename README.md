# Fraga Lanches - Sistema de Pedidos para Hamburgueria Artesanal

[![Python](https://img.shields.io/badge/Python-3.12-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-green.svg)](https://fastapi.tiangolo.com/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-orange.svg)](https://www.mysql.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-3.12-purple.svg)](https://www.rabbitmq.com/)

Sistema web progressivo (PWA) para gestão completa de hamburgueria artesanal: cardápio digital, pedidos, cozinha, entregas, pagamentos, avaliações e relatórios.

## 🏗️ Arquitetura

### Microserviços (Python/FastAPI)

| Serviço | Porta | Responsabilidade |
|---------|-------|------------------|
| **ms-gateway** | 8000 | API Gateway, roteamento, autenticação |
| **ms-auth** | 8001 | Autenticação JWT, usuários, perfis, endereços |
| **ms-catalogo** | 8002 | Categorias, produtos, opções, horários, taxas |
| **ms-pedidos** | 8003 | Carrinho, pedidos, histórico, status |
| **ms-cozinha** | 8004 | Painel cozinha, alertas tempo real, WebSocket |
| **ms-entregas** | 8005 | Gestão de entregas, entregadores |
| **ms-notificacoes** | 8006 | Push notifications, in-app, WebSocket |
| **ms-avaliacoes** | 8007 | Avaliações de pedidos |
| **ms-pagamentos** | 8008 | Pagamentos (Mercado Pago), webhooks |
| **ms-relatorios** | 8009 | Relatórios gerenciais, dashboard |

### Infraestrutura

- **MySQL 8.0** - Banco de dados relacional (ACID)
- **RabbitMQ 3.12** - Message broker para eventos assíncronos
- **Docker Compose** - Orquestração local
- **WebSocket** - Comunicação tempo real (cozinha, notificações)

## 🚀 Início Rápido

### Pré-requisitos

- Docker 24+ e Docker Compose 2+
- Python 3.12+ (para desenvolvimento local)
- Make (opcional)

### Desenvolvimento Local

```bash
# 1. Clone e configure
git clone <repo>
cd fraga-lanches

# 2. Configure variáveis de ambiente
cp .env.example .env
# Edite .env com suas chaves (VAPID, Mercado Pago, etc.)

# 3. Suba a infraestrutura
docker-compose up -d mysql rabbitmq

# 4. Aguarde os healthchecks passarem
docker-compose ps

# 5. Execute os microserviços (em terminais separados ou via IDE)
# Exemplo para ms-auth:
cd services/ms-auth
pip install -e ".[dev]"
uvicorn app:app --reload --port 8001

# Ou use o script de desenvolvimento:
./scripts/dev.sh
```

### Produção (Docker Compose)

```bash
# Build e start de todos os serviços
docker-compose up -d --build

# Ver logs
docker-compose logs -f

# Parar
docker-compose down

# Parar e remover volumes (CUIDADO: apaga dados)
docker-compose down -v
```

## 📋 Funcionalidades por Incremento

### Incremento 1 - Cadastro, Autenticação e Cardápio ✅
- [x] Cadastro de usuários (clientes e equipe)
- [x] Login/Logout com JWT + Argon2id
- [x] Perfis: Administrador, Atendente, Cozinha, Entregador, Cliente
- [x] Categorias e produtos com foto, descrição, preço, opcionais
- [x] Cardápio digital responsivo

### Incremento 2 - Carrinho e Finalização ✅
- [x] Gerenciamento do carrinho (add, remove, quantidade)
- [x] Seleção de opcionais e adicionais
- [x] Cálculo automático (subtotal, taxa entrega, total)
- [x] Dados de entrega com validação
- [x] Formas de pagamento: Pix, Cartão, Dinheiro (com troco)

### Incremento 3 - Cozinha e Tempo Real ✅
- [x] Painel cozinha com pedidos por status
- [x] Atualização de status: Novo → Preparo → Pronto → Saiu → Concluído
- [x] Alertas visuais/sonoros (WebSocket)
- [x] Status tempo real para cliente (sem reload)

### Incremento 4 - Notificações e PWA ✅
- [x] Push notifications (Web Push API / FCM)
- [x] Service Workers + Cache offline
- [x] Web App Manifest + Instalação
- [x] Banner de convite PWA

### Incremento 5 - Avaliações e Pagamentos ✅
- [x] Avaliações 1-5 estrelas + comentário
- [x] Integração Mercado Pago (Pix dinâmico, Cartão)
- [x] Webhooks de confirmação
- [x] Pagamento na entrega (dinheiro)

### Incremento 6 - Relatórios e Configurações ✅
- [x] Relatórios: vendas, produtos, entregas, pagamentos, avaliações
- [x] Horários de funcionamento + status Aberto/Fechado
- [x] Dashboard administrativo
- [x] Configurações do sistema

## 🔧 Desenvolvimento

### Estrutura do Projeto

```
fraga-lanches/
├── docker-compose.yml          # Orquestração completa
├── Dockerfile                  # Imagem base multi-serviço
├── .env.example                # Template de variáveis
├── shared/                     # Módulos compartilhados
│   ├── database/               # SQLAlchemy async, sessões
│   ├── models/                 # Models SQLAlchemy
│   ├── schemas/                # Schemas Pydantic
│   ├── auth/                   # JWT, Argon2id
│   ├── messaging/              # RabbitMQ client, eventos
│   └── websocket/              # WebSocket manager
├── services/                   # Microserviços
│   ├── ms-auth/
│   ├── ms-catalogo/
│   ├── ms-pedidos/
│   ├── ms-cozinha/
│   ├── ms-entregas/
│   ├── ms-notificacoes/
│   ├── ms-avaliacoes/
│   ├── ms-pagamentos/
│   ├── ms-relatorios/
│   └── ms-gateway/
└── inicio/                     # Frontend PWA (Vanilla JS)
    ├── index.html
    ├── cardapio.html
    ├── carrinho.html
    ├── checkout.html
    ├── meus-pedidos.html
    ├── perfil.html
    ├── admin-*.html
    ├── js/
    ├── style.css
    ├── manifest.json
    └── service-worker.js
```

### Comandos Úteis

```bash
# Ver status dos containers
docker-compose ps

# Logs de um serviço específico
docker-compose logs -f ms-auth

# Acessar shell do MySQL
docker-compose exec mysql mysql -u fraga_user -p fraga_lanches

# Acessar RabbitMQ Management UI
# http://localhost:15672 (user: fraga_user, pass: fraga_pass_2026)

# Executar migrações (se usar Alembic)
docker-compose exec ms-auth alembic upgrade head

# Rodar testes
cd services/ms-auth && pytest -v

# Gerar chaves VAPID para push
python -c "from pywebpush import generate_vapid_keys; k=generate_vapid_keys(); print('PUBLIC:', k['public_key']); print('PRIVATE:', k['private_key'])"
```

## 🔐 Segurança

- **JWT** com expiração curta (60min) + Refresh tokens (30 dias)
- **Argon2id** para hash de senhas (parâmetros OWASP recomendados)
- **Rate limiting** no Gateway
- **CORS** configurável
- **Helmet-style headers** via middleware
- **Validação server-side** em todas as operações
- **LGPD compliance**: dados mínimos, consentimento, direito ao esquecimento

## 📡 Eventos (RabbitMQ)

| Evento | Publicador | Consumidores |
|--------|------------|--------------|
| `pedido.criado` | ms-pedidos | ms-cozinha, ms-notificacoes, ms-entregas |
| `pedido.status_atualizado` | ms-pedidos/ms-cozinha | ms-notificacoes, ms-gateway (WS) |
| `pagamento.aprovado` | ms-pagamentos | ms-pedidos, ms-notificacoes, ms-cozinha |
| `pagamento.recusado` | ms-pagamentos | ms-notificacoes |
| `entrega.atribuida` | ms-entregas | ms-notificacoes |
| `entrega.saida` | ms-entregas | ms-notificacoes |
| `entrega.concluida` | ms-entregas | ms-notificacoes, ms-pedidos |
| `notificacao.enviar` | Qualquer | ms-notificacoes |
| `avaliacao.criada` | ms-avaliacoes | ms-notificacoes |

## 🌐 Frontend (PWA)

O frontend em `inicio/` usa **Vanilla JS** (sem frameworks):

- **HTML5** semântico
- **CSS3** responsivo (mobile-first)
- **ES6+** modules
- **Service Worker** para cache offline
- **Web App Manifest** para instalação
- **Web Push API** para notificações
- **WebSocket** para tempo real

### Páginas

| Página | Descrição |
|--------|-----------|
| `index.html` | Home / Cardápio |
| `cardapio.html` | Cardápio completo com filtros |
| `carrinho.html` | Carrinho de compras |
| `checkout.html` | Finalização + pagamento |
| `meus-pedidos.html` | Histórico + acompanhamento |
| `perfil.html` | Perfil + endereços |
| `admin-*.html` | Painel administrativo |

## 📊 API Documentation

Com os serviços rodando, acesse:

- **Gateway**: http://localhost:8000/docs
- **Auth**: http://localhost:8001/docs
- **Catálogo**: http://localhost:8002/docs
- **Pedidos**: http://localhost:8003/docs
- **Cozinha**: http://localhost:8004/docs
- **Entregas**: http://localhost:8005/docs
- **Notificações**: http://localhost:8006/docs
- **Avaliações**: http://localhost:8007/docs
- **Pagamentos**: http://localhost:8008/docs
- **Relatórios**: http://localhost:8009/docs

## 🚢 Deploy Produção (Hostinger VPS)

```bash
# 1. No servidor, clone e configure
git clone <repo> /opt/fraga-lanches
cd /opt/fraga-lanches
cp .env.example .env
# Edite .env com valores de produção

# 2. Build e deploy
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# 3. Configure nginx proxy reverso (exemplo)
# server {
#     listen 80;
#     server_name api.fragalanches.com;
#     location / { proxy_pass http://localhost:8000; }
# }
```

### docker-compose.prod.yml (exemplo)

```yaml
version: '3.8'
services:
  gateway:
    environment:
      - ENVIRONMENT=production
      - CORS_ORIGINS=https://fragalanches.com,https://www.fragalanches.com
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
      replicas: 2
      restart_policy:
        condition: on-failure

  mysql:
    volumes:
      - /opt/fraga-data/mysql:/var/lib/mysql
    deploy:
      resources:
        limits:
          memory: 1G
```

## 🧪 Testes

```bash
# Testes unitários (por serviço)
cd services/ms-auth && pytest -v --cov=app

# Testes de integração
pytest tests/integration -v

# Testes de carga (locust)
locust -f tests/load/locustfile.py --host=http://localhost:8000
```

## 📝 Licença

Proprietary - Fraga Lanches © 2026

## 👥 Equipe

- **Arquiteta**: Eloise Arruda Borges
- **Desenvolvedores**: Christian Marcelo, Gabriel Pinheiro, Samuel Welington

---

**Documentação da Arquitetura**: Ver `docs/arquitetura.md`  
**Requisitos de Software**: Ver `docs/requisitos.md`