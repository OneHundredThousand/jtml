import { warn } from "./debugger";

const hooks = {
    beforeRequest: [],
    afterRequest: [],
    requestError: [],
};

// @TODO Simplify API
export const globalHooks = {
    register: (fn) => {
        if (!fn || typeof fn !== "object") {
            warn(`[jtml] cannot register ${fn}: must be object with optional properties { beforeRequest: () => {}, afterRequest: () => {}, requestError: () => {} }`);
            return;
        }

        for (const key in hooks) {
            if (fn[key] === undefined) {
                continue;
            }
            if (typeof fn[key] !== "function") {
                warn(`[jtml] cannot register ${key} from ${JSON.stringify(fn)}: ${key} is not a function`);
                continue;
            }

            hooks[key].push(fn[key]);
        }
    },
};

export const run = (phase, ...params) => {
    for (const hook of hooks[phase]) {
        hook(...params);
    }
};
