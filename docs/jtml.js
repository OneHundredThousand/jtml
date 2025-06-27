(function () {
  const XMethodMap = {
    'x-get': 'GET',
    'x-post': 'POST',
    'x-put': 'PUT',
  };
  const SupportedEvents = ["click", "submit", "input", "change"]; // extend as needed

  function processJtmlElements() {
    Object.keys(XMethodMap).forEach(attrName => {
      document.querySelectorAll(`[${attrName}]`).forEach(el => {
        const event = getEventTrigger(el);
        if (event) {
          el.addEventListener(event, () => attachRequest(el, attrName));
        } else {
          // No custom trigger, fire immediately
          attachRequest(el, attrName);
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
    let data = testData ? getTestData(el) : await fetchJSON(el, attrName);

    if (data) {
      renderTemplate(el, data);
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

  async function fetchJSON(el, name) {
    const url = el.getAttribute(name);
    const method = XMethodToHttpMethod[name];
    try {
      const res = await fetch(url, { method });
      return res.json();
    } catch (err) {
      console.error('[jtml] fetch failed:', url, err);
      return;
    }
  }

  function renderTemplate(container, response) {
    const template = container.querySelector("template");
    if (!template) {
      return;
    }

    // Determine the target for output
    const targetSelector = container.getAttribute("x-target");
    const target = targetSelector
      ? container.querySelector(targetSelector)
      : container;

    if (targetSelector && !target) {
      console.warn(
        "[jtml] Target not found inside scoped container:",
        targetSelector
      );
      return;
    }

    const content = template.content.cloneNode(true);
    target.innerHTML = "";

    processForeachBlocks(content, response, target);
    applyTextBindings(content, response);
  }

  function processForeachBlocks(content, response, target) {
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
        cloneContainer.appendChild(inner);
      });

      // Replace loopEl with its clones, not append to target directly
      loopEl.replaceWith(cloneContainer);
    });
    target.appendChild(content);
  }

  function applyTextBindings(fragment, data) {
    if (!fragment.querySelectorAll) {
      return;
    }

    fragment.querySelectorAll("[x-text]").forEach(el => {
      const path = el.getAttribute("x-text");
      const value = getNestedValue(data, path);
      el.removeAttribute("x-text");
      el.innerHTML = value;
    });
  }

  function getNestedValue(obj, path) {
    return path.split('.').reduce((o, key) => (o ? o[key] : undefined), obj);
  }

  if (document.readyState !== "loading") {
    processJtmlElements();
  } else {
    document.addEventListener("DOMContentLoaded", processJtmlElements);
  }
})();
