import { getHandler } from "../handlers";
import { getStore } from "../store";
import { warn } from "./utils";

const __DEV__ = process.env.NODE_ENV !== "production";

const script = document.currentScript;

export function debug(root) {
    if (!__DEV__) {
        return;
    }

    const url = new URL(script.src);
    const params = url.searchParams;

    if (params.has("debug")) {
        const events = root.querySelectorAll("[jt-event]");

        const jtProps = {
            "jt-store": (event) => event.hasAttribute("jt-store"),
            "jt-html": (event) => event.hasAttribute("jt-html"),
            "jt-render": (event) => resolveElFromAttr(event, "jt-render"),
            "jt-target": (event) => resolveElFromAttr(event, "jt-target") || event,
            "jt-swap": (event) => event.getAttribute("jt-swap") || "replace",
            "jt-after": (event) => resolveElFromAttr(event, "jt-after", true),

            "jt-source": (event) => ({
                name: event.getAttribute("jt-source"),
                store: getStore(event.getAttribute("jt-source")),
            }),

            "jt-request:before": (event) => ({
                name: event.getAttribute("jt-request:before"),
                class: getHandler(event.getAttribute("jt-request:before"))?.constructor,
                handler: getHandler(event.getAttribute("jt-request:before"))?.handler,
            }),
            "jt-request:after": (event) => ({
                name: event.getAttribute("jt-request:after"),
                class: getHandler(event.getAttribute("jt-request:after"))?.constructor,
                handler: getHandler(event.getAttribute("jt-request:after"))?.handler,
            }),
            "jt-request:error": (event) => ({
                name: event.getAttribute("jt-request:error"),
                class: getHandler(event.getAttribute("jt-request:error"))?.constructor,
                handler: getHandler(event.getAttribute("jt-request:error"))?.handler,
            }),
        };

        for (const event of events) {

            if (params.has("debug-only")) {
                if (!event.hasAttribute("jt-debug-only")) {
                    continue;
                }
            }

            const props = {
                "jt-event": {
                    name: event.getAttribute("jt-event"),
                    element: event,
                },
            };

            for (const jtProp in jtProps) {
                if (!event.hasAttribute(jtProp) && !params.has("debug-verbose")) {
                    continue;
                }

                props[jtProp] = jtProps[jtProp](event);
            }

            console.log("Processing JTML el:", props);
        }
    }
}

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

/*
    // --- Entry point: pass the <template>, the bad node, and why ---
    function warnTemplateStructure(templateEl, { highlight, message } = {}) {
        const root = templateEl.content || templateEl;
        const lines = [];
        for (const child of root.childNodes) {
            lines.push(...serializeNode(child, 0, highlight));
        }
        const tree = lines.join("\n");

        // text tree: readable, copy-pasteable, safe to paste into an issue
        console.warn(`${message || "Template structure error:"}\n\n${tree}`);
        // live reference: clickable in devtools, expandable, not serializable
        if (highlight) console.warn("Offending element (click to inspect):", highlight);

        return tree; // also useful for showing in-page, or asserting on in tests
    }

    // --- Demo wiring: reuses the same kind of validation error as before ---
    function findBadIfNode(root) {
        return root.querySelector("[data-if]");
    }

    function serializeNode(node, depth = 0, highlightNode = null) {
        const indent = "  ".repeat(depth);
        const lines = [];

        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim();
            if (text) lines.push(`${indent}"${text}"`);
            return lines;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return lines;

        const attrs = Array.from(node.attributes || [])
            .map(a => `${a.name}="${a.value}"`)
            .join(" ");

        const tag = node.tagName.toLowerCase();
        const isTarget = node === highlightNode;
        const line = `${indent}<${tag}${attrs ? " " + attrs : ""}>${isTarget ? "   <-- HERE" : ""}`;
        lines.push(line);

        for (const child of node.childNodes) {
            lines.push(...serializeNode(child, depth + 1, highlightNode));
        }

        return lines;
    }

    function run() {
        const tpl = document.getElementById("tpl");
        const bad = findBadIfNode(tpl.content);
        const tree = warnTemplateStructure(tpl, {
            highlight: bad,
            message: `data-if="${bad.getAttribute("data-if")}" is missing a comparison value (rhs)`
        });
        document.getElementById("out").textContent = tree;
    }

    run();
*/