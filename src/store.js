// validate this
export const JTStore = {
    data: {},

    add: (key, value) => {
        JTStore.data[key] = value;
    },

    get: (key) => {
        return JTStore.data[key];
    },

    // remove(key) {
    //     delete this.data[key];
    // },

    // clearPrefix(prefix) {
    //     for (const key in this.data) {
    //         if (key.startsWith(prefix)) {
    //             delete this.data[key];
    //         }
    //     }
    // },

    // clearAll() {
    //     this.data = {};
    // }
};
