import { compileTemplate } from "./template-engine";
import { handlers } from "./handlers";
import { store } from "./store";
import { run as hooksRunner, BEFORE_REQUEST, AFTER_REQUEST, REQUEST_ERROR } from "./global-hooks";
import { isDocumentFragment } from "./utils";
import { debug } from "./debugger/debugger";
import { error, warn } from "./debugger/utils";

const appliedCache = new WeakMap();

const parseEventEl = (el) => {
    const eventMeta = {
        $events: el.getAttribute("jt-event")?.split(" ")?.filter(Boolean),
        $renderer: getRenderer(el),
        $isHtml: el.hasAttribute("jt-html"),
        $handler: getHandler(el),
        $swapper: getSwapper(el),
        $source: getSource(el),
        $target: getTarget(el),
        $nexts: resolveElFromAttr(el, "jt-after", true) || [],
    };

    appliedCache.set(el, eventMeta);

    return eventMeta;
};


// @TODO: review
const bindEvents = (el, eventMeta) => {
    for (const event of eventMeta.$events) {
        if (event === "load") {
            handleEvent(el, eventMeta);
            continue;
        }
        // console.log(event, eventMeta);
        el.addEventListener(event, (e) => handleEvent(el, eventMeta, e));
    }
};

// check if this can be sync and only async if needed
const handleEvent = async (el, eventMeta, e) => {
    const isFormOrLink = el.tagName === "A" || el.tagName === "FORM";
    if (isFormOrLink && e) {
        e.preventDefault();
    }

    if (eventMeta.$handler) {
        const res = await eventMeta.$handler(el, e);
        if (res === false) {
            return;
        }
    }

    if (eventMeta.$renderer) {
        const response = await getEventData(el);
        const dom = eventMeta.$renderer(response);
        if (dom) {
            swappers2[eventMeta.$swapper](eventMeta.$target, dom);
            apply(eventMeta.$target);
        }
    }

    if (eventMeta.$isHtml) {
        const html = await getEventData(el);
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

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

        swappers2[eventMeta.$swapper](eventMeta.$target, frag);

        for (const script of scripts) {
            (new Function(script))();
        }

        apply(eventMeta.$target);
    }

    for (const after of eventMeta.$nexts) {
        run(after);
    }
};

const getEventData = async (el) => {
    if (el.tagName === "FORM" || el.tagName === "A") {
        const response = await httpRequest(el);
        if (!response) {
            return;
        }

        const storeKey = el.getAttribute("jt-store");
        if (storeKey) {
            store.set(storeKey, response);
        }

        return response;
    }

    const source = el.getAttribute("jt-source");
    if (source) {
        return store.get(source);
    }
};

const httpRequest = async (requester) => {
    const { $url, $options } = getFetchOptions(requester);

    try {
        hooksRunner(BEFORE_REQUEST, requester, $options);

        const beforeHook = requester.getAttribute("jt-request:before");
        if (beforeHook) {
            await handlers.access(beforeHook, requester, $options);
        }


        const res = await fetch($url, $options);
        const body = await getResponseBody(res);

        hooksRunner(AFTER_REQUEST, requester, res, body);

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
        hooksRunner(REQUEST_ERROR, requester, err);

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

const getRenderer = (el) => {
    const render = resolveElFromAttr(el, "jt-render");
    if (!render) {
        return;
    }

    return compileTemplate(render);
};

const getHandler = (el) => {
    const handlerPath = el.getAttribute("jt-handler");
    if (!handlerPath) {
        return;
    }

    return handlers.get(handlerPath);
};

const swappers2 = {
    replace: (target, dom) => target.replaceChildren(dom),
    append: (target, dom) => target.appendChild(dom),
    prepend: (target, dom) => target.prepend(dom),
};

const getSwapper = (el) => {
    const swapType = el.getAttribute("jt-swap") || "replace";
    const isValidSwapType = ["replace", "append", "prepend"].includes(swapType);

    if (swapType && !isValidSwapType) {
        warn(`[jtml] unknown [jt-swap] value ${swapType} on event`, el);
    }

    return swapType;
};

const getSource = (el) => {
    const sourcePath = el.getAttribute("jt-source");
    if (!sourcePath) {
        return;
    }

    return store.get(sourcePath);
};

const getTarget = (el) => {
    const target = resolveElFromAttr(el, "jt-target");
    if (!target) {
        const tergetSelector = el.getAttribute("jt-target");
        warn(`[jtml] jt-target ${tergetSelector} not found, defaulting to current jt-event`, el);
        return el;
    }

    return target;
};

const resolveElFromAttr = (el, attr, all = false) => {
    const selector = el.getAttribute(attr);
    if (!selector) {
        return;
    }

    try {
        return all ? document.querySelectorAll(selector) : document.querySelector(selector);
    } catch {
        warn(`[jtml] Invalid ${attr} selector "${selector}" on event`, el);
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


    const events = root.querySelectorAll("[jt-event]");

    for (const event of events) {
        if (appliedCache.get(event)) {
            continue;
        }

        const eventMeta = parseEventEl(event);

        bindEvents(event, eventMeta);
    }

    // const end = performance.now();
    // if (root === document) {
    //     console.log(`${end - start} ms`);
    // }
};

export const run = (el) => {
    const eventCache = appliedCache.get(el) || parseEventEl(el);
    handleEvent(el, eventCache);
};
