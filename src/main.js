import { compileTemplate } from "./template-engine.js";
import { store } from "./store.js";
import { debug, error, warn } from "./debugger.js";
import { handlers } from "./handlers.js";
import { globalHooks } from "./global-hooks.js";

// show loading befor jt-fn?

const JTML = {
    apply: (root = document.body) => {
        debug(root);

        const actors = root.querySelectorAll("[jt-actor]");
        for (const actor of actors) {
            if (actor._redered) {
                continue;
            }

            bindEvents(actor);
            actor._redered = true;
        }
    },
    run: (el) => {
        handleEvent(el, "");
    },
    store,
    handlers,
    globalHooks,
};

const bindEvents = (el) => {

    const events = el.getAttribute("jt-actor")
        .split(",")
        .map(pair => {
            let [event, fnName = ""] = pair.split(":");
            return [event.trim(), fnName.trim()];
        });

    for (const [event, fnName] of events) {

        const renderer = getRenderer(el); // @TODO async?

        if (event === "load") {
            handleEvent(el, fnName, renderer);
            continue;
        }

        el.addEventListener(event, (evt) => handleEvent(el, fnName, renderer, evt));
    }
}

const handleEvent = async (el, eventVal, renderer, evt) => {
    if (evt) {
        evt.preventDefault();
    }

    const res = await handlers.access(eventVal, el, evt);
    if (res === false) {
        return;
    }

    if (["FORM", "A"].includes(el.tagName)) {
        const response = await httpRequest(el);
        if (!response) {
            return;
        }

        const storeKey = el.getAttribute("jt-store");
        if (storeKey) {
            store.set(storeKey, response);
        }

        actions(el, renderer, response);
        return;
    }

    let context = {};

    const source = store.get(el.getAttribute("jt-source"));
    if (source) {
        context = source;
    }

    actions(el, renderer, context);
}

const actions = (el, renderer, context) => {
    if (renderer) {
        renderer(context);
    }

    const afters = resolveElsFromAttr(el, "jt-after") || [];
    for (const after of afters) {
        const afterRenderer = getRenderer(after);
        handleEvent(after, "", afterRenderer); // @TODO notify proxy/chain/after?
    }
}

const getRenderer = (requester) => {
    const template = getTemplater(requester);
    if (!template) {
        return;
    }

    const target = resolveElFromAttr(requester, "jt-target") || requester;
    const swapper = getSwapper(requester);

    return (data) => render(requester, template, data, swapper, target);
}

const getTemplater = (requester) => {
    if (requester.hasAttribute("jt-html")) {
        return data => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(data, 'text/html');

            const scripts = [];
            const domScripts = doc.body.querySelectorAll("script");

            for (const domScript of domScripts) {
                scripts.push(domScript.innerHTML);
                domScript.remove();
            }

            const frag = document.createDocumentFragment();
            for (const el of doc.body.children) {
                frag.appendChild(el);
            }

            return { $frag: frag, $scripts: scripts };
        };
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

const render = (requester, renderer, data, swapper, target) => {

    const dom = renderer(data);
    if (!dom) {
        return;
    }

    if (dom instanceof DocumentFragment) {
        swapper(target, dom);
        JTML.apply(target);
        return;
    }

    swapper(target, dom.$frag);

    for (const script of dom.$scripts) {
        (new Function(script))();
    }

    JTML.apply(target);
}

const getSwapper = (el) => {
    const swapType = el.getAttribute("jt-swap") || "replace";
    const isValidSwapType = ["replace", "append", "prepend"].includes(swapType);

    if (swapType && !isValidSwapType) {
        warn(`[jtml] unknown [jt-swap] value ${swapType} on actor`, el);
    }

    return {
        replace: (target, dom) => target.replaceChildren(dom),
        append: (target, dom) => target.appendChild(dom),
        prepend: (target, dom) => target.prepend(dom),
    }[swapType];
}

const httpRequest = async (requester) => {
    const { url, options } = getFetchOptions(requester);

    try {
        globalHooks.run("beforeRequest", requester, options);
        await handlers.access(requester.getAttribute("jt-request\\:before"), requester, options);

        const res = await fetch(url, options);
        const body = await getResponseBody(res);

        globalHooks.run("afterRequest", requester, res, body);
        await handlers.access(requester.getAttribute("jt-request\\:after"), requester, res, body);

        if (!res.ok) {
            throw {
                status: res.status,
                body,
            };
        }

        return body;
    } catch (err) {
        globalHooks.run("requestError", requester, err);
        await handlers.access(requester.getAttribute("jt-request\\:error"), requester, err);

        error("[jtml] fetch failed:", url, err);
    }
}

const getFetchOptions = (requester) => {
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

const extractRequestBody = (el) => {
    const formData = new FormData(el);
    const output = {};

    for (const [key, value] of formData.entries()) {
        output[key] = value;
    }
    return output;
};

const getResponseBody = (res) => {
    if (res.headers.get("Content-Type").includes("text/html")) {
        return res.text();
    }

    return res.json();
};

const resolveElFromAttr = (el, attr) => {
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

const resolveElsFromAttr = (el, attr) => {
    const selector = el.getAttribute(attr);
    if (!selector) {
        return null;
    }

    try {
        return document.querySelectorAll(selector);
    } catch {
        warn(`[jtml] Invalid ${attr} selector "${selector}" on actor`, el);
        return null;
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => JTML.apply());
} else {
    JTML.apply();
}

export default JTML;
