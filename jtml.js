(function () {
  const XMethodMap = {
    'x-get': 'GET',
    'x-post': 'POST',
    'x-put': 'PUT',
    'x-patch': 'PATCH',
    'x-delete': 'DELETE',
  };
  const SupportedEvents = ["click", "submit", "input", "change"]; // extend as needed
  const actions = {}
  const _globalActions = [];

  function processJtmlElements(elem) {
    Object.keys(XMethodMap).forEach(attrName => {
      elem.querySelectorAll(`[${attrName}]`).forEach(el => {
        const handler = (e) => {
          e?.preventDefault();
          attachRequest(el, attrName);
        };
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
    document.querySelectorAll("[x-loading], [x-error]").forEach(el => {
      el.style.display = "none";
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

    showLoading(el);
    hideError(el);
    try {
      const testData = el.getAttribute('x-test-data');
      const data = testData ? getTestData(el) : await fetchData(el, attrName);

      if (el.hasAttribute("x-html")) {
        target.innerHTML = data;
        processJtmlElements(target);
      } else {
        renderTemplate(el, data, target);
        applyActions(el, "post", data);
      }
    } catch (err) {
      console.error("[jtml] fetch failed:", err);
      showError(el, err);
    } finally {
      hideLoading(el);
    }
  }
  var e = 0;

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
          el.setAttribute(attrName, value);
          el.removeAttribute(attr.name); // clean up
        }
      });
    });
  }

  function showLoading(el) {
    const loadingEl = el.querySelector("[x-loading]");
    if (loadingEl) {
      loadingEl.style.display = "";
    }
  }

  function hideLoading(el) {
    const loadingEl = el.querySelector("[x-loading]");
    if (loadingEl) {
      loadingEl.style.display = "none";
    }
  }

  function showError(el, errorData) {
    const errorEl = el.querySelector("[x-error]");
    if (!errorEl) {
      return;
    }

    applyTextBindings(el, errorData || {});
    errorEl.style.display = "";
  }

  function hideError(el) {
    const errorEl = el.querySelector("[x-error]");
    if (errorEl) {
      errorEl.style.display = "none";
    }
  }

  function extractRequestBody(el) {
    // 1. Check for explicit x-submit target
    const submitTarget = el.getAttribute("x-submit");
    let formEl = null;

    if (submitTarget) {
      // Search for the form inside the element
      formEl = el.querySelector(submitTarget);
      if (!formEl) {
        console.warn("[jtml] x-submit target not found:", submitTarget);
      }
    }

    // 2. If no x-submit, fallback: check if this is a form
    if (!formEl && el.tagName === "FORM") {
      formEl = el;
    }

    // 3. Extract form data if form is found
    if (formEl && formEl.tagName === "FORM") {
      const formData = new FormData(formEl);
      const obj = {};
      for (const [key, value] of formData.entries()) {
        obj[key] = value;
      }
      return obj;
    }

    // 4. Default: no form, no data
    return {};
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

  function applyActions(el, phase, response = null) {
    const actionAttrs = Array.from(el.attributes).filter(attr =>
      attr.name.startsWith("x-action-")
    );

    const options = {}

    for (const attr of actionAttrs) {
      const name = attr.name.replace("x-action-", "");
      const action = actions[name];

      if (typeof action !== "object") continue;

      if (phase === "pre" && typeof action.pre === "function") {
        action.pre(el, options);
      } else if (phase === "post" && typeof action.post === "function") {
        action.post(el, response, options);
      }
    }

    if (phase === "pre") {
      _globalActions.forEach(fn => {
        if (typeof fn.pre === "function") fn.pre(el, options);
      });
    } else if (phase === "post") {
      _globalActions.forEach(fn => {
        if (typeof fn.post === "function") fn.post(el, response, options);
      });
    }

    return options;
  }

  if (document.readyState !== "loading") {
    processJtmlElements(document.body);
  } else {
    document.addEventListener("DOMContentLoaded", () => processJtmlElements(document.body));
  }

  function registerAction(name, fn) {
    actions[name] = fn;
  }

  registerAction("paginate", {
    post: builtinPaginate,
  });

  window.jtml = {
    render: processJtmlElements,
    addGlobalAction: (fn) => {
      if (typeof fn === "function") {
        _globalActions.push(fn);
      }
    },
    registerAction,
  }
})();
