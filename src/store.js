import { getNestedValue, setNestedValue, isFunction, isObject } from "./utils";
import { warn } from "./debugger/utils";

const data = {};

// validate this
export const store = {
    add: (fn) => {
        if (!isFunction(fn)) {
            warn(`store: add() expects a function, "${typeof fn}" received.`);
            return;
        }

        const value = fn();
        if (!isObject(value)) {
            warn(`store: add() value must be an object, "${typeof value}" received.`);
            return;
        }

        data[fn.name] = value;
        return () => delete data[fn.name];
    },

    set: (path, value) => {
        const succeeded = setNestedValue(data, path, value);

        if (!succeeded) {
            warn(`store: set() unable to set value in non-existing path "${path}"`);
        }
    },

    get: (path) => {
        const value = getNestedValue(data, path);

        if (!value) {
            warn(`store: get() unable to get value in non-existing path "${path}"`);
        }

        return value;
    },

    // remove(key) {
    //     delete this.data[key];
    // },
};

export const getStore = (path) => {
    return {
        path,
        store: getNestedValue(data, path),
    };
}
