export const getNestedValue = (obj, paths) => {
    if (!isString(paths)) {
        return;
    }

    if (paths === ".") {
        return obj;
    }

    let current = obj;
    for (const path of paths.split(".")) {
        if (!current) {
            return;
        }

        current = current[path];
    }

    return current;
};

export const setNestedValue = (obj, path, value) => {
    if (!isString(path)) {
        return;
    }

    const keys = path.split(".");
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!current[key]) {
            return;
        }
        current = current[key];
    }

    current[keys[keys.length - 1]] = value;
    return obj;
};


export const isString = (str) => typeof str === "string" && str !== "";

export const isFunction = (str) => typeof str === "function";

export const isObject = (str) => typeof str === "object";

export const isHTMLTemplateElement = (dom) => dom instanceof HTMLTemplateElement;

export const isDocumentFragment = (dom) => dom instanceof DocumentFragment;
