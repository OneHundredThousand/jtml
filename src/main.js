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

        const context = window[el.getAttribute("jt-scope")]?.();
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
    evt?.preventDefault?.();

    const fn = window[eventVal];

    const res = fn?.constructor?.name === "AsyncFunction" ? await fn(el, evt) : fn?.(el, evt);
    if (res === false) {
        return;
    }

    let data = context;
    if (source.tagName === 'FORM' || source.tagName === 'A') {
        const response = await jtRequester(scope, source);
        if (!response) {
            return;
        }
        if (el.hasAttribute('jt-html')) {
            data = response;
        } else {
            data = { ...data, ...response };
        }
    }

    renderer(data);
}

function getRenderer(scope, requester) {
    let compiledTemplate;

    const template = !requester.hasAttribute('jt-html') ? resolveElFromAttr(scope, requester, "jt-render") || requester : null;
    if (template) {
        if (template._renderer) {
            return template._renderer;
        }

        compiledTemplate = utils.compileTemplate(template);
    }

    const target = resolveElFromAttr(scope, requester, "jt-target") || requester;
    const swapper = getSwapper(requester);

    const renderer = (data) => {
        let dom = data;

        if (compiledTemplate) {
            dom = compiledTemplate(data);
        }

        if (!dom || !target) {
            return;
        }

        swapper(target, dom);

        JTML.bindDom(scope, target);
    }

    if (template) {
        template._renderer = renderer;
    }

    return renderer;
}

function getSwapper(el) {
    const DOMSwappers = {
        replace: (target, dom) => target.replaceChildren(dom),
        append: (target, dom) => target.appendChild(dom),
        prepend: (target, dom) => target.prepend(dom),
    };
    const StringSwappers = {
        replace: (target, domStr) => target.innerHTML = domStr,
        append: (target, domStr) => target.innerHTML += domStr,
        prepend: (target, domStr) => target.innerHTML = domStr + target.innerHTML,
    };
    const swapType = el.getAttribute('jt-swap') || 'replace';
    const swapperStrategy = el.hasAttribute('jt-html') ? StringSwappers : DOMSwappers;
    return swapperStrategy[swapType];
}

async function httpRequest(requester) {
    const { url, options } = getFetchOptions(requester);

    const preRequestHook = requester.getAttribute("jt-pre-request-fn");
    if (preRequestHook) {
        const preRequestFn = window[preRequestHook];
        preRequestFn(requester, options);
    }

    try {
        const res = await fetch(url, options);
        const body = await getResponseBody(res);

        const postRequestHook = requester.getAttribute("jt-post-request-fn");
        if (postRequestHook) {
            const postRequestHookFn = window[postRequestHook];
            postRequestHookFn(requester, res, body);
        }

        if (!res.ok) {
            throw {
                status: res.status,
                body,
            };
        }

        return body;
    } catch (error) {
        const requestErrorHook = requester.getAttribute("jt-request-error-fn");
        if (requestErrorHook) {
            const requestErrorHook = window[requestErrorHook];
            requestErrorHook(requester, error);
        }

        console.error("[jtml] fetch failed:", url, error);
        throw error;
    }
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
    const url = requester.getAttribute("action") || requester.getAttribute("href");
    const method = (requester.getAttribute("method") || "GET").toUpperCase();

    const options = {
        method,
        headers: {},
    };

    const isWriteMethod = ["post", "put", "patch"].includes(method);
    if (isWriteMethod) {
        const body = extractRequestBody(requester);
        options.body = JSON.stringify(body);

        options.headers = { "Content-Type": "application/json" };
    }

    return {
        url,
        options,
    };
};

function extractRequestBody(el) {
    if (el.tagName !== "FORM") {
        return {};
    }

    const formData = new FormData(el);
    const output = {};

    for (const [key, value] of formData.entries()) {
        output[key] = value;
    }
    return output;
};

function getResponseBody(res) {
    if (res.headers.get("Content-Type")?.includes("text/html")) {
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

window.JTML = JTML;
// 550
// 338
// 670 peak