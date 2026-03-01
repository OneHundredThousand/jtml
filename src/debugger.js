const SupportedEvents = ["jt-click", "jt-submit", "jt-input", "jt-change", "jt-load"];

const __DEBUG__ = process.env.NODE_ENV !== "production";

const script = document.currentScript;

export function debug(root) {
    if (!__DEBUG__) {
        return;
    }

    const url = new URL(script.src);
    const params = url.searchParams;

    if (params.has("debug")) {
        const actors = root.querySelectorAll(`[${SupportedEvents.join("],[")}]`);

        const jtProps = {
            "jt-source": (actor) => actor.getAttribute("jt-source"),
            "jt-store": (actor) => actor.hasAttribute("jt-store"),
            "jt-html": (actor) => actor.hasAttribute("jt-html"),
            "jt-render": (actor) => resolveElFromAttr(actor, "jt-render"),
            "jt-target": (actor) => resolveElFromAttr(actor, "jt-target") || actor,
            "jt-swap": (actor) => actor.getAttribute("jt-swap") || "replace",
            "jt-after": (actor) => resolveElsFromAttr(actor, "jt-after"),

            "jt-loading": (actor) => resolveElFromAttr(actor, "jt-loading"),
            "jt-error": (actor) => resolveElFromAttr(actor, "jt-error"),

            "jt-pre-request-fn": (actor) => window[actor.getAttribute("jt-pre-request-fn")],
            "jt-post-request-fn": (actor) => window[actor.getAttribute("jt-post-request-fn")],
            "jt-request-error-fn": (actor) => window[actor.getAttribute("jt-request-error-fn")]
        };

        for (const event of SupportedEvents) {
            jtProps[event] = (actor) => window[actor.getAttribute(event)];
        }

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
