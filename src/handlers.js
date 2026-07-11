
const storedHandlers = {};

export const handlers = {
    add: (classObj) => {
        const handler = new classObj();
        storedHandlers[handler.constructor.name] = handler;

        return () => delete storedHandlers[handler.constructor.name];
    },
    access: async (path, ...params) => {
        if (!path) {
            return;
        }

        const [constructor, method] = path.split(".");
        const handler = storedHandlers[constructor];
        if (!handler) {
            return;
        }

        if (!handler[method]) {
            return;
        }

        return handler[method](...params);
    }
}
