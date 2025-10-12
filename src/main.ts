import { renderTemplate } from './template-engine';

// @TODO declare constants
// @TODO move other functions to different files
// @TODO refactor

const SupportedEvents = ["jt-click", "jt-submit", "jt-input", "jt-change", "jt-load"]; // extend as needed

type HookFunction = { pre?: Function, post?: Function };

const builtInActions: { [name: string]: HookFunction } = {
};
const actions = {
  ...builtInActions,
}
const globalActions: HookFunction[] = [];

function processJtmlElements(scope: Element): void {
  scope.querySelectorAll('[jt-scope]')
    .forEach(jtScope => {
      initRequesters(jtScope);
      hideInitialUiMarkers(jtScope);
    });
}

function initRequesters(scope: Element): void {

  scope.querySelectorAll('form, a').forEach(requester => {
    const event = resolveEvent(requester);
    const triggerEl = resolveAttrElem(scope, requester, event);

    if (event === 'jt-load') {
      queueMicrotask(() => attachRequest(scope, requester));
    } else {
      triggerEl.addEventListener(event.substring(3), (e: Event) => {
        e.preventDefault();
        attachRequest(scope, requester);
      });
    }
  });
}

function hideInitialUiMarkers(scope: Element): void {
  scope.querySelectorAll("[jt-loading], [jt-error], [jt-error-data]").forEach(el => {
    (el as HTMLElement).style.display = "none";
  });
}

function resolveEvent(requester: Element): string {
  for (const attr of requester.attributes) {
    if (!attr.name.startsWith("jt-")) {
      continue;
    }

    if (!SupportedEvents.includes(attr.name)) {
      continue;
    }

    return attr.name;
  }

  return getTriggerDefault(requester);
}

function getTriggerDefault(el: Element): string {
  if (el.tagName === 'FORM') {
    return 'jt-submit';
  }
  return 'jt-click';
}

function resolveMethod(el: Element): string {
  if (el.tagName === 'FORM') {
    return el.getAttribute('method')?.toLowerCase() || 'get';
  }
  return 'get';
}

async function attachRequest(scope: Element, requester: Element): Promise<void> {
  const method = resolveMethod(requester); // 🔧
  const target = resolveAttrElem(scope, requester, 'jt-target');

  const loading = resolveSelector(scope, '[jt-loading]');
  const error = resolveSelector(scope, '[jt-error]');
  const errorData = resolveSelector(scope, '[jt-error-data]');

  showElement(loading);
  hideElement(error);

  try {
    const response = await handleRequest(requester, method);
    handleResponse(requester, response, target);
  } catch (err) {
    // @TODO refactor to new method
    if (errorData && (err as { body: object })?.body) {
      handleErrorData((err as { body: object })?.body, errorData);
      showElement(errorData);
    } else if (error) {
      showElement(error);
    }
  } finally {
    hideElement(loading);
  }
}

async function handleRequest(requester: Element, method: string): Promise<object | string | null> {
  const testData = requester.getAttribute('jt-test-data');
  if (testData) {
    return getTestData(requester);
  }
  return fetchData(requester, method);
}

async function fetchData(requester: Element, method: string): Promise<object | string | null> {
  const url = requester.getAttribute('action') || requester.getAttribute('href') as string;
  const customOptions = applyActions(requester, "pre");

  const options = {
    method,
    headers: customOptions.headers || {},
  } as RequestInit;
  const isWriteMethod = ["post", "put", "patch"].includes(method);
  if (isWriteMethod) {
    const body = extractRequestBody(requester);
    // @TODO let content-type be customizable?
    options.headers = { ...options.headers, "Content-Type": "application/json" };
    options.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(url, options);
    const body = await getResponseBody(requester, res);
    if (!res.ok) {
      throw {
        status: res.status,
        body,
      };
    }

    return body;
  } catch (error) {
    console.error('[jtml] fetch failed:', url, error);
    throw error;
  }
}

async function getResponseBody(requester: Element, res: Response): Promise<object | string | null> {
  const contentType = res.headers.get('Content-Type');
  if (!contentType) {
    return null;
  }

  if (requester.hasAttribute('jt-html')) {
    return res.text();
  }

  return res.json();
}

function extractRequestBody(requester: Element): object {
  if (requester.tagName !== 'FORM') {
    return {};
  }

  const formData = new FormData(requester as HTMLFormElement);
  const obj: Record<string, object | string> = {};
  for (const [key, value] of formData.entries()) {
    obj[key] = value;
  }
  return obj;
}

function getTestData(el: Element): object {
  const testData = el.getAttribute('x-test-data');
  if (!testData) {
    return {};
  }

  try {
    const data = JSON.parse(testData);
    console.info('[jtml] Using x-test-data');
    return data;
  } catch (error) {
    console.error('[jtml] Invalid x-test-data:', error);
    throw error;
  }
}

function handleResponse(requester: Element, response: object | string | undefined | null, target: Element) {
  if (requester.hasAttribute("jt-html")) {
    target.innerHTML = response as string;
  } else {
    const template = target.querySelector("template");
    if (!template) {
      return;
    }

    const renderedDom = renderTemplate(template.content as unknown as HTMLElement, response as object);
    target.innerHTML = "";
    target.appendChild(renderedDom);

    applyActions(requester, "post", response as object);
  }
}

function handleErrorData(response: object | string, target: Element) {
  const renderedDom = renderTemplate(target, response as object);
  target.innerHTML = renderedDom.innerHTML;
}

function resolveAttrElem(scope: Element, elem: Element, attr: string): Element {
  const selector = elem.getAttribute(attr);
  if (!selector) {
    return elem;
  }

  const triggerEl = resolveSelector(scope, selector);
  if (!triggerEl) {
    console.warn(`[jtml] Selector '${selector}' from ${attr} not found in:`, scope);
    return elem;
  }

  return triggerEl;
}

function resolveSelector(el: Element, selector: string): Element | null {
  try {
    const target = el.querySelector(selector);
    if (!target) {
      return null;
    }
    return target as HTMLElement;
  } catch (err) {
    console.warn(`[jtml] Invalid selector '${selector}':`, err);
    return null;
  }
}

function showElement(el: Element | null): void {
  if (!el) {
    return;
  }

  if ((el as HTMLElement).style.display === 'none') {
    console.log((el as HTMLElement).style.display);
    (el as HTMLElement).style.display = '';
  }
}
function hideElement(el: Element | null): void {
  if (!el) {
    return;
  }
  (el as HTMLElement).style.display = 'none';
}

function applyActions(el: Element, phase: 'pre' | 'post', response?: object): { el: Element, response: object | undefined, headers?: object } {
  const actionsNames = el.getAttribute('jt-hook')?.split(',') || [];

  const ctx = { el, response };

  for (const name of actionsNames) {
    const action = actions[name];
    const fn = action?.[phase];

    if (typeof fn !== 'function') {
      console.warn(`[jtml] Action "${name}" does not have a valid ${phase}() function`);
      continue;
    }

    fn(ctx);
  }

  globalActions.forEach(fn => {
    if (typeof fn[phase] !== 'function') {
      console.warn(`[jtml] Registered global action has an invalid ${phase} function:`, fn);
      return;
    }

    fn[phase]?.(ctx);
  });

  return ctx;
}

if (document.readyState !== "loading") {
  processJtmlElements(document.body);
} else {
  document.addEventListener("DOMContentLoaded", () => processJtmlElements(document.body));
}

function addGlobalAction(fn: HookFunction) {
  globalActions.push(fn);
}

function registerAction(name: string, fn: HookFunction) {
  if (!name.startsWith("user:")) {
    console.warn(`[jtml] Custom actions should be prefixed with "user:". Got "${name}".`);
  }
  actions[name] = fn;
}

(window as any).Jtml = {
  addGlobalAction,
  registerAction
}
