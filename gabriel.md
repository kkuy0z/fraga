📦 Plano de Ação Recomendado

Fase 1: Fundação (Semana 1-2)

# 1. Setup build system
npm create vite@latest frontend -- --template vanilla-ts
# ou: migração gradual com Vite multi-page

# 2. TypeScript + ESLint + Prettier
npm i -D typescript eslint prettier @typescript-eslint/parser

# 3. Estrutura shared/
src/
├── shared/
│   ├── components/    # Header, Nav, UserMenu, CartButton, Modal, Toast
│   ├── hooks/         # us
│   ├── api/           # apiClient tipado + React Query/TanStack Query
│   ├── store/         # Zustand: auth, cart, ui
│   └── styles/        # design-tokens.css, components.css, utilities.css
├── pages/
│   ├── public/        # index, cardapio, carrinho, checkout, cadastro
│   ├── cliente/       # meus-pedidos, perfil
│   └── admin/         # dashboard, categorias, produtos, pedidos...
└── app.ts             # Entry point + router

Fase 2: Consolidação (Semana 2-3)

- [ ] Extrair Header/Nav/Us
Fase 3: Qualidade (Semana 3-4)

- [ ] Testes unitários (Vitest) para utils, hooks, store
- [ ] Testes de componente (Testing Library)
- [ ] E2E (Playwright): fluxos crítico (cadastro → pedido → checkout)
- [ ] CI/CD GitHub Actions:

- [ ] Workbox para SW (generateSW + injectManifest)
- [ ] Code splitting por rota (import('./pages/admin/dashboard'))
- [ ] Otimização de imagens (Sharp/Vite plugin + WebP/AVIF)
- [ ] Font optimization (self-host + font-display: swap + preload)
- [ ] Bundle analysis (vite-bundle-analyzer)

---

🎯 Quick Wins (Podem ser feitos AGORA)

┌───────────────────────────────────────────────────────────────────────┬─────────┬────────────────────────────────┐
│                                 Ação                                  │ Esforço │            Impacto             │
├───────────────────────────────────────────────────────────────────────┼─────────┼────────────────────────────────┤
│ Criar shared/utils/auth.ts e importar em vez de copiar decodificarJWT │ 15 min  │ Elimina 4 duplicatas           │
├───────────────────────────────────────────────────────────────────────┼─────────┼────────────────────────────────┤
│ Criar shared/hooks/useAuth.ts com verificarAuth()                     │ 30 min  │ Elimina 7 duplicatas           │
├───────────────────────────────────────────────────────────────────────┼─────────┼────────────────────────────────┤
│ Extrair Header/Nav para shared/components/Header.html + Header.js     │ 1h      │ Elimina 18+ duplicatas de HTML │
├───────────────────────────────────────────────────────────────────────┼─────────┼────────────────────────────────┤
│ Adicionar font-display: swap no @import do Google Fonts               │ 5 min   │ Core Web Vitals (CLS/LCP)      │
├───────────────────────────────────────────────────────────────────────┼─────────┼────────────────────────────────┤
│ Configurar ESLint + Prettier no projeto                               │ 30 min  │ Consistência de código         │
├───────────────────────────────────────────────────────────────────────┼─────────┼────────────────────────────────┤
│ Adicionar skip link no topo de style-pages.css                        │ 10 min  │ Acessibilidade                 │
└───────────────────────────────────────────────────────────────────────┴─────────┴────────────────────────────────┘

---

💡 Decisão Arquitetural Importante

▎ Manter duas implementações de cardápio (inicio/cardapio.html vs menu/menu.html)?
▎ Recomendação: Escolher UMA e migrar. O menu/ tem UX superior (sidebar cart, <dialog> nativo, busca integrada), mas inicio/ tem mais páginas dependentes. Sugiro migrar inicio/ para usar a arquitetura do menu/ (SPA-like com router client-side).

---

📊 Métricas de Sucesso Pós-Refatoração

┌──────────────────────────┬────────┬──────────────────────────────────────────┐
│         Métrica          │ Atual  │                   Alvo                   │
├──────────────────────────┼────────┼──────────────────────────────────────────┤
│ Arquivos JS por página   │ 8-12   │ 1-3 (code split)                         │
├──────────────────────────┼────────┼──────────────────────────────────────────┤
│ KB JS inicial (gzipped)  │ ~120KB │ < 50KB                                   │
├──────────────────────────┼────────┼──────────────────────────────────────────┤
│ Duplicação de código     │ ~40%
└──────────────────────────┴────────┴──────────────────────────────────────────┘

---