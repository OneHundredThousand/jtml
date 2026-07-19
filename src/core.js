import { compileTemplate } from "./template-engine";
import { handlers } from "./handlers";
import { store } from "./store";
import { globalHooks, runBeforeRequests, runAfterRequests, runRequestErrors } from "./global-hooks";
import { isDocumentFragment } from "./utils";
import { debug } from "./debugger/debugger";
import { error, warn } from "./debugger/utils";

// add JSdoc
// build versioning

const bindEvents = (el) => {
    const handlerName = el.getAttribute("jt-handler");

    for (const event of el.getAttribute("jt-event").split(" ")) {

        if (!event) {
            continue;
        }

        // const separator = (pair + ":").indexOf(":");
        // const event = pair.slice(0, separator).trim();
        // const fnName = pair.slice(separator + 1).trim();

        const renderer = getRenderer(el); // @TODO async?

        if (event === "load") {
            // handleEvent(el, fnName, renderer);
            handleEvent(el, handlerName, renderer);
            continue;
        }

        el.addEventListener(event, (evt) => handleEvent(el, handlerName, renderer, evt));
    }
}

// check if this can be sync and only async if needed
// should there be a jt-trigger or jt-before, opposite of jt-after
const handleEvent = async (el, eventVal, renderer, evt) => {
    if (evt) {
        evt.preventDefault();
    }

    if (eventVal) {
        const res = await handlers.access(eventVal, el, evt);
        if (res === false) {
            return;
        }
    }

    if (el.tagName === "FORM" || el.tagName === "A") {
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

    const source = el.getAttribute("jt-source");
    if (source) {
        const sourceObj = store.get(source);
        if (sourceObj) {
            context = sourceObj;
        }
    }

    actions(el, renderer, context);
}

const actions = (el, renderer, context) => {

    if (renderer) {
        renderer(context);
    }

    const afters = resolveElFromAttr(el, "jt-after", true) ?? [];
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
            const doc = parser.parseFromString(data, "text/html");

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

    if (isDocumentFragment(dom)) {
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

    const swappers = {
        replace: (target, dom) => target.replaceChildren(dom),
        append: (target, dom) => target.appendChild(dom),
        prepend: (target, dom) => target.prepend(dom),
    };
    return swappers[swapType];
}

const httpRequest = async (requester) => {
    const { $url, $options } = getFetchOptions(requester);

    try {
        runBeforeRequests(requester, $options);

        const beforeHook = requester.getAttribute("jt-request:before");
        if (beforeHook) {
            await handlers.access(beforeHook, requester, $options);
        }


        const res = await fetch($url, $options);
        const body = await getResponseBody(res);

        runAfterRequests(requester, res, body);

        const afterHook = requester.getAttribute("jt-request:after");
        if (afterHook) {
            await handlers.access(afterHook, requester, res, body);
        }

        if (!res.ok) {
            throw {
                status: res.status,
                body,
            };
        }

        return body;
    } catch (err) {
        runRequestErrors(requester, err);

        const onError = requester.getAttribute("jt-request:error");
        if (onError) {
            await handlers.access(onError, requester, err);
        }

        error("[jtml] fetch failed:", $url, err);
    }
}

const getFetchOptions = (requester) => {

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

    let url = requester.getAttribute("action") || requester.getAttribute("href");

    if (method === "GET" && requester.tagName === "FORM") {
        const data = new FormData(requester);
        const params = new URLSearchParams(data);

        const _url = new URL(url, window.location.href);
        _url.search = params;

        url = _url.toString();
    }

    return {
        $url: url,
        $options: options,
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

const resolveElFromAttr = (el, attr, all = false) => {
    const selector = el.getAttribute(attr);
    if (!selector) {
        return;
    }

    try {
        return all ? document.querySelectorAll(selector) : document.querySelector(selector);
    } catch {
        warn(`[jtml] Invalid ${attr} selector "${selector}" on actor`, el);
        return;
    }
};

export const apply = (root = document) => {
    debug(root);

    const start = performance.now();

    // const xpath = "//*[@*[starts-with(name(), 'jt-on:')]]";
    // const result = document.evaluate(
    //     xpath,
    //     document,          // or a specific element as context node to scope the search
    //     null,
    //     XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
    //     null
    // );

    // for (let i = 0; i < result.snapshotLength; i++) {
    //     const actor = result.snapshotItem(i);
    //     if (actor._redered) {
    //         continue;
    //     }

    //     bindEvents(actor);
    //     actor._redered = true;
    // }

    const actors = root.querySelectorAll("[jt-actor]");

    for (const actor of actors) {
        if (actor._redered) {
            continue;
        }

        bindEvents(actor);
        actor._redered = true;
    }

    const end = performance.now();
    console.log(`${end - start} ms`);
};

export const run = (el) => handleEvent(el, "");
