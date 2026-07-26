/**
 * debug-overlay.js
 * Provides a debug/error panel for student boards.
 */

class DebugOverlay {
    constructor(loader, panelElement) {
        this.loader = loader;
        this.panel = panelElement;
    }

    /**
     * Refresh the debug panel with current errors and warnings.
     */
    refresh() {
        if (!this.panel) return;
        const errors = this.loader.errors;
        const warnings = this.loader.warnings;

        if (errors.length === 0 && warnings.length === 0) {
            this.panel.innerHTML = `
                <div class="debug-success">
                    <span class="debug-icon">✅</span>
                    <h3>All Clear!</h3>
                    <p>Your linked list looks correct. No orphan nodes, broken pointers, or cycles detected.</p>
                </div>`;
            return;
        }

        let html = '';

        if (errors.length > 0) {
            html += '<div class="debug-section debug-errors">';
            html += `<h3><span class="debug-icon">❌</span> Errors (${errors.length})</h3>`;
            html += '<ul>';
            for (const err of errors) {
                html += `<li>${this._escapeHtml(err)}</li>`;
            }
            html += '</ul></div>';
        }

        if (warnings.length > 0) {
            html += '<div class="debug-section debug-warnings">';
            html += `<h3><span class="debug-icon">⚠️</span> Warnings (${warnings.length})</h3>`;
            html += '<ul>';
            for (const warn of warnings) {
                html += `<li>${this._escapeHtml(warn)}</li>`;
            }
            html += '</ul></div>';
        }

        // Add educational tips
        html += '<div class="debug-section debug-tips">';
        html += '<h3><span class="debug-icon">💡</span> Understanding These Errors</h3>';
        html += '<ul>';

        const hasOrphans = warnings.some(w => w.includes('ORPHAN'));
        const hasBroken = errors.some(e => e.includes('NEXT pointer'));
        const hasCycles = errors.some(e => e.includes('Cycle'));

        if (hasOrphans) {
            html += '<li><strong>Orphan Nodes</strong> are like malloc\'d memory that nothing points to — a <em>memory leak</em>. Make sure every node is reachable by following NEXT pointers from HEAD.</li>';
        }
        if (hasBroken) {
            html += '<li><strong>Broken Pointers</strong> are like dangling pointers in C++ — your node\'s <code>next</code> field points to a node ID that doesn\'t exist. Check your node IDs.</li>';
        }
        if (hasCycles) {
            html += '<li><strong>Cycles</strong> mean following NEXT pointers goes in circles forever — you\'ll never reach NULL. This is an <em>infinite loop</em>. Check which node incorrectly points back.</li>';
        }

        html += '</ul></div>';

        this.panel.innerHTML = html;
    }

    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}
