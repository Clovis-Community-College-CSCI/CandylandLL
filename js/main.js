/**
 * main.js
 * Application initialization and UI wiring for Linked List Candyland.
 */

(function () {
    'use strict';

    let loader, renderer, engine, debugOverlay;

    // DOM references
    const canvas = () => document.getElementById('board-canvas');
    const fileInput = () => document.getElementById('file-input');
    const loadSampleBtn = () => document.getElementById('load-sample');
    const debugToggle = () => document.getElementById('debug-toggle');
    const debugPanel = () => document.getElementById('debug-panel');
    const drawCardBtn = () => document.getElementById('draw-card');
    const newGameBtn = () => document.getElementById('new-game');
    const playerCountSelect = () => document.getElementById('player-count');
    const currentPlayerEl = () => document.getElementById('current-player');
    const lastCardEl = () => document.getElementById('last-card');
    const historyList = () => document.getElementById('history-list');
    const boardTitle = () => document.getElementById('board-title');
    const statusBar = () => document.getElementById('status-bar');
    const branchModal = () => document.getElementById('branch-modal');
    const branchOptions = () => document.getElementById('branch-options');
    const winBanner = () => document.getElementById('win-banner');
    const winMessage = () => document.getElementById('win-message');

    /**
     * Initialize the app.
     */
    function init() {
        loader = new BoardLoader();

        // Set up canvas sizing
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Load sample board button
        loadSampleBtn().addEventListener('click', async () => {
            const result = await loader.loadFromUrl('data/sample-board.json');
            onBoardLoaded(result);
        });

        // File input
        fileInput().addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                const result = loader.loadFromString(evt.target.result);
                onBoardLoaded(result);
            };
            reader.readAsText(file);
        });

        // Debug toggle
        debugToggle().addEventListener('change', (e) => {
            const on = e.target.checked;
            if (renderer) renderer.setDebugMode(on);
            debugPanel().classList.toggle('visible', on);
            if (on && debugOverlay) debugOverlay.refresh();
        });

        // Draw card
        drawCardBtn().addEventListener('click', async () => {
            if (!engine || engine.gameOver) return;
            drawCardBtn().disabled = true;
            const entry = await engine.drawCard();
            if (entry) {
                updateGameUI(entry);
                if (renderer) renderer.playerPositions = engine.getPlayerPositions();
            }
            drawCardBtn().disabled = false;
        });

        // New game
        newGameBtn().addEventListener('click', () => {
            startNewGame();
        });

        // Auto-load sample board
        loadSampleBtn().click();
    }

    /**
     * Handle a loaded board.
     */
    function onBoardLoaded(result) {
        boardTitle().textContent = loader.title;

        if (renderer) renderer.destroy();
        renderer = new BoardRenderer(canvas(), loader);
        renderer.setDebugMode(debugToggle().checked);

        debugOverlay = new DebugOverlay(loader, debugPanel());
        if (debugToggle().checked) debugOverlay.refresh();

        if (result.errors.length > 0) {
            statusBar().textContent = `⚠ Loaded with ${result.errors.length} error(s). Enable Debug Mode to see details.`;
            statusBar().className = 'status-bar status-error';
        } else if (result.warnings.length > 0) {
            statusBar().textContent = `Loaded with ${result.warnings.length} warning(s). Enable Debug Mode to see details.`;
            statusBar().className = 'status-bar status-warning';
        } else {
            statusBar().textContent = `✅ Board loaded successfully — ${loader.nodes.size} nodes, ${Object.keys(loader.zones).length} zones.`;
            statusBar().className = 'status-bar status-ok';
        }

        startNewGame();
    }

    /**
     * Start a new game on the current board.
     */
    function startNewGame() {
        if (!loader || loader.nodes.size === 0) return;

        winBanner().classList.remove('visible');
        const numPlayers = parseInt(playerCountSelect().value) || 2;

        engine = new GameEngine(loader);
        engine.onBranchChoice = handleBranchChoice;
        engine.onStateChange = () => {
            if (renderer) renderer.playerPositions = engine.getPlayerPositions();
        };
        engine.init(numPlayers);

        if (renderer) renderer.playerPositions = engine.getPlayerPositions();

        // Clear UI
        historyList().innerHTML = '';
        lastCardEl().innerHTML = '<span class="no-card">No card drawn yet</span>';
        updateCurrentPlayer();
        drawCardBtn().disabled = false;
    }

    /**
     * Handle branch choice via modal.
     */
    function handleBranchChoice(nodeId, options) {
        return new Promise((resolve) => {
            const node = loader.nodes.get(nodeId);
            branchOptions().innerHTML = '';

            for (const optId of options) {
                const optNode = loader.nodes.get(optId);
                const btn = document.createElement('button');
                btn.className = 'branch-btn';
                btn.innerHTML = `<span class="branch-id">${optId}</span> <span class="branch-name">${optNode ? optNode.name : 'Unknown'}</span>`;
                if (optNode) {
                    btn.style.borderColor = (this?.COLOR_MAP?.[optNode.color]?.stroke) || '#636e72';
                }
                btn.addEventListener('click', () => {
                    branchModal().classList.remove('visible');
                    resolve(optId);
                });
                branchOptions().appendChild(btn);
            }

            branchModal().classList.add('visible');
        });
    }

    /**
     * Update the game UI after a card draw.
     */
    function updateGameUI(entry) {
        // Last card
        const cardColor = entry.card.color;
        const cardType = entry.card.type === 'double' ? '×2' : '';
        lastCardEl().innerHTML = `<span class="card-display" style="background: ${getCardColor(cardColor)}">${capitalize(cardColor)} ${cardType}</span>`;

        // History
        const li = document.createElement('li');
        li.className = 'history-entry';
        li.innerHTML = `<span class="history-player" style="color: ${getPlayerColor(entry.playerId)}">${entry.player}</span>: ${entry.message}`;
        historyList().prepend(li);

        // Current player
        updateCurrentPlayer();

        // Win
        if (engine.gameOver && engine.winner) {
            winMessage().textContent = `${engine.winner.name} reached the end of the linked list!`;
            winBanner().classList.add('visible');
            drawCardBtn().disabled = true;
        }
    }

    function updateCurrentPlayer() {
        if (!engine) return;
        const cp = engine.getCurrentPlayer();
        currentPlayerEl().innerHTML = `<span style="color: ${getPlayerColor(cp.id)}">${cp.name}</span>'s turn`;
    }

    function getPlayerColor(id) {
        const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12'];
        return colors[id % colors.length];
    }

    function getCardColor(color) {
        const map = { red: '#ff6b6b', blue: '#74b9ff', yellow: '#ffeaa7', green: '#55efc4', purple: '#a29bfe', orange: '#fab1a0' };
        return map[color] || '#b2bec3';
    }

    function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

    /**
     * Resize canvas to fit container.
     */
    function resizeCanvas() {
        const c = canvas();
        if (!c) return;
        const container = c.parentElement;
        const dpr = window.devicePixelRatio || 1;
        c.width = container.clientWidth * dpr;
        c.height = container.clientHeight * dpr;
        c.style.width = container.clientWidth + 'px';
        c.style.height = container.clientHeight + 'px';
        if (renderer) renderer.invalidateLayout();
    }

    // Boot
    document.addEventListener('DOMContentLoaded', init);
})();
