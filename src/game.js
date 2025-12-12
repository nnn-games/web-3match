class Block {
    constructor(val, r, c) {
        this.val = val;
        this.r = r; // Logical Row
        this.c = c; // Logical Col

        // Visual Properties
        this.x = 0;
        this.y = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.scale = 1;
        this.isMatch = false;

        // Physics Properties
        this.vy = 0;
        this.isFalling = false;

        // ID for uniqueness (optional)
        this.id = Math.random().toString(36).substr(2, 9);
    }
}

class Grid {
    constructor(rows, cols) {
        this.rows = rows;
        this.cols = cols;
        this.cells = [];
    }

    init() {
        // Initialize with random numbers 1-5
        for (let r = 0; r < this.rows; r++) {
            this.cells[r] = [];
            for (let c = 0; c < this.cols; c++) {
                this.cells[r][c] = this.createBlock(r, c);
            }
        }
        // Prevent initial matches
        this.preventInitialMatches();
    }

    createBlock(r, c) {
        const val = this.getRandomValue();
        return new Block(val, r, c);
    }

    getRandomValue() {
        return Math.floor(Math.random() * 5) + 1;
    }

    preventInitialMatches() {
        let hasMatch = true;
        while (hasMatch) {
            hasMatch = false;
            const matches = this.findMatches();
            if (matches.length > 0) {
                hasMatch = true;
                matches.forEach(m => {
                    this.cells[m.r][m.c].val = this.getRandomValue();
                });
            }
        }
    }


    swap(cell1, cell2) {
        const b1 = this.cells[cell1.r][cell1.c];
        const b2 = this.cells[cell2.r][cell2.c];

        // Swap in array
        this.cells[cell1.r][cell1.c] = b2;
        this.cells[cell2.r][cell2.c] = b1;

        // Update logical coordinates
        b1.r = cell2.r;
        b1.c = cell2.c;
        b2.r = cell1.r;
        b2.c = cell1.c;
    }

    findMatches() {
        let matchedSet = new Set();
        // Horizontal
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols - 2; c++) {
                const b1 = this.cells[r][c];
                const b2 = this.cells[r][c + 1];
                const b3 = this.cells[r][c + 2];
                if (!b1 || !b2 || !b3) continue; // Skip empty/null

                if (b1.val === b2.val && b2.val === b3.val) {
                    matchedSet.add(b1);
                    matchedSet.add(b2);
                    matchedSet.add(b3);
                    let k = c + 3;
                    while (k < this.cols) {
                        const next = this.cells[r][k];
                        if (next && next.val === b1.val) {
                            matchedSet.add(next);
                            k++;
                        } else break;
                    }
                }
            }
        }
        // Vertical
        for (let c = 0; c < this.cols; c++) {
            for (let r = 0; r < this.rows - 2; r++) {
                const b1 = this.cells[r][c];
                const b2 = this.cells[r + 1][c];
                const b3 = this.cells[r + 2][c];
                if (!b1 || !b2 || !b3) continue;

                if (b1.val === b2.val && b2.val === b3.val) {
                    matchedSet.add(b1);
                    matchedSet.add(b2);
                    matchedSet.add(b3);
                    let k = r + 3;
                    while (k < this.rows) {
                        const next = this.cells[k][c];
                        if (next && next.val === b1.val) {
                            matchedSet.add(next);
                            k++;
                        } else break;
                    }
                }
            }
        }

        return Array.from(matchedSet).map(b => ({ r: b.r, c: b.c }));
    }

    removeMatches(matches) {
        matches.forEach(m => {
            const block = this.cells[m.r][m.c];
            if (block) block.isMatch = true;
        });
    }

    // Actually delete the blocks that were marked matched
    clearMatchedBlocks() {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.cells[r][c] && this.cells[r][c].isMatch) {
                    this.cells[r][c] = null;
                }
            }
        }
    }

    applyGravity() {
        let moved = false;
        // 1. Drop existing items
        for (let c = 0; c < this.cols; c++) {
            for (let r = this.rows - 1; r >= 0; r--) {
                if (this.cells[r][c] === null) {
                    // Search up
                    let nr = r - 1;
                    while (nr >= 0 && this.cells[nr][c] === null) nr--;

                    if (nr >= 0) {
                        // Move down
                        this.cells[r][c] = this.cells[nr][c];
                        this.cells[nr][c] = null;
                        this.cells[r][c].r = r; // Update logic row
                        // Visual x/y remains at nr pos, will target r pos
                        this.cells[r][c].isFalling = true;
                        this.cells[r][c].vy = 0;
                        moved = true;
                    }
                }
            }
        }
        // 2. Spawn new items
        for (let c = 0; c < this.cols; c++) {
            let spawnCount = 0;
            for (let r = this.rows - 1; r >= 0; r--) {
                if (this.cells[r][c] === null) {
                    const block = this.createBlock(r, c);
                    this.cells[r][c] = block;
                    // Spawn above screen
                    block.visualR = -1 - spawnCount; // Meta property for spawn pos
                    block.isFalling = true;
                    block.vy = 0;
                    spawnCount++;
                    moved = true;
                }
            }
        }
        return moved;
    }
}

class Game {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.lastTime = 0;

        // Config
        this.gridSize = 8;
        this.cellSize = 0;
        this.padding = 10;

        this.grid = new Grid(this.gridSize, this.gridSize);
        this.grid.init();

        // States
        this.state = 'IDLE'; // IDLE, SWAPPED, MATCHING, REFILLING, REVERTING
        this.selectedCell = null;
        this.score = 0;
        this.scoreElement = document.getElementById('score');

        // Animation Queue/State
        this.animating = false;

        this.colors = {
            1: '#e74c3c', 2: '#2ecc71', 3: '#3498db', 4: '#f1c40f', 5: '#9b59b6'
        };

        this.setupInput();
        document.getElementById('reset-btn').addEventListener('click', () => this.resetGame());

        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.canvas.parentElement);
        this.resize();

        requestAnimationFrame(this.gameLoop.bind(this));
    }

    resize() {
        const container = this.canvas.parentElement;
        const size = Math.min(container.clientWidth, container.clientHeight);
        this.canvas.width = size;
        this.canvas.height = size;
        this.cellSize = (this.canvas.width - (this.padding * 2)) / this.gridSize;

        // Initialize visual positions for all blocks
        this.grid.cells.forEach(row => {
            row.forEach(block => {
                if (block) {
                    const target = this.getPixelPos(block.r, block.c);
                    block.x = target.x;
                    block.y = target.y;
                    block.scale = 1;
                }
            });
        });
    }

    getPixelPos(r, c) {
        return {
            x: this.padding + c * this.cellSize,
            y: this.padding + r * this.cellSize
        };
    }

    update(deltaTime) {
        let anythingMoving = false;

        // Update all blocks visual state
        for (let r = 0; r < this.grid.rows; r++) {
            for (let c = 0; c < this.grid.cols; c++) {
                const block = this.grid.cells[r][c];
                if (!block) continue;

                const target = this.getPixelPos(r, c);

                // Handle spawn spawning above
                if (block.visualR !== undefined) {
                    block.y = this.getPixelPos(block.visualR, c).y;
                    delete block.visualR;
                }

                // Lerp Pos or Gravity
                const dist = Math.sqrt(Math.pow(target.x - block.x, 2) + Math.pow(target.y - block.y, 2));
                const gravity = 2; // px/frame^2

                if (block.isFalling) {
                    // Update target X immediately to keep alignment during fall
                    block.x = target.x;

                    block.vy += gravity;
                    block.y += block.vy;

                    if (block.y >= target.y) {
                        block.y = target.y;
                        block.vy = 0;
                        block.isFalling = false;
                        // Small bounce could go here
                    } else {
                        anythingMoving = true;
                    }
                } else {
                    // Standard slide (Lerp)
                    const speed = 0.2; // 0.1 to 0.3 for smoothness
                    if (dist > 1) {
                        block.x += (target.x - block.x) * speed;
                        block.y += (target.y - block.y) * speed;
                        anythingMoving = true;
                    } else {
                        block.x = target.x;
                        block.y = target.y;
                    }
                }

                // Lerp Scale (for removal)
                if (block.isMatch) {
                    block.scale -= 0.1;
                    if (block.scale <= 0) {
                        block.scale = 0;
                    } else {
                        anythingMoving = true;
                    }
                }
            }
        }

        this.animating = anythingMoving;

        // State Machine Logic
        if (!this.animating) {
            if (this.state === 'SWAPPED') {
                this.checkPostSwap();
            } else if (this.state === 'REFILLING') {
                this.checkMatches();
            } else if (this.state === 'MATCHING') {
                this.handlePostMatch();
            } else if (this.state === 'REVERTING') {
                this.state = 'IDLE';
            }
        }
    }

    trySwap(cell1, cell2) {
        if (this.state !== 'IDLE') return;

        this.swapPair = { c1: cell1, c2: cell2 };
        this.grid.swap(cell1, cell2);
        this.state = 'SWAPPED';
        // Animation starts automatically next frame due to varied r,c
    }

    checkPostSwap() {
        const matches = this.grid.findMatches();
        if (matches.length > 0) {
            this.processMatches(matches);
        } else {
            // Invalid, revert
            this.grid.swap(this.swapPair.c1, this.swapPair.c2);
            this.state = 'REVERTING';
        }
    }

    checkMatches() {
        const matches = this.grid.findMatches();
        if (matches.length > 0) {
            this.processMatches(matches);
        } else {
            this.state = 'IDLE';
        }
    }

    processMatches(matches) {
        this.grid.removeMatches(matches);

        // Score
        this.score += matches.length * 10;
        this.scoreElement.textContent = `Score: ${this.score}`;

        this.state = 'MATCHING';
    }

    handlePostMatch() {
        // Items have shrunk, now actually remove them
        this.grid.clearMatchedBlocks();
        this.grid.applyGravity();
        this.state = 'REFILLING';
    }

    render() {
        this.ctx.fillStyle = '#34495e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw debug grid lines (optional, maybe distinct color)
        this.ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        this.ctx.lineWidth = 1;
        for (let i = 0; i <= this.gridSize; i++) {
            const p = this.padding + i * this.cellSize;
            this.ctx.beginPath(); this.ctx.moveTo(p, this.padding); this.ctx.lineTo(p, this.canvas.height - this.padding); this.ctx.stroke();
            this.ctx.beginPath(); this.ctx.moveTo(this.padding, p); this.ctx.lineTo(this.canvas.width - this.padding, p); this.ctx.stroke();
        }

        // Render Blocks
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                const block = this.grid.cells[r][c];
                if (block) {
                    this.drawBlock(block);
                }
            }
        }

        // Render Selection
        if (this.selectedCell) {
            const x = this.padding + this.selectedCell.c * this.cellSize;
            const y = this.padding + this.selectedCell.r * this.cellSize;
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(x, y, this.cellSize, this.cellSize);
        }
    }

    drawBlock(block) {
        const cx = block.x + this.cellSize / 2;
        const cy = block.y + this.cellSize / 2;
        const radius = (this.cellSize / 2) * 0.8 * block.scale;

        if (radius <= 0) return;

        this.ctx.beginPath();
        this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        this.ctx.fillStyle = this.colors[block.val];
        this.ctx.fill();
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        this.ctx.fillStyle = '#fff';
        this.ctx.font = `bold ${radius}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(block.val, cx, cy);
    }

    // --- Input Handling Copied and Adapted ---
    setupInput() {
        const start = (e) => this.handleInputStart(e);
        const move = (e) => this.handleInputMove(e);
        const end = (e) => this.handleInputEnd(e);
        this.canvas.addEventListener('mousedown', start);
        this.canvas.addEventListener('mousemove', move);
        window.addEventListener('mouseup', end);
        this.canvas.addEventListener('touchstart', start, { passive: false });
        this.canvas.addEventListener('touchmove', move, { passive: false });
        window.addEventListener('touchend', end);
    }
    // ... Input methods need to check state ...
    getEventPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        let x, y;
        if (e.touches && e.touches.length > 0) { x = e.touches[0].clientX; y = e.touches[0].clientY; }
        else { x = e.clientX; y = e.clientY; }
        return { x: x - rect.left, y: y - rect.top };
    }
    getCellFromPos(pos) {
        const x = pos.x - this.padding;
        const y = pos.y - this.padding;
        if (x < 0 || y < 0) return null;
        const c = Math.floor(x / this.cellSize);
        const r = Math.floor(y / this.cellSize);
        if (r >= 0 && r < this.gridSize && c >= 0 && c < this.gridSize) return { r, c };
        return null;
    }
    handleInputStart(e) {
        if (this.state !== 'IDLE') return;
        e.preventDefault();
        const pos = this.getEventPos(e);
        const cell = this.getCellFromPos(pos);
        if (cell) {
            this.isDragging = true;
            this.startPos = pos;
            if (!this.selectedCell) {
                this.selectedCell = cell;
            } else {
                if (this.isNeighbor(this.selectedCell, cell)) {
                    this.trySwap(this.selectedCell, cell);
                    this.selectedCell = null;
                    this.isDragging = false;
                    return;
                }
                if (this.selectedCell.r === cell.r && this.selectedCell.c === cell.c) {
                    this.selectedCell = null;
                    this.isDragging = false;
                    return;
                }
                this.selectedCell = cell;
            }
        }
    }
    handleInputMove(e) {
        if (!this.isDragging || !this.selectedCell || this.state !== 'IDLE') return;
        e.preventDefault();
        const pos = this.getEventPos(e);
        const dx = pos.x - this.startPos.x;
        const dy = pos.y - this.startPos.y;
        if (Math.abs(dx) > this.cellSize / 2 || Math.abs(dy) > this.cellSize / 2) {
            let targetR = this.selectedCell.r;
            let targetC = this.selectedCell.c;
            if (Math.abs(dx) > Math.abs(dy)) { targetC += dx > 0 ? 1 : -1; }
            else { targetR += dy > 0 ? 1 : -1; }
            const targetCell = { r: targetR, c: targetC };
            if (this.isValidCell(targetCell) && this.isNeighbor(this.selectedCell, targetCell)) {
                this.trySwap(this.selectedCell, targetCell);
                this.selectedCell = null;
                this.isDragging = false;
            }
        }
    }
    handleInputEnd() { this.isDragging = false; }
    isValidCell(cell) { return cell.r >= 0 && cell.r < this.gridSize && cell.c >= 0 && cell.c < this.gridSize; }
    isNeighbor(c1, c2) {
        const dr = Math.abs(c1.r - c2.r);
        const dc = Math.abs(c1.c - c2.c);
        return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
    }
    resetGame() {
        if (this.state !== 'IDLE') return;
        this.score = 0;
        this.scoreElement.textContent = `Score: 0`;
        this.grid = new Grid(this.gridSize, this.gridSize);
        this.grid.init();
        this.resize(); // Reset visual positions
        this.selectedCell = null;
    }
    gameLoop(timestamp) {
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;
        this.update(deltaTime);
        this.render();
        requestAnimationFrame(this.gameLoop.bind(this));
    }
}

// Start
window.addEventListener('DOMContentLoaded', () => { new Game('gameCanvas'); });
