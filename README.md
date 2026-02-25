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
- One actor element = one action  
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
  jt-render="#posts-template"
  jt-target="#output"
  jt-load
>
</form>

<template id="posts-template">
  <ul>
    <li jt-foreach="items">
      <span jt-text="{title}"></span>
    </li>
  </ul>
</template>

<div id="output"></div>

<script src="jtml.js"></script>
```

If `/posts` returns JSON like:

```json
{
  "items": [
    { "title": "First" },
    { "title": "Second" }
  ]
}
```

JTML renders it automatically.

---

## ⚡ Supported Events

JTML binds behavior using `jt-*` attributes.

- `jt-click`
- `jt-submit`
- `jt-input`
- `jt-change`
- `jt-load`

Example:

```html
<button 
  jt-click="handleClick"
  jt-render="#result"
  jt-target="#out">
  Click
</button>
```

```javascript
function handleClick(el, event) {
  console.log("clicked");
}
```

If the handler returns `false`, rendering is skipped.  
If it returns a `Promise`, rendering waits.

---

## 🔁 Forms & Anchors (Requests)

Forms and anchors automatically use `fetch()`.

```html
<form
  action="/users"
  method="POST"
  jt-render="#user-template"
  jt-target="#users"
  jt-store="usersData"
>
</form>
```

### Behavior

- `GET` → query string via `URLSearchParams`
- `POST`, `PUT`, `PATCH` → JSON body

Response auto-parsed:

- `application/json` → `res.json()`
- `text/html` → `res.text()`

---

## 🧩 Rendering (`jt-render`)

`jt-render` points to a `<template>`.

```html
<template id="user-template">
  <div>
    <h3 jt-text="{name}"></h3>
    <p jt-text="{email}"></p>
  </div>
</template>
```

### Supported Template Directives

- `jt-text="{path.to.value}"`
- `jt-foreach="items"`
- `jt-if="count gt 0"`
- `jt-attr:href="{url}"`

### Conditional Operators

- `eq`
- `neq`
- `gt`
- `lt`
- `gte`
- `lte`

Example:

```html
<div jt-if="count gt 0">
  Has items
</div>
```

Templates are compiled once and cached automatically.

---

## 🎯 Targets (`jt-target`)

```html
jt-target="#output"
```

If omitted, rendering happens in place.

---

## 🔄 Swap Strategies (`jt-swap`)

Controls how output is inserted:

| Value   | Behavior                     |
|---------|-----------------------------|
| replace | Replace children (default)  |
| append  | Append output               |
| prepend | Prepend output              |

Example:

```html
<form jt-swap="append">...</form>
```

---

## 🧠 Global Store

JTML includes a tiny key/value store.

```javascript
JTML.store.add("user", { name: "Arthur" });

const user = JTML.store.get("user");
```

Use it via `jt-source`:

```html
<div 
  jt-source="user"
  jt-render="#profile-template">
</div>
```

The stored object becomes the render context.

---

## ⏳ Loading & Error States

```html
<form
  jt-loading="#loading"
  jt-error="#error">
</form>
```

- `jt-loading` → shown during request  
- `jt-error` → shown if request fails  

---

## 🪝 Lifecycle Hooks

Hooks are plain global functions.

```html
<form
  jt-pre-request-fn="beforeReq"
  jt-post-request-fn="afterReq"
  jt-request-error-fn="onError">
</form>
```

```javascript
function beforeReq(el, options) {}
function afterReq(el, response, body) {}
function onError(el, error) {}
```

No framework lifecycle. Just functions.

---

## 🔍 Debug Mode

Enable via query string:

```html
<script src="jtml.js?debug"></script>
```

Optional flags:

- `?debug`
- `?debug&debug-only`
- `?debug&debug-verbose`

Logs actor processing details to the console.

---

## 🔄 Manual Re-Apply

JTML runs automatically on `DOMContentLoaded`.

You can manually re-bind:

```javascript
JTML.apply();
```

Or apply to a subtree:

```javascript
JTML.apply(someElement);
```

---

## 🧠 Philosophy

JTML is intentionally not a framework.

- No component system  
- No router  
- No global state management  
- No hidden diffing  
- No magical reactivity  

It enhances HTML with predictable, explicit behavior.

If things get complicated, use plain JavaScript.  
JTML doesn’t try to compete with full frameworks — it avoids becoming one.

---

## 📄 License

MIT