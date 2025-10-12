const actions: { [name: string]: (param: string, data: object) => string } = {
    'var': (param: string, data: object): string => {
        return interpolate(param, data);
    },
}

function renderTemplate(el: Element, response: object): Element {
    const content = el.cloneNode(true) as Element;

    processElements(content, response);

    return content;
}

function processElements(content: Element, response: object): void {
    const foreachBlocks = content.children;
    if (!foreachBlocks) {
        return;
    }

    for (const loopEl of foreachBlocks) {
        if (loopEl.hasAttribute("jt-foreach")) {
            processForeachBlocks(loopEl, response);
            continue;
        }

        processElements(loopEl as HTMLElement, response);
        applyAttrBindings(loopEl, response);
    }
}

function processForeachBlocks(el: Element, response: object): void {
    const path = el.getAttribute("jt-foreach");
    const loopData = path ? getNestedValue(response, path) : response;

    if (!Array.isArray(loopData)) {
        console.warn("jt-foreach expected an array but got", loopData);
        return;
    }

    const cloneContainer = document.createDocumentFragment();

    loopData.forEach(item => {
        const inner = el.cloneNode(true) as HTMLElement;
        inner.removeAttribute("jt-foreach");

        processElements(inner, item);

        cloneContainer.appendChild(inner);
    });

    // Replace loopEl with its clones, not append to target directly
    el.replaceWith(cloneContainer);
}

function applyAttrBindings(el: Element, data: object): void {
    for (const attr of el.attributes) {
        if (!attr.name.startsWith("jt-")) {
            continue;
        }

        el.removeAttribute(attr.name);

        const [attrName, transformerName] = attr.name.slice(3).split(':');
        const attrValue = attr.value;
        const transformer = actions[transformerName];

        let value;
        if (transformer) {
            value = transformer(attrValue, data);
        } else {
            value = getNestedValue(data, attrValue);
        }

        if (attrName === 'text') {
            el.textContent = value;
        } else {
            el.setAttribute(attrName, value);
        }
    }
}

function getNestedValue(obj: Record<string, any>, path: string): any | null {
    return path
        .split('.')
        .reduce((o, key) => {
            if (o) {
                return o[key];
            }
            return undefined;
        }, obj);
}

function interpolate(template: string, data: object): string {
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

export {
    renderTemplate,
}
