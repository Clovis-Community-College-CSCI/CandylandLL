/**
 * board-loader.js
 * Parses and validates a Linked List Candyland board JSON file.
 * Detects orphan nodes, broken pointers, and cycles.
 */

class BoardLoader {
    constructor() {
        this.nodes = new Map();       // id → node object
        this.zones = {};              // zone definitions
        this.head = null;             // head node id
        this.title = '';
        this.errors = [];             // validation errors
        this.warnings = [];           // validation warnings
        this.reachable = new Set();   // ids reachable from HEAD
    }

    /**
     * Load board data from a JSON object.
     * @param {Object} data - Parsed JSON board data
     * @returns {{ success: boolean, errors: string[], warnings: string[] }}
     */
    load(data) {
        this.nodes.clear();
        this.zones = {};
        this.head = null;
        this.title = '';
        this.errors = [];
        this.warnings = [];
        this.reachable.clear();

        // --- Basic structure validation ---
        if (!data || typeof data !== 'object') {
            this.errors.push('Board data must be a JSON object.');
            return this._result();
        }

        this.title = data.title || 'Untitled Board';
        this.zones = data.zones || {};

        if (data.head === undefined || data.head === null) {
            this.errors.push('Missing "head" field — which node is the start of the list?');
            return this._result();
        }
        this.head = data.head;

        if (!Array.isArray(data.nodes) || data.nodes.length === 0) {
            this.errors.push('Missing or empty "nodes" array.');
            return this._result();
        }

        // --- Parse nodes ---
        const seenIds = new Set();
        for (const raw of data.nodes) {
            if (raw.id === undefined || raw.id === null) {
                this.errors.push('A node is missing its "id" field.');
                continue;
            }
            if (seenIds.has(raw.id)) {
                this.errors.push(`Duplicate node id: ${raw.id}`);
                continue;
            }
            seenIds.add(raw.id);

            const node = {
                id: raw.id,
                color: (raw.color || 'gray').toLowerCase(),
                name: raw.name || `Node ${raw.id}`,
                zone: raw.zone || null,
                next: Array.isArray(raw.next) ? [...raw.next] : (raw.next !== undefined ? [raw.next] : []),
                x: typeof raw.x === 'number' ? raw.x : null,
                y: typeof raw.y === 'number' ? raw.y : null,
                // runtime fields filled during validation
                isOrphan: false,
                hasBrokenPointer: false,
                brokenPointers: [],
                inCycle: false,
            };

            this.nodes.set(node.id, node);
        }

        // --- Validate HEAD exists ---
        if (!this.nodes.has(this.head)) {
            this.errors.push(`HEAD points to node ${this.head}, which doesn't exist.`);
        }

        // --- Validate next pointers ---
        for (const [id, node] of this.nodes) {
            for (const nextId of node.next) {
                if (!this.nodes.has(nextId)) {
                    node.hasBrokenPointer = true;
                    node.brokenPointers.push(nextId);
                    this.errors.push(
                        `Node ${id} ("${node.name}") has a NEXT pointer to node ${nextId}, which doesn't exist. ` +
                        `This is like having a pointer to freed memory!`
                    );
                }
            }
        }

        // --- Reachability analysis (BFS from HEAD) ---
        if (this.nodes.has(this.head)) {
            this._computeReachability();
        }

        // --- Mark orphans ---
        for (const [id, node] of this.nodes) {
            if (!this.reachable.has(id)) {
                node.isOrphan = true;
                this.warnings.push(
                    `Node ${id} ("${node.name}") is an ORPHAN — nothing points to it from HEAD. ` +
                    `It's allocated in memory but unreachable. This is a memory leak!`
                );
            }
        }

        // --- Cycle detection ---
        this._detectCycles();

        // --- Zone validation ---
        for (const [id, node] of this.nodes) {
            if (node.zone && !this.zones[node.zone]) {
                this.warnings.push(
                    `Node ${id} ("${node.name}") references zone "${node.zone}" which isn't defined in the zones object.`
                );
            }
        }

        // --- Terminal node check ---
        const terminals = [...this.nodes.values()].filter(n => n.next.length === 0 && this.reachable.has(n.id));
        if (terminals.length === 0 && this.nodes.size > 0 && this.reachable.size > 0) {
            this.warnings.push(
                'No terminal node (NULL pointer) found! Every reachable node has a NEXT pointer. ' +
                'The list might be an infinite loop.'
            );
        }

        return this._result();
    }

    /**
     * Load board data from a JSON string.
     * @param {string} jsonString
     */
    loadFromString(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            return this.load(data);
        } catch (e) {
            this.errors.push(`JSON parse error: ${e.message}`);
            return this._result();
        }
    }

    /**
     * Load board data from a file via fetch.
     * @param {string} url
     */
    async loadFromUrl(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                this.errors.push(`Failed to load file: ${response.status} ${response.statusText}`);
                return this._result();
            }
            const data = await response.json();
            return this.load(data);
        } catch (e) {
            this.errors.push(`Failed to load board data: ${e.message}`);
            return this._result();
        }
    }

    /**
     * BFS from HEAD to find all reachable nodes.
     */
    _computeReachability() {
        const queue = [this.head];
        this.reachable.add(this.head);

        while (queue.length > 0) {
            const currentId = queue.shift();
            const node = this.nodes.get(currentId);
            if (!node) continue;

            for (const nextId of node.next) {
                if (this.nodes.has(nextId) && !this.reachable.has(nextId)) {
                    this.reachable.add(nextId);
                    queue.push(nextId);
                }
            }
        }
    }

    /**
     * Detect cycles using DFS with coloring.
     */
    _detectCycles() {
        const WHITE = 0, GRAY = 1, BLACK = 2;
        const color = new Map();
        for (const id of this.nodes.keys()) {
            color.set(id, WHITE);
        }

        const cycleNodes = new Set();

        const dfs = (id, path) => {
            color.set(id, GRAY);
            path.push(id);
            const node = this.nodes.get(id);

            for (const nextId of node.next) {
                if (!this.nodes.has(nextId)) continue;

                if (color.get(nextId) === GRAY) {
                    // Found a cycle — mark all nodes in the cycle
                    const cycleStart = path.indexOf(nextId);
                    for (let i = cycleStart; i < path.length; i++) {
                        cycleNodes.add(path[i]);
                    }
                } else if (color.get(nextId) === WHITE) {
                    dfs(nextId, path);
                }
            }

            path.pop();
            color.set(id, BLACK);
        };

        // Start DFS from HEAD if it exists
        if (this.nodes.has(this.head)) {
            dfs(this.head, []);
        }

        // Also check orphan subgraphs
        for (const id of this.nodes.keys()) {
            if (color.get(id) === WHITE) {
                dfs(id, []);
            }
        }

        for (const id of cycleNodes) {
            const node = this.nodes.get(id);
            node.inCycle = true;
        }

        if (cycleNodes.size > 0) {
            const names = [...cycleNodes].map(id => {
                const n = this.nodes.get(id);
                return `${id} ("${n.name}")`;
            }).join(', ');
            this.errors.push(
                `Cycle detected! The following nodes form an infinite loop: ${names}. ` +
                `Following NEXT pointers will never reach NULL.`
            );
        }
    }

    /**
     * Get the traversal order from HEAD, following the first next pointer at each branch.
     * Returns an array of node ids.
     */
    getTraversalOrder() {
        const order = [];
        const visited = new Set();
        let currentId = this.head;

        while (currentId !== null && currentId !== undefined) {
            if (visited.has(currentId)) break; // avoid infinite loop
            visited.add(currentId);
            order.push(currentId);

            const node = this.nodes.get(currentId);
            if (!node || node.next.length === 0) break;
            currentId = node.next[0]; // follow first pointer
        }

        return order;
    }

    /**
     * Get all nodes reachable from a given node, in order.
     */
    getPathFrom(startId) {
        const path = [];
        const visited = new Set();
        let currentId = startId;

        while (currentId !== null && currentId !== undefined) {
            if (visited.has(currentId)) break;
            visited.add(currentId);
            path.push(currentId);

            const node = this.nodes.get(currentId);
            if (!node || node.next.length === 0) break;
            currentId = node.next[0];
        }

        return path;
    }

    _result() {
        return {
            success: this.errors.length === 0,
            errors: [...this.errors],
            warnings: [...this.warnings],
        };
    }
}
