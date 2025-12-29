export function compileTemplate(template) {
    const isTemplate = template instanceof HTMLTemplateElement;

    const renderers = createRenderers(isTemplate ? template.content.childNodes : [template]);

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
    const renders = [];
    for (const tmpl of tmpls) {
        const renderer = createRenderer(tmpl);
        if (!renderer) {
            continue;
        }

        renders.push(renderer);
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
    const text = compileInterpolation(node.getAttribute("jt-text"));

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

            const text = compileInterpolation(attr.value);
            binders.push((el, ctx) => {
                el.setAttribute(realAttr, text(ctx));
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

function compileInterpolation(template) {
    if (!template?.length) {
        return;
    }

    const ast = [];
    const len = template.length;

    let i = 0;
    let textStart = 0;

    while (i < len) {
        if (template[i] !== "{") {
            i++;
            continue;
        }

        // flush text before "{"
        if (i > textStart) {
            ast.push({
                type: "text",
                value: template.slice(textStart, i)
            });
        }

        const exprStart = i + 1;
        let j = exprStart;

        while (j < len && template[j] !== "}") {
            j++;
        }

        // unmatched "{"
        if (j === len) {
            ast.push({
                type: "text",
                value: template.slice(i)
            });
            return ast;
        }

        ast.push({
            type: "path",
            value: template.slice(exprStart, j)
        });

        i = j + 1;
        textStart = i;
    }

    // trailing text
    if (textStart < len) {
        ast.push({
            type: "text",
            value: template.slice(textStart)
        });
    }

    return (ctx) => {
        let out = "";

        if (ast.length === 1) {
            const val = getNestedValue(ctx, ast[0].value);
            out += val ? String(val) : ast[0].value;
        } else {
            for (const node of ast) {
                if (node.type === "text") {
                    out += node.value;
                    continue;
                }

                if (node.type === "path") {
                    const val = getNestedValue(ctx, node.value);
                    out += val ? String(val) : node.value;
                }
            }
        }

        return out;
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
        const items = getNestedValue(context, foreach);
        if (!Array.isArray(items)) {
            return null;
        }

        const frag = document.createDocumentFragment();
        for (const item of items) {
            const clone = node.cloneNode(false);

            for (const childRenderer of children) {
                const childNode = renderNode(childRenderer, item, isTemplate);
                if (isTemplate && childNode) {
                    clone.appendChild(childNode);
                }
            }

            frag.appendChild(clone);
        }
        return frag;
    }

    const clone = isTemplate ? node.cloneNode(false) : node;
    if (text) {
        const val = text(context);
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

function getNestedValue(obj, paths) {
    let current = obj;
    for (const path of paths.split('.')) {
        if (!current) {
            return undefined;
        }

        current = current[path];
    }

    return current;
}
// 261, 223
