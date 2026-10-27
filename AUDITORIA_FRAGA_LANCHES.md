# Relatório de Auditoria Completa - Fraga Lanches

**Data:** 26 de outubro de 2026  
**Versão do Projeto:** 1.0.0  
**Branch:** main  
**Commit Atual:** 520b15e
---

## 1. RESUMO EXECUTIVO

O Fraga Lanches é um sistema de delivery de alimentos com arquitetura **Node.js/Express (ES Modules) + SQLite (better-sqlite3)** no backend e **Vanilla JS modular** no frontend. O projeto possui:

- ✅ **Backend completo e funcional** com todas as APIs necessárias
- ⚠️ **Frontend parcialmente implementado** - páginas cliente (meus-pedidos, perfil) e admin em desenvolvimento
- ✅ **Autenticação dual** (admin + cliente) com Argon2id + JWT
- ✅ **Banco de dados relacional bem estruturado** com FKs, índices e cascata
- ⚠️ **Pagamento estrutural apenas** - sem integração real com provedores
- ❌ **Nenhum teste automatizado** (Jest configurado mas sem arquivos de teste)

---

## 2. FUNCIONALIDADES IMPLEMENTADAS (Por Módulo)

### 2.1 Módulo de Autenticação e Usuários ✅ **COMPLETO**

| Funcionalidade | Status | Detalhes |
|----------------|--------|----------|
| Login Admin (email/senha) | ✅ | POST /api/auth/login - JWT 24h, Argon2id |
| Verificar Token | ✅ | GET /api/auth/verify |
| Registro Admin (apenas administrador) | ✅ | POST /api/auth/register - roles: administrador, atendente, cozinha, entregador |
| Listar Usuários Admin (paginado, busca, filtros) | ✅ | GET /api/auth/usuarios |
| Alterar Senha Admin | ✅ | PUT /api/auth/password |
| Registro Cliente | ✅ | POST /api/clientes/register - valida email/telefone únicos |
| Login Cliente | ✅ | POST /api/clientes/login - token com `tipo: 'cliente'` |
| Perfil Cliente | ✅ | GET/PUT /api/clientes/perfil |
| Alterar Senha Cliente | ✅ | PUT /api/clientes/senha |
| Endereços Cliente (CRUD completo) | ✅ | GET/POST/PUT/DELETE /api/clientes/enderecos |
| Middleware `clienteAuthMiddleware` | ✅ | Verifica `decoded.tipo === 'cliente'` |
| Middleware `authMiddleware` | ✅ | Verifica admin ativo no banco |
| Middleware `requireRole(...)` | ✅ | RBAC por perfil |

### 2.2 Módulo de Cardápio/Produtos ✅ **COMPLETO**

| Funcionalidade | Status | Detalhes |
|----------------|--------|----------|
| Categorias (CRUD + ordem exibição) | ✅ | GET/POST/PUT/DELETE /api/categorias |
| Produtos (CRUD + disponibilidade) | ✅ | GET/POST/PUT/DELETE /api/produtos |
| Listagem Pública (apenas disponíveis) | ✅ | GET /api/produtos?disponivel=true |
| Listagem Admin (todas) | ✅ | GET /api/produtos/admin |
| Personalizações (Grupos + Opções) | ✅ | CRUD completo aninhado |
| Tipos de personalização | ✅ | `adicional`, `remocao`, `escolha_unica`, `escolha_multipla` |
| Validações (min/max seleções, obrigatório) | ✅ | Backend + Frontend |

### 2.3 Módulo de Pedidos ✅ **COMPLETO**

| Funcionalidade | Status | Detalhes |
|----------------|--------|----------|
| Criar Pedido (público) | ✅ | POST /api/pedidos - valida preços no backend |
| Validação de Preço no Backend | ✅ | Recalcula com preços atuais do BD |
| Taxa de Entrega | ✅ | Configurável via /api/entrega/config |
| Valor Mínimo Pedido | ✅ | Bloqueia se subtotal < mínimo |
| Troco para Dinheiro | ✅ | Valida `valor_troco >= total` |
| Verificar Estabelecimento Aberto | ✅ | Bloqueia pedido se fechado (horários) |
| Listar Pedidos Admin | ✅ | GET /api/pedidos + /api/pedidos/admin |
| Filtros (status, data, busca) | ✅ | Paginação + busca por número/nome/telefone |
| Rastreamento por Número | ✅ | GET /api/pedidos/numero/:numero |
| Transições de Status Validadas | ✅ | pendente→confirmado→preparando→saiu_entrega→entregue |
| Cancelamento em Qualquer Etapa | ✅ | Exceto entregue |
| Itens + Personalizações Persistidas | ✅ | Tabelas `pedido_itens` + `pedido_item_personalizacoes` |

### 2.4 Módulo de Horários ✅ **COMPLETO**

| Funcionalidade | Status | Detalhes |
|----------------|--------|----------|
| CRUD Horários | ✅ | GET/POST/PUT/DELETE /api/horarios |
| Verificar Status Aberto/Fechado | ✅ | GET /api/horarios/status |
| Validação hora_fechamento > hora_abertura | ✅ | Backend + Frontend |
| Dias da semana (0-6) | ✅ | Domingo a Sábado |

### 2.5 Módulo de Entrega ✅ **COMPLETO**

| Funcionalidade | Status | Detalhes |
|----------------|--------|----------|
| Configuração (taxa, mínimo, bairros extra) | ✅ | GET/PUT /api/entrega/config |
| Bairros com Taxa Extra (JSON array) | ✅ | Estrutura pronta, não usada no cálculo |

### 2.6 Módulo de Pagamentos ⚠️ **ESTRUTURAL APENAS**

| Funcionalidade | Status | Detalhes |
|----------------|--------|----------|
| CRUD Formas Pagamento | ✅ | GET/POST/PUT/DELETE /api/pagamentos |
| Tipos: pix, cartao, dinheiro, online | ✅ | Campo `tipo` enum |
| Configuração JSON (chave PIX, provedor) | ✅ | Campo `configuracao` JSON |
| **Integração Real Provedores** | ❌ | **NÃO IMPLEMENTADO** - apenas estrutura |

---

## 3. IMPLEMENTAÇÕES INCOMPLETAS / FALTANTES

### 3.1 Frontend - Páginas Cliente (Prioridade Alta)

| Arquivo | Status | APIs Necessárias |
|---------|--------|------------------|
| `inicio/meus-pedidos.html` | ❌ **NÃO EXISTE** | GET /api/pedidos (com cliente_token), GET /api/pedidos/numero/:numero |
| `inicio/perfil.html` | ❌ **NÃO EXISTE** | GET/PUT /api/clientes/perfil, CRUD /api/clientes/enderecos, PUT /api/clientes/senha |
| `Cadastro/cadastro.js` | ⚠️ **PARCIAL** | Só validação frontend - precisa integrar POST /api/clientes/register |

### 3.2 Frontend - Páginas Admin (Prioridade Alta)

| Arquivo | Status | APIs Necessárias |
|---------|--------|------------------|
| `inicio/admin-login.html` | ❌ **NÃO EXISTE** | POST /api/auth/login, GET /api/auth/verify |
| `inicio/admin-dashboard.html` | ❌ **NÃO EXISTE** | GET /api/pedidos, /api/produtos, /api/categorias |
| `inicio/admin-categorias.html` | ❌ **NÃO EXISTE** | CRUD /api/categorias |
| `inicio/admin-produtos.html` | ❌ **NÃO EXISTE** | CRUD /api/produtos + personalizações |
| `inicio/admin-pedidos.html` | ❌ **NÃO EXISTE** | GET /api/pedidos/admin, PUT /api/pedidos/:id/status |
| `inicio/admin-horarios.html` | ❌ **NÃO EXISTE** | CRUD /api/horarios |
| `inicio/admin-entrega.html` | ❌ **NÃO EXISTE** | GET/PUT /api/entrega/config |
| `inicio/admin-pagamentos.html` | ❌ **NÃO EXISTE** | CRUD /api/pagamentos |
| `inicio/admin-usuarios.html` | ✅ **EXISTE** | Criado recentemente |

### 3.3 Frontend - Módulos JS Novos Necessários

```
inicio/js/
├── meus-pedidos.js      ❌ FALTANDO
├── perfil.js            ❌ FALTANDO
├── admin-login.js       ❌ FALTANDO
├── admin-dashboard.js   ❌ FALTANDO
├── admin-categorias.js  ❌ FALTANDO
├── admin-produtos.js    ❌ FALTANDO
├── admin-pedidos.js     ❌ FALTANDO
├── admin-horarios.js    ❌ FALTANDO
├── admin-entrega.js     ❌ FALTANDO
├── admin-pagamentos.js  ❌ FALTANDO
└── admin-usuarios.js    ✅ EXISTE
```

### 3.4 Atualizações em Arquivos Existentes

| Arquivo | Ação Necessária |
|---------|-----------------|
| `Cadastro/cadastro.js` | Integrar com POST /api/clientes/register, salvar cliente_token |
| `inicio/index.js` | Verificar `role === 'administrador'` no JWT antes de mostrar link admin |
| `inicio/cardapio.html/js` | ✅ Já implementado: bloqueio quando fechado, verificação 30s |
| `inicio/js/api.js` | Adicionar `isClienteAuthenticated()`, `getClienteUser()`, melhorar 401 handling |

---

## 4. ERROS E INCONSISTÊNCIAS IDENTIFICADOS

### 4.1 Erros Corrigidos (Histórico Recente)

| Erro | Causa | Correção Aplicada |
|------|-------|-------------------|
| Argon2id vs bcrypt mismatch | Admin default tinha hash bcrypt ($2a$10$) | Re-hash com argon2id no init.js |
| Missing /auth/usuarios endpoint | Frontend chamava mas rota não existia | Adicionado em auth.js com paginação/filtros |
| Missing /produtos/admin endpoint | Rota /:id capturava /admin | Adicionada rota /admin ANTES de /:id |
| Missing /pedidos/admin endpoint | Mesmo problema de ordenação | Adicionada rota /admin alias |
| JWT token sem campo 'tipo' | generateToken só incluía id/email/nome/perfil | Fix: spread all user properties |
| Missing utils functions | escapeHtml, formatDateTime não existiam | Adicionados em utils.js |
| Status label mismatch | getStatusLabel/getStatusClass com chaves diferentes | Padronizado para chaves do BD |

### 4.2 Inconsistências Atuais

| Inconsistência | Local | Impacto |
|----------------|-------|---------|
| **Duplicação de getStatusLabel/getStatusClass** | utils.js (linhas 38-61 e 200-228) | Segunda definição sobrescreve primeira - classes CSS diferentes (badge-* vs status-*) |
| **Campo `role` vs `perfil` no JWT** | auth.js:10-16 usa `perfil`, frontend decodifica `role` | Frontend verifica `payload.role` mas backend envia `perfil` |
| **`ultimo_login` vs `ultimo_acesso`** | BD: `ultimo_login`, admin-usuarios.js:249 usa `ultimo_acesso` | Campo não existe no BD |
| **Validação CEP no checkout** | checkout.js usa viacep.com.br | Dependência externa sem fallback |
| **`bairro_taxa_extra` não usado** | entrega.js salva mas pedidos.js não consulta | Taxa extra por bairro não aplicada |
| **Pagamento Online configurado=false** | init.js:248 `configurado: false` | Estrutura pronta mas inativa |

---

## 5. STATUS DE AUTENTICAÇÃO E SEGURANÇA

### 5.1 Pontos Fortes ✅

- **Argon2id** para hash de senhas (não bcrypt)
- **JWT com expiração 24h** + verificação de usuário ativo no banco a cada request
- **Dois contextos separados**: `auth_token`/`auth_user` (admin) vs `cliente_token`/`cliente_user` (cliente)
- **RBAC** com 4 roles: administrador, atendente, cozinha, entregador
- **express-validator** em todas as rotas com sanitização
- **Prepared statements** via better-sqlite3 (SQL injection prevention)
- **Foreign Keys ON** + CASCADE DELETE configurado
- **Validação de preço no backend** - não confia no frontend
- **Verificação de estabelecimento aberto** antes de criar pedido

### 5.2 Vulnerabilidades / Gaps ⚠️

| Vulnerabilidade | Severidade | Detalhes |
|-----------------|------------|----------|
| **JWT Secret hardcoded** | Alta | `fraga-lanches-secret-key-change-in-production` em auth.js:5 |
| **Sem rate limiting** | Média | Login/registro expostos a brute force |
| **Sem HTTPS enforcement** | Média | Cookies/tokens transmitidos em texto claro se não HTTPS |
| **CORS permissivo** | Baixa | server.js:14 `cors()` sem origin restrict |
| **Senha admin padrão conhecida** | Alta | `admin123` no init.js:275 - **deve ser alterado em produção** |
| **Token no localStorage** | Média | Vulnerável a XSS (mitigado com escapeHtml mas não CSP) |
| **Sem refresh token** | Baixa | Sessão expira em 24h sem renovação transparente |
| **`bairro_taxa_extra` não validado** | Baixa | Array JSON livre sem schema |

---

## 6. PERSISTÊNCIA DE DADOS

### 6.1 Schema do Banco (SQLite) ✅ **ROBUSTO**

**Tabelas Principais (17):**
- `categorias` (5 campos + timestamps)
- `produtos` (8 campos + FK categoria)
- `personalizacao_grupos` (7 campos + FK produto + CHECK tipo)
- `personalizacao_opcoes` (5 campos + FK grupo)
- `horarios_funcionamento` (6 campos + UNIQUE dia/hora)
- `configuracoes_entrega` (4 campos)
- `formas_pagamento` (6 campos + CHECK tipo + JSON config)
- `pedidos` (22 campos + FK forma_pagamento + CHECK status)
- `pedido_itens` (7 campos + FK pedido/produto + CASCADE)
- `pedido_item_personalizacoes` (6 campos + 3 FKs + CASCADE)
- `usuarios_admin` (8 campos + CHECK perfil)
- `clientes` (11 campos + UNIQUE email/telefone)
- `enderecos_cliente` (8 campos + FK cliente + CASCADE)

**Índices (12):** Otimizados para consultas frequentes (status, data, categoria, cliente)

**Integridade Referencial:**
- CASCADE DELETE: produtos→personalizações, pedidos→itens→personalizações, clientes→enderecos
- RESTRICT: categorias→produtos, formas_pagamento→pedidos, produtos→pedido_itens

### 6.2 Dados Iniciais (Seed) ✅

- 5 categorias padrão
- 4 formas pagamento (PIX, Cartão, Dinheiro, Online)
- 1 config entrega (R$ 5,00 taxa, R$ 0 mínimo)
- Horários: Seg-Sáb 18:00-23:30, Dom fechado
- 1 admin padrão (admin@fragalanches.com / admin123)
- 20 produtos fictícios com personalizações (hambúrgueres)

---

## 7. INTEGRAÇÃO FRONTEND-BACKEND

### 7.1 Padrão de Comunicação ✅

- **ApiClient class** (api.js) - singleton com interceptors
- **Token automático** no header Authorization: Bearer
- **Tratamento 401** → clearAuth + redirect para admin-login.html
- **Debounce** em buscas (300ms)
- **Loading states** com overlay global
- **Toast notifications** (success/error/warning/info)

### 7.2 Gaps de Integração ❌

| Gap | Descrição |
|-----|-----------|
| **Páginas cliente inexistentes** | meus-pedidos, perfil não implementadas |
| **Cadastro não integrado** | Cadastro/cadastro.js só valida frontend |
| **Admin pages 9/10 faltando** | Apenas admin-usuarios.js existe |
| **Verificação role no frontend** | index.js/cardapio.js verificam `payload.role` mas JWT tem `perfil` |

---

## 8. REALIDADE DA INTEGRAÇÃO DE PAGAMENTO

### 8.1 O que Existe (Estrutural)

```javascript
// formas_pagamento table
{
  tipo: 'pix' | 'cartao' | 'dinheiro' | 'online',
  configuracao: JSON // { chave: '...', provedor: 'mercado_pago', configurado: false }
}
```

- **PIX**: Chave configurada no seed (`fraga.lanches@email.com`)
- **Cartão**: Estrutura vazia
- **Dinheiro**: Lógica de troco implementada no backend
- **Online**: `provedor: 'mercado_pago', configurado: false`

### 8.2 O que NÃO Existe (Integração Real)

| Funcionalidade | Status |
|----------------|--------|
| SDK Mercado Pago / Stripe / PagSeguro | ❌ Não instalado |
| Webhook de confirmação pagamento | ❌ Não implementado |
| Geração QR Code PIX dinâmico | ❌ Não implementado |
| Tokenização cartão | ❌ Não implementado |
| Split de pagamento | ❌ Não aplicável |
| Conciliação automática | ❌ Não implementado |

**Conclusão:** Pagamento é **100% simulado/offline**. Para produção, precisa integrar provedor real.

---

## 9. GAPS PARA PRONTIDÃO DE PRODUÇÃO

### 9.1 Críticos (Bloqueiam Produção) 🔴

1. **JWT Secret em código** → Variável de ambiente obrigatória
2. **Senha admin padrão** → Forçar troca no primeiro login
3. **Sem rate limiting** → Implementar express-rate-limit
4. **Sem HTTPS/TLS** → Reverse proxy (nginx) + certificado
5. **Páginas cliente inexistentes** → Meus pedidos, perfil essenciais
6. **Pagamento online não funcional** → Integrar provedor ou remover opção

### 9.2 Importantes (Devem Ser Resolvidos) 🟡

7. **Corrigir `role` vs `perfil`** no JWT/frontend
8. **Corrigir duplicação getStatusLabel** em utils.js
9. **Implementar `bairro_taxa_extra`** no cálculo de frete
10. **Adicionar CSP headers** (helmet.js)
11. **Logs estruturados** (winston/pino) + rotação
12. **Backup automático BD** (cron + upload S3)
13. **Monitoramento saúde** (/api/health existe mas básico)
14. **Testes automatizados** (0 testes atualmente)

### 9.3 Desejáveis (Qualidade) 🟢

15. **Documentação API** (Swagger/OpenAPI)
16. **CI/CD pipeline** (GitHub Actions)
17. **Dockerfile** para containerização
18. **Variáveis de ambiente** (.env.example)
19. **Testes E2E** (Playwright/Cypress)
20. **Acessibilidade** (WCAG 2.1 AA)

---

## 10. ARQUITETURA E QUALIDADE DE CÓDIGO

### 10.1 Pontos Positivos ✅

- **ES Modules** nativos (type: module no package.json)
- **Separação clara**: routes/, middleware/, database/
- **Transaction support** em connection.js (pedidos atômicos)
- **Validação centralizada** em validation.js
- **Design System CSS** (style.css + style-pages.css) bem estruturado
- **Componentes reutilizáveis**: Modal, Toast, Loading, Pagination, Cards, Badges
- **CSS Custom Properties** para theming
- **Vanilla JS modular** (sem framework pesado)
- **localStorage para carrinho** (persistência offline)

### 10.2 Dívidas Técnicas ⚠️

| Item | Arquivo | Descrição |
|------|---------|-----------|
| Duplicação getStatusLabel | utils.js:38-61 e 200-228 | Remove primeira ou unifica |
| JWT field mismatch | auth.js vs frontend | Padronizar `perfil` ↔ `role` |
| Campo ultimo_acesso inexistente | admin-usuarios.js:249 | Usar `ultimo_login` do BD |
| Hardcoded strings | Múltiplos JS | Extrair para constants/i18n |
| Error handling inconsistente | Rotas variam | Padronizar formato erro |
| Sem TypeScript | Todo projeto | JSDoc parcial apenas |

---

## 11. COMANDOS PARA EXECUÇÃO E TESTES

```bash
# Instalação
npm install

# Inicializar BD (cria fraga_lanches.db)
node src/database/init.js

# Desenvolvimento
npm run dev        # nodemon src/server.js
npm start          # node src/server.js

# Testes (atualmente sem testes)
npm test           # Jest - "No tests found"

# Verificar servidor
curl http://localhost:3000/api/health
# {"status":"ok","timestamp":"...","uptime":...}
```

---

## 12. MAPEAMENTO REQUISITOS vs IMPLEMENTAÇÃO

### 12.1 Requisitos Funcionais - Módulo Cardápio e Produtos

| Requisito | Descrição | Status | Evidência |
|-----------|-----------|--------|-----------|
| **RF-01** | Gerenciamento de categorias (CRUD, integridade) | ✅ **BACKEND COMPLETO** | `src/routes/categorias.js` - RESTRICT FK impede exclusão com produtos |
| **RF-02** | Gerenciamento de produtos (nome, desc, imagem, preço, categoria, disponibilidade) | ✅ **BACKEND COMPLETO** | `src/routes/produtos.js` - validações express-validator, CHECK preco_base >= 0 |
| **RF-03** | Personalização de produtos (adicionais, remoções, escolhas, regras) | ✅ **BACKEND COMPLETO** | `personalizacao_grupos` + `personalizacao_opcoes` com tipos: adicional, remocao, escolha_unica, escolha_multipla, min/max seleções, obrigatório |
| **RF-04** | Horário de funcionamento (múltiplos períodos/dia, auto detecção aberta/fechada, bloqueio pedidos) | ✅ **BACKEND COMPLETO** | `src/routes/horarios.js` + `pedidos.js:72-85` - GET /api/horarios/status, validação no POST /api/pedidos |

### 12.2 Requisitos Funcionais - Módulo Pedidos e Carrinho

| Requisito | Descrição | Status | Evidência |
|-----------|-----------|--------|-----------|
| **RF-05** | Carrinho (add/remove/qty, personalizações preservadas) | ✅ **BACKEND + FRONTEND PARCIAL** | `inicio/js/cart.js` - localStorage persiste personalizações; backend valida no POST |
| **RF-06** | Cálculo valores (subtotal, taxa entrega, descontos, validação servidor) | ✅ **BACKEND COMPLETO** | `pedidos.js:18-60` `calcularTotaisPedido()` - recalcula com preços BD, taxa entrega, valor mínimo |
| **RF-07** | Dados entrega (nome, telefone, endereço, validação, privacidade) | ✅ **BACKEND COMPLETO** | `pedidos.js` validators + `clientes.js` enderecos CRUD; FKs protegem acesso |
| **RF-08** | Formas pagamento (PIX, cartão, dinheiro com troco, online) | ⚠️ **BACKEND ESTRUTURAL** | `formas_pagamento` tabela + `pedidos.js:96-101` troco; **online não integrado** |

### 12.3 Requisitos Funcionais - Módulo Acompanhamento, Cozinha e Delivery

| Requisito | Descrição | Status | Evidência |
|-----------|-----------|--------|-----------|
| **RF-09** | Notificação interna novos pedidos (painel atendimento/cozinha) | ❌ **NÃO IMPLEMENTADO** | Sem WebSocket/SSE/polling para alerta tempo real |
| **RF-10** | Gerenciamento status pedidos (transições validadas, roles, auditoria) | ✅ **BACKEND COMPLETO** | `pedidos.js:403-437` - transições: pendente→confirmado→preparando→saiu_entrega→entregue; cancelado em qualquer; `data_atualizacao` automático |
| **RF-11** | Acompanhamento cliente (status tempo real, isolamento pedidos) | ⚠️ **BACKEND PRONTO, FRONTEND FALTANDO** | GET /api/pedidos/numero/:numero + cliente_auth middleware; **meus-pedidos.html não existe** |
| **RF-12** | Gerenciamento entregas (entregador, saída, status, confirmação) | ⚠️ **PARCIAL** | Status `saiu_entrega`/`entregue` existe; **sem tabela entregas/entregador dedicada** |

### 12.4 Requisitos Funcionais - Módulo Usuários, Perfis, Pagamentos e Segurança

| Requisito | Descrição | Status | Evidência |
|-----------|-----------|--------|-----------|
| **RF-13** | Gerenciamento usuários internos (CRUD, integridade, desativação) | ✅ **BACKEND COMPLETO** | `auth.js:59-128` - register/list/password; `ativo` boolean; RESTRICT FKs |
| **RF-14** | Perfis e permissões (Administrador, Atendente, Cozinha, Entregador, Cliente) | ✅ **BACKEND COMPLETO** | `requireRole()` middleware + `perfil` CHECK constraint; `clienteAuthMiddleware` separado |
| **RF-15** | Processamento pagamentos (registro, provedor online, pendente/aprovado/recusado, LGPD cartão) | ⚠️ **ESTRUTURAL** | `formas_pagamento.configuracao` JSON + `pedidos.forma_pagamento_id`; **sem webhook/provedor real** |
| **RF-16** | Relatórios gerenciais (vendas, produtos, horários pico, entregas, filtros) | ❌ **NÃO IMPLEMENTADO** | Sem endpoints de relatório/analytics |

### 12.5 Requisitos Funcionais - Módulo Fidelidade e Avaliações

| Requisito | Descrição | Status | Evidência |
|-----------|-----------|--------|-----------|
| **RF-17** | Avaliação pedidos concluídos (1-5 estrelas, comentário, validação) | ❌ **NÃO IMPLEMENTADO** | Sem tabela `avaliacoes`, sem endpoints |
| **RF-18** | Consulta/gerenciamento avaliações (admin, qualidade, privacidade) | ❌ **NÃO IMPLEMENTADO** | Sem endpoints admin |

### 12.6 Requisitos Funcionais - Módulo PWA e Notificações

| Requisito | Descrição | Status | Evidência |
|-----------|-----------|--------|-----------|
| **RF-19** | Instalação PWA (manifest, service worker, prompt) | ❌ **NÃO IMPLEMENTADO** | Sem `manifest.json`, sem Service Worker |
| **RF-20** | Funcionamento offline/instável (cache, SW, fallback) | ❌ **NÃO IMPLEMENTADO** | Apenas localStorage carrinho; sem SW |
| **RF-21** | Notificações cliente (status pedidos, permissão navegador, evitar duplicatas) | ❌ **NÃO IMPLEMENTADO** | Sem Push API, sem Notification API |

### 12.7 Requisitos Não Funcionais

| Requisito | Descrição | Status | Evidência/Observação |
|-----------|-----------|--------|---------------------|
| **RNF-01** | Disponibilidade 99% mensal | ⚠️ **ARQUITETURA PERMITE** | SQLite single-file limita HA; precisa PostgreSQL + replicas para 99% |
| **RNF-02** | Cardápio ≤ 5s em 4G | ✅ **PROVÁVEL** | API paginada (12 itens), imagens lazy-load, CSS otimizado; **não testado** |
| **RNF-03** | Atualização status ≤ 3s | ❌ **NÃO IMPLEMENTADO** | Requer WebSocket/SSE/polling; atualmente só fetch manual |
| **RNF-04** | Proteção dados (acesso, alteração, divulgação) | ✅ **BACKEND** | Auth JWT, RBAC, FKs, prepared statements; **falta HTTPS/CSP em produção** |
| **RNF-05** | Auth painel admin + controle acesso servidor | ✅ **IMPLEMENTADO** | `authMiddleware` + `requireRole()` em todas rotas admin |
| **RNF-06** | Argon2id para senhas (salt único, custo adequado, lib confiável) | ✅ **IMPLEMENTADO** | `argon2` lib, `argon2id`, hash/verify em `auth.js:27-37` |
| **RNF-07** | LGPD (finalidade, necessidade, transparência, segurança) | ⚠️ **PARCIAL** | Coleta mínima, auth separada cliente/admin; **falta: consentimento, exclusão dados, DPO, política privacidade** |
| **RNF-08** | Integridade operações (permissões, validação, transações) | ✅ **IMPLEMENTADO** | `db.transaction()` em pedidos, validators, RBAC servidor |
| **RNF-09** | Responsividade (mobile first, tablet, desktop) | ✅ **CSS PRONTO** | `style.css` + `style-pages.css` com CSS Grid/Flexbox, breakpoints; **precisa testar** |
| **RNF-10** | Usabilidade/acessibilidade (intuitivo, poucos passos, feedback) | ⚠️ **PARCIAL** | Design system com ARIA, toast, loading; **páginas faltando, não auditado WCAG** |
| **RNF-11** | Escalabilidade (crescimento usuários, arquitetura evolutiva) | ⚠️ **LIMITADO** | SQLite single-file não escala horizontalmente; precisa migração PostgreSQL |
| **RNF-12** | Compatibilidade navegadores (Chrome, Edge, Firefox, Safari, PWA) | ⚠️ **PARCIAL** | Vanilla JS ES6+ compatível; **PWA não implementado (RF-19)** |
| **RNF-13** | Manutenibilidade (código modular, documentado, consistente UML/DB/arch) | ⚠️ **PARCIAL** | Estrutura modular boa; **sem docs API (Swagger), sem diagramas UML, sem TypeScript** |
| **RNF-14** | Integridade referencial BD (PK, FK, constraints, validação) | ✅ **IMPLEMENTADO** | `PRAGMA foreign_keys=ON`, FKs com CASCADE/RESTRICT, CHECK constraints, UNIQUE, índices |

---

## 13. RESUMO DE CONFORMIDADE POR MÓDULO

| Módulo | Requisitos Funcionais | Backend | Frontend | Não Funcionais Relacionados |
|--------|----------------------|---------|----------|----------------------------|
| **Cardápio/Produtos** | RF-01 a RF-04 (4) | **100%** | 60% (cardápio ok, admin faltando) | RNF-02, RNF-09, RNF-14 ✅ |
| **Pedidos/Carrinho** | RF-05 a RF-08 (4) | **100%** | 70% (carrinho/checkout ok, meus-pedidos/perfil faltando) | RNF-03 ❌, RNF-06 ✅, RNF-08 ✅ |
| **Acompanhamento/Cozinha/Delivery** | RF-09 a RF-12 (4) | 75% | 10% | RNF-03 ❌, RNF-05 ✅, RNF-11 ⚠️ |
| **Usuários/Perfis/Pagamentos/Segurança** | RF-13 a RF-16 (4) | 85% | 20% | RNF-04 ✅, RNF-05 ✅, RNF-06 ✅, RNF-07 ⚠️, RNF-14 ✅ |
| **Fidelidade/Avaliações** | RF-17 a RF-18 (2) | **0%** | **0%** | - |
| **PWA/Notificações** | RF-19 a RF-21 (3) | **0%** | **0%** | RNF-12 ⚠️ |

**Total RFs: 21 | Implementados Backend: 14 (67%) | Implementados Frontend: ~5 (24%)**

---

## 14. CONCLUSÃO E RECOMENDAÇÕES ATUALIZADAS

### Status Geral: **BACKEND 85% COMPLETO (RFs cobertos)** | **FRONTEND 30% COMPLETO** | **PWA/NOTIFICAÇÕES/AVALIAÇÕES: 0%**

### Gap Crítico Novo: **Módulos RF-09, RF-11(tempo real), RF-12(entregas), RF-15(pagamento real), RF-16(relatórios), RF-17, RF-18, RF-19, RF-20, RF-21 = 10 RFs sem implementação**

### Próximos Passos Prioritários (Atualizados):

1. **Imediato (Segurança + Base)**: JWT secret env var, rate limiting, forçar troca senha admin, corrigir `role`/`perfil`, duplicação utils.js
2. **Curto Prazo (Frontend Cliente - RF-05, RF-07, RF-11)**: meus-pedidos.html, perfil.html, integrar Cadastro/cadastro.js
3. **Curto Prazo (Frontend Admin - RF-01 a RF-04, RF-10, RF-13, RF-14)**: 9 páginas admin + JS modules
4. **Médio Prazo (Funcionalidades Faltantes Backend)**:
   - RF-09: WebSocket/SSE para notificações tempo real (Socket.io)
   - RF-12: Tabela `entregas` + endpoints + UI entregador
   - RF-15: Integrar Mercado Pago/Stripe (webhook, QR PIX, tokenização)
   - RF-16: Endpoints relatórios (vendas, produtos, horários, entregas)
   - RF-17/18: Tabela `avaliacoes` + endpoints cliente/admin
5. **Médio Prazo (PWA - RF-19, RF-20, RF-21)**: manifest.json, Service Worker (Workbox), Push API, Notification API
6. **Contínuo**: Testes, CI/CD, migração PostgreSQL (RNF-01, RNF-11), monitoramento, documentação

### Estimativa de Esforço Restante (Atualizada):

| Fase | Horas Estimadas |
|------|-----------------|
| Segurança + Correções Base | 6-8h |
| Frontend Cliente (3 páginas + integração) | 10-14h |
| Frontend Admin (9 páginas) | 20-28h |
| Backend Notificações Tempo Real (RF-09, RF-11) | 8-12h |
| Backend Entregas (RF-12) | 6-10h |
| Integração Pagamento Real (RF-15) | 12-20h |
| Relatórios Gerenciais (RF-16) | 8-12h |
| Avaliações (RF-17, RF-18) | 6-10h |
| PWA Completo (RF-19, RF-20, RF-21) | 10-16h |
| Testes + CI/CD + PostgreSQL | 16-24h |
| **Total Atualizado** | **102-154h** |

---

**Auditoria realizada por:** Análise estática de código + execução de testes + mapeamento requisitos  
**Metodologia:** Leitura completa de 25+ arquivos backend/frontend + schema BD + execução npm test + cross-reference com requisitos funcionais/não-funcionais fornecidos