const actions = {
    'var': (param, data) => {
        return interpolate(param, data);
    },
}

function renderTemplate(template: HTMLTemplateElement, response: object): HTMLElement {
    const content = template.content.cloneNode(true) as HTMLElement;

    processElements(content, response);

    return content;
}

function processElements(content: HTMLElement, response: object): void {
    const foreachBlocks = content.children;
    if (!foreachBlocks) {
        return;
    }

    for (const loopEl of foreachBlocks) {
        if (loopEl.hasAttribute("x-foreach")) {
            processForeachBlocks(loopEl as HTMLElement, response);
            continue;
        }

        processElements(loopEl as HTMLElement, response);
        applyAttrBindings(loopEl as HTMLElement, response);
    }
}

function processForeachBlocks(el: HTMLElement, response: object): void {
    const path = el.getAttribute("x-foreach");
    const loopData = path ? getNestedValue(response, path) : response;

    if (!Array.isArray(loopData)) {
        console.warn("x-foreach expected an array but got", loopData);
        return;
    }

    const cloneContainer = document.createDocumentFragment();

    loopData.forEach(item => {
        const inner = el.cloneNode(true) as HTMLElement;
        inner.removeAttribute("x-foreach");

        processElements(inner, item);

        cloneContainer.appendChild(inner);
    });

    // Replace loopEl with its clones, not append to target directly
    el.replaceWith(cloneContainer);
}

function applyAttrBindings(fragment: HTMLElement, data: object): void {
    const elements = fragment.parentNode?.querySelectorAll("*");
    if (!elements) {
        return;
    }

    for (const el of elements) {
        for (const attr of el.attributes) {
            console.log(attr);
            if (!attr.name.startsWith("x-")) {
                continue;
            }

            el.removeAttribute(attr.name); // remove after processing

            const [attrName, transformerName] = attr.name.slice(2).split(':');
            const attrValue = attr.value;
            const transformer = actions[transformerName];

            let value;
            if (transformer) {
                value = transformer(attrValue, data);
            } else {
                value = getNestedValue(data, attrValue);
            }

            console.log(attrName, value);

            if (attrName === 'text') {
                el.textContent = value;
            } else {
                el.setAttribute(attrName, value);
            }
        }
    }
}

function getNestedValue(obj: object, path: string): any | null {
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
