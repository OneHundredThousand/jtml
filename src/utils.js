export const getNestedValue = (obj, paths) => {
    if (typeof paths !== "string" || paths === "") {
        return obj;
    }

    if (paths === ".") {
        return obj;
    }

    let current = obj;
    for (const path of paths.split(".")) {
        if (!current) {
            return undefined;
        }

        current = current[path];
    }

    return current;
};

export const setNestedValue = (obj, path, value) => {
    if (typeof paths !== "string" || paths === "") {
        return obj;
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
