const data = {};

// validate this
export const store = {
    add: (fn) => {
        data[fn.name] = fn();
        return () => delete data[fn.name];
    },

    set: (path, value) => {
        const [key, prop] = path.split(".");
        const obj = data[key];
        obj[path] = value;
    },

    get: (path) => {
        if (!path) {
            return;
        }

        const [key, prop] = path.split(".");
        return data[key][prop];
    },

    // remove(key) {
    //     delete this.data[key];
    // },
};
