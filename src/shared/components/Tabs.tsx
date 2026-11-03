/**
 * Tabs component reutilizável
 */

import { useState, ReactNode, AllHTMLAttributes } from 'react';
import styles from './Tabs.module.css';

export interface TabsProps extends Omit<AllHTMLAttributes<HTMLDivElement>, 'onChange'> {
  defaultIndex?: number;
  onChange?: (index: number) => void;
  children: ReactNode;
}

export function Tabs({ defaultIndex = 0, onChange, children, className = '', ...props }: TabsProps) {
  const [activeIndex, setActiveIndex] = useState(defaultIndex);

  const handleChange = (index: number) => {
    setActiveIndex(index);
    onChange?.(index);
  };

  // Filtrar apenas filhos válidos (TabList e TabPanel)
  const validChildren = Array.isArray(children) ? children : [children];
  const tabList = validChildren.find((child) => child?.type === TabList);
  const tabPanels = validChildren.filter((child) => child?.type === TabPanel);

  return (
    <div className={`${styles.tabs} ${className}`} {...props}>
      {tabList}
      {tabPanels.map((panel, index) =>
        React.cloneElement(panel as any, {
          isActive: index === activeIndex,
        })
      )}
    </div>
  );
}

export interface TabListProps extends AllHTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function TabList({ children, className = '', ...props }: TabListProps) {
  return (
    <div role="tablist" className={`${styles.tabList} ${className}`} {...props}>
      {children}
    </div>
  );
}

export interface TabProps extends AllHTMLAttributes<HTMLButtonElement> {
  index: number;
  disabled?: boolean;
}

export function Tab({ index, disabled = false, className = '', children, onClick, ...props }: TabProps) {
  // A lógica de seleção é feita via contexto ou props do pai
  // Aqui assumimos que o pai Tabs passa o estado via props
  return (
    <button
      role="tab"
      type="button"
      disabled={disabled}
      className={`${styles.tab} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}

export interface TabPanelProps extends AllHTMLAttributes<HTMLDivElement> {
  isActive: boolean;
}

export function TabPanel({ isActive, className = '', children, ...props }: TabPanelProps) {
  if (!isActive) return null;

  return (
    <div role="tabpanel" className={`${styles.tabPanel} ${className}`} {...props}>
      {children}
    </div>
  );
}

// Context-based version for more complex usage
import { createContext, useContext, useMemo } from 'react';

interface TabsContextValue {
  activeIndex: number;
  onTabClick: (index: number) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export function TabsProvider({ children, defaultIndex = 0, onChange }: { children: ReactNode; defaultIndex?: number; onChange?: (index: number) => void }) {
  const [activeIndex, setActiveIndex] = useState(defaultIndex);

  const handleTabClick = (index: number) => {
    setActiveIndex(index);
    onChange?.(index);
  };

  const value = useMemo(() => ({ activeIndex, onTabClick: handleTabClick }), [activeIndex, handleTabClick]);

  return <TabsContext.Provider value={value}>{children}</TabsContext.Provider>;
}

export function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within TabsProvider');
  }
  return context;
}

export function TabListContext({ children, className = '', ...props }: TabListProps) {
  return <div role="tablist" className={`${styles.tabList} ${className}`} {...props}>{children}</div>;
}

export function TabContext({ index, disabled = false, className = '', children, ...props }: TabProps) {
  const { activeIndex, onTabClick } = useTabsContext();
  const isActive = activeIndex === index;

  return (
    <button
      role="tab"
      type="button"
      disabled={disabled}
      aria-selected={isActive}
      aria-controls={`panel-${index}`}
      id={`tab-${index}`}
      className={`${styles.tab} ${isActive ? styles.active : ''} ${disabled ? styles.disabled : ''} ${className}`}
      onClick={() => !disabled && onTabClick(index)}
      {...props}
    >
      {children}
    </button>
  );
}

export function TabPanelContext({ index, className = '', children, ...props }: { index: number } & Omit<TabPanelProps, 'isActive'>) {
  const { activeIndex } = useTabsContext();
  const isActive = activeIndex === index;

  return (
    <div
      role="tabpanel"
      id={`panel-${index}`}
      aria-labelledby={`tab-${index}`}
      hidden={!isActive}
      className={`${styles.tabPanel} ${className}`}
      {...props}
    >
      {isActive && children}
    </div>
  );
}

// Named exports for convenience
export const TabList2 = TabListContext;
export const Tab2 = TabContext;
export const TabPanel2 = TabPanelContext;