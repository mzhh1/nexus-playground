/**
 * RolePerspectiveProvider - 角色视角上下文提供者
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { RolePerspective } from '@nexus/shared-types';

interface RolePerspectiveContextValue {
  perspective: RolePerspective | null;
}

const RolePerspectiveContext = createContext<RolePerspectiveContextValue>({
  perspective: null,
});

export interface RolePerspectiveProviderProps {
  perspective: RolePerspective | null;
  children: ReactNode;
}

/**
 * 角色视角提供者组件
 */
export function RolePerspectiveProvider({
  perspective,
  children,
}: RolePerspectiveProviderProps) {
  return (
    <RolePerspectiveContext.Provider value={{ perspective }}>
      {children}
    </RolePerspectiveContext.Provider>
  );
}

/**
 * 使用角色视角的Hook
 */
export function useRolePerspective() {
  const context = useContext(RolePerspectiveContext);
  if (!context) {
    throw new Error('useRolePerspective must be used within RolePerspectiveProvider');
  }
  return context;
}

