# Fraga Lanches - Execução Local (Sem Docker)

## Pré-requisitos

1. **Python 3.12+** - https://python.org
2. **MariaDB/MySQL** rodando na porta 3306
3. **RabbitMQ** rodando na porta 5672 (com plugin management na 15672)

## Instalação Rápida

```bash
# 1. Criar venv e instalar dependências
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
pip install -e ./shared
pip install -e ./services/ms-auth
pip install -e ./services/ms-catalogo
pip install -e ./services/ms-pedidos
pip install -e ./services/ms-cozinha
pip install -e ./services/ms-entregas
pip install -e ./services/ms-notificacoes
pip install -e ./services/ms-avaliacoes
pip install -e ./services/ms-pagamentos
pip install -e ./services/ms-relatorios
pip install -e ./services/ms-gateway

# 2. Configurar .env (já criado, edite se necessário)
# 3. Criar banco de dados
mysql -u root -p < shared/database/init.sql

# 4. Iniciar cada serviço em terminais separados:

# Terminal 1 - Gateway (porta 8000)
set SERVICE_NAME=gateway && python -m uvicorn services.ms_gateway.app:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 - Auth (porta 8001)
set SERVICE_NAME=auth && python -m uvicorn services.ms_auth.app:app --host 0.0.0.0 --port 8001 --reload

# Terminal 3 - Catalogo (porta 8002)
set SERVICE_NAME=catalogo && python -m uvicorn services.ms_catalogo.app:app --host 0.0.0.0 --port 8002 --reload

# Terminal 4 - Pedidos (porta 8003)
set SERVICE_NAME=pedidos && python -m uvicorn services.ms_pedidos.app:app --host 0.0.0.0 --port 8003 --reload

# Terminal 5 - Cozinha (porta 8004)
set SERVICE_NAME=cozinha && python -m uvicorn services.ms_cozinha.app:app --host 0.0.0.0 --port 8004 --reload

# Terminal 6 - Entregas (porta 8005)
set SERVICE_NAME=entregas && python -m uvicorn services.ms_entregas.app:app --host 0.0.0.0 --port 8005 --reload

# Terminal 7 - Notificacoes (porta 8006)
set SERVICE_NAME=notificacoes && python -m uvicorn services.ms_notificacoes.app:app --host 0.0.0.0 --port 8006 --reload

# Terminal 8 - Avaliacoes (porta 8007)
set SERVICE_NAME=avaliacoes && python -m uvicorn services.ms_avaliacoes.app:app --host 0.0.0.0 --port 8007 --reload

# Terminal 9 - Pagamentos (porta 8008)
set SERVICE_NAME=pagamentos && python -m uvicorn services.ms_pagamentos.app:app --host 0.0.0.0 --port 8008 --reload

# Terminal 10 - Relatorios (porta 8009)
set SERVICE_NAME=relatorios && python -m uvicorn services.ms_relatorios.app:app --host 0.0.0.0 --port 8009 --reload

# Terminal 11 - Frontend (porta 8080)
cd inicio && python -m http.server 8080
```

## Acessar

- **Frontend**: http://localhost:8080
- **API Gateway**: http://localhost:8000
- **Docs da API**: http://localhost:8000/docs
- **Health check**: http://localhost:8000/health
- **RabbitMQ UI**: http://localhost:15672 (guest/guest)

## Como os Serviços se Conectam

```
Navegador (porta 8080)
    │
    ▼ fetch('/api/...')
Frontend (Python http.server)
    │
    ▼ Proxy /api/*
API Gateway (porta 8000) ──► Roteia por prefixo da URL
    │
    ├─► /auth, /usuarios, /clientes     → Auth (8001)
    ├─► /categorias, /produtos          → Catalogo (8002)
    ├─► /pedidos                        → Pedidos (8003)
    ├─► /entregas                       → Entregas (8005)
    ├─► /notificacoes, /push            → Notificacoes (8006)
    ├─► /avaliacoes                     → Avaliacoes (8007)
    ├─► /pagamentos, /webhook           → Pagamentos (8008)
    └─► /relatorios                     → Relatorios (8009)
    │
    ▼ Todos usam o mesmo:
MariaDB (porta 3306) ← Banco compartilhado 'fraga_lanches'
RabbitMQ (porta 5672) ← Mensageria assíncrona entre serviços
```

## Pontos-chave

1. **Banco único**: Todos os 10 serviços conectam no mesmo MariaDB (`fraga_lanches`)
2. **Gateway central**: Recebe tudo em `/api/*` e encaminha pro serviço certo
3. **RabbitMQ**: Eventos assíncronos (ex: pedido criado → notifica cozinha + entregas)
4. **Frontend estático**: Servido direto na 8080, chama API via `/api/`