# jtml

**jtml** is a lightweight JavaScript micro-library inspired by [HTMX](https://htmx.org), but built for the JSON age. It brings HTML templating back to the front of frontend development—where it belongs.

Instead of burying your UI in component jungle or JSX jungle gyms, `jtml` lets you build declarative, readable, no-nonsense HTML with dynamic JSON rendering using nothing more than attributes and `<template>` tags.

> jtml stands for **JSON Template Markup Language**. It's like HTML... but powered by JSON.

## 🌿 jtml Manifesto

```text
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║                 🌿  jtml Manifesto 🌿                   ║
║                                                          ║
║     Markup comes first. Data flows cleanly.              ║
║     No components. No build steps. No nonsense.          ║
║                                                          ║
║     Just HTML. Just JSON. Just magic.                    ║
║                                                          ║
║     // Designed by you, assisted by ChatGPT ♥            ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
```

---

## ✨ Features

- 🪄 **HTML-first**: Let your HTML define the structure—no components or build tools needed.
- ⚡ **Zero dependencies**: It's just you, your markup, and a sprinkle of JavaScript.
- 🔁 **Declarative JSON rendering**: Fetch and loop through data using `x-get`, `x-foreach`, and `x-text`.
- 🎯 **Smart defaults**: Skip the boilerplate—render in-place by default or target custom containers.
- 🤝 **Inspired by HTMX**: But with JSON as the primary response format.
- 🤖 **AI-assisted**: Heavily generated using ChatGPT (with love and lots of coffee ☕).

---


## 🚀 Quick Start

```html
<div x-get="/posts">
  <template>
    <div x-foreach>
      <span x-text="name"></span>
    </div>
  </template>
</div>
<script src="jtml.js"></script>
<!-- /posts returns [{ "name": "name" }] -->
```

## 🎮 Playground
[🧪 Try it in the Playground!](https://onehundredthousand.github.io/jtml/)

## 🔧 How It Works

- `x-get="/url"`: Fetches JSON from the provided endpoint.
- `<template>`: HTML structure used for rendering.
- `x-foreach="res"`: Loops through the JSON array.
- `x-text="res.field"`: Inserts text from the current item into the DOM.
- `x-target="#id"` *(optional)*: Directs where to insert the rendered content. If omitted, renders in-place.

## 📦 Installation

Just drop it in:

```html
<script src="jtml.js"></script>
```

## 🌱 Philosophy

Modern frontend stacks have overcomplicated the simple act of rendering data. `jtml` aims to shift that balance back toward:

- Markup-first thinking  
- Minimal JavaScript overhead  
- Transparent design and layout logic  

Inspired by **HTMX** and the joy of declarative UI, `jtml` embraces simplicity and clarity for building dynamic web interfaces.

---

### 🔍 Why Templates Are Placed Inside the Request Element

In **jtml**, the `<template>` is always defined **inside the same element** that contains the request trigger — such as `x-get`, `x-post`, or `x-click`.

This is a deliberate design choice, not a limitation. Here's why:

- 🧠 **Clarity through proximity**  
  You can see where the data comes from and how it will render — all in one place. No need to scroll, search, or guess. The HTML becomes self-explanatory.

- 🧱 **Disciplined structure by design**  
  If you're using `x-target`, it should live close to the `x-get`. This encourages a consistent and readable layout. What triggers the data, and where it goes, should never be far apart.

- 🧼 **Avoiding indirection and hidden magic**  
  Some libraries scatter behavior and rendering across different parts of the page or component tree. That leads to confusion. jtml values simplicity over power — what you see is what you get.

This approach keeps things predictable, maintainable, and beautifully boring — just like a good tool should. ✨

---

### 🗂️ Scoped Targets

To reinforce the principles above, `x-target` selectors in jtml are **scoped locally**.

This means that the target must be a **child of the element that owns the `x-get`, `x-post`, or other directive**. We don't support targeting far-away DOM elements.

#### ✅ Valid

```html
<div x-get="/users" x-click="#paginate" x-target="#list">
  <template>
    <li x-text="name"></li>
  </template>
  <ul id="list"></ul>
  <button id="paginate">Load Users</button>
</div>
```

#### ❌ Invalid

```html
<!-- This will NOT work -->
<div x-get="/users" x-click="#paginate" x-target="#list">
  <template>...</template>
</div>

<ul id="list"></ul> <!-- too far away -->
```

When you scope things this way:

- You prevent fragile code that breaks when the layout changes  
- You make the HTML easier to reason about  
- You enforce a modular, component-like structure without extra tooling

If you have to scroll or guess where data ends up — you're breaking the jtml mindset. 😄

## 💬 Built with ChatGPT

This project is a collaboration between human creativity and OpenAI’s ChatGPT. Most of the ideas, logic, and even this README were crafted using AI tools—with the goal of building something that *feels like magic, but stays human-friendly.*

---

## 🛠️ Roadmap

Here are the current goals and ideas being considered for jtml's development. The aim is to keep the library small and focused while supporting common, essential frontend needs.

### ✅ Core Goals (High Priority)

- [x] **Support for `GET` Method**
  - Fetch JSON from a given URL via `x-get` and render it using a template
- [x] **Static Test Data Support**
  - Allow using `x-test-data='[...]'` to simulate API responses for rapid prototyping
- [ ] **Support for `POST`, `PUT`, `PATCH`, `DELETE`,  Methods**
  - Extend current behavior to handle `x-post`, `x-put`, `x-patch` and `x-delete` for sending and receiving JSON data
- [ ] **Error Handling**
  - Provide a declarative way to display error HTML when a fetch fails (e.g. using `<div x-error>` or `x-error-template`)
- [ ] **Custom Headers**
  - Allow optional request headers for things like Authorization via a JSON attribute (e.g. `x-headers='{"Authorization": "Bearer ..."}'`)
- [ ] **`x-target` Attribute**
  - Allow content to be rendered into a separate target container rather than in-place

### 🎁 Bonus Ideas (Future Exploration)

- [ ] **SPA-like Navigation**
  - Add support for progressive enhancement of internal links (similar to `hx-boost`) to enable basic SPA behavior via HTML streaming or swaps
- [ ] **Server-Sent Events (SSE) Support**
  - Enable live updates using SSE with `x-sse="/events"`
- [ ] **WebSocket Support**
  - Possible integration for real-time templates rendered from incoming WebSocket messages

---

The focus will always be on minimalism and doing one thing well—putting HTML-driven templating at the center of frontend development.

---

## 📄 License

MIT. Use it, remix it, build weird things with it.
