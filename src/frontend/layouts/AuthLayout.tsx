/**
 * Layout para páginas de autenticação/perfil do cliente
 */

import { Outlet } from 'react-router-dom';
import { Header } from '@components';

export function AuthLayout() {
  return (
    <>
      <Header currentPage="perfil" />
      <Outlet />
    </>
  );
}

export default AuthLayout;