import { getNestedValue, isHTMLTemplateElement } from "./utils";
import { error, warn } from "./debugger/utils";

const JT_FOREACH = "jt-foreach";
const JT_IF = "jt-if";
const JT_ELSE_IF = "jt-elseif";
const JT_ELSE = "jt-else";
const JT_ATTR = "jt-attr:";
const JT_TEXT = "jt-text";

const AST_Element = 1;
const AST_Text = 2;
const AST_If = 3;
const AST_Loop = 4;

const IF_TYPE_IF = 1;
const IF_TYPE_ELSEIF = 2;
const IF_TYPE_ELSE = 3;

const INTERPOLATION_STATIC = 1;
const INTERPOLATION_EXPR = 1;

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

        if (el.hasAttribute(JT_FOREACH)) {
            nodes.push(toForeach(el));
            continue;
        }

        if (el.hasAttribute(JT_IF)) {
            const chain = readConditionalChain(elems, i);
            nodes.push(toIf(chain));
            i = chain.$nextIndex - 1;
            continue;
        }

        if (el.hasAttribute(JT_ELSE_IF) || el.hasAttribute(JT_ELSE)) {
            const found = el.hasAttribute(JT_ELSE_IF) ? JT_ELSE_IF : JT_ELSE;
            const value = el.hasAttribute(JT_ELSE_IF) ? el.getAttribute(JT_ELSE_IF) : "";
            warn(`[jtml] ${found}="${value}" with no preceding "${JT_IF}"`, elems[i]);
        }

        nodes.push(toElement(el));
    }
    return nodes;
}

const readConditionalChain = (children, start) => {
    const branches = [toBranch(children[start], IF_TYPE_IF)];
    let i = start + 1;
    let sawElse = false;

    while (i < children.length) {
        const el = children[i];

        if (el.nodeType !== ELEMENT_NODE) {
            i++;
            continue;
        }

        if (el.hasAttribute(JT_ELSE_IF)) {
            if (sawElse) {
                warn(`[jtml] "elseif" cannot follow "else"`, children[i]);
                continue;
            }
            branches.push(toBranch(children[i], IF_TYPE_ELSEIF));
        } else if (el.hasAttribute(JT_ELSE)) {
            if (sawElse) {
                warn(`[jtml] Only one "else" allowed per chain`, children[i]);
                continue;
            }
            branches.push(toBranch(children[i], IF_TYPE_ELSE));
            sawElse = true;
        } else {
            break;
        }
        i++;
    }

    return { $branches: branches, $nextIndex: i };
};

const toElement = (el) => {
    const text = el.getAttribute(JT_TEXT);
    const textInterpolation = text && compileInterpolations(text);
    const compiledBinders = compileBinders(el);
    return {
        $type: AST_Element,
        $element: el,
        $textContent: textInterpolation,
        $binders: compiledBinders,
        $children: createRenderers(el.childNodes),
    };
};

const toText = (el) => ({
    $type: AST_Text,
    $textContent: el.textContent,
});

const toIf = (chain) => ({
    $type: AST_If,
    $branches: chain.$branches,
});

const toBranch = (node, type) => {
    let condition;
    if (type === IF_TYPE_IF) {
        condition = compileIf(node, JT_IF);
    } else if (type === IF_TYPE_ELSEIF) {
        condition = compileIf(node, JT_ELSE_IF);
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
    const foreach = node.getAttribute(JT_FOREACH);
    if (!foreach) {
        return foreach;
    }

    const [collection, as, alias] = foreach.trim().split(" ").filter(Boolean);

    if (!collection || !as || as !== "as" || !alias) {
        warn(`[jtml] invalid jt-foreach synatx "${foreach}"`, node);
    }

    return {
        $type: AST_Loop,
        $collection: collection,
        $alias: alias,
        $template: toElement(node),
    };
};

// @TODO Review implementation
const compileBinders = (node) => {
    const binders = [];

    for (const attr of node.attributes) {
        if (attr.name.startsWith(JT_ATTR)) {
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
        warn(`[jtml] empty ${attr} expression`, node);
        return () => false;
    }

    const ops = {
        eq: (a, b) => a === b,
        ne: (a, b) => a !== b,
        gt: (a, b) => a > b,
        lt: (a, b) => a < b,
        gte: (a, b) => a >= b,
        lte: (a, b) => a <= b,
    };

    const parts = xif.trim().split(" ").filter(Boolean);
    if (parts.length === 1) {
        const [path] = parts;
        if (path[0] === "!") {
            return (ctx) => !getNestedValue(ctx, path.slice(1));
        }
        return (ctx) => getNestedValue(ctx, path);
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

        if (!isNaN(val)) {
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
            parts.push({ $type: INTERPOLATION_STATIC, $value: str.slice(staticStart, end) });
        }
    };

    while (i < len) {
        const ch = str[i];

        if (ch === "\\" && (str[i + 1] === "{" || str[i + 1] === "}")) {
            // Escaped brace: flush static up to here, splice in literal char,
            // then restart static run right after it.
            flushStatic(i);
            parts.push({ $type: INTERPOLATION_STATIC, $value: str[i + 1] });
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

            parts.push({ $type: INTERPOLATION_EXPR, $expr: expr });
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

        if (parts.length === 1 && parts[0].$type === INTERPOLATION_STATIC) {
            const val = getNestedValue(ctx, parts[0].$value);
            out += val ? String(val) : parts[0].$value;
            return out;
        }

        for (const part of parts) {
            out += part.$type === INTERPOLATION_STATIC
                ? part.$value
                : String(getNestedValue(ctx, part.$expr));
        }
        return out;
    };
};

const renderNode = (renderer, context, isDynamic) => {
    const { $type } = renderer;

    if ($type === AST_Text && isDynamic) {
        const { $textContent } = renderer;
        return document.createTextNode($textContent);
    }

    if ($type === AST_If) {
        const { $branches } = renderer;
        for (const branch of $branches) {
            if (branch.$condition(context)) {
                return renderNode(branch.$node, context, isDynamic);
            }
        }
        return;
    }

    if ($type === AST_Loop) {
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

    if ($type === AST_Element) {
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
