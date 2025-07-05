(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __async = (__this, __arguments, generator) => {
    return new Promise((resolve, reject) => {
      var fulfilled = (value) => {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      };
      var rejected = (value) => {
        try {
          step(generator.throw(value));
        } catch (e) {
          reject(e);
        }
      };
      var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
      step((generator = generator.apply(__this, __arguments)).next());
    });
  };

  // src/template-engine.ts
  var actions = {
    "var": (param, data) => {
      return interpolate(param, data);
    }
  };
  function renderTemplate(template, response) {
    const content = template.content.cloneNode(true);
    processElements(content, response);
    return content;
  }
  function processElements(content, response) {
    const foreachBlocks = content.children;
    if (!foreachBlocks) {
      return;
    }
    for (const loopEl of foreachBlocks) {
      if (loopEl.hasAttribute("x-foreach")) {
        processForeachBlocks(loopEl, response);
        continue;
      }
      processElements(loopEl, response);
      applyAttrBindings(loopEl, response);
    }
  }
  function processForeachBlocks(el, response) {
    const path = el.getAttribute("x-foreach");
    const loopData = path ? getNestedValue(response, path) : response;
    if (!Array.isArray(loopData)) {
      console.warn("x-foreach expected an array but got", loopData);
      return;
    }
    const cloneContainer = document.createDocumentFragment();
    loopData.forEach((item) => {
      const inner = el.cloneNode(true);
      inner.removeAttribute("x-foreach");
      processElements(inner, item);
      cloneContainer.appendChild(inner);
    });
    el.replaceWith(cloneContainer);
  }
  function applyAttrBindings(fragment, data) {
    var _a;
    const elements = (_a = fragment.parentNode) == null ? void 0 : _a.querySelectorAll("*");
    if (!elements) {
      return;
    }
    for (const el of elements) {
      for (const attr of el.attributes) {
        console.log(attr);
        if (!attr.name.startsWith("x-")) {
          continue;
        }
        el.removeAttribute(attr.name);
        const [attrName, transformerName] = attr.name.slice(2).split(":");
        const attrValue = attr.value;
        const transformer = actions[transformerName];
        let value;
        if (transformer) {
          value = transformer(attrValue, data);
        } else {
          value = getNestedValue(data, attrValue);
        }
        console.log(attrName, value);
        if (attrName === "text") {
          el.textContent = value;
        } else {
          el.setAttribute(attrName, value);
        }
      }
    }
  }
  function getNestedValue(obj, path) {
    return path.split(".").reduce((o, key) => {
      if (o) {
        return o[key];
      }
      return void 0;
    }, obj);
  }
  function interpolate(template, data) {
    let result = "";
    let i = 0;
    while (i < template.length) {
      const start = template.indexOf("{{", i);
      if (start === -1) {
        result += template.slice(i);
        break;
      }
      result += template.slice(i, start);
      const end = template.indexOf("}}", start);
      if (end === -1) {
        result += template.slice(start);
        break;
      }
      const key = template.slice(start + 2, end).trim();
      result += getNestedValue(data, key);
      i = end + 2;
    }
    return result;
  }

  // src/main.ts
  var XMethodMap = {
    "x-get": "GET",
    "x-post": "POST",
    "x-put": "PUT",
    "x-patch": "PATCH",
    "x-delete": "DELETE"
  };
  var SupportedEvents = ["click", "submit", "input", "change"];
  var builtInActions = {
    paginate: {
      post: builtinPaginate
    }
  };
  var actions2 = __spreadValues({}, builtInActions);
  var globalActions = [];
  function processJtmlElements(elem = document.body) {
    Object.keys(XMethodMap).forEach((attrName) => {
      const targets = elem.querySelectorAll(`[${attrName}]`);
      targets.forEach((requestEl) => {
        setupRequestTrigger(requestEl, attrName);
      });
    });
    hideInitialUiMarkers(elem);
  }
  function hideInitialUiMarkers(root) {
    root.querySelectorAll("[x-loading], [x-error]").forEach((el) => {
      el.style.display = "none";
    });
  }
  function setupRequestTrigger(requestEl, attrName) {
    const event = resolveTrigger(requestEl);
    if (event) {
      const { name, triggerEl } = event;
      triggerEl.addEventListener(name, (e) => {
        e.preventDefault();
        attachRequest(requestEl, attrName);
      });
    } else {
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
        triggerEl: resolveLocalAttrElem(el, attr.name)
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
      const scope = elem.closest("[x-scoped]");
      if (!scope) {
        console.warn(`[jtml] Selector '${selector}' from ${attr} not found in:`, elem);
        return elem;
      }
      return resolveSelector(scope, selector);
    }
    return triggerEl;
  }
  function attachRequest(el, attrName) {
    return __async(this, null, function* () {
      const method = XMethodMap[attrName];
      if (!method) {
        return;
      }
      const target = resolveScopedAttrElem(el, "x-target");
      showBySelector(el, "[x-loading]");
      hideBySelector(el, "[x-error]");
      hideBySelector(el, "[x-error-data]");
      try {
        const response = yield handleRequest(el, attrName);
        handleResponse(el, response, target);
      } catch (err) {
        console.error("[jtml] fetch failed:", err);
        showBySelector(el, "[x-error]");
      } finally {
        hideBySelector(el, "[x-loading]");
      }
    });
  }
  function handleRequest(el, attrName) {
    return __async(this, null, function* () {
      const testData = el.getAttribute("x-test-data");
      if (testData) {
        return getTestData(el);
      }
      return fetchData(el, attrName);
    });
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
    const errorDataEl = el.querySelector("[x-error-data]");
    if (!errorDataEl || !response.data) {
      showBySelector(el, "[x-error]");
      return;
    }
    showBySelector(el, "[x-error-data]");
  }
  function getTestData(el) {
    const testData = el.getAttribute("x-test-data");
    if (!testData) {
      return null;
    }
    try {
      const data = JSON.parse(testData);
      console.info("[jtml] Using x-test-data");
      return { data };
    } catch (error) {
      console.error("[jtml] Invalid x-test-data:", error);
      return { error };
    }
  }
  function fetchData(el, name) {
    return __async(this, null, function* () {
      const url = el.getAttribute(name);
      const method = XMethodMap[name];
      const customOptions = applyActions(el, "pre");
      const options = {
        method,
        headers: customOptions["headers"] || {}
      };
      const isWriteMethod = ["POST", "PUT", "PATCH"].includes(method);
      if (isWriteMethod) {
        const body = extractRequestBody(el);
        options.headers["Content-Type"] = "application/json";
        options["body"] = JSON.stringify(body);
      }
      try {
        const res = yield fetch(url, options);
        const error = res.status >= 400;
        if (el.hasAttribute("x-html")) {
          const textData = yield res.text();
          return { error, data: textData };
        }
        const jsonData = yield res.json();
        return { error, data: jsonData };
      } catch (error) {
        console.error("[jtml] fetch failed:", url, error);
        throw { error };
      }
    });
  }
  function showBySelector(el, selector) {
    try {
      const elem = el.querySelector(selector);
      if (!elem) {
        return;
      }
      if (elem.style.display === "none") {
        elem.style.display = "";
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
      elem.style.display = "none";
    } catch (e) {
      console.warn(`[jtml] Invalid selector '${selector}' inside element:`, el);
    }
  }
  function extractRequestBody(el) {
    const formEl = resolveLocalAttrElem(el, "x-submit");
    if (formEl.tagName !== "FORM") {
      return {};
    }
    const formData = new FormData(formEl);
    const obj = {};
    for (const [key, value] of formData.entries()) {
      obj[key] = value;
    }
    return obj;
  }
  function builtinPaginate(ctx) {
    const el = ctx["el"];
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
    const newUrl = url.origin === window.location.origin ? url.pathname + url.search : url.toString();
    el.setAttribute("x-get", newUrl);
  }
  function applyActions(el, phase, response) {
    const actionAttrs = Array.from(el.attributes).filter((attr) => attr.name.startsWith("x-action-"));
    const ctx = { el, response };
    for (const attr of actionAttrs) {
      const name = attr.name.slice(9);
      const action = actions2[name];
      const fn = action == null ? void 0 : action[phase];
      if (typeof fn !== "function") {
        console.warn(`[jtml] Action "${name}" does not have a valid ${phase}() function`);
        continue;
      }
      fn(ctx);
    }
    globalActions.forEach((fn) => {
      var _a;
      if (typeof fn[phase] !== "function") {
        console.warn(`[jtml] Registered global action has an invalid ${phase} function:`, fn);
        return;
      }
      (_a = fn[phase]) == null ? void 0 : _a.call(fn, ctx);
    });
    return ctx;
  }
  if (document.readyState !== "loading") {
    processJtmlElements(document.body);
  } else {
    document.addEventListener("DOMContentLoaded", () => processJtmlElements(document.body));
  }
  window["jtml"] = {
    render: processJtmlElements,
    addGlobalAction: (fn) => {
      globalActions.push(fn);
    },
    registerAction: (name, fn) => {
      if (!name.startsWith("user:")) {
        console.warn(`[jtml] Custom actions should be prefixed with "user:". Got "${name}".`);
      }
      actions2[name] = fn;
    }
  };
})();
//# sourceMappingURL=jtml-min.js.map
