# JTML

JTML is a lightweight, attribute-driven JavaScript micro-library that turns plain HTML into interactive, data-driven UI — without becoming a framework.

- No virtual DOM  
- No components  
- No build step required  
- No hidden lifecycle  

**JTML = JSON Template Markup Language**

---

## ✨ Core Ideas

- HTML defines structure and behavior  
- Templates stay in `<template>`  
- JSON is the default data shape  
- Explicit over implicit  

JTML enhances real HTML — it doesn’t replace it.

---

## 🚀 Quick Start

```html
<form
  action="/posts"
  method="GET"
  jt-actor="load"
  jt-render="#posts-template"
  jt-target="#output"
>
</form>

<template id="posts-template">
  <ul>
    <li jt-foreach="items as item">
      <span jt-text="{item.title}"></span>
    </li>
  </ul>
</template>

<div id="output"></div>

<script src="jtml.js"></script>
```

If `/posts` returns:

```json
{
  "items": [
    { "title": "First" },
    { "title": "Second" }
  ]
}
```

JTML fetches, then renders the template into `#output`.

---

## ⚡ Actors (`jt-actor`)

Behavior is bound with a single attribute:

```html
jt-actor="event:Handler.method, anotherEvent"
```

- `event` — any native DOM event name, or the special `load` (runs once when the actor is bound)
- `Handler.method` — optional. Path to a registered handler method. If omitted the default action runs (fetch for forms/anchors, or render from store).

Examples:

```html
<button jt-actor="click:App.onClick" jt-render="#tpl" jt-target="#out">
  Go
</button>

<form jt-actor="submit" action="/save" method="POST" jt-render="#result">
  ...
</form>

<div jt-actor="load" jt-source="user" jt-render="#profile"></div>
```

```js
class App {
  onClick(el, evt) {
    // return false to cancel rendering
    // may return a Promise
  }
}
JTML.handlers.add(App);
```

Multiple events: `jt-actor="click:App.a, input:App.b"`

`JTML.run(el)` manually triggers an actor (with empty handler path).

---

## Forms & Anchors (HTTP)

When the actor element is a `<form>` or `<a>`, JTML performs a `fetch` on the bound event.

- URL from `action` or `href`
- Method from `method` (defaults to `GET`)
- `POST` / `PUT` / `PATCH` on forms → JSON body built from `FormData`
- `GET` forms → query string via `URLSearchParams`

Response body:

- `Content-Type: text/html` → `text()`
- otherwise → `json()`

Optional:

```html
jt-store="posts"          <!-- store.set("posts", body) after success -->
jt-request:before="App.before"
jt-request:after="App.after"
jt-request:error="App.onError"
```

---

## 🧩 Rendering

| Attribute     | Description                                      | Default     |
|---------------|--------------------------------------------------|-------------|
| `jt-render`   | CSS selector of a `<template>`                   | —           |
| `jt-html`     | Treat response as raw HTML (parse + run scripts) | —           |
| `jt-target`   | Where to put the result                          | the actor itself |
| `jt-swap`     | `replace` / `append` / `prepend`                 | `replace`   |
| `jt-after`    | CSS selector(s) of other actors to run next      | —           |
| `jt-source`   | Store path used as render context (non-HTTP)     | —           |

After a render, JTML automatically re-applies itself to the new content so nested actors work.

`jt-html` is useful when the server returns a full HTML fragment (scripts inside are extracted and executed after insertion).

---

## Templates

Point `jt-render` at a `<template>`. Directives live as attributes on elements inside it.

### Text & attributes

```html
<span jt-text="{user.name}"></span>
<a jt-attr:href="{url}" jt-text="Open {title}"></a>
```

- `{path.to.value}` — nested access
- Mixed static + expressions: `Hello {name}!`
- Escape braces: `\{` or `\}`

### Loops

```html
<li jt-foreach="items as item">
  <span jt-text="{item.title}"></span>
  <span jt-text="{item.count}"></span>
</li>
```

`as alias` is required so properties are reached via `{alias.prop}`.

The loop element itself supports `jt-text` and `jt-attr:*`.

### Conditionals

```html
<div jt-if="count gt 0">
  Has items
</div>
<div jt-elseif="count eq 0">
  Empty
</div>
<div jt-else>
  Unknown
</div>
```

Operators: `eq` `neq` `gt` `lt` `gte` `lte`

Also supports bare truthy check or `!path`:

```html
<div jt-if="user"></div>
<div jt-if="!error"></div>
```

Literals: `'string'`, `true`, `false`, `null`, `undefined`, numbers.

`jt-if` / `jt-elseif` / `jt-else` must be consecutive siblings.

Templates are compiled once and cached on the `<template>` element.

---

## Store

Tiny nested key/value store.

```js
// Register a named store (function name becomes the root key)
function user() {
  return { name: "One Hundred", posts: [] };
}
const dispose = JTML.store.add(user);

// Set / get with dotted paths
JTML.store.set("user.name", "Two Hundred");
JTML.store.set("user.posts", [{ title: "42" }]);

const name = JTML.store.get("user.name");
const whole = JTML.store.get("user");
```

In HTML:

```html
<!-- after a successful request -->
<form jt-store="posts" ...></form>

<!-- later, re-render from store -->
<div
  jt-actor="load"
  jt-source="posts"
  jt-render="#list-template"
  jt-target="#list">
</div>
```

---

## Handlers

Custom logic lives in plain classes.

```js
class App {
  before(el, options) {
    options.headers["X-Token"] = "secret";
  }

  after(el, res, body) {
    console.log(res.status, body);
  }

  onError(el, err) {
    console.error(err);
  }

  onClick(el, evt) {
    if (!confirm("Sure?")) return false; // cancel
  }
}

JTML.handlers.add(App);
// returns a disposer that removes the handler
```

Reference them from attributes:

```html
jt-actor="click:App.onClick"
jt-request:before="App.before"
jt-request:after="App.after"
jt-request:error="App.onError"
```

---

## Global Hooks

For cross-cutting request concerns:

```js
JTML.globalHooks.register({
  beforeRequest(el, options) { /* ... */ },
  afterRequest(el, res, body) { /* ... */ },
  requestError(el, err) { /* ... */ },
});
```

They run for every HTTP request, in addition to any per-actor `jt-request:*` handlers.

---

## Debug Mode

```html
<script type="module" src="./main.js?debug"></script>
```

Flags (query params on the script URL):

- `?debug` — log every actor that is processed
- `?debug&debug-only` — only actors that also have `jt-debug-only`
- `?debug&debug-verbose` — include props even when the attribute is absent

---

## Manual Control

```js
JTML.apply();                 // whole document
JTML.apply(someElement);      // subtree only
JTML.run(document.querySelector("#foo")); // run an actor
```

Actors already processed are skipped (`_rendered` flag).

---

## 🧠 Philosophy

JTML is intentionally not a framework.

- No component system
- No router
- No global reactivity
- No hidden diffing or lifecycle magic

It enhances HTML with predictable, explicit behavior.

It just adds a few attributes that make HTML a bit more useful for the common “fetch JSON → fill a template” pattern.

If things get complicated, drop back to plain JavaScript. JTML stays out of the way.

---

## License

MIT
