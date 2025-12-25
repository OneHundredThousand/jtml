# jtml

**jtml** is a lightweight, declarative JavaScript micro‑library for wiring HTML to JSON‑driven behavior using attributes.

It is inspired by HTMX and Alpine, but deliberately opinionated: **HTML comes first, JavaScript stays boring, and JSON is the default data shape.**

There are no components, no virtual DOM, no build step, and no framework abstractions to learn.

> jtml = **JSON Template Markup Language**

---

## ✨ Core Ideas

* Markup defines structure **and behavior**
* One request or action per element
* Templates live next to the thing that triggers them
* Targets are scoped locally
* JSON is assumed unless told otherwise

If something gets complex, jtml doesn’t try to hide it — you drop to plain JavaScript.

---

## 🚀 Quick Start

```html
<div jt-scope="postsScope">
  <form action="/posts" method="get" jt-render="#tpl" jt-target="#list" jt-load>
    <template id="tpl">
      <ul>
        <li jt-foreach=".">
          <span jt-text="title"></span>
        </li>
      </ul>
    </template>
    <div id="list"></div>
  </form>
</div>

<script>
function postsScope() {
  return {};
}
</script>
<script src="jtml.js"></script>
```

If `/posts` returns JSON, it will be rendered automatically into `#list`.

---

## 🧭 Scopes (`jt-scope`)

All jtml behavior lives inside a **scope**.

```html
<div jt-scope="myScope">...</div>
```

* The attribute value must be the name of a global function
* That function is called once and its return value becomes the **context**
* Targets, templates, loading, and error elements are all resolved **inside the scope only**

No nested scopes. No global DOM wandering.

---

## 🔁 Requests (Forms & Anchors)

jtml treats **forms** and **anchors** as request elements.

### Forms

```html
<form
  action="/users"
  method="post"
  jt-render="#userTpl"
  jt-target="#users"
>
```

* Uses `fetch()` under the hood
* Write methods (`POST`, `PUT`, `PATCH`) send JSON bodies
* `GET` requests do not

### Anchors

```html
<a href="/users" jt-render="#tpl" jt-target="#out">Load</a>
```

Anchors always trigger on click unless overridden.

---

## 🧩 Rendering (`jt-render`)

`jt-render` points to a `<template>` **inside the same scope**.

```html
<template id="tpl">
  <div jt-foreach=".">
    <span jt-text="name"></span>
  </div>
</template>
```

* Templates are compiled once
* JSON data is passed directly to the renderer
* The renderer returns DOM (or HTML if `jt-html` is used)

---

## 🎯 Targets (`jt-target`)

```html
<div jt-target="#output"></div>
```

* Must resolve inside the same scope
* If omitted, rendering happens in place

This avoids invisible cross‑DOM side effects.

---

## 🔄 Swap Strategies (`jt-swap`)

Controls how rendered output is inserted.

| Value   | Behavior                   |
| ------- | -------------------------- |
| replace | Replace children (default) |
| append  | Append output              |
| prepend | Prepend output             |

```html
<form jt-swap="append">...</form>
```

### HTML vs DOM

* Default: rendered output is **DOM nodes**
* Add `jt-html` to treat render output as raw HTML strings

---

## ⏳ Loading & Error States

```html
<form jt-loading="#loading" jt-error="#error">...</form>
```

* `jt-loading`: shown during request
* `jt-error`: shown if request fails

Both selectors are resolved locally.

---

## 🪝 Lifecycle Hooks

Hooks are plain global functions.

```html
<form
  jt-pre-request-fn="beforeReq"
  jt-post-request-fn="afterReq"
  jt-request-error-fn="onError"
>
```

```js
function beforeReq(el, options) {}
function afterReq(el, res, body) {}
function onError(el, error) {}
```

No magic. No hidden state.

---

## ⚡ Event Binding (`jt-*` events)

Supported events:

* `jt-click`
* `jt-submit`
* `jt-input`
* `jt-change`
* `jt-load`

```html
<button jt-click="increment">+</button>
```

```js
function increment(el, e) {
  console.log("clicked");
}
```

Rules:

* **One event per element**
* Forms and anchors are excluded (they already have request semantics)
* If the handler returns a Promise, rendering waits for it

---

## 🧠 Context Rendering

Event handlers can trigger renders using the scope context.

```js
function update(el) {
  return fetch("/data");
}
```

Once resolved, the renderer runs using the scope context.

---

## 🧪 Template Directives

Supported template attributes:

* `jt-foreach="items"`
* `jt-text="field"`
* `jt-if="a eq b"`
* `jt-attr:name="value"`

Interpolation is supported:

```html
<span>{{ user.name }}</span>
```

---

## 🧠 Philosophy

jtml is intentionally **not** a framework.

* It does not manage state
* It does not own navigation
* It does not invent new syntax

It is a helper that makes boring HTML powerful again.

If your app starts fighting jtml, that’s your signal to use plain JavaScript — not bend the library.

---

## 📄 License

MIT. Use it. Abuse it. Keep it simple.
