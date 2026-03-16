import { compileTemplate } from "./template-engine.js";
import { SupportedEvents } from "./events.js";
import { JTStore } from "./store.js";
import { debug, error, warn } from "./debugger.js";

// show loading befor jt-fn?
// global hooks

const JTML = {
    // globalHooks: [],
    apply: (root = document.body) => {
        const actors = root.querySelectorAll(`[${SupportedEvents.join("],[")}]`);

        for (const actor of actors) {
            if (actor._redered) {
                continue;
            }

            bindEvents(actor);
            actor._redered = true;

            debug(actor);
        }
    },
    run: (el) => {
        handleEvent(el, "");
    },
    store: JTStore,
    // registerGlobalHook: (fn) => {
    //     warnCb(() => typeof fn !== "function", `[jtml] cannot register non-function global hook ${fn}`);

    //     JTML.globalHooks.push(fn);
    // }
};


// function bindNavigation(root) {
//     const links = root.querySelectorAll("[jt-nav]");

//     for (const link of links) {
//         link.addEventListener("click", async (e) => {
//             e.preventDefault();

//             const url = link.getAttribute("href");
//             if (!url) {
//                 return;
//             }

//             await navigate(url);
//         });
//     }
// }

// async function navigate(url) {
//     try {
//         const res = await fetch(url, { method: "GET" });
//         const html = await res.text();

//         const parser = new DOMParser();
//         const doc = parser.parseFromString(html, "text/html");

//         const newBody = doc.body;
//         if (!newBody) {
//             return;
//         }

//         // Clear page-level store only
//         JTStore.clearPrefix("page:");

//         document.body.replaceWith(newBody);

//         JTML.apply(document);
//         window.history.pushState({}, "", url);

//     } catch (err) {
//         console.error("[jtml] navigation failed:", err);
//     }
// }

const bindEvents = (el) => {
    // const renderer = getRenderer(el);

    for (const jtEvent of SupportedEvents) {
        const jtEventFnName = el.getAttribute(jtEvent);

        if (jtEventFnName === null) {
            continue;
        }

        if (jtEvent === "jt-load") {
            handleEvent(el, jtEventFnName);
            continue;
        }

        el.addEventListener(jtEvent.slice(3), (evt) => handleEvent(el, jtEventFnName, evt));
    }
}

const handleEvent = async (el, eventVal, evt) => {
    if (evt) {
        evt.preventDefault();
    }

    const res = await fnRunner(eventVal, el, evt);
    if (res === false) {
        return;
    }

    const renderer = getRenderer(el);

    if (["FORM", "A"].includes(el.tagName)) {
        const response = await jtRequester(el);
        if (!response) {
            return;
        }

        const storeKey = el.getAttribute("jt-store");
        if (storeKey) {
            JTStore.add(storeKey, response);
        }

        actions(el, renderer, response);
        return;
    }

    let context = {};

    const source = JTStore.get(el.getAttribute("jt-source"));
    if (source) {
        context = source;
    }

    actions(el, renderer, context);
}

function actions(el, renderer, context) {
    if (renderer) {
        renderer(context);
    }

    const afters = resolveElsFromAttr(el, "jt-after") || [];
    for (const after of afters) {
        //     const afterRenderer = getRenderer(after);
        handleEvent(after, "");
    }
}

function getRenderer(requester) {
    const template = getTemplater(requester);
    if (!template) {
        return;
    }

    const target = resolveElFromAttr(requester, "jt-target") || requester;
    const swapper = getSwapper(requester);

    return (data) => render(template, data, swapper, target);
}

function getTemplater(requester) {
    if (requester.hasAttribute('jt-html')) {
        return data => data;
    }

    const template = resolveElFromAttr(requester, "jt-render");
    if (!template) {
        return;
    }

    if (template._compiled) {
        return template._compiled;
    }

    const compiled = compileTemplate(template);
    template._compiled = compiled;

    return compiled;
}

function render(renderer, data, swapper, target) {
    const dom = renderer(data);
    if (!dom) {
        return;
    }

    swapper(target, dom);

    JTML.apply(target);
}

function getSwapper(el) {
    const swapType = el.getAttribute('jt-swap') || 'replace';
    const isValidSwapType = ["replace", "append", "prepend"].includes(swapType);
    if (swapType && !isValidSwapType) {
        warn(`[jtml] unknown [jt-swap] value ${swapType} on actor`, el);
    }

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
    } catch (err) {
        await fnRunner(requester.getAttribute("jt-request-error-fn"), requester, err);

        error("[jtml] fetch failed:", url, err);
        throw error;
    }
}

async function fnRunner(name, ...args) {
    const fn = window[name];
    if (name && !fnExists) {
        warn(`[jtml] cannot find function ${name}`);
    }

    return (fn && fn(...args));
}

async function jtRequester(requester) {
    const loadingEl = resolveElFromAttr(requester, "jt-loading");
    const errorEl = resolveElFromAttr(requester, "jt-error");

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

        // double logged?

        // console.error("[jtml] Form request failed:", err, "on actor", requester);
        error("[jtml] Form request failed:", err, "on actor", requester);
    }
}

function getFetchOptions(requester) {
    let url = requester.getAttribute("action") || requester.getAttribute("href");
    const method = (requester.getAttribute("method") || "GET").toUpperCase();

    const options = {
        method,
        headers: {},
    };

    const isWriteMethod = requester.tagName === "FORM" && ["POST", "PUT", "PATCH"].includes(method);
    if (isWriteMethod) {
        const body = extractRequestBody(requester);
        options.body = JSON.stringify(body);

        options.headers = { "Content-Type": "application/json" };
    }

    if (method === "GET" && requester.tagName === "FORM") {
        const data = new FormData(requester);
        const params = new URLSearchParams(data);

        const _url = new URL(url, window.location.href);
        _url.search = params;

        url = _url.toString();
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

function resolveElFromAttr(el, attr) {
    const selector = el.getAttribute(attr);
    if (!selector) {
        return null;
    }

    try {
        return document.querySelector(selector);
    } catch {
        // console.warn(`[jtml] Invalid ${attr} selector "${selector}"`);
        warn(`[jtml] Invalid ${attr} selector "${selector}" on actor`, el);
        return null;
    }
}

function resolveElsFromAttr(el, attr) {
    const selector = el.getAttribute(attr);
    if (!selector) {
        return null;
    }

    try {
        return document.querySelectorAll(selector);
    } catch {
        // console.warn(`[jtml] Invalid ${attr} selector "${selector}"`);
        warn(`[jtml] Invalid ${attr} selector "${selector}" on actor`, el);
        return null;
    }
}

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

// 338
// 670 peak