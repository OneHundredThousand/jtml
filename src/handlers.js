import { isFunction, isString } from "./utils";
import { warn } from "./debugger/utils";

const storedHandlers = {};

export const handlers = {
    add: (classObj) => {
        if (!isFunction(classObj)) {
            warn(`handlers: add() expects a class, ${typeof fn} received.`);
            return;
        }

        const constructor = classObj.name;
        if (storedHandlers[constructor]) {
            warn(`handlers: add() ${constructor} class already added.`);
            return;
        }

        const handler = new classObj();
        storedHandlers[constructor] = handler;

        return () => delete storedHandlers[constructor];
    },
    access: async (path, ...params) => {
        if (!isString(path)) {
            warn(`handlers: access() path "${path}" must be a string, ${typeof path} received.`);
            return;
        }

        const [constructor, method = ""] = path.split(".");

        const handler = storedHandlers[constructor];
        if (!handler) {
            warn(`handlers: access() handler "${handler}" was not found, full path ${path}`);
            return;
        }

        if (!isFunction(handler[method])) {
            warn(`handlers: access() the value for method found was not a function but a "${typeof handler[method]}", full path ${path}`);
            return;
        }

        return handler[method](...params);
    }
}

export const getHandler = (path) => {
    if (!isString(path)) {
        return;
    }

    const [constructor, method = ""] = path.split(".");

    const handler = storedHandlers[constructor];
    if (!handler) {
        return;
    }

    if (!isFunction(handler[method])) {
        return;
    }

    return {
        constructor,
        handler: handler[method],
    };
}
