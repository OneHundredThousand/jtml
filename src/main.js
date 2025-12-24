import * as utils from "./template-engine.js";

const SupportedEvents = ["jt-click", "jt-submit", "jt-input", "jt-change", "jt-load"];

const JTML = {
    apply: function (root = document) {
        const scopes = root.querySelectorAll("[jt-scope]");

        scopes.forEach(scope => {
            console.log("Processing JTML scope:", scope);

            // actors
            // pipelines
            // decorator

            const context = window[scope.getAttribute("jt-scope")]?.();

            // can be condensed to actors

            // Find forms and anchors within this scope
            const forms = scope.querySelectorAll("form");
            const anchors = scope.querySelectorAll("a");

            // Set defaults and bind events for forms
            forms.forEach(form => setupFormRequester(scope, form));

            anchors.forEach(anchor => setupAnchorRequester(scope, anchor));

            bindEvents(scope, context);
        });
    },
};

// separate forms and anchors handlers
function setupFormRequester(scope, requester) {
    const triggers = requester.querySelectorAll("[jt-submit-form]");

    const renderer = getRenderer(scope, requester);

    const cb = evt => {
        if (evt) {
            evt.preventDefault();
        }

        jtRequester(scope, requester, renderer);
    };

    const onload = requester.hasAttribute("jt-load");
    if (onload) {
        cb();
    }

    requester.addEventListener("submit", cb);

    triggers.forEach(triggerEl => {
        const event = triggerEl.getAttribute("jt-submit-form");
        triggerEl.addEventListener(event, cb);
    });
};

function setupAnchorRequester(scope, requester) {
    const renderer = getRenderer(scope, requester);

    const cb = (evt) => {
        if (evt) {
            evt.preventDefault();
        }

        jtRequester(scope, requester, renderer);
    };

    const onload = requester.hasAttribute("jt-load");
    if (onload) {
        cb();
    }

    requester.addEventListener("click", cb);
};

function getRenderer(scope, requester) {
    const swapper = getSwapper(requester);

    let compiledTemplate;

    const target = resolveElFromAttr(scope, requester, "jt-target");

    const template = resolveElFromAttr(scope, requester, "jt-render");
    if (template) {
        compiledTemplate = utils.compileTemplate(template);
    }

    return (data) => {
        let dom = data;

        if (compiledTemplate) {
            dom = compiledTemplate(data);
        }

        if (!dom || !target) {
            return;
        }

        swapper(target, dom);
    }
}

function getSwapper(el) {
    const swapType = el.getAttribute('jt-swap') || 'replace';
    const isJtHtml = el.hasAttribute('jt-html');
    switch (swapType) {
        case "replace":
            return getReplacer(isJtHtml);
        case "append":
            return getAppender(isJtHtml);
        case "prepend":
            return getPrepender(isJtHtml);
    }
}

function getReplacer(isJtHtml) {
    if (isJtHtml) {
        return (target, domStr) => target.innerHTML = domStr;
    }

    return (target, dom) => target.replaceChildren(dom);
}

function getAppender(isJtHtml) {
    if (isJtHtml) {
        return (target, domStr) => target.innerHTML += domStr;
    }

    return (target, dom) => target.appendChild(dom);
}

function getPrepender(isJtHtml) {
    if (isJtHtml) {
        return (target, domStr) => target.innerHTML = domStr + target.innerHTML;
    }

    return (target, dom) => target.prepend(dom);
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

async function jtRequester(scope, requester, renderer) {
    const loadingEl = resolveElFromAttr(scope, requester, "jt-loading");
    const errorEl = resolveElFromAttr(scope, requester, "jt-error");

    showElement(loadingEl);
    hideElement(errorEl);

    try {
        const data = await httpRequest(requester);

        hideElement(loadingEl);
        hideElement(errorEl);

        renderer(data);

    } catch (err) {
        hideElement(loadingEl);
        showElement(errorEl);

        console.error("Form request failed:", err);
    }
};

function bindEvents(scope, context) {
    const els = scope.querySelectorAll(`[${SupportedEvents.join("],[")}]`);

    for (const el of els) {
        for (const jtEvent of SupportedEvents) {

            if (el.tagName === "FORM" || el.tagName === "A") {
                continue;
            }

            if (!el.hasAttribute(jtEvent)) {
                continue;
            }

            const attr = el.getAttribute(jtEvent);

            const renderer = getRenderer(scope, el);

            if (jtEvent === "jt-load") {
                eventCb(el, attr, renderer, context);
                continue;
            }

            el.addEventListener(getEventName(jtEvent), (e) => eventCb(el, attr, renderer, context, e));
        }
    }
};

function eventCb(el, attr, renderer, context, e) {
    const fn = window[attr];
    const res = fn?.(el, e);

    if (res instanceof Promise) {
        res.then(() => {
            renderer(context)
        });
        return;
    }

    renderer(context);
}

function getEventName(jtEvent) {
    return jtEvent.slice(3);
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
        // @TODO let content-type be customizable?
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