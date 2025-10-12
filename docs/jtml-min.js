(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
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
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
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
  function renderTemplate(el, response) {
    const content = el.cloneNode(true);
    processElements(content, response);
    return content;
  }
  function processElements(content, response) {
    const foreachBlocks = content.children;
    if (!foreachBlocks) {
      return;
    }
    for (const loopEl of foreachBlocks) {
      if (loopEl.hasAttribute("jt-foreach")) {
        processForeachBlocks(loopEl, response);
        continue;
      }
      processElements(loopEl, response);
      applyAttrBindings(loopEl, response);
    }
  }
  function processForeachBlocks(el, response) {
    const path = el.getAttribute("jt-foreach");
    const loopData = path ? getNestedValue(response, path) : response;
    if (!Array.isArray(loopData)) {
      console.warn("jt-foreach expected an array but got", loopData);
      return;
    }
    const cloneContainer = document.createDocumentFragment();
    loopData.forEach((item) => {
      const inner = el.cloneNode(true);
      inner.removeAttribute("jt-foreach");
      processElements(inner, item);
      cloneContainer.appendChild(inner);
    });
    el.replaceWith(cloneContainer);
  }
  function applyAttrBindings(el, data) {
    for (const attr of el.attributes) {
      if (!attr.name.startsWith("jt-")) {
        continue;
      }
      el.removeAttribute(attr.name);
      const [attrName, transformerName] = attr.name.slice(3).split(":");
      const attrValue = attr.value;
      const transformer = actions[transformerName];
      let value;
      if (transformer) {
        value = transformer(attrValue, data);
      } else {
        value = getNestedValue(data, attrValue);
      }
      if (attrName === "text") {
        el.textContent = value;
      } else {
        el.setAttribute(attrName, value);
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

  // src/new-main.ts
  var SupportedEvents = ["jt-click", "jt-submit", "jt-input", "jt-change", "jt-load"];
  var builtInActions = {};
  var actions2 = __spreadValues({}, builtInActions);
  var globalActions = [];
  function processJtmlElements(scope) {
    scope.querySelectorAll("[jt-scope]").forEach((jtScope) => {
      initRequesters(jtScope);
      hideInitialUiMarkers(jtScope);
    });
  }
  function initRequesters(scope) {
    scope.querySelectorAll("form, a").forEach((requester) => {
      const event = resolveEvent(requester);
      const triggerEl = resolveAttrElem(scope, requester, event);
      if (event === "jt-load") {
        queueMicrotask(() => attachRequest(scope, requester));
      } else {
        triggerEl.addEventListener(event.substring(3), (e) => {
          e.preventDefault();
          attachRequest(scope, requester);
        });
      }
    });
  }
  function hideInitialUiMarkers(scope) {
    scope.querySelectorAll("[jt-loading], [jt-error], [jt-error-data]").forEach((el) => {
      el.style.display = "none";
    });
  }
  function resolveEvent(requester) {
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
  function getTriggerDefault(el) {
    if (el.tagName === "FORM") {
      return "jt-submit";
    }
    return "jt-click";
  }
  function resolveMethod(el) {
    var _a;
    if (el.tagName === "FORM") {
      return ((_a = el.getAttribute("method")) == null ? void 0 : _a.toLowerCase()) || "get";
    }
    return "get";
  }
  function attachRequest(scope, requester) {
    return __async(this, null, function* () {
      const method = resolveMethod(requester);
      const target = resolveAttrElem(scope, requester, "jt-target");
      const loading = resolveSelector(scope, "[jt-loading]");
      const error = resolveSelector(scope, "[jt-error]");
      const errorData = resolveSelector(scope, "[jt-error-data]");
      showElement(loading);
      hideElement(error);
      try {
        const response = yield handleRequest(requester, method);
        handleResponse(requester, response, target);
      } catch (err) {
        if (errorData && (err == null ? void 0 : err.body)) {
          handleErrorData(err == null ? void 0 : err.body, errorData);
          showElement(errorData);
        } else if (error) {
          showElement(error);
        }
      } finally {
        hideElement(loading);
      }
    });
  }
  function handleRequest(requester, method) {
    return __async(this, null, function* () {
      const testData = requester.getAttribute("jt-test-data");
      if (testData) {
        return getTestData(requester);
      }
      return fetchData(requester, method);
    });
  }
  function fetchData(requester, method) {
    return __async(this, null, function* () {
      const url = requester.getAttribute("action") || requester.getAttribute("href");
      const customOptions = applyActions(requester, "pre");
      const options = {
        method,
        headers: customOptions.headers || {}
      };
      const isWriteMethod = ["post", "put", "patch"].includes(method);
      if (isWriteMethod) {
        const body = extractRequestBody(requester);
        options.headers = __spreadProps(__spreadValues({}, options.headers), { "Content-Type": "application/json" });
        options.body = JSON.stringify(body);
      }
      try {
        const res = yield fetch(url, options);
        const body = yield getResponseBody(requester, res);
        if (!res.ok) {
          throw {
            status: res.status,
            body
          };
        }
        return body;
      } catch (error) {
        console.error("[jtml] fetch failed:", url, error);
        throw error;
      }
    });
  }
  function getResponseBody(requester, res) {
    return __async(this, null, function* () {
      const contentType = res.headers.get("Content-Type");
      if (!contentType) {
        return null;
      }
      if (requester.hasAttribute("jt-html")) {
        return res.text();
      }
      return res.json();
    });
  }
  function extractRequestBody(requester) {
    if (requester.tagName !== "FORM") {
      return {};
    }
    const formData = new FormData(requester);
    const obj = {};
    for (const [key, value] of formData.entries()) {
      obj[key] = value;
    }
    return obj;
  }
  function getTestData(el) {
    const testData = el.getAttribute("x-test-data");
    if (!testData) {
      return {};
    }
    try {
      const data = JSON.parse(testData);
      console.info("[jtml] Using x-test-data");
      return data;
    } catch (error) {
      console.error("[jtml] Invalid x-test-data:", error);
      throw error;
    }
  }
  function handleResponse(requester, response, target) {
    if (requester.hasAttribute("jt-html")) {
      target.innerHTML = response;
    } else {
      const template = target.querySelector("template");
      if (!template) {
        return;
      }
      const renderedDom = renderTemplate(template.content, response);
      target.innerHTML = "";
      target.appendChild(renderedDom);
      applyActions(requester, "post", response);
    }
  }
  function handleErrorData(response, target) {
    const renderedDom = renderTemplate(target, response);
    target.innerHTML = renderedDom.innerHTML;
  }
  function resolveAttrElem(scope, elem, attr) {
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
  function showElement(el) {
    if (!el) {
      return;
    }
    if (el.style.display === "none") {
      console.log(el.style.display);
      el.style.display = "";
    }
  }
  function hideElement(el) {
    if (!el) {
      return;
    }
    el.style.display = "none";
  }
  function applyActions(el, phase, response) {
    var _a;
    const actionsNames = ((_a = el.getAttribute("jt-hook")) == null ? void 0 : _a.split(",")) || [];
    const ctx = { el, response };
    for (const name of actionsNames) {
      const action = actions2[name];
      const fn = action == null ? void 0 : action[phase];
      if (typeof fn !== "function") {
        console.warn(`[jtml] Action "${name}" does not have a valid ${phase}() function`);
        continue;
      }
      fn(ctx);
    }
    globalActions.forEach((fn) => {
      var _a2;
      if (typeof fn[phase] !== "function") {
        console.warn(`[jtml] Registered global action has an invalid ${phase} function:`, fn);
        return;
      }
      (_a2 = fn[phase]) == null ? void 0 : _a2.call(fn, ctx);
    });
    return ctx;
  }
  if (document.readyState !== "loading") {
    processJtmlElements(document.body);
  } else {
    document.addEventListener("DOMContentLoaded", () => processJtmlElements(document.body));
  }
  function addGlobalAction(fn) {
    globalActions.push(fn);
  }
  function registerAction(name, fn) {
    if (!name.startsWith("user:")) {
      console.warn(`[jtml] Custom actions should be prefixed with "user:". Got "${name}".`);
    }
    actions2[name] = fn;
  }
  window.Jtml = {
    addGlobalAction,
    registerAction
  };
})();
//# sourceMappingURL=jtml-min.js.map
