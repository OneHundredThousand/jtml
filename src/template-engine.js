const actions = {
    'var': (param, data) => {
        return interpolate(param, data);
    },
}

function renderTemplate(template, response) {
    const content = template.content.cloneNode(true);

    processElements(content, response);

    return content;
}

function processElements(content, response) {
    const foreachBlocks = content.children;
    if (!foreachBlocks) {
        return;
    }

    for (let loopEl of foreachBlocks) {
        if (loopEl.hasAttribute("x-foreach")) {
            processForeachBlocks(loopEl, response);
            continue;
        }

        processElements(loopEl, response);
        applyAttrBindings(loopEl, response);
    }
}

function processForeachBlocks(el, response) {
    const path = el.getAttribute("x-foreach");
    const loopData = path ? getNestedValue(response, path) : response;

    if (!Array.isArray(loopData)) {
        console.warn("x-foreach expected an array but got", loopData);
        return;
    }

    const cloneContainer = document.createDocumentFragment();

    loopData.forEach(item => {
        const inner = el.cloneNode(true);
        inner.removeAttribute("x-foreach");

        processElements(inner, item);

        cloneContainer.appendChild(inner);
    });

    // Replace loopEl with its clones, not append to target directly
    el.replaceWith(cloneContainer);
}

function applyAttrBindings(fragment, data) {
    const elements = fragment.parentNode.querySelectorAll("*");
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

function getNestedValue(obj, path) {
    return path
        .split('.')
        .reduce((o, key) => {
            if (o) {
                return o[key];
            }
            return undefined;
        }, obj);
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

export {
    renderTemplate,
}
