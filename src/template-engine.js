export function compileTemplate(template) {
    const isTemplate = template instanceof HTMLTemplateElement;
    if (isTemplate) {
        const tpl = template.content;
        const renderers = Array.from(tpl.childNodes).map(createRenderer).filter(Boolean);

        return function (data) {
            const frag = document.createDocumentFragment();
            for (const renderer of renderers) {
                const node = renderNode(renderer, data);
                if (node) frag.appendChild(node);
            }

            return frag;
        };
    }

    const renderers = Array.from(template.children).map(createRendererStatic);
    return function (data) {
        for (const renderer of renderers) {
            renderNodeStatic(renderer, data);
        }

        return null;
    };
}

function createRenderer(node) {
    if (node.nodeType === Node.TEXT_NODE) {
        const raw = node.textContent;
        if (!raw.trim()) {
            return null;
        }

        return { type: "text", raw };
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
        return null;
    }

    const foreach = node.getAttribute('jt-foreach');
    const text = node.getAttribute('jt-text');

    const binders = compileBind(node);

    const ifExpr = compileIf(node);

    const children = Array.from(node.childNodes).map(createRenderer).filter(Boolean);

    return { type: "element", node, foreach, text, ifExpr, binders, children };
}

function createRendererStatic(node) {
    const text = node.getAttribute('jt-text');
    const binders = compileBind(node);

    const children = Array.from(node.children).map(createRendererStatic);

    return { node, text, binders, children };
}

function compileBind(node) {
    const binders = [];

    for (let attr of node.attributes) {
        if (attr.name.startsWith("jt-attr:")) {
            const [, realAttr] = attr.name.split(":");
            binders.push((el, ctx) => {
                el.setAttribute(realAttr, ctx[attr.value]);
            });
        }
    }

    return binders;
}

function compileIf(node) {
    const xif = node.getAttribute('jt-if');
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

    if (!opFn) throw new Error("Unknown operator: " + op);

    // pre-resolve right-hand literal
    let rightVal;
    if (/^'.*'$/.test(rightRaw)) {
        rightVal = rightRaw.slice(1, -1); // remove quotes
    } else if (!isNaN(Number(rightRaw))) {
        rightVal = Number(rightRaw);
    } else {
        // right might be a variable too
        rightVal = (ctx) => ctx[rightRaw];
    }

    const leftAccessor = (ctx) => ctx[left];

    // Now build a NO-STRING closure
    return function (ctx) {
        const leftValue = leftAccessor(ctx);
        const rightValue = typeof rightVal === "function" ? rightVal(ctx) : rightVal;
        return opFn(leftValue, rightValue);
    };
}

function renderNode(renderer, context) {
    const { type, node, foreach, text, ifExpr, binders, children } = renderer;

    if (type === "text") {
        return document.createTextNode(renderer.raw);
    }

    if (ifExpr && !ifExpr(context)) {
        return;
    }

    if (foreach) {
        const items = foreach !== '.' ? context[foreach] : context;

        if (!Array.isArray(items)) return null;

        const frag = document.createDocumentFragment();
        for (const item of items) {
            const clone = node.cloneNode(false);
            clone.removeAttribute('jt-foreach');
            for (const childRenderer of children) {
                const childNode = renderNode(childRenderer, item);
                if (childNode) clone.appendChild(childNode);
            }
            frag.appendChild(clone);
        }
        return frag;
    }

    const clone = node.cloneNode(false);
    const ctx = text && text !== '.' ? evalVariables(context, text) : context;
    if (text && ctx) {
        clone.textContent = ctx;
    }

    // jt-bind
    binders.forEach((fn) => fn(clone, ctx));

    for (const childRenderer of children) {
        const childNode = renderNode(childRenderer, context);
        if (childNode) {
            clone.appendChild(childNode);
        }
    }

    return clone;
}

function renderNodeStatic(renderer, context) {
    const { node, text, binders, children } = renderer;

    const ctx = text && text !== '.' ? evalVariables(context, text) : context;
    if (text && ctx) {
        node.textContent = ctx;
    }

    // jt-bind
    binders.forEach((fn) => fn(node, ctx));

    for (const childRenderer of children) {
        renderNodeStatic(childRenderer, context);
    }
}

function evalVariables(context, text) {
    console.log(text, context);
    const val = getNestedValue(context, text);
    if (val) {
        return val;
    }
    return interpolate(text, context);
}

function getNestedValue(obj, path) {
    let current = obj;
    for (let i = 0, keys = path.split('.'); i < keys.length; i++) {
        if (current == null) return undefined;
        current = current[keys[i]];
    }
    return current;
}

function interpolate(template, data) {
    let result = '';
    let i = 0;

    while (i < template.length) {
        const start = template.indexOf('{{', i);

        if (start === -1) {
            result += template.slice(i); // Append remaining text
            break;
        }

        result += template.slice(i, start); // Append text before {{
        const end = template.indexOf('}}', start);

        if (end === -1) {
            result += template.slice(start); // No matching }} — treat as raw
            break;
        }

        const key = template
            .slice(start + 2, end)
            .trim(); // Extract the key inside {{ }}

        result += getNestedValue(data, key); // Interpolate or empty
        i = end + 2; // Move past the }}
    }

    return result;
}

