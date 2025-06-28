(function () {
  const XMethodMap = {
    'x-get': 'GET',
    'x-post': 'POST',
    'x-put': 'PUT',
  };
  const SupportedEvents = ["click", "submit", "input", "change"]; // extend as needed
  const builtinActions = {
    paginate: builtinPaginate
  };

  function processJtmlElements(elem) {
    Object.keys(XMethodMap).forEach(attrName => {
      elem.querySelectorAll(`[${attrName}]`).forEach(el => {
        const handler = () => attachRequest(el, attrName);
        const event = getEventTrigger(el);
        if (event) {
          const triggerSelector = el.getAttribute(`x-${event}`)
          const triggerEl = triggerSelector ? el.querySelector(triggerSelector) : el;

          if (!triggerEl) {
            console.warn(`[jtml] x-click selector '${triggerSelector}' not found inside element:`, el);
            return;
          }

          triggerEl.addEventListener(event, handler);
        } else {
          // No custom trigger, fire immediately
          handler();
        }
      });
    });
  }

  function getEventTrigger(el) {
    for (const attr of el.attributes) {
      if (attr.name.startsWith("x-")) {
        const event = attr.name.slice(2); // e.g. "click"
        if (SupportedEvents.includes(event)) {
          return event;
        }
      }
    }
    return null;
  }

  async function attachRequest(el, attrName) {
    const method = XMethodMap[attrName];
    if (!method) {
      return;
    }

    const testData = el.getAttribute('x-test-data');
    let data = testData ? getTestData(el) : await fetchData(el, attrName);

    // Determine the target for output
    const targetSelector = el.getAttribute("x-target");
    const target = targetSelector
      ? findScopedTarget(el, targetSelector)
      : el;

    if (targetSelector && !target) {
      console.warn(
        "[jtml] Target not found inside scoped container:",
        targetSelector
      );
      return;
    }

    if (el.hasAttribute("x-html")) {
      target.innerHTML = data;
      processJtmlElements(target);
    } else {
      renderTemplate(el, data, target);
      runBuiltinActions(el);
      runCustomActions(el);
    }
  }


  function getTestData(el) {
    const testData = el.getAttribute('x-test-data');
    if (!testData) {
      return;
    }

    try {
      const data = JSON.parse(testData);
      console.info('[jtml] Using x-test-data');
      return data;
    } catch (e) {
      console.error('[jtml] Invalid x-test-data:', e);
      return;
    }
  }

  async function fetchData(el, name) {
    const url = el.getAttribute(name);
    const method = XMethodMap[name];
    try {
      const res = await fetch(url, { method });

      if (el.hasAttribute("x-html")) {
        return res.text();  // Get raw HTML string
      }

      return res.json();
    } catch (err) {
      console.error('[jtml] fetch failed:', url, err);
      return;
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

  function findScopedTarget(container, selector) {
    // Start from the container that has x-get / x-post / etc.
    let scope = container.closest('[x-scoped]') || container;

    // Use querySelector *inside* the scope
    return scope.querySelector(selector);
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
    fragment.querySelectorAll("*").forEach(el => {
      [...el.attributes].forEach(attr => {
        if (attr.name.startsWith("x-attr:")) {
          const attrName = attr.name.slice(7); // strip "x-attr:"
          const dataPath = attr.value;
          const value = getNestedValue(data, dataPath);
          console.log(attrName, dataPath, value, data)
          el.setAttribute(attrName, value);
          el.removeAttribute(attr.name); // clean up
        }
      });
    });
  }

  function getNestedValue(obj, path) {
    return path.split('.').reduce((o, key) => (o ? o[key] : undefined), obj);
  }

  function builtinPaginate(el) {
    const rawUrl = el.getAttribute("x-get");
    if (!rawUrl) {
      return;
    }

    const url = new URL(rawUrl, window.location.href);
    const currentPage = parseInt(url.searchParams.get("page") || "1", 10);
    url.searchParams.set("page", currentPage + 1);

    // Preserve full URL (relative or absolute)
    const newUrl = url.origin === window.location.origin
      ? url.pathname + url.search
      : url.toString();
    el.setAttribute("x-get", newUrl);
  }

  function runBuiltinActions(el) {
    if (el.hasAttribute("x-paginate")) {
      builtinActions.paginate(el);
    }
  }

  function runCustomActions(el) {
    if (!window.jtml || !window.jtml.actions) return;

    for (const attr of el.attributes) {
      if (attr.name.startsWith("x-action-")) {
        const fnName = attr.name.slice("x-action-".length);
        const fn = window.jtml.actions[fnName];
        if (typeof fn === "function") {
          fn(el);
        } else {
          console.warn(`[jtml] Unknown x-action '${fnName}'`);
        }
      }
    }
  }

  if (document.readyState !== "loading") {
    processJtmlElements(document.body);
  } else {
    document.addEventListener("DOMContentLoaded", () => processJtmlElements(document.body));
  }

  window.jtml = {
    render: processJtmlElements,
  }
})();
