/**
 * board-renderer.js
 * Renders the linked list board on a canvas element.
 */

class BoardRenderer {
    constructor(canvas, loader) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.loader = loader;
        this.debugMode = false;
        this.NODE_RADIUS = 28;
        this.ARROW_HEAD_SIZE = 10;
        this.PADDING = 60;

        this.COLOR_MAP = {
            red:    { fill: '#ff6b6b', stroke: '#d63031', glow: '#ff8787' },
            blue:   { fill: '#74b9ff', stroke: '#0984e3', glow: '#a0d2ff' },
            yellow: { fill: '#ffeaa7', stroke: '#fdcb6e', glow: '#fff3c4' },
            green:  { fill: '#55efc4', stroke: '#00b894', glow: '#81f5d8' },
            purple: { fill: '#a29bfe', stroke: '#6c5ce7', glow: '#c3bfff' },
            orange: { fill: '#fab1a0', stroke: '#e17055', glow: '#fcc8b8' },
            gray:   { fill: '#b2bec3', stroke: '#636e72', glow: '#d5dde0' },
        };

        this.hoverNode = null;
        this.selectedNode = null;
        this.playerPositions = {};  // playerId -> nodeId
        this.playerColors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12'];
        this.pulsePhase = 0;
        this._mouseX = 0;
        this._mouseY = 0;
        this._nodePositions = new Map();

        this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
        this.canvas.addEventListener('click', (e) => this._onClick(e));

        this._animating = true;
        this._lastTime = 0;
        this._startAnimation();
    }

    setDebugMode(enabled) { this.debugMode = enabled; }

    _toCanvasCoords(nx, ny) {
        const w = this.canvas.width, h = this.canvas.height;
        return {
            x: this.PADDING + nx * (w - 2 * this.PADDING),
            y: this.PADDING + ny * (h - 2 * this.PADDING),
        };
    }

    _computePositions() {
        this._nodePositions.clear();
        const hasManual = [...this.loader.nodes.values()].some(n => n.x !== null && n.y !== null);
        if (hasManual) {
            for (const [id, node] of this.loader.nodes) {
                if (node.x !== null && node.y !== null) {
                    this._nodePositions.set(id, this._toCanvasCoords(node.x, node.y));
                }
            }
            const unpos = [...this.loader.nodes.values()].filter(n => n.x === null || n.y === null);
            if (unpos.length > 0) this._autoLayoutNodes(unpos);
        } else {
            this._autoLayoutNodes([...this.loader.nodes.values()]);
        }
    }

    _autoLayoutNodes(nodes) {
        const cols = Math.ceil(Math.sqrt(nodes.length * 1.5));
        nodes.forEach((node, i) => {
            const row = Math.floor(i / cols);
            const col = row % 2 === 0 ? (i % cols) : (cols - 1 - (i % cols));
            const rows = Math.ceil(nodes.length / cols);
            this._nodePositions.set(node.id, this._toCanvasCoords((col + 0.5) / cols, (row + 0.5) / rows));
        });
    }

    render(timestamp) {
        const dt = timestamp - this._lastTime;
        this._lastTime = timestamp;
        this.pulsePhase += dt * 0.003;
        const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
        ctx.clearRect(0, 0, w, h);
        if (this._nodePositions.size === 0) this._computePositions();
        this._drawZones(ctx);
        this._drawArrows(ctx);
        this._drawNodes(ctx, timestamp);
        this._drawHeadMarker(ctx);
        this._drawPlayerTokens(ctx);
        if (this.hoverNode !== null) this._drawTooltip(ctx);
    }

    _drawZones(ctx) {
        const zoneNodes = {};
        for (const [id, node] of this.loader.nodes) {
            if (!node.zone) continue;
            if (!zoneNodes[node.zone]) zoneNodes[node.zone] = [];
            const pos = this._nodePositions.get(id);
            if (pos) zoneNodes[node.zone].push(pos);
        }
        for (const [zoneName, positions] of Object.entries(zoneNodes)) {
            if (positions.length === 0) continue;
            const zoneDef = this.loader.zones[zoneName];
            const color = zoneDef ? zoneDef.color : '#f0f0f0';
            const pad = 50;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const p of positions) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
            ctx.save();
            ctx.globalAlpha = 0.15;
            ctx.fillStyle = color;
            ctx.beginPath();
            this._roundRect(ctx, minX - pad, minY - pad, maxX - minX + 2 * pad, maxY - minY + 2 * pad, 20);
            ctx.fill();
            ctx.globalAlpha = 0.3;
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
            ctx.save();
            ctx.globalAlpha = 0.6;
            ctx.fillStyle = zoneDef ? zoneDef.accent : '#888';
            ctx.font = 'bold 13px "Fredoka", "Comic Sans MS", cursive';
            ctx.textAlign = 'center';
            ctx.fillText(zoneName, (minX + maxX) / 2, minY - pad + 16);
            ctx.restore();
        }
    }

    _drawArrows(ctx) {
        for (const [id, node] of this.loader.nodes) {
            const fromPos = this._nodePositions.get(id);
            if (!fromPos) continue;
            for (let i = 0; i < node.next.length; i++) {
                const nextId = node.next[i];
                const toPos = this._nodePositions.get(nextId);
                if (!toPos) {
                    if (this.debugMode) this._drawBrokenArrow(ctx, fromPos, nextId);
                    continue;
                }
                const isBranch = node.next.length > 1;
                const dx = toPos.x - fromPos.x, dy = toPos.y - fromPos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist === 0) continue;
                const nx = dx / dist, ny = dy / dist;
                const sx = fromPos.x + nx * (this.NODE_RADIUS + 4), sy = fromPos.y + ny * (this.NODE_RADIUS + 4);
                const ex = toPos.x - nx * (this.NODE_RADIUS + 4), ey = toPos.y - ny * (this.NODE_RADIUS + 4);
                ctx.save();
                if (this.debugMode && node.inCycle && this.loader.nodes.get(nextId)?.inCycle) {
                    ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 3; ctx.setLineDash([8, 4]);
                } else if (isBranch) {
                    ctx.strokeStyle = i === 0 ? '#e17055' : '#00b894'; ctx.lineWidth = 2.5; ctx.setLineDash([]);
                } else {
                    ctx.strokeStyle = '#636e72'; ctx.lineWidth = 2; ctx.setLineDash([]);
                }
                ctx.globalAlpha = 0.7;
                ctx.beginPath();
                if (isBranch) {
                    const cs = (i === 0 ? -1 : 1) * 30;
                    const cpX = (sx + ex) / 2 + (-ny) * cs, cpY = (sy + ey) / 2 + nx * cs;
                    ctx.moveTo(sx, sy); ctx.quadraticCurveTo(cpX, cpY, ex, ey);
                } else {
                    ctx.moveTo(sx, sy); ctx.lineTo(ex, ey);
                }
                ctx.stroke();
                // Arrowhead
                let aa = Math.atan2(ey - sy, ex - sx);
                if (isBranch) {
                    const cs = (i === 0 ? -1 : 1) * 30;
                    const cpX = (sx + ex) / 2 + (-ny) * cs, cpY = (sy + ey) / 2 + nx * cs;
                    aa = Math.atan2(ey - cpY, ex - cpX);
                }
                ctx.fillStyle = ctx.strokeStyle; ctx.globalAlpha = 0.85;
                ctx.beginPath(); ctx.moveTo(ex, ey);
                ctx.lineTo(ex - this.ARROW_HEAD_SIZE * Math.cos(aa - Math.PI / 6), ey - this.ARROW_HEAD_SIZE * Math.sin(aa - Math.PI / 6));
                ctx.lineTo(ex - this.ARROW_HEAD_SIZE * Math.cos(aa + Math.PI / 6), ey - this.ARROW_HEAD_SIZE * Math.sin(aa + Math.PI / 6));
                ctx.closePath(); ctx.fill();
                // NEXT label
                ctx.globalAlpha = 0.5; ctx.fillStyle = '#2d3436'; ctx.font = '9px "Fredoka", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                const la = Math.atan2(dy, dx);
                ctx.fillText('NEXT', (sx + ex) / 2 - Math.sin(la) * 12, (sy + ey) / 2 + Math.cos(la) * 12);
                ctx.restore();
            }
            if (node.next.length === 0) this._drawNullTerminator(ctx, fromPos);
        }
    }

    _drawNullTerminator(ctx, pos) {
        const y = pos.y + this.NODE_RADIUS + 18;
        ctx.save();
        ctx.strokeStyle = '#636e72'; ctx.lineWidth = 2; ctx.globalAlpha = 0.7;
        ctx.beginPath(); ctx.moveTo(pos.x, pos.y + this.NODE_RADIUS + 4); ctx.lineTo(pos.x, y - 4); ctx.stroke();
        ctx.fillStyle = '#636e72'; ctx.beginPath(); ctx.moveTo(pos.x, y - 4); ctx.lineTo(pos.x - 5, y - 10); ctx.lineTo(pos.x + 5, y - 10); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e74c3c'; ctx.font = 'bold 11px "Fredoka", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.globalAlpha = 0.8;
        ctx.fillText('NULL', pos.x, y);
        ctx.restore();
    }

    _drawBrokenArrow(ctx, fromPos, toId) {
        ctx.save();
        const x = fromPos.x + this.NODE_RADIUS + 15, y = fromPos.y;
        ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.moveTo(fromPos.x + this.NODE_RADIUS + 4, fromPos.y); ctx.lineTo(x + 20, y); ctx.stroke();
        const ex = x + 25; ctx.lineWidth = 3; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(ex - 5, y - 5); ctx.lineTo(ex + 5, y + 5); ctx.moveTo(ex + 5, y - 5); ctx.lineTo(ex - 5, y + 5); ctx.stroke();
        ctx.fillStyle = '#e74c3c'; ctx.font = 'bold 9px "Fredoka", monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(`-> ${toId} (missing!)`, ex + 10, y);
        ctx.restore();
    }

    _drawNodes(ctx, timestamp) {
        for (const [id, node] of this.loader.nodes) {
            const pos = this._nodePositions.get(id);
            if (!pos) continue;
            this._drawSingleNode(ctx, node, pos, this.hoverNode === id, this.debugMode && node.isOrphan, this.debugMode && node.inCycle, this.debugMode && node.hasBrokenPointer);
        }
    }

    _drawSingleNode(ctx, node, pos, isHovered, isOrphan, isCycle, isBroken) {
        const r = this.NODE_RADIUS;
        const colors = this.COLOR_MAP[node.color] || this.COLOR_MAP.gray;
        ctx.save();
        if (isHovered) { ctx.translate(pos.x, pos.y); ctx.scale(1.15, 1.15); ctx.translate(-pos.x, -pos.y); }
        if (isOrphan) ctx.globalAlpha = 0.4;
        if (isHovered || isCycle || isBroken) {
            const gc = isCycle || isBroken ? '#e74c3c' : colors.glow;
            const ps = isCycle || isBroken ? r + 8 + Math.sin(this.pulsePhase * 3) * 4 : r + 6;
            ctx.beginPath(); ctx.arc(pos.x, pos.y, ps, 0, Math.PI * 2); ctx.fillStyle = gc; ctx.globalAlpha = isOrphan ? 0.15 : 0.25; ctx.fill(); ctx.globalAlpha = isOrphan ? 0.4 : 1.0;
        }
        ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 8; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3;
        const grad = ctx.createRadialGradient(pos.x - r * 0.3, pos.y - r * 0.3, r * 0.1, pos.x, pos.y, r);
        grad.addColorStop(0, colors.glow); grad.addColorStop(1, colors.fill);
        ctx.beginPath(); ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2); ctx.fillStyle = grad; ctx.fill();
        ctx.shadowColor = 'transparent'; ctx.strokeStyle = isOrphan ? '#95a5a6' : (isCycle || isBroken ? '#e74c3c' : colors.stroke); ctx.lineWidth = isHovered ? 3 : 2;
        if (isCycle) ctx.setLineDash([6, 3]);
        ctx.stroke(); ctx.setLineDash([]);
        // Shine
        ctx.beginPath(); ctx.arc(pos.x - r * 0.25, pos.y - r * 0.3, r * 0.35, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
        // ID
        ctx.fillStyle = '#2d3436'; ctx.font = `bold ${r * 0.65}px "Fredoka", "Comic Sans MS", cursive`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(node.id), pos.x, pos.y);
        // Name
        ctx.fillStyle = isOrphan ? '#95a5a6' : '#2d3436'; ctx.font = `${Math.max(9, r * 0.35)}px "Fredoka", "Comic Sans MS", cursive`; ctx.textBaseline = 'top';
        ctx.fillText(node.name, pos.x, pos.y + r + 4, 100);
        // Debug badges
        if (isOrphan) { ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = '#e67e22'; ctx.textBaseline = 'middle'; ctx.fillText('⚠️', pos.x + r + 2, pos.y - r + 2); }
        if (isCycle) { ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = '#e74c3c'; ctx.textBaseline = 'middle'; ctx.fillText('🔄', pos.x + r + 2, pos.y); }
        ctx.restore();
    }

    _drawHeadMarker(ctx) {
        const headPos = this._nodePositions.get(this.loader.head);
        if (!headPos) return;
        const x = headPos.x, y = headPos.y - this.NODE_RADIUS - 28;
        const bounce = Math.sin(this.pulsePhase * 2) * 3;
        ctx.save();
        ctx.fillStyle = '#e74c3c'; ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.moveTo(x, y + 16 + bounce); ctx.lineTo(x - 8, y + 6 + bounce); ctx.lineTo(x + 8, y + 6 + bounce); ctx.closePath(); ctx.fill();
        ctx.font = 'bold 14px "Fredoka", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText('HEAD', x, y + 4 + bounce);
        ctx.restore();
    }

    _drawPlayerTokens(ctx) {
        let idx = 0;
        for (const [playerId, nodeId] of Object.entries(this.playerPositions)) {
            const pos = this._nodePositions.get(nodeId);
            if (!pos) continue;
            const color = this.playerColors[idx % this.playerColors.length];
            const offset = (idx - Object.keys(this.playerPositions).length / 2) * 14;
            const tx = pos.x + offset, ty = pos.y - this.NODE_RADIUS - 8;
            ctx.save();
            ctx.fillStyle = color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(tx, ty, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(String(parseInt(playerId) + 1), tx, ty);
            ctx.restore();
            idx++;
        }
    }

    _drawTooltip(ctx) {
        const node = this.loader.nodes.get(this.hoverNode);
        if (!node) return;
        const pos = this._nodePositions.get(this.hoverNode);
        if (!pos) return;
        const lines = [`ID: ${node.id}`, `Name: ${node.name}`, `Color: ${node.color}`, `Zone: ${node.zone || 'none'}`, `Next: ${node.next.length === 0 ? 'NULL' : node.next.join(', ')}`];
        if (this.debugMode) {
            if (node.isOrphan) lines.push('⚠ ORPHAN — unreachable from HEAD');
            if (node.inCycle) lines.push('CYCLE detected');
            if (node.hasBrokenPointer) lines.push(`Broken ptr: ${node.brokenPointers.join(', ')}`);
        }
        const pad = 10, lh = 18, tw = 220, th = lines.length * lh + pad * 2;
        let tipX = pos.x + this.NODE_RADIUS + 15, tipY = pos.y - th / 2;
        if (tipX + tw > this.canvas.width) tipX = pos.x - this.NODE_RADIUS - 15 - tw;
        if (tipY < 5) tipY = 5;
        if (tipY + th > this.canvas.height - 5) tipY = this.canvas.height - 5 - th;
        ctx.save();
        ctx.fillStyle = 'rgba(45, 52, 54, 0.92)'; ctx.beginPath(); this._roundRect(ctx, tipX, tipY, tw, th, 8); ctx.fill();
        ctx.fillStyle = '#dfe6e9'; ctx.font = '13px "Fredoka", monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        lines.forEach((line, i) => ctx.fillText(line, tipX + pad, tipY + pad + i * lh));
        ctx.restore();
    }

    _roundRect(ctx, x, y, w, h, r) {
        ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
    }

    _onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this._mouseX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        this._mouseY = (e.clientY - rect.top) * (this.canvas.height / rect.height);
        this.hoverNode = null;
        for (const [id, pos] of this._nodePositions) {
            const dx = this._mouseX - pos.x, dy = this._mouseY - pos.y;
            if (dx * dx + dy * dy <= this.NODE_RADIUS * this.NODE_RADIUS * 1.3) { this.hoverNode = id; this.canvas.style.cursor = 'pointer'; return; }
        }
        this.canvas.style.cursor = 'default';
    }

    _onClick(e) {
        if (this.hoverNode !== null) {
            this.selectedNode = this.hoverNode;
            this.canvas.dispatchEvent(new CustomEvent('nodeclick', { detail: { nodeId: this.hoverNode } }));
        }
    }

    _startAnimation() {
        const loop = (ts) => { if (!this._animating) return; this.render(ts); requestAnimationFrame(loop); };
        requestAnimationFrame(loop);
    }

    destroy() { this._animating = false; }
    invalidateLayout() { this._nodePositions.clear(); }
    getNodePosition(nodeId) { return this._nodePositions.get(nodeId) || null; }
}
