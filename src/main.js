import * as utils from "./template-engine.js";

const SupportedEvents = ["jt-click", "jt-submit", "jt-input", "jt-change", "jt-load"];

const JTML = {
    apply: function (root = document.body) {
        const scopes = root.querySelectorAll("[jt-scope]");

        for (const scope of scopes) {
            JTML.bindDom(scope);
        }
    },
    bindDom: function (scope, el = scope) {
        console.log("Processing JTML el:", el);

        // actors
        // pipelines
        // decorator

        const scopeInit = window[el.getAttribute("jt-scope")];
        const context = scopeInit && scopeInit();

        const actors = el.querySelectorAll(`[${SupportedEvents.join("],[")}]`);

        for (const actor of actors) {
            if (actor._redered) {
                continue;
            }

            bindEvents(scope, actor, context);
            actor._redered = true;
        }
    },
};

function bindEvents(scope, el, context) {
    const source = resolveElFromAttr(scope, el, 'jt-source') || el;
    const renderer = getRenderer(scope, el);

    for (const jtEvent of SupportedEvents) {
        const eventVal = el.getAttribute(jtEvent);

        if (eventVal === null) {
            continue;
        }

        if (jtEvent === "jt-load") {
            handleEvent(scope, el, eventVal, renderer, context, source);
            continue;
        }

        el.addEventListener(jtEvent.slice(3), (evt) => handleEvent(scope, el, eventVal, renderer, context, source, evt));
    }
}

async function handleEvent(scope, el, eventVal, renderer, context, source, evt) {
    if (evt) {
        evt.preventDefault();
    }

    const res = await fnRunner(eventVal, el, evt);
    if (res === false) {
        return;
    }

    if (!renderer) {
        return;
    }

    if (["FORM", "A"].includes(source.tagName)) {
        const response = await jtRequester(scope, source);
        if (!response) {
            return;
        }
        renderer(response);
        return;
    }

    renderer(context);
}

function getRenderer(scope, requester) {
    const template = getTemplater(scope, requester);
    if (!template) {
        return;
    }

    const target = resolveElFromAttr(scope, requester, "jt-target") || requester;
    const swapper = getSwapper(requester);

    return (data) => render(scope, template, data, swapper, target);
}

function getTemplater(scope, requester) {
    if (requester.hasAttribute('jt-html')) {
        return data => data;
    }

    const template = resolveElFromAttr(scope, requester, "jt-render");
    if (!template) {
        return;
    }

    if (template._compiled) {
        return template._compiled;
    }

    const compiled = utils.compileTemplate(template);
    template._compiled = compiled;

    return compiled;
}

function render(scope, renderer, data, swapper, target) {
    const dom = renderer(data);
    if (!dom) {
        return;
    }

    swapper(target, dom);

    JTML.bindDom(scope, target);
}

function getSwapper(el) {
    const swapType = el.getAttribute('jt-swap') || 'replace';
    return {
        replace: (target, dom) => typeof dom === "string" ? target.innerHTML = dom : target.replaceChildren(dom),
        append: (target, dom) => typeof dom === "string" ? target.innerHTML += dom : target.appendChild(dom),
        prepend: (target, dom) => typeof dom === "string" ? target.innerHTML = dom + target.innerHTML : target.prepend(dom),
    }[swapType];
}

async function httpRequest(requester) {
    const { url, options } = getFetchOptions(requester);

    try {
        await fnRunner(requester.getAttribute("jt-pre-request-fn"), requester, options);

        const res = await fetch(url, options);
        const body = await getResponseBody(res);

        await fnRunner(requester.getAttribute("jt-post-request-fn"), requester, res, body);

        if (!res.ok) {
            throw {
                status: res.status,
                body,
            };
        }

        return body;
    } catch (error) {
        await fnRunner(requester.getAttribute("jt-request-error-fn"), requester, error);

        console.error("[jtml] fetch failed:", url, error);
        throw error;
    }
}

async function fnRunner(name, ...args) {
    const fn = window[name];
    return (fn && fn(...args));
}

async function jtRequester(scope, requester) {
    const loadingEl = resolveElFromAttr(scope, requester, "jt-loading");
    const errorEl = resolveElFromAttr(scope, requester, "jt-error");

    showElement(loadingEl);
    hideElement(errorEl);

    try {
        const data = await httpRequest(requester);

        hideElement(loadingEl);
        hideElement(errorEl);

        return data;

    } catch (err) {
        hideElement(loadingEl);
        showElement(errorEl);

        console.error("Form request failed:", err);
    }
}

function getFetchOptions(requester) {
    let url = requester.getAttribute("action") || requester.getAttribute("href");
    const method = (requester.getAttribute("method") || "GET").toUpperCase();

    const options = {
        method,
        headers: {},
    };

    const isWriteMethod = ["POST", "PUT", "PATCH"].includes(method);
    if (isWriteMethod) {
        const body = extractRequestBody(requester);
        options.body = JSON.stringify(body);

        options.headers = { "Content-Type": "application/json" };
    }

    if (method === "GET") {
        const data = new FormData(requester);
        const params = new URLSearchParams(data);

        url = `${url}?${params.toString()}`;
    }

    return {
        url,
        options,
    };
};

function extractRequestBody(el) {
    const formData = new FormData(el);
    const output = {};

    for (const [key, value] of formData.entries()) {
        output[key] = value;
    }
    return output;
};

function getResponseBody(res) {
    if (res.headers.get("Content-Type").includes("text/html")) {
        return res.text();
    }

    return res.json();
};

function resolveElFromAttr(scope, el, attr) {
    const selector = el.getAttribute(attr);
    if (!selector) {
        return null;
    }

    try {
        return scope.querySelector(selector);
    } catch {
        console.warn(`[jtml] Invalid ${attr} selector "${selector}"`);
        return null;
    }
};

function showElement(el) {
    if (!el) {
        return;
    }

    el.style.display = "";
};

function hideElement(el) {
    if (!el) {
        return;
    }

    el.style.display = "none";
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => JTML.apply());
} else {
    JTML.apply();
}

export default JTML;

// window.JTML = JTML;
// 550
// 338
// 670 peak