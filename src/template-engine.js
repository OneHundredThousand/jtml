export function compileTemplate(template) {
    const isTemplate = template instanceof HTMLTemplateElement;

    const renderers = createRenderers(isTemplate ? template.content.childNodes : template.children);

    return function (data) {
        const frag = isTemplate ? document.createDocumentFragment() : null;
        for (const renderer of renderers) {
            const node = renderNode(renderer, data, isTemplate);
            if (isTemplate && node) frag.appendChild(node);
        }

        return frag;
    };
}

function createRenderers(tmpls) {
    const renders = new Array(tmpls.length);
    for (let i = 0; i < tmpls.length; i++) {
        const renderer = createRenderer(tmpls[i]);
        if (!renderer) {
            continue;
        }

        renders[i] = renderer;
    }

    return renders;
}

function createRenderer(node) {
    if (node.nodeType === Node.TEXT_NODE) {
        const raw = node.textContent;
        if (!raw || !raw.length) {
            return null;
        }

        return { type: "text", raw };
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
        return null;
    }

    const foreach = node.getAttribute("jt-foreach");
    const text = node.getAttribute("jt-text");

    const binders = compileBind(node);

    const ifExpr = compileIf(node);

    const children = createRenderers(node.childNodes);

    return { type: "element", node, foreach, text, ifExpr, binders, children };
}

function compileBind(node) {
    const binders = [];

    for (let attr of node.attributes) {
        if (attr.name.startsWith("jt-attr:")) {
            const [, realAttr] = attr.name.split(":");
            binders.push((el, ctx) => {
                el.setAttribute(realAttr, evalVariables(ctx, attr.value));
            });
        }
    }

    return binders;
}

function compileIf(node) {
    const xif = node.getAttribute("jt-if");
    if (!xif) {
        return null;
    }

    const ops = {
        eq: (a, b) => a === b,
        neq: (a, b) => a !== b,
        gt: (a, b) => a > b,
        lt: (a, b) => a < b,
        gte: (a, b) => a >= b,
        lte: (a, b) => a <= b,
    };

    const [left, op, rightRaw] = xif.trim().split(/\s+/);
    const opFn = ops[op];

    if (!opFn) {
        throw new Error("Unknown operator: " + op);
    }

    let rightVal;
    if (/^'.*'$/.test(rightRaw)) {
        rightVal = rightRaw.slice(1, -1);
    } else if (!isNaN(Number(rightRaw))) {
        rightVal = Number(rightRaw);
    } else {
        rightVal = (ctx) => ctx[rightRaw];
    }

    const leftAccessor = (ctx) => ctx[left];

    return (ctx) => {
        const leftValue = leftAccessor(ctx);
        const rightValue = typeof rightVal === "function" ? rightVal(ctx) : rightVal;
        return opFn(leftValue, rightValue);
    };
}

function renderNode(renderer, context, isTemplate) {
    const { type, node, foreach, text, ifExpr, binders, children } = renderer;

    if (type === "text") {
        return document.createTextNode(renderer.raw);
    }

    if (ifExpr && !ifExpr(context)) {
        return;
    }

    if (foreach) {
        const items = evalVariables(context, foreach);

        if (!Array.isArray(items)) {
            return null;
        }

        const frag = document.createDocumentFragment();
        for (const item of items) {
            const clone = node.cloneNode(false);

            for (const childRenderer of children) {
                const childNode = renderNode(childRenderer, item, isTemplate);
                if (childNode) {
                    clone.appendChild(childNode);
                }
            }

            frag.appendChild(clone);
        }
        return frag;
    }

    const clone = isTemplate ? node.cloneNode(false) : node;
    if (text) {
        const val = evalVariables(context, text);
        if (val) {
            clone.textContent = val;
        }
    }

    for (const fn of binders) {
        fn(clone, context);
    }

    for (const childRenderer of children) {
        const childNode = renderNode(childRenderer, context, isTemplate);
        if (isTemplate && childNode) {
            clone.appendChild(childNode);
        }
    }

    return clone;
}

function evalVariables(context, name) {
    if (name === ".") {
        return context;
    }

    const val = getNestedValue(context, name);
    if (val) {
        return val;
    }

    return interpolate(name, context);
}

function getNestedValue(obj, path) {
    let current = obj;
    for (let i = 0, keys = path.split("."); i < keys.length; i++) {
        if (current == null) {
            return undefined;
        }

        current = current[keys[i]];
    }

    return current;
}

function interpolate(template, data) {
    let result = "";
    let i = 0;

    while (i < template.length) {
        const start = template.indexOf("{{", i);

        if (start === -1) {
            result += template.slice(i);
            break;
        }

        result += template.slice(i, start);

        const end = template.indexOf("}}", start);
        if (end === -1) {
            result += template.slice(start);
            break;
        }

        const key = template
            .slice(start + 2, end)
            .trim();

        result += getNestedValue(data, key);
        i = end + 2;
    }

    return result;
} // 261
