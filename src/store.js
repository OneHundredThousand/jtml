import { getNestedValue, setNestedValue } from "./utils";
import { warn } from "./debugger";

const data = {};

// validate this
export const store = {
    add: (fn) => {
        if (typeof fn !== "function") {
            warn(`store: add() expects a function, "${typeof fn}" received.`);
            return;
        }

        const value = fn();
        if (typeof value !== "object") {
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
