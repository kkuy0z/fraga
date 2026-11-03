/**
 * Utilitários de DOM compartilhados
 */

/**
 * Cria elemento com atributos e filhos
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Partial<HTMLElementTagNameMap[K]> & { class?: string; dataset?: Record<string, string> } = {},
  children: (Node | string)[] = []
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);

  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'class') {
      element.className = value as string;
    } else if (key === 'dataset' && typeof value === 'object') {
      Object.entries(value).forEach(([dataKey, dataValue]) => {
        element.dataset[dataKey] = dataValue;
      });
    } else if (key.startsWith('on') && typeof value === 'function') {
      element.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else {
      element.setAttribute(key, String(value));
    }
  });

  children.forEach((child) => {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else {
      element.appendChild(child);
    }
  });

  return element;
}

/**
 * Remove todos os filhos de um elemento
 */
export function clearElement(element: HTMLElement): void {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

/**
 * Adiciona classe(s) a um elemento
 */
export function addClass(element: HTMLElement, ...classes: string[]): void {
  element.classList.add(...classes);
}

/**
 * Remove classe(s) de um elemento
 */
export function removeClass(element: HTMLElement, ...classes: string[]): void {
  element.classList.remove(...classes);
}

/**
 * Alterna classe(s) em um elemento
 */
export function toggleClass(element: HTMLElement, className: string, force?: boolean): boolean {
  return element.classList.toggle(className, force);
}

/**
 * Verifica se elemento tem classe
 */
export function hasClass(element: HTMLElement, className: string): boolean {
  return element.classList.contains(className);
}

/**
 * Define atributos em lote
 */
export function setAttributes(element: HTMLElement, attributes: Record<string, string>): void {
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
}

/**
 * Obtém elemento por ID com tipagem
 */
export function $(selector: string): Element | null {
  return document.querySelector(selector);
}

/**
 * Obtém elementos por seletor com tipagem
 */
export function $$(selector: string): NodeListOf<Element> {
  return document.querySelectorAll(selector);
}

/**
 * Obtém elemento por ID
 */
export function getById<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

/**
 * Delega evento para elementos filhos
 */
export function delegateEvent<K extends keyof HTMLElementEventMap>(
  parent: HTMLElement,
  selector: string,
  eventType: K,
  handler: (event: HTMLElementEventMap[K], target: HTMLElement) => void
): () => void {
  const listener = (event: Event) => {
    const target = event.target as HTMLElement;
    const matched = target.closest(selector);
    if (matched && parent.contains(matched)) {
      handler(event as HTMLElementEventMap[K], matched);
    }
  };

  parent.addEventListener(eventType, listener);
  return () => parent.removeEventListener(eventType, listener);
}

/**
 * Aguarda elemento aparecer no DOM
 */
export function waitForElement(selector: string, timeout = 5000): Promise<Element> {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) return resolve(element);

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

/**
 * Trap focus dentro de um elemento (para modais)
 */
export function trapFocus(element: HTMLElement): () => void {
  const focusableElements = element.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  function handleTab(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }

  element.addEventListener('keydown', handleTab);
  firstElement?.focus();

  return () => {
    element.removeEventListener('keydown', handleTab);
  };
}

/**
 * Scroll suave para elemento
 */
export function scrollToElement(element: HTMLElement, offset = 0): void {
  const elementPosition = element.getBoundingClientRect().top + window.scrollY;
  window.scrollTo({
    top: elementPosition - offset,
    behavior: 'smooth',
  });
}

/**
 * Verifica se elemento está visível no viewport
 */
export function isInViewport(element: HTMLElement, threshold = 0): boolean {
  const rect = element.getBoundingClientRect();
  const windowHeight = window.innerHeight || document.documentElement.clientHeight;
  const windowWidth = window.innerWidth || document.documentElement.clientWidth;

  return (
    rect.bottom >= threshold &&
    rect.right >= threshold &&
    rect.top <= windowHeight - threshold &&
    rect.left <= windowWidth - threshold
  );
}