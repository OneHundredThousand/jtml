# jtml

**jtml** is a lightweight JavaScript micro-library inspired by [HTMX](https://htmx.org), but built for the JSON age. It brings HTML templating back to the front of frontend development—where it belongs.

Instead of burying your UI in component jungle or JSX jungle gyms, `jtml` lets you build declarative, readable, no-nonsense HTML with dynamic JSON rendering using nothing more than attributes and `<template>` tags.

> jtml stands for **JSON Template Markup Language**. It's like HTML... but powered by JSON.

![License](https://img.shields.io/badge/license-MIT-green)
![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)
![Last Commit](https://img.shields.io/github/last-commit/YOUR_USER/YOUR_REPO)
![Inspired by HTMX](https://img.shields.io/badge/Inspired%20by-HTMX-blue)
![Inspired by Alpine.js](https://img.shields.io/badge/Inspired%20by-Alpine.js-77C1D2)

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

## 📚 Examples
[Checkout examples!](https://onehundredthousand.github.io/jtml/)

## 🎮 Playground
[🧪 Try it in the Playground!](https://onehundredthousand.github.io/jtml/playground.html)

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

Inspired by HTMX, the joy of declarative UI, and the lightweight interactivity of Alpine.js, jtml embraces simplicity and clarity for building dynamic web interfaces — all without handing over the keys to a massive JS framework.

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

## 🎯 Core Goals

`jtml` is built around progressive enhancement, keeping things declarative, and doing more with less. Here's what we're focused on (and what we've nailed so far):

- [x] **Support for `GET` requests**  
  Fetch JSON from a given URL using `x-get` and render it through a local `<template>`. This is the foundation.

- [x] **Static Test Data**  
  Use `x-test-data='[...]'` to prototype without needing an actual backend. Great for design-first workflows and quick mocks.

- [x] **Scoped Targets (`x-target`)**  
  Render responses into a different part of the DOM — not just in-place. Perfect for modals, sidebars, or sneakily updating that one notification bell.

- [x] **Lifecycle Hooks**  
  Run custom JS before or after requests with attributes like `x-before`, `x-after`, and `x-error`. Lightweight control without the mess.

- [x] **Attribute-Based Templates**  
  Define templates inline using `x-template`, so you can keep logic and layout close — no extra files or imports needed.

- [x] **Event Triggering**  
  Automatically dispatch custom events (like `jtml:loaded`, `jtml:error`, etc.) after key actions, so other scripts can react without tight coupling.

- [x] **Support for `POST`, `PUT`, `PATCH`, `DELETE`**  
  Extend current behavior to handle `x-post`, `x-put`, `x-patch`, and `x-delete` for sending and receiving JSON.

- [x] **Error Handling UI**  
  Show fallback/error HTML when a request fails — ideally using something like `<div x-error>` or a dedicated `x-error-template`.


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
