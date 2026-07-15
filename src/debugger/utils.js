const __DEV__ = process.env.NODE_ENV !== "production";

// @RODO add stacktace
export function error(...data) {
    if (!__DEV__) {
        return;
    }

    console.error(...data);
}

export function warn(...data) {
    if (!__DEV__) {
        return;
    }

    console.warn(...data);
}

export function stringify(obj) {
    if (!__DEV__) {
        return;
    }

    return JSON.stringify(obj);
}
