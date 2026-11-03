/**
 * Componente raiz da aplicação
 * Configura roteamento, providers globais e layout base
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from '@components';
import { LoadingOverlay } from '@components';
import { Header } from '@components';
import { Footer } from '@components';
import { useAuth, useCheckAuth } from '@hooks';

// Páginas públicas
import { HomePage } from './pages/HomePage';
import { CardapioPage } from './pages/CardapioPage';
import { CarrinhoPage } from './pages/CarrinhoPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { CadastroPage } from './pages/CadastroPage';
import { LoginPage } from './pages/LoginPage';
import { PerfilPage } from './pages/PerfilPage';
import { MeusPedidosPage } from './pages/MeusPedidosPage';
import { PedidoConfirmadoPage } from './pages/PedidoConfirmadoPage';

// Páginas admin
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminCategoriasPage } from './pages/AdminCategoriasPage';
import { AdminProdutosPage } from './pages/AdminProdutosPage';
import { AdminPedidosPage } from './pages/AdminPedidosPage';
import { AdminUsuariosPage } from './pages/AdminUsuariosPage';
import { AdminHorariosPage } from './pages/AdminHorariosPage';
import { AdminEntregaPage } from './pages/AdminEntregaPage';
import { AdminPagamentosPage } from './pages/AdminPagamentosPage';

// Layouts
import { PublicLayout } from './layouts/PublicLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { AdminLayout } from './layouts/AdminLayout';

export function App() {
  const { isAdminAuthenticated, isClienteAuthenticated } = useCheckAuth();

  return (
    <BrowserRouter>
      <div className="app">
        {/* Skip link para acessibilidade */}
        <a href="#main-content" className="skipLink">
          Pular para o conteúdo principal
        </a>

        {/* Header global */}
        <Header currentPage="inicio" showAdminLink />

        {/* Loading global */}
        <LoadingOverlay loadingKey="global" />

        {/* Toast container */}
        <ToastContainer />

        {/* Conteúdo principal */}
        <main id="main-content" className="main-content">
          <Routes>
            {/* Rotas públicas */}
            <Route path="/" element={<PublicLayout />}>
              <Route index element={<HomePage />} />
              <Route path="cardapio" element={<CardapioPage />} />
              <Route path="carrinho" element={<CarrinhoPage />} />
              <Route path="checkout" element={<CheckoutPage />} />
              <Route path="pedido-confirmado/:id" element={<PedidoConfirmadoPage />} />
            </Route>

            {/* Rotas de autenticação cliente */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/cadastro" element={<AuthLayout />}>
              <Route index element={<CadastroPage />} />
            </Route>

            {/* Rotas protegidas cliente */}
            <Route
              path="/perfil"
              element={
                isClienteAuthenticated ? (
                  <AuthLayout>
                    <PerfilPage />
                  </AuthLayout>
                ) : (
                  <Navigate to="/cadastro" replace />
                )
              }
            />
            <Route
              path="/meus-pedidos"
              element={
                isClienteAuthenticated ? (
                  <AuthLayout>
                    <MeusPedidosPage />
                  </AuthLayout>
                ) : (
                  <Navigate to="/cadastro" replace />
                )
              }
            />

            {/* Rotas admin */}
            <Route path="/admin-login" element={<AdminLoginPage />} />
            <Route
              path="/admin"
              element={
                isAdminAuthenticated ? <AdminLayout /> : <Navigate to="/admin-login" replace />
              }
            >
              <Route index element={<AdminDashboardPage />} />
              <Route path="categorias" element={<AdminCategoriasPage />} />
              <Route path="produtos" element={<AdminProdutosPage />} />
              <Route path="pedidos" element={<AdminPedidosPage />} />
              <Route path="usuarios" element={<AdminUsuariosPage />} />
              <Route path="horarios" element={<AdminHorariosPage />} />
              <Route path="entrega" element={<AdminEntregaPage />} />
              <Route path="pagamentos" element={<AdminPagamentosPage />} />
            </Route>

            {/* 404 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* Footer global */}
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;