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
    <div x-foreach="res">
      <span x-text="res.name"></span>
    </div>
  </template>
</div>
```


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


## 💬 Built with ChatGPT

This project is a collaboration between human creativity and OpenAI’s ChatGPT. Most of the ideas, logic, and even this README were crafted using AI tools—with the goal of building something that *feels like magic, but stays human-friendly.*

---

## 🛠️ Roadmap

- [ ] Add support for `x-if`, `x-class`, `x-on:event`
- [ ] Enhanced error/loading templates
- [ ] Support for `x-foreach="item in res"` syntax
- [ ] Partial updates via `x-patch`, `x-post`
- [ ] Component-style nesting?

---

## 📄 License

MIT. Use it, remix it, build weird things with it.

