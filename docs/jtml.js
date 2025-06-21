(function () {
  
  function processJtmlElements() {
    const getElements = document.querySelectorAll("[x-get]");

    getElements.forEach(async el => {
      const url = el.getAttribute("x-get");
      const targetSelector = el.getAttribute("x-target");
      const template = el.querySelector("template");

      if (!template) {
        console.warn("No <template> found inside:", el);
        return;
      }

      let data;
      try {
        const testDataAttr = el.getAttribute('x-test-data');
        if (testDataAttr) {
          try {
            data = JSON.parse(testDataAttr);
            console.info('[jtml] Using x-test-data instead of x-get:', data);
          } catch (err) {
            console.error('[jtml] Failed to parse x-test-data JSON:', err);
            return;
          }
        } else {
          // Fallback: fetch from x-get URL
          const url = el.getAttribute('x-get');
          if (!url) return;
          try {
            const res = await fetch(url);
            data = await res.json();
          } catch (err) {
            console.error('[jtml] Failed to fetch x-get URL:', url, err);
            return;
          }
        }
      } catch (e) {
        console.error("Failed to fetch:", url, e);
        return;
      }

      const target = targetSelector
        ? document.querySelector(targetSelector)
        : el;

      // Clear previous content if not appending
      if (!targetSelector) {
        target.innerHTML = "";
      }

      data.forEach(item => {
        const clone = template.content.cloneNode(true);

        clone.querySelectorAll("[x-foreach]").forEach(loopEl => {
          loopEl.removeAttribute("x-foreach");
        });

        // Replace x-text bindings
        clone.querySelectorAll("[x-text]").forEach(textEl => {
          const path = textEl.getAttribute("x-text"); // e.g. "res.name"
          const value = getNestedValue(item, path);
          textEl.textContent = value;
        });

        target.appendChild(clone);
      });
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
