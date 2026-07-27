# 🍬 Linked List Candyland

**A Directed Journey Through Data Structures!**

Linked List Candyland is an interactive, browser-based board game that teaches **linked lists and pointers** through a colorful Candyland-style experience. Students build their own game boards by defining linked list nodes in JSON, then play through them — watching traversal, branching, and pointer errors come to life.

Built for **CSCI 41 / Data Structures** courses at Clovis Community College.

---

## ✨ Features

- **Visual Linked List Rendering** — Nodes are drawn as candy-colored circles on an HTML5 canvas, connected by animated arrows representing `NEXT` pointers.
- **Board Validation & Error Detection** — Automatically detects:
  - 🔗 **Broken pointers** (dangling references to non-existent nodes)
  - 👻 **Orphan nodes** (allocated but unreachable — memory leaks!)
  - 🔄 **Cycles** (infinite loops where traversal never reaches `NULL`)
- **Candyland-Style Gameplay** — Draw color cards and traverse the linked list to find the next matching node. First player to reach `NULL` wins!
- **Branching Paths** — Nodes can have multiple `NEXT` pointers, prompting players to choose a path at branch points.
- **Debug Mode** — Toggle an overlay that highlights structural problems with educational explanations mapping them to C++ pointer concepts.
- **Custom Boards** — Load your own JSON board file or use the included sample board.
- **1–4 Player Support** — Play solo or with friends.

---

## 🚀 Getting Started

### Prerequisites

No build tools, package managers, or servers required — just a modern web browser.

The entire application is **self-contained in a single `index.html` file** — all CSS, JavaScript, and the sample board data are embedded inline. It works directly from `file://` with no server needed.

### Running Locally

1. Clone the repository:
   ```bash
   git clone https://github.com/Clovis-Community-College-CSCI/CandylandLL.git
   cd CandylandLL
   ```
2. Open `index.html` in your browser — just double-click it!

3. The sample board loads automatically. Click **🃏 Draw Card** to start playing!

---

## 🎮 How to Play

1. **Load a board** — Use the sample board or upload a custom JSON file.
2. **Select player count** — Choose 1–4 players from the sidebar.
3. **Draw a card** — Click **🃏 Draw Card** to draw a color card.
4. **Traverse the list** — Your token automatically advances along `NEXT` pointers until it lands on a node matching the drawn color.
   - **Single cards** advance to the first match; **Double (×2) cards** skip to the second match.
5. **Choose at branches** — If a node has multiple `NEXT` pointers, a modal asks which path to take.
6. **Win!** — The first player whose token reaches a node with `next: []` (a `NULL` pointer / end of the list) wins the game!

---

## 📂 Project Structure

```
CandylandLL/
├── index.html              # Self-contained app (HTML + CSS + JS + sample board — all in one file)
├── css/
│   └── style.css           # Standalone stylesheet (also inlined in index.html)
├── js/
│   ├── board-loader.js     # Parses & validates board JSON (orphan/cycle/broken-pointer detection)
│   ├── board-renderer.js   # Canvas-based rendering of nodes, arrows, zones, and player tokens
│   ├── game-engine.js      # Candyland card-draw gameplay logic
│   ├── debug-overlay.js    # Debug panel with educational error explanations
│   └── main.js             # Application initialization & UI wiring
├── data/
│   └── sample-board.json   # Sample board data (also embedded in index.html)
├── Design Documents/       # OER design documents and reference images
├── LICENSE                 # GNU General Public License v3.0
└── README.md               # This file
```

> **Note:** Only `index.html` is needed to run the game. The `css/`, `js/`, and `data/` directories are kept as reference source files.

---

## 🗺️ Board JSON Format

Boards are defined as JSON files with the following structure:

```json
{
  "title": "My Custom Board",
  "head": 1,
  "zones": {
    "Zone Name": {
      "color": "#c9a0dc",
      "accent": "#a06cc8",
      "description": "A description of this zone."
    }
  },
  "nodes": [
    {
      "id": 1,
      "color": "red",
      "name": "Start Node",
      "zone": "Zone Name",
      "next": [2],
      "x": 0.1,
      "y": 0.5
    },
    {
      "id": 2,
      "color": "blue",
      "name": "End Node",
      "zone": "Zone Name",
      "next": [],
      "x": 0.9,
      "y": 0.5
    }
  ]
}
```

### Field Reference

| Field | Required | Description |
|-------|----------|-------------|
| `title` | No | Display title for the board. |
| `head` | **Yes** | The `id` of the first node in the linked list (the HEAD pointer). |
| `zones` | No | Named regions that group nodes visually on the canvas. |
| `nodes` | **Yes** | Array of node objects (the linked list). |

#### Node Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | **Yes** | Unique identifier for the node (integer). |
| `color` | No | One of: `red`, `blue`, `yellow`, `green`, `purple`, `orange`. Defaults to `gray`. |
| `name` | No | Display name shown below the node. |
| `zone` | No | Which zone this node belongs to. |
| `next` | No | Array of node IDs this node points to. Empty array `[]` means `NULL` (end of list). Multiple entries create branch points. |
| `x`, `y` | No | Normalized position (0.0–1.0) for manual layout. If omitted, nodes are auto-positioned. |

---

## 🐛 Debug Mode

Toggle **Debug Mode** in the board header to reveal:

- **Error panel** listing all structural problems with educational context
- **Visual indicators** on the canvas:
  - Orphan nodes rendered at reduced opacity with ⚠️ badges
  - Cycle nodes highlighted in red with 🔄 badges and dashed borders
  - Broken pointers shown as dashed red arrows with ✕ markers
  - Cycle arrows rendered as dashed red lines

Each error is explained in terms of C/C++ pointer concepts:
- **Orphan nodes** → memory leaks (allocated but unreachable)
- **Broken pointers** → dangling pointers (pointing to freed memory)
- **Cycles** → infinite loops (traversal never reaches `NULL`)

---

## 🧑‍🏫 For Instructors

This project is designed as an **Open Educational Resource (OER)**. Suggested classroom uses:

1. **Board-Building Assignments** — Have students create their own board JSON files. The validator will catch common linked list mistakes and explain them.
2. **Bug-Hunting Exercises** — Provide intentionally broken boards (with orphans, cycles, or dangling pointers) and ask students to identify and fix the issues.
3. **Concept Reinforcement** — Use the visual traversal to demonstrate how linked list operations (traversal, branching) work step by step.

---

## 📄 License

This project is licensed under the **GNU General Public License v3.0** — see the [LICENSE](LICENSE) file for details.
