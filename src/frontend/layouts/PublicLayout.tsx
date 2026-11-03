/**
 * Layout para páginas públicas
 */

import { Outlet } from 'react-router-dom';

export function PublicLayout() {
  return (
    <>
      <Outlet />
    </>
  );
}

export default PublicLayout;