import { warn } from "./debugger";

const storedHandlers = {};

export const handlers = {
    add: (classObj) => {

        if (typeof classObj !== "function") {
            warn(`handlers: add() expects a class, ${typeof fn} received.`);
            return;
        }

        const handler = new classObj();
        storedHandlers[handler.constructor.name] = handler;

        return () => delete storedHandlers[handler.constructor.name];
    },
    access: async (path, ...params) => {
        if (!path) {
            return;
        }

        if (typeof path !== "string") {
            warn(`handlers: access() path must be a string ${typeof path} received.`);
            return;
        }

        const [constructor, method = ""] = path.split(".");

        const handler = storedHandlers[constructor];
        if (!handler) {
            warn(`handlers: access() handler "${handler}" was not found, full path ${path}`);
            return;
        }

        if (!handler[method]) {
            warn(`handlers: access() method "${method}" was not found, full path ${path}`);
            return;
        }

        if (typeof handler[method] !== "function") {
            warn(`handlers: access() the value for method found was not a function but a "${typeof handler[method]}", full path ${path}`);
            return;
        }

        return handler[method](...params);
    }
}
