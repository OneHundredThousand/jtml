import { apply, run } from "./core";
import { store } from "./store";
import { handlers } from "./handlers";
import { globalHooks } from "./global-hooks";

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => apply());
} else {
    apply();
}

export default {
    apply,
    run,
    store,
    handlers,
    globalHooks,
};
