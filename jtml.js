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
        const response = await fetch(url);
        data = await response.json();
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
          const expr = textEl.getAttribute("x-text"); // e.g. "res.name"
          const value = resolveExpression(expr, item);
          textEl.textContent = value;
        });

        target.appendChild(clone);
      });
    });
  }

  function resolveExpression(expr, context) {
    try {
      // Very basic and slightly dangerous eval (can be improved)
      return Function("res", `return ${expr}`)(context);
    } catch (e) {
      console.warn("Failed to evaluate expression:", expr, e);
      return "";
    }
  }

  if (document.readyState !== "loading") {
    processJtmlElements();
  } else {
    document.addEventListener("DOMContentLoaded", processJtmlElements);
  }
})();
