import { isFunction } from "./utils";
import { warn, stringify } from "./debugger/utils";

const BEFORE_REQUEST = "beforeRequest";
const AFTER_REQUEST = "afterRequest";
const REQUEST_ERROR = "requestError";

const hooks = {
    [BEFORE_REQUEST]: [],
    [AFTER_REQUEST]: [],
    [REQUEST_ERROR]: [],
};

// @TODO Simplify API
export const globalHooks = {
    register: (phase, fn) => {
        // if (typeof fn !== "object") {
        //     warn(`[jtml] cannot register ${fn}: must be object with optional properties { beforeRequest: () => {}, afterRequest: () => {}, requestError: () => {} }`);
        //     return;
        // }

        if (![BEFORE_REQUEST, AFTER_REQUEST, REQUEST_ERROR].includes(phase)) {
            warn(`[jtml] unknown global hook phase ${phase}, cannot register ${fn}`);
            return;
        }

        if (!isFunction(fn)) {
            warn(`[jtml] cannot register ${key} from ${stringify(fn)}: ${key} is not a function`);
            return;
        }

        hooks[phase] = fn;

        // warn(`[jtml] unknown global hook phase ${phase}, cannot register ${fn}`);


        // for (const key in hooks) {
        //     if (fn[key] === undefined) {
        //         continue;
        //     }
        //     if (typeof fn[key] !== "function") {
        //         warn(`[jtml] cannot register ${key} from ${stringify(fn)}: ${key} is not a function`);
        //         continue;
        //     }

        //     hooks[key].push(fn[key]);
        // }
    },
};

// const run = (hooks, ...params) => {
//     hooks.forEach(hook => hook(...params))
//     // for (const hook of hooks) {
//     //     hook(...params);
//     // }
// }

export const runBeforeRequests = (...params) => {
    for (const hook of hooks[BEFORE_REQUEST]) {
        hook(...params);
    }
};

export const runAfterRequests = (...params) => {
    for (const hook of hooks[AFTER_REQUEST]) {
        hook(...params);
    }
};

export const runRequestErrors = (...params) => {
    for (const hook of hooks[REQUEST_ERROR]) {
        hook(...params);
    }
};
