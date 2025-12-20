import * as utils from "./template-engine.js";

const SupportedEvents = ["jt-click", "jt-submit", "jt-input", "jt-change", "jt-load"]; // extend as needed

const JTML = {
    apply: function (root = document) {
        const scopes = root.querySelectorAll('[jt-scope]');

        scopes.forEach(scope => {
            console.log("Processing JTML scope:", scope);

            // actors
            // pipelines
            // decorator

            const context = window[scope.getAttribute('jt-scope')]?.();

            // Find forms and anchors within this scope
            const forms = scope.querySelectorAll('form');
            const anchors = scope.querySelectorAll('a');

            // Set defaults and bind events for forms
            forms.forEach(form => setupRequester(scope, form));

            // Set defaults and bind events for anchors
            // maybe we don't handle anchors?
            anchors.forEach(anchor => setupRequester(scope, anchor));

            bindEvents(scope, context);
        });
    },
};

const setupRequester = async (scope, requester) => {
    const triggers = requester.querySelectorAll('[jt-submit-form]');

    const renderer = getRenderer(scope, requester);

    const onload = requester.hasAttribute('jt-load');
    if (onload) {
        if (!renderer) {
            return;
        }
        jtRequester(scope, requester, renderer);
    }

    if (!triggers.length) {
        if (requester.tagName === 'FORM') {
            requester.addEventListener('submit', async evt => {
                evt.preventDefault();

                if (!renderer) {
                    return;
                }

                jtRequester(scope, requester, renderer);
            });
        } else {
            requester.addEventListener('click', async evt => {
                evt.preventDefault();

                if (!renderer) {
                    return;
                }

                jtRequester(scope, requester, renderer);
            });
        }
    } else {
        triggers.forEach(triggerEl => {
            const event = triggerEl.getAttribute('jt-submit-form');
            console.log(triggerEl, event);
            triggerEl.addEventListener(event, async evt => {
                evt.preventDefault();

                if (!renderer) {
                    return;
                }

                jtRequester(scope, requester, renderer);
            });
        })
    }
}

const getRenderer = (scope, requester) => {
    const templateSelector = requester.getAttribute('jt-render');
    if (!templateSelector) {
        return null;
    }

    const template = scope.querySelector(templateSelector);
    if (!template) {
        return null;
    }

    return utils.compileTemplate(template);
}

const jtRequester = async (scope, requester, renderer) => {
    const method = (requester.getAttribute('method') || 'GET').toUpperCase();

    const preRequestHook = requester.getAttribute('jt-pre-request-fn');
    console.log(preRequestHook);
    if (preRequestHook) {
        const preRequestFn = window[preRequestHook];
        preRequestFn(requester);
    }

    const loadingEl = resolveElement(requester.getAttribute("jt-loading"));
    const errorEl = resolveElement(requester.getAttribute("jt-error"));

    // Show loading, hide error
    if (loadingEl) showElement(loadingEl);
    if (errorEl) hideElement(errorEl);

    try {
        const data = await fetchData(requester, method);

        const postRequestHook = requester.getAttribute('jt-post-request-fn');
        if (postRequestHook) {
            const postRequestHookFn = window[postRequestHook];
            postRequestHookFn(requester);
        }

        if (loadingEl) hideElement(loadingEl);
        if (errorEl) hideElement(errorEl);

        const target = resolveTarget(scope, requester);
        applySwap(requester, renderer, target, data);
    } catch (err) {
        if (loadingEl) hideElement(loadingEl);
        if (errorEl) showElement(errorEl);

        console.error("Form request failed:", err);
    }
}

const bindEvents = async (scope, context) => {
    const els = scope.querySelectorAll(`[${SupportedEvents.join('],[')}]`);

    for (const el of els) {
        for (const jtEvent of SupportedEvents) {

            if (el.tagName === 'FORM' || el.tagName === 'A') {
                continue;
            }

            if (!el.hasAttribute(jtEvent)) {
                continue;
            }

            const attr = el.getAttribute(jtEvent);

            if (jtEvent === 'jt-load') {
                const fn = window[attr];
                fn?.(el);

                const renderer = getRenderer(scope, el);
                if (renderer) {
                    const target = resolveTarget(scope, el);
                    applySwap(el, renderer, target, context);
                }
                continue;
            }

            if (!attr) {
                continue;
            }

            el.addEventListener(getEventName(jtEvent), (e) => {

                const fn = window[attr];
                fn?.(el, e);

                const renderer = getRenderer(scope, el);
                if (renderer) {
                    const target = resolveTarget(scope, el);
                    applySwap(el, renderer, target, context);
                }
            });
        }
    }
};

const resolveEvent = (scope) => {
    const events = [];
    for (const attr of scope.attributes) {
        if (!attr.name.startsWith("jt-")) {
            continue;
        }

        if (!SupportedEvents.includes(attr.name)) {
            continue;
        }

        events.push({ el: scope, attr });
    }

    for (const child of scope.children) {
        events.push(...resolveEvent(child));
    }

    return events;
}

const getEventName = (jtEvent) => {
    return jtEvent.slice(3);
}

const fetchData = async (requester, method) => {
    const url = requester.getAttribute('action') || requester.getAttribute('href');
    const customOptions = {} //applyActions(requester, "pre");

    const options = {
        method,
        headers: customOptions.headers || {},
    };
    const isWriteMethod = ["post", "put", "patch"].includes(method);
    if (isWriteMethod) {
        const body = extractRequestBody(requester);
        // @TODO let content-type be customizable?
        options.headers = { ...options.headers, "Content-Type": "application/json" };
        options.body = JSON.stringify(body);
    }

    try {
        const res = await fetch(url, options);
        const body = await getResponseBody(requester, res);
        if (!res.ok) {
            throw {
                status: res.status,
                body,
            };
        }

        return body;
    } catch (error) {
        console.error('[jtml] fetch failed:', url, error);
        throw error;
    }
}

const extractRequestBody = (el) => {
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

const getResponseBody = async (requester, res) => {
    const type = res.headers.get("Content-Type") || "";

    if (type.includes("application/json")) {
        return res.json();
    }

    return res.text();
};

const resolveTarget = (scope, requester) => {
    const selector = requester.getAttribute("jt-target");
    if (!selector) {
        return requester; // default: replace requester itself
    }

    try {
        return scope.querySelector(selector);
    } catch {
        console.warn(`[jtml] Invalid jt-target selector '${selector}'`);
        return requester;
    }
};

const applySwap = (scope, renderer, target, data) => {
    const dom = renderer(data);
    if (!dom) {
        return;
    }

    const swap = resolveSwap(scope);
    console.log(swap);
    if (swap === 'replace') {
        target.replaceChildren(dom);
        return;
    }

    if (swap === 'append') {
        target.appendChild(dom);
        return;
    }

    if (swap === 'prepend') {
        target.prepend(dom);
        return;
    }
}

const resolveSwap = (scope) => {
    const swap = scope.getAttribute("jt-swap");
    console.log(swap);
    if (!swap) {
        return 'replace'; // default: replace requester itself
    }
    return swap;
};

const showElement = (el) => {
    if (!el) return;
    el.style.display = "";
};

const hideElement = (el) => {
    if (!el) return;
    el.style.display = "none";
};

const resolveElement = (selector) => {
    if (!selector) return null;
    return document.querySelector(selector);
};

// Wait for DOM ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => JTML.apply());
} else {
    JTML.apply();
}

window.JTML = JTML;
