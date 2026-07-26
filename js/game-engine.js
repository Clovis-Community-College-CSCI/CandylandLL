/**
 * game-engine.js
 * Implements Candyland card-draw gameplay on the linked list board.
 */

class GameEngine {
    constructor(loader) {
        this.loader = loader;
        this.players = [];
        this.currentPlayerIndex = 0;
        this.deck = [];
        this.discardPile = [];
        this.turnHistory = [];
        this.gameOver = false;
        this.winner = null;
        this.onStateChange = null;  // callback
        this.onBranchChoice = null; // callback(nodeId, options) -> Promise<chosenNextId>
    }

    /**
     * Initialize a new game.
     * @param {number} numPlayers - 1 to 4
     */
    init(numPlayers) {
        this.players = [];
        for (let i = 0; i < Math.min(numPlayers, 4); i++) {
            this.players.push({
                id: i,
                name: `Player ${i + 1}`,
                position: this.loader.head,
                finished: false,
            });
        }
        this.currentPlayerIndex = 0;
        this.gameOver = false;
        this.winner = null;
        this.turnHistory = [];
        this._buildDeck();
        this._shuffleDeck();
        this._notify();
    }

    /**
     * Build the card deck: 10 cards of each of the 6 colors, plus 4 special "double" cards.
     */
    _buildDeck() {
        this.deck = [];
        this.discardPile = [];
        const colors = ['red', 'blue', 'yellow', 'green', 'purple', 'orange'];
        for (const color of colors) {
            for (let i = 0; i < 10; i++) {
                this.deck.push({ type: 'single', color });
            }
            // 2 double cards per color — advance to the SECOND matching color
            this.deck.push({ type: 'double', color });
            this.deck.push({ type: 'double', color });
        }
    }

    _shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    /**
     * Draw a card for the current player and advance them.
     * Returns the drawn card and movement result.
     */
    async drawCard() {
        if (this.gameOver) return null;

        const player = this.players[this.currentPlayerIndex];
        if (player.finished) {
            this._advanceTurn();
            return this.drawCard();
        }

        // Reshuffle if deck empty
        if (this.deck.length === 0) {
            this.deck = [...this.discardPile];
            this.discardPile = [];
            this._shuffleDeck();
        }

        const card = this.deck.pop();
        this.discardPile.push(card);

        // Find the target node
        const result = await this._findTarget(player, card);

        const entry = {
            player: player.name,
            playerId: player.id,
            card: card,
            from: player.position,
            to: result.targetNode,
            path: result.path,
            message: result.message,
        };
        this.turnHistory.push(entry);

        // Move the player
        if (result.targetNode !== null) {
            player.position = result.targetNode;

            // Check for win (reached a NULL-terminating node)
            const targetNodeObj = this.loader.nodes.get(result.targetNode);
            if (targetNodeObj && targetNodeObj.next.length === 0) {
                player.finished = true;
                if (!this.winner) {
                    this.winner = player;
                    this.gameOver = true;
                    entry.message += ` 🎉 ${player.name} wins!`;
                }
            }
        }

        this._advanceTurn();
        this._notify();
        return entry;
    }

    /**
     * Find the next node of the matching color by traversing the linked list.
     */
    async _findTarget(player, card) {
        const visited = new Set();
        let current = player.position;
        let matchesNeeded = card.type === 'double' ? 2 : 1;
        let matchCount = 0;
        const path = [current];

        while (true) {
            const node = this.loader.nodes.get(current);
            if (!node || node.next.length === 0) {
                return { targetNode: current, path, message: `Drew ${card.color} ${card.type} — no more ${card.color} spaces ahead. Stayed at ${node?.name || 'unknown'}.` };
            }

            // Handle branches
            let nextId;
            if (node.next.length > 1) {
                if (this.onBranchChoice) {
                    nextId = await this.onBranchChoice(current, node.next);
                } else {
                    nextId = node.next[0]; // default to first branch
                }
            } else {
                nextId = node.next[0];
            }

            if (visited.has(nextId)) {
                return { targetNode: current, path, message: `Drew ${card.color} ${card.type} — hit a cycle! Stayed at ${node.name}.` };
            }
            visited.add(nextId);
            current = nextId;
            path.push(current);

            const nextNode = this.loader.nodes.get(current);
            if (nextNode && nextNode.color === card.color) {
                matchCount++;
                if (matchCount >= matchesNeeded) {
                    const traversalText = path.map(id => id).join(' → ');
                    return {
                        targetNode: current,
                        path,
                        message: `Drew ${card.color} ${card.type} — traversed ${traversalText} to reach "${nextNode.name}".`
                    };
                }
            }

            if (!nextNode || nextNode.next.length === 0) {
                return { targetNode: current, path, message: `Drew ${card.color} ${card.type} — reached end of list at "${nextNode?.name || 'unknown'}" without finding ${card.color}.` };
            }
        }
    }

    _advanceTurn() {
        if (this.gameOver) return;
        let tries = 0;
        do {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
            tries++;
        } while (this.players[this.currentPlayerIndex].finished && tries < this.players.length);

        if (tries >= this.players.length) {
            this.gameOver = true;
        }
    }

    getCurrentPlayer() {
        return this.players[this.currentPlayerIndex];
    }

    getPlayerPositions() {
        const positions = {};
        for (const p of this.players) {
            positions[p.id] = p.position;
        }
        return positions;
    }

    _notify() {
        if (this.onStateChange) this.onStateChange();
    }
}
