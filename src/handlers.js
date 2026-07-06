export const handlers = {
    handlers: new Map(),
    add: (classObj) => {
        if (handlers.handlers.has(classObj)) {
            return;
        }

        const handler = new classObj();
        handlers.handlers.set(handler.constructor.name, handler);
    },
    access: async (path, ...params) => {
        if (!path) {
            return;
        }

        const [constructor, method] = path.split(".");

        const handler = handlers.handlers.get(constructor);
        if (!handler) {
            return;
        }

        if (!handler[method]) {
            return;
        }

        return handler[method](...params);
    }
}
