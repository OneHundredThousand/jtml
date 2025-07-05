import { renderTemplate } from './template-engine';

type HookFunction = { pre?: Function, post?: Function }

const XMethodMap = {
  'x-get': 'GET',
  'x-post': 'POST',
  'x-put': 'PUT',
  'x-patch': 'PATCH',
  'x-delete': 'DELETE',
};
const SupportedEvents = ["click", "submit", "input", "change"]; // extend as needed
const builtInActions: { [name: string]: HookFunction } = {
  paginate: {
    post: builtinPaginate,
  },
};
const actions = {
  ...builtInActions,
}
const globalActions: HookFunction[] = [];

function processJtmlElements(elem: HTMLElement = document.body): void {
  Object.keys(XMethodMap).forEach(attrName => {
    const targets = elem.querySelectorAll(`[${attrName}]`);
    targets.forEach(requestEl => {
      setupRequestTrigger(requestEl as HTMLElement, attrName);
    });
  });

  hideInitialUiMarkers(elem);
}

function hideInitialUiMarkers(root: HTMLElement): void {
  root.querySelectorAll("[x-loading], [x-error]").forEach(el => {
    (el as HTMLElement).style.display = "none";
  });
}

function setupRequestTrigger(requestEl: HTMLElement, attrName: string): void {
  const event = resolveTrigger(requestEl);
  if (event) {
    const { name, triggerEl } = event;
    triggerEl.addEventListener(name, (e: Event) => {
      e.preventDefault();
      attachRequest(requestEl, attrName);
    });
  } else {
    // No trigger declared (e.g. x-click), fetch immediately on page load
    attachRequest(requestEl, attrName);
  }
}

function resolveTrigger(el: HTMLElement): { name: string, triggerEl: HTMLElement } | null {
  for (const attr of el.attributes) {
    if (!attr.name.startsWith("x-")) {
      continue;
    }

    const event = attr.name.slice(2);
    if (!SupportedEvents.includes(event)) {
      continue;
    }

    return {
      name: event,
      triggerEl: resolveLocalAttrElem(el, attr.name),
    };
  }
  return null;
}

function resolveSelector(el: HTMLElement, selector: string): HTMLElement | null {
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

function resolveLocalAttrElem(elem: HTMLElement, attr: string): HTMLElement {
  const selector = elem.getAttribute(attr);
  if (!selector) {
    return elem;
  }

  const triggerEl = resolveSelector(elem, selector);
  if (!triggerEl) {
    console.warn(`[jtml] Selector '${selector}' from ${attr} not found in:`, elem);
    return elem;
  }

  return triggerEl;
}

function resolveScopedAttrElem(elem: HTMLElement, attr: string): HTMLElement | null {
  const selector = elem.getAttribute(attr);
  if (!selector) {
    return elem;
  }

  const triggerEl = resolveSelector(elem, selector);
  if (!triggerEl) {
    const scope = elem.closest('[x-scoped]');
    if (!scope) {
      console.warn(`[jtml] Selector '${selector}' from ${attr} not found in:`, elem);
      return elem;
    }
    return resolveSelector(scope as HTMLElement, selector);
  }

  return triggerEl;
}

async function attachRequest(el: HTMLElement, attrName: string): Promise<void> {
  const method = XMethodMap[attrName];
  if (!method) {
    return;
  }

  const target = resolveScopedAttrElem(el, 'x-target');

  showBySelector(el, '[x-loading]');
  hideBySelector(el, '[x-error]');
  hideBySelector(el, '[x-error-data]');
  try {
    const response = await handleRequest(el, attrName);
    handleResponse(el, response, target);
  } catch (err) {
    console.error("[jtml] fetch failed:", err);
    showBySelector(el, '[x-error]');
  } finally {
    hideBySelector(el, '[x-loading]');
  }
}

async function handleRequest(el: HTMLElement, attrName: string): Promise<{ data?: object | string, error?: object | boolean } | null> {
  const testData = el.getAttribute('x-test-data');
  if (testData) {
    return getTestData(el);
  }
  return fetchData(el, attrName);
}

function handleResponse(el, response, target) {
  if (response.error) {
    handleErrors(el, response);
    return;
  }
  if (el.hasAttribute("x-html")) {
    target.innerHTML = response.data;
    processJtmlElements(target);
  } else {
    const template = el.querySelector("template");
    if (!template) {
      return;
    }

    const renderedDom = renderTemplate(template, response.data);
    target.innerHTML = "";
    target.appendChild(renderedDom);

    applyActions(el, "post", response.data);
  }
}

function handleErrors(el, response) {
  const errorDataEl = el.querySelector('[x-error-data]');
  if (!errorDataEl || !response.data) {
    showBySelector(el, '[x-error]');
    return;
  }

  showBySelector(el, '[x-error-data]');
  // applyTextBindings(errorDataEl, response.data);
}

function getTestData(el: HTMLElement): { data?: object, error?: object } | null {
  const testData = el.getAttribute('x-test-data');
  if (!testData) {
    return null;
  }

  try {
    const data = JSON.parse(testData);
    console.info('[jtml] Using x-test-data');
    return { data };
  } catch (error) {
    console.error('[jtml] Invalid x-test-data:', error);
    return { error };
  }
}

async function fetchData(el: HTMLElement, name: string): Promise<{ data?: object | string, error?: object | boolean }> {
  const url = el.getAttribute(name) as string;
  const method = XMethodMap[name];
  const customOptions = applyActions(el, "pre");

  const options = {
    method,
    headers: customOptions['headers'] || {},
  };
  const isWriteMethod = ["POST", "PUT", "PATCH"].includes(method);
  if (isWriteMethod) {
    const body = extractRequestBody(el);
    options.headers["Content-Type"] = "application/json";
    options['body'] = JSON.stringify(body);
  }

  try {
    const res = await fetch(url, options);
    const error = res.status >= 400;

    if (el.hasAttribute("x-html")) {
      const textData = await res.text();
      return { error, data: textData };  // Get raw HTML string
    }

    const jsonData = await res.json();
    return { error, data: jsonData };
  } catch (error) {
    console.error('[jtml] fetch failed:', url, error);
    throw { error };
  }
}

function showBySelector(el: HTMLElement, selector: string): void {
  try {
    const elem = el.querySelector(selector) as HTMLElement | null;
    if (!elem) {
      return;
    }

    if (elem.style.display === 'none') {
      elem.style.display = '';
    }
  } catch (e) {
    console.warn(`[jtml] Invalid selector '${selector}' inside element:`, el);
  }
}

function hideBySelector(el: HTMLElement, selector: string): void {
  try {
    const elem = el.querySelector(selector) as HTMLElement | null;
    if (!elem) {
      return;
    }

    elem.style.display = 'none';
  } catch (e) {
    console.warn(`[jtml] Invalid selector '${selector}' inside element:`, el);
  }
}

function extractRequestBody(el: HTMLElement): object {
  const formEl = resolveLocalAttrElem(el, 'x-submit') as HTMLFormElement;
  if (formEl.tagName !== 'FORM') {
    return {};
  }

  const formData = new FormData(formEl);
  const obj = {};
  for (const [key, value] of formData.entries()) {
    obj[key] = value;
  }
  return obj;
}

function builtinPaginate(ctx: object): void {
  const el = ctx['el'];
  const rawUrl = el.getAttribute("x-get");
  if (!rawUrl) {
    return;
  }

  let url;
  try {
    url = new URL(rawUrl, window.location.href);
  } catch (err) {
    console.warn("[jtml] Invalid x-get URL for pagination:", rawUrl);
    return;
  }

  const currentPage = parseInt(url.searchParams.get("page") || "1", 10);
  url.searchParams.set("page", currentPage + 1);

  const newUrl = url.origin === window.location.origin
    ? url.pathname + url.search
    : url.toString();

  el.setAttribute("x-get", newUrl);
}

function applyActions(el: HTMLElement, phase: 'pre' | 'post', response?: object): object {
  const actionAttrs = Array
    .from(el.attributes)
    .filter(attr => attr.name.startsWith("x-action-"));

  const ctx = { el, response };

  for (const attr of actionAttrs) {
    const name = attr.name.slice(9);
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

window['jtml'] = {
  render: processJtmlElements,
  addGlobalAction: (fn: HookFunction) => {
    globalActions.push(fn);
  },
  registerAction: (name: string, fn: HookFunction) => {
    if (!name.startsWith("user:")) {
      console.warn(`[jtml] Custom actions should be prefixed with "user:". Got "${name}".`);
    }
    actions[name] = fn;
  },
}
