import { getNestedValue, isHTMLTemplateElement } from "./utils";
import { error, warn } from "./debugger/utils";

const AST_TYPE = {
    Element: 1,
    Text: 2,
    If: 3,
    Loop: 4,
};

const IF_TYPE = {
    If: 1,
    ElseIf: 2,
    Else: 3
};

const INTERPOLATION_NODE_TYPE = {
    Static: 1,
    Expr: 2,
};

const TEXT_NODE = Node.TEXT_NODE;
const ELEMENT_NODE = Node.ELEMENT_NODE;

export const compileTemplate = (template) => {
    const isTemplate = isHTMLTemplateElement(template);

    const roots = isTemplate ? template.content.childNodes : [template];
    const renderers = createRenderers(roots);

    return function (data) {
        const frag = isTemplate ? document.createDocumentFragment() : null;
        for (const renderer of renderers) {
            const node = renderNode(renderer, data, isTemplate);
            if (isTemplate && node) frag.appendChild(node);
        }
        return frag;
    };
}

const createRenderers = (elems) => {
    const nodes = [];
    for (let i = 0; i < elems.length; i++) {
        const el = elems[i];
        const nodeType = elems[i].nodeType;

        if (nodeType === TEXT_NODE) {
            nodes.push(toText(el));
            continue;
        }

        if (nodeType !== ELEMENT_NODE) {
            continue;
        }

        if (el.hasAttribute("jt-foreach")) {
            nodes.push(toForeach(el));
            continue;
        }

        if (el.hasAttribute("jt-if")) {
            const chain = readConditionalChain(elems, i);
            nodes.push(toIf(chain));
            i = chain.$nextIndex - 1;
            continue;
        }

        if (el.hasAttribute("jt-elseif") || el.hasAttribute("jt-else")) {
            const found = el.hasAttribute("jt-elseif") ? "jt-elseif" : "jt-else";
            const value = el.hasAttribute("jt-elseif") ? el.getAttribute("jt-elseif") : "";
            warn(`[jtml] ${found}="${value}" with no preceding "jt-if"`, elems[i]);
        }

        nodes.push(toElement(el));
    }
    return nodes;
}

const readConditionalChain = (children, start) => {
    const branches = [toBranch(children[start], IF_TYPE.If)];
    let i = start + 1;
    let sawElse = false;

    while (i < children.length) {
        const el = children[i];

        if (el.nodeType !== ELEMENT_NODE) {
            i++;
            continue;
        }

        if (el.hasAttribute("jt-elseif")) {
            if (sawElse) {
                warn(`[jtml] "elseif" cannot follow "else"`, children[i]);
                continue;
            }
            branches.push(toBranch(children[i], IF_TYPE.ElseIf));
        } else if (el.hasAttribute("jt-else")) {
            if (sawElse) {
                warn(`[jtml] Only one "else" allowed per chain`, children[i]);
                continue;
            }
            branches.push(toBranch(children[i], IF_TYPE.Else));
            sawElse = true;
        } else {
            break;
        }
        i++;
    }

    return { $branches: branches, $nextIndex: i };
};

const toElement = (el) => {
    const text = el.getAttribute("jt-text");
    const textInterpolation = text && compileInterpolations(text);
    const compiledBinders = compileBinders(el);
    return {
        $type: AST_TYPE.Element,
        $element: el,
        $textContent: textInterpolation,
        $binders: compiledBinders,
        $children: createRenderers(el.childNodes),
    };
};

const toText = (el) => {
    return {
        $type: AST_TYPE.Text,
        $textContent: el.textContent,
    };
};

const toIf = (chain) => {
    return {
        $type: AST_TYPE.If,
        $branches: chain.$branches,
    };
};

const toBranch = (node, type) => {
    let condition;
    if (type === IF_TYPE.If) {
        condition = compileIf(node, "jt-if");
    } else if (type === IF_TYPE.ElseIf) {
        condition = compileIf(node, "jt-elseif");
    } else {
        condition = () => true;
    }

    return {
        $type: type,
        $condition: condition,
        $node: toElement(node),
    };
};

const toForeach = (node) => {
    const foreach = node.getAttribute("jt-foreach");
    if (!foreach) {
        return foreach;
    }

    const [collection, alias] = foreach.trim().split(/\s+as\s+/);
    return {
        $type: AST_TYPE.Loop,
        $collection: collection,
        $alias: alias,
        $template: toElement(node),
    };
};

// @TODO Review implementation
const compileBinders = (node) => {
    const binders = [];

    for (const attr of node.attributes) {
        if (attr.name.startsWith("jt-attr:")) {
            if (!attr.value) {
                continue;
            }

            const text = compileInterpolations(attr.value);
            const realAttr = attr.name.slice(8);

            binders.push((el, ctx) => {
                el.setAttribute(realAttr, text(ctx));
            });
        }
    }

    return binders;
};

const compileIf = (node, attr) => {
    const xif = node.getAttribute(attr);
    if (!xif) {
        return () => false;
    }

    const ops = {
        eq: (a, b) => a === b,
        neq: (a, b) => a !== b,
        gt: (a, b) => a > b,
        lt: (a, b) => a < b,
        gte: (a, b) => a >= b,
        lte: (a, b) => a <= b,
    };

    const parts = xif.trim().split(/\s+/);
    if (parts.length === 1) {
        let [path] = parts;
        if (path[0] === "!") {
            path = path.slice(1);
            return (ctx) => !ctx[path];
        }
        return (ctx) => ctx[path];
    }

    const [left, op, right] = parts;
    const opFn = ops[op];

    if (!opFn) {
        warn("[jtml] invalid jt-if expression", node);
        return () => false;
    }

    const getExpression = (val) => {
        if (/^'.*'$/.test(val)) {
            return () => val.slice(1, -1);
        }

        if (!isNaN(Number(val))) {
            return () => Number(val);
        }

        const literals = {
            "true": true,
            "false": false,
            "undefined": undefined,
            "null": null,
        };

        const literalFn = literals[val];
        if (literals.hasOwnProperty(val)) {
            return () => literalFn[val];
        }

        return (ctx) => getNestedValue(ctx, val);
    };

    const leftAccessor = getExpression(left);
    const rightAccessor = getExpression(right);

    return (ctx) => {
        const leftValue = leftAccessor(ctx);
        const rightValue = rightAccessor(ctx);
        return opFn(leftValue, rightValue);
    };
};

const compileInterpolations = (str) => {
    const parts = [];
    let staticStart = 0;   // start of current static run
    let i = 0;
    const len = str.length;

    const flushStatic = (end) => {
        if (end > staticStart) {
            parts.push({ $type: INTERPOLATION_NODE_TYPE.Static, $value: str.slice(staticStart, end) });
        }
    };

    while (i < len) {
        const ch = str[i];

        if (ch === "\\" && (str[i + 1] === "{" || str[i + 1] === "}")) {
            // Escaped brace: flush static up to here, splice in literal char,
            // then restart static run right after it.
            flushStatic(i);
            parts.push({ $type: INTERPOLATION_NODE_TYPE.Static, $value: str[i + 1] });
            i += 2;
            staticStart = i;
            continue;
        }

        if (ch === "{") {
            flushStatic(i);
            const exprStart = i + 1;
            const close = str.indexOf("}", exprStart);

            if (close === -1) {
                error(`Unmatched "{" at position ${i} in template: "${str}"`);
                return;
            }

            const expr = str.slice(exprStart, close).trim();
            if (expr.length === 0) {
                error(`Empty expression "{}" at position ${i}`)
                return;
            }

            parts.push({ $type: INTERPOLATION_NODE_TYPE.Expr, $expr: expr });
            i = close + 1;
            staticStart = i;
            continue;
        }

        if (ch === "}") {
            // A bare `}` with no matching `{` is malformed — strict mode rejects it
            // rather than silently treating it as a literal.
            error(`Unmatched "}" at position ${i}`);
            return;
        }

        i++;
    }

    flushStatic(len);

    return (ctx) => {
        let out = "";

        if (parts.length === 1 && parts[0].$type === INTERPOLATION_NODE_TYPE.Static) {
            const val = getNestedValue(ctx, parts[0].$value);
            out += val ? String(val) : parts[0].$value;
            return out;
        }

        for (const part of parts) {
            out += part.$type === INTERPOLATION_NODE_TYPE.Static
                ? part.$value
                : String(getNestedValue(ctx, part.$expr));
        }
        return out;
    };
};

const renderNode = (renderer, context, isDynamic) => {
    const { $type } = renderer;

    if ($type === AST_TYPE.Text && isDynamic) {
        const { $textContent } = renderer;
        return document.createTextNode($textContent);
    }

    if ($type === AST_TYPE.If) {
        const { $branches } = renderer;
        for (const branch of $branches) {
            if (branch.$condition(context)) {
                return renderNode(branch.$node, context, isDynamic);
            }
        }
        return;
    }

    if ($type === AST_TYPE.Loop) {
        const { $collection, $alias, $template } = renderer;

        const items = getNestedValue(context, $collection);
        if (!Array.isArray(items)) {
            return null;
        }

        const frag = document.createDocumentFragment();
        for (const item of items) {
            const clone = $template.$element.cloneNode(false);
            context[$alias] = item;

            for (const childRenderer of $template.$children) {

                const childNode = renderNode(childRenderer, context, isDynamic);
                if (childNode) {
                    clone.appendChild(childNode);
                }
            }

            frag.appendChild(clone);
        }

        delete context[$alias];
        return frag;
    }

    if ($type === AST_TYPE.Element) {
        const { $element, $textContent, $binders, $children } = renderer;

        const clone = isDynamic ? $element.cloneNode(false) : $element;

        if ($textContent) {
            clone.textContent = $textContent(context);
        }

        for (const fn of $binders) {
            fn(clone, context);
        }

        for (const childRenderer of $children) {
            const childNode = renderNode(childRenderer, context, isDynamic);
            if (isDynamic && childNode) {
                clone.appendChild(childNode);
            }
        }

        return clone;
    }
};

// 261, 223
// 366
