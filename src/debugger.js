// import { SupportedEvents } from "./events.js";



const __DEVELOPMENT__ = process.env.NODE_ENV !== "production";

const script = document.currentScript;

export function debug(root) {
    if (!__DEVELOPMENT__) {
        return;
    }

    const url = new URL(script.src);
    const params = url.searchParams;

    if (params.has("debug")) {
        // const actors = root.querySelectorAll(`[${[...SupportedEvents].join("],[")}]`);
        const actors = root.querySelectorAll("[jt-actor]");

        const jtProps = {
            "jt-source": (actor) => actor.getAttribute("jt-source"),
            "jt-store": (actor) => actor.hasAttribute("jt-store"),
            "jt-html": (actor) => actor.hasAttribute("jt-html"),
            "jt-render": (actor) => resolveElFromAttr(actor, "jt-render"),
            "jt-target": (actor) => resolveElFromAttr(actor, "jt-target") || actor,
            "jt-swap": (actor) => actor.getAttribute("jt-swap") || "replace",
            "jt-after": (actor) => resolveElsFromAttr(actor, "jt-after"),

            // "jt-loading": (actor) => resolveElFromAttr(actor, "jt-loading"),
            // "jt-error": (actor) => resolveElFromAttr(actor, "jt-error"),

            "jt-pre-request-fn": (actor) => window[actor.getAttribute("jt-pre-request-fn")],
            "jt-post-request-fn": (actor) => window[actor.getAttribute("jt-post-request-fn")],
            "jt-request-error-fn": (actor) => window[actor.getAttribute("jt-request-error-fn")]
        };

        // for (const event of SupportedEvents) {
        //     jtProps[event] = (actor) => window[actor.getAttribute(event)];
        // }

        // console.log(actors);

        for (const actor of actors) {

            if (params.has("debug-only")) {
                if (!actor.hasAttribute("jt-debug-only")) {
                    continue;
                }
            }

            const props = {
                actor,
            };

            for (const jtProp in jtProps) {
                if (!actor.hasAttribute(jtProp) && !params.has("debug-verbose")) {
                    continue;
                }

                props[jtProp] = jtProps[jtProp](actor);
            }

            console.log("Processing JTML el:", props);
        }
    }
}

// add stacktace
export function error(...data) {
    if (!__DEVELOPMENT__) {
        return;
    }

    console.error(...data);
}

export function warn(...data) {
    if (!__DEVELOPMENT__) {
        return;
    }

    console.warn(...data);
}

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
        // console.warn(`[jtml] Invalid ${attr} selector "${selector}"`);
        warn(`[jtml] Invalid ${attr} selector "${selector}" on actor`, el);
        return null;
    }
}

function serializeNode(node, depth = 0, highlightNode = null) {
    const indent = '  '.repeat(depth);
    const lines = [];

    if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        if (text) lines.push(`${indent}"${text}"`);
        return lines;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return lines;

    const attrs = Array.from(node.attributes || [])
        .map(a => `${a.name}="${a.value}"`)
        .join(' ');

    const tag = node.tagName.toLowerCase();
    const isTarget = node === highlightNode;
    const line = `${indent}<${tag}${attrs ? ' ' + attrs : ''}>${isTarget ? '   <-- HERE' : ''}`;
    lines.push(line);

    for (const child of node.childNodes) {
        lines.push(...serializeNode(child, depth + 1, highlightNode));
    }

    return lines;
}

/*
    // --- Entry point: pass the <template>, the bad node, and why ---
    function warnTemplateStructure(templateEl, { highlight, message } = {}) {
        const root = templateEl.content || templateEl;
        const lines = [];
        for (const child of root.childNodes) {
            lines.push(...serializeNode(child, 0, highlight));
        }
        const tree = lines.join('\n');

        // text tree: readable, copy-pasteable, safe to paste into an issue
        console.warn(`${message || 'Template structure error:'}\n\n${tree}`);
        // live reference: clickable in devtools, expandable, not serializable
        if (highlight) console.warn('Offending element (click to inspect):', highlight);

        return tree; // also useful for showing in-page, or asserting on in tests
    }

    // --- Demo wiring: reuses the same kind of validation error as before ---
    function findBadIfNode(root) {
        return root.querySelector('[data-if]');
    }

    function run() {
        const tpl = document.getElementById('tpl');
        const bad = findBadIfNode(tpl.content);
        const tree = warnTemplateStructure(tpl, {
            highlight: bad,
            message: `data-if="${bad.getAttribute('data-if')}" is missing a comparison value (rhs)`
        });
        document.getElementById('out').textContent = tree;
    }

    run();
*/