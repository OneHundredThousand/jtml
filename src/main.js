import { compileTemplate } from "./template-engine.js";

const SupportedEvents = ["jt-click", "jt-submit", "jt-input", "jt-change", "jt-load"];

const JTStore = {
    data: {},

    add(key, value) {
        this.data[key] = value;
    },

    get(key) {
        return this.data[key];
    },

    // remove(key) {
    //     delete this.data[key];
    // },

    // clearPrefix(prefix) {
    //     for (const key in this.data) {
    //         if (key.startsWith(prefix)) {
    //             delete this.data[key];
    //         }
    //     }
    // },

    // clearAll() {
    //     this.data = {};
    // }
};

const JTML = {
    apply: function (root = document.body) {
        const actors = root.querySelectorAll(`[${SupportedEvents.join("],[")}]`);

        for (const actor of actors) {
            if (actor._redered) {
                continue;
            }

            bindEvents(actor);
            actor._redered = true;
        }

        if (__DEBUG__) {
            debug(root);
        }
    },
    store: JTStore,
};

if (__DEBUG__) {
    const script = document.currentScript;

    function debug(root) {
        const url = new URL(script.src);
        const params = url.searchParams;

        if (params.has("debug")) {
            const actors = root.querySelectorAll(`[${SupportedEvents.join("],[")}]`);

            const jtProps = {
                "jt-source": (actor) => actor.getAttribute("jt-source"),
                "jt-store": (actor) => actor.hasAttribute("jt-store"),
                "jt-html": (actor) => actor.hasAttribute("jt-html"),
                "jt-render": (actor) => resolveElFromAttr(actor, "jt-render"),
                "jt-target": (actor) => resolveElFromAttr(actor, "jt-target"),
                "jt-swap": (actor) => actor.getAttribute("jt-swap") || "jt-replace",
                "jt-after": (actor) => resolveElsFromAttr(actor, "jt-after"),
            }

            for (const actor of actors) {
                const event = SupportedEvents.find(event => actor.hasAttribute(event));
                const props = {
                    actor,
                    event,
                };

                for (const jtProp in jtProps) {
                    if (!actor.hasAttribute(jtProp) && !params.has("verbose")) {
                        continue;
                    }

                    props[jtProp] = jtProps[jtProp](actor);
                }

                console.log("Processing JTML el:", props);
            }
        }
    }
}

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

function bindEvents(el) {
    const renderer = getRenderer(el);

    for (const jtEvent of SupportedEvents) {
        const eventVal = el.getAttribute(jtEvent);

        if (eventVal === null) {
            continue;
        }

        if (jtEvent === "jt-load") {
            handleEvent(el, eventVal, renderer);
            continue;
        }

        el.addEventListener(jtEvent.slice(3), (evt) => handleEvent(el, eventVal, renderer, evt));
    }
}

async function handleEvent(el, eventVal, renderer, evt) {
    if (evt) {
        evt.preventDefault();
    }

    const res = await fnRunner(eventVal, el, evt);
    if (res === false) {
        return;
    }

    let context = {};

    const source = JTStore.get(el.getAttribute("jt-source"));
    if (source) {
        context = source;
    }

    if (["FORM", "A"].includes(el.tagName)) {
        const response = await jtRequester(el);
        if (!response) {
            return;
        }

        const storeKey = el.getAttribute("jt-store");
        if (storeKey) {
            JTStore.add(storeKey, response);
        }

        actions(el, renderer, context ? { ...context, ...response } : response);
        return;
    }

    actions(el, renderer, context);
}

function actions(el, renderer, context) {
    if (renderer) {
        renderer(context);
    }

    const afters = resolveElsFromAttr(el, "jt-after") || [];
    for (const after of afters) {
        const afterRenderer = getRenderer(after);
        handleEvent(after, "", afterRenderer);
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

// function resolveElFromAttr(el, attr) {
//     const selector = el.getAttribute(attr);
//     if (!selector) {
//         return null;
//     }

//     try {
//         return document.querySelector(selector);
//     } catch {
//         console.warn(`[jtml] Invalid ${attr} selector "${selector}"`);
//         return null;
//     }
// }

function resolveElsFromAttr(el, attr) {
    const selector = el.getAttribute(attr);
    if (!selector) {
        return null;
    }

    try {
        return document.querySelectorAll(selector);
    } catch {
        console.warn(`[jtml] Invalid ${attr} selector "${selector}"`);
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