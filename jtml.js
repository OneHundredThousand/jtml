(function () {
  const XMethodMap = {
    'x-get': 'GET',
    'x-post': 'POST',
    'x-put': 'PUT',
    'x-patch': 'PATCH',
    'x-delete': 'DELETE',
  };
  const SupportedEvents = ["click", "submit", "input", "change"]; // extend as needed
  const builtInActions = {
    paginate: {
      post: builtinPaginate,
    },
  };
  const actions = {
    ...builtInActions,
  }
  const globalActions = [];

  function processJtmlElements(elem = document) {
    Object.keys(XMethodMap).forEach(attrName => {
      const targets = elem.querySelectorAll(`[${attrName}]`);
      targets.forEach(requestEl => {
        setupRequestTrigger(requestEl, attrName);
      });
    });

    hideInitialUiMarkers(elem);
  }

  function hideInitialUiMarkers(root) {
    root.querySelectorAll("[x-loading], [x-error]").forEach(el => {
      el.style.display = "none";
    });
  }

  function setupRequestTrigger(requestEl, attrName) {
    const event = resolveTrigger(requestEl);
    if (event) {
      const { name, triggerEl } = event;
      triggerEl.addEventListener(name, e => {
        e.preventDefault();
        attachRequest(requestEl, attrName);
      });
    } else {
      // No trigger declared (e.g. x-click), fetch immediately on page load
      attachRequest(requestEl, attrName);
    }
  }

  function resolveTrigger(el) {
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

  function resolveSelector(el, selector) {
    try {
      const target = el.querySelector(selector);
      if (!target) {
        return null;
      }
      return target;
    } catch (err) {
      console.warn(`[jtml] Invalid selector '${selector}':`, err);
      return null;
    }
  }

  function resolveLocalAttrElem(elem, attr) {
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

  function resolveScopedAttrElem(elem, attr) {
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
      return resolveSelector(scope, selector);
    }

    return triggerEl;
  }

  async function attachRequest(el, attrName) {
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
      applyTextBindings(el, err);
    } finally {
      hideBySelector(el, '[x-loading]');
    }
  }

  async function handleRequest(el, attrName) {
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
      renderTemplate(el, response.data, target);
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
    applyTextBindings(errorDataEl, response.data);
  }

  function getTestData(el) {
    const testData = el.getAttribute('x-test-data');
    if (!testData) {
      return;
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

  async function fetchData(el, name) {
    const url = el.getAttribute(name);
    const method = XMethodMap[name];
    const customOptions = applyActions(el, "pre");

    const options = {
      method,
      headers: customOptions.headers || {},
    };
    const isWriteMethod = ["POST", "PUT", "PATCH"].includes(method);
    if (isWriteMethod) {
      const body = extractRequestBody(el);
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
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

  function renderTemplate(container, response, target) {
    const template = container.querySelector("template");
    if (!template) {
      return;
    }

    const content = template.content.cloneNode(true);
    target.innerHTML = "";

    processForeachBlocks(content, response, target);
    applyTextBindings(content, response);
    applyAttrBindings(content, response);

    target.appendChild(content);
  }

  function processForeachBlocks(content, response) {
    const foreachBlocks = content.querySelectorAll("[x-foreach]");
    foreachBlocks.forEach(loopEl => {
      const path = loopEl.getAttribute("x-foreach");
      const loopData = path ? getNestedValue(response, path) : response;

      if (!Array.isArray(loopData)) {
        console.warn("x-foreach expected an array but got", loopData);
        return;
      }

      const cloneContainer = document.createDocumentFragment();

      loopData.forEach(item => {
        const inner = loopEl.cloneNode(true);
        applyTextBindings(inner, item);
        applyAttrBindings(inner, item);
        cloneContainer.appendChild(inner);
      });

      // Replace loopEl with its clones, not append to target directly
      loopEl.replaceWith(cloneContainer);
    });
  }

  function applyTextBindings(fragment, data) {
    if (!fragment.querySelectorAll) {
      return;
    }

    fragment.querySelectorAll("[x-text]").forEach(el => {
      const path = el.getAttribute("x-text");
      const value = getNestedValue(data, path);
      el.removeAttribute("x-text");
      el.textContent = value;
    });
  }

  function applyAttrBindings(fragment, data) {
    const elements = fragment.querySelectorAll("*");
    for (const el of elements) {
      for (const attr of el.attributes) {
        if (!attr.name.startsWith("x-attr:")) {
          continue;
        }

        const attrName = attr.name.slice(7); // remove "x-attr:"
        const dataPath = attr.value;
        const value = getNestedValue(data, dataPath);

        if (value) {
          el.setAttribute(attrName, value);
        }
        el.removeAttribute(attr.name); // remove x-attr
      }
    }
  }

  function showBySelector(el, selector) {
    try {
      const elem = el.querySelector(selector);
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

  function hideBySelector(el, selector) {
    try {
      const elem = el.querySelector(selector);
      if (!elem) {
        return;
      }

      elem.style.display = 'none';
    } catch (e) {
      console.warn(`[jtml] Invalid selector '${selector}' inside element:`, el);
    }
  }

  function extractRequestBody(el) {
    const formEl = resolveLocalAttrElem(el, 'x-submit');
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

  function getNestedValue(obj, path) {
    return path
      .split('.')
      .reduce((o, key) => {
        if (o) {
          return o[key];
        }
        return undefined;
      }, obj);
  }

  function builtinPaginate(ctx) {
    const el = ctx.el;
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

  function applyActions(el, phase, response) {
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
      if (typeof fn !== 'function') {
        console.warn(`[jtml] Registered global action is not a function:`, fn);
        return;
      }

      fn(ctx);
    });

    return ctx;
  }

  if (document.readyState !== "loading") {
    processJtmlElements(document.body);
  } else {
    document.addEventListener("DOMContentLoaded", () => processJtmlElements(document.body));
  }

  window.jtml = {
    render: processJtmlElements,
    addGlobalAction: (fn) => {
      if (typeof fn === "function") {
        globalActions.push(fn);
      }
    },
    registerAction: (name, fn) => {
      if (!name.startsWith("user:")) {
        console.warn(`[jtml] Custom actions should be prefixed with "user:". Got "${name}".`);
      }
      actions[name] = fn;
    },
  }
})();
