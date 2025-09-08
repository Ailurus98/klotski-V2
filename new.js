// Klotski Sliding Puzzle Solution Space Viewer with Drag Functionality

// --- Core Game and UI State ---

let gameState = {
    board: {
        width: 4,
        height: 5,
        pieces: []
    },
    selectedPiece: null,
    moveCount: 0,
    gameWon: false,
    targetPieceId: null // The character ID of the piece that needs to reach the exit
};

let dragState = {
    isDragging: false,
    piece: null,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
    originalX: 0,
    originalY: 0
};

let viewer = {
    canvas: null,
    ctx: null,
    camera: { x: 0, y: 0, z: 8, rotX: 0.2, rotY: 0 },
    nodes: [],
    edges: [],
    settings: {
        colorMode: 0,
        showSolutions: false,
        showPath: false
    }
};

let keys = {};
let mouse = { x: 0, y: 0, down: false, rightDown: false };

// The representation for the classic Klotski starting position.
const CLASSIC_REPRESENTATION = "aTTbaTTb.cc.dghedfie";

// --- Initialization ---

function init() {
    setupGameCanvas();
    setupViewer();
    setupControls();
    generateSolutionSpace(); // Generate space first
    resetGame(); // Then set the initial state
    updateDisplay();
    startGameLoop();
}

document.addEventListener('DOMContentLoaded', init);

// --- Game State Management ---

/**
 * Reconstructs the board state from a compact string representation.
 * This function parses a string where each character represents a part of a piece
 * on a grid and converts it into a structured array of piece objects.
 *
 * @param {string} representationString The string representing the board state (e.g., "aTTbaTTb.cc.dghedfie").
 */
function setGameStateFromString(representationString) {
    gameState.board.pieces = [];
    const grid = [];
    let charIndex = 0;

    // 1. Chunk the string into a 2D grid
    for (let y = 0; y < gameState.board.height; y++) {
        const row = representationString.substring(charIndex, charIndex + gameState.board.width);
        grid.push(row.split(''));
        charIndex += gameState.board.width;
    }

    const processedChars = new Set();
    const pieceData = {};

    // 2. Identify all pieces and their dimensions
    for (let y = 0; y < gameState.board.height; y++) {
        for (let x = 0; x < gameState.board.width; x++) {
            const char = grid[y][x];
            if (char === '.' || processedChars.has(char)) {
                continue;
            }

            let pieceWidth = 0;
            let pieceHeight = 0;

            // Determine width
            for (let i = x; i < gameState.board.width && grid[y][i] === char; i++) {
                pieceWidth++;
            }
            // Determine height
            for (let j = y; j < gameState.board.height && grid[j][x] === char; j++) {
                pieceHeight++;
            }

            pieceData[char] = { x, y, width: pieceWidth, height: pieceHeight };
            processedChars.add(char);
        }
    }

    // 3. Create piece objects with stable styling
    for (const char in pieceData) {
        const data = pieceData[char];
        const isTarget = data.width === 2 && data.height === 2;
        
        if (isTarget) {
            gameState.targetPieceId = char;
        }

        gameState.board.pieces.push({
            id: char,
            x: data.x,
            y: data.y,
            width: data.width,
            height: data.height,
            color: isTarget ? '#ff4444' : generateColorFromChar(char),
            name: isTarget ? 'Target' : `Piece ${char}`
        });
    }
}

/**
 * Generates a consistent color based on a character ID.
 * @param {string} char The character ID of the piece.
 * @returns {string} A CSS color string.
 */
function generateColorFromChar(char) {
    const hue = (char.charCodeAt(0) * 47) % 360;
    const saturation = 70 + (char.charCodeAt(0) % 20);
    const lightness = 50 + (char.charCodeAt(0) % 10);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Converts the current game state object back into its string representation.
 * @returns {string} The compact string for the current board layout.
 */
function gameStateToString() {
    const grid = Array(gameState.board.height).fill(null).map(() => Array(gameState.board.width).fill('.'));

    for (const piece of gameState.board.pieces) {
        for (let y = 0; y < piece.height; y++) {
            for (let x = 0; x < piece.width; x++) {
                grid[piece.y + y][piece.x + x] = piece.id;
            }
        }
    }

    return grid.map(row => row.join('')).join('');
}

function resetGame() {
    setGameStateFromString(CLASSIC_REPRESENTATION);
    gameState.selectedPiece = null;
    gameState.moveCount = 0;
    gameState.gameWon = false;
    dragState.isDragging = false;
    dragState.piece = null;
    
    updateCurrentGameState();
    updateDisplay();
}

function checkWinCondition() {
    const targetPiece = gameState.board.pieces.find(p => p.id === gameState.targetPieceId);
    if (targetPiece && targetPiece.x === 1 && targetPiece.y === 3) {
        gameState.gameWon = true;
    } else {
        gameState.gameWon = false;
    }
}

// --- Setup Functions (UI, Controls, etc.) ---

function setupGameCanvas() {
    const canvas = document.getElementById('gameCanvas');
    canvas.width = 400;
    canvas.height = 500;
    canvas.addEventListener('mousedown', handleGameMouseDown);
    canvas.addEventListener('mousemove', handleGameMouseMove);
    canvas.addEventListener('mouseup', handleGameMouseUp);
    canvas.addEventListener('mouseleave', handleGameMouseUp);
}

function setupViewer() {
    viewer.canvas = document.getElementById('graphCanvas');
    viewer.ctx = viewer.canvas.getContext('2d');
    resizeViewer();
    window.addEventListener('resize', resizeViewer);
    viewer.canvas.addEventListener('mousedown', handleMouseDown);
    viewer.canvas.addEventListener('mousemove', handleMouseMove);
    viewer.canvas.addEventListener('mouseup', handleMouseUp);
    viewer.canvas.addEventListener('contextmenu', e => e.preventDefault());
    viewer.canvas.addEventListener('wheel', handleWheel);
    viewer.canvas.addEventListener('click', handleViewerClick);
}

function resizeViewer() {
    const container = viewer.canvas.parentElement;
    viewer.canvas.width = container.clientWidth;
    viewer.canvas.height = container.clientHeight;
}

function setupControls() {
    document.getElementById('colorMode').addEventListener('change', (e) => viewer.settings.colorMode = parseInt(e.target.value));
    
    document.getElementById('solutionsMode').addEventListener('change', (e) => {
        viewer.settings.showSolutions = e.target.value === '1';
        updateCurrentGameState(); // Refresh to update display
    });
    
    document.getElementById('pathMode').addEventListener('change', (e) => {
        viewer.settings.showPath = e.target.value === '1';
        updateCurrentGameState(); // Refresh optimal path calculation
    });
    
    document.getElementById('resetGameBtn').addEventListener('click', resetGame);
    document.getElementById('resetCameraBtn').addEventListener('click', resetCamera);
    document.getElementById('togglePanelBtn').addEventListener('click', togglePanel);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
}

function togglePanel() {
    const panel = document.getElementById('control-panel');
    panel.classList.toggle('minimized');
    document.getElementById('togglePanelBtn').textContent = panel.classList.contains('minimized') ? '+' : '−';
}

function resetCamera() {
    viewer.camera = { x: 0, y: 0, z: 8, rotX: 0.2, rotY: 0 };
}

// --- Game Canvas Drag-and-Drop Handlers ---

function handleGameMouseDown(e) {
    if (gameState.gameWon) return;
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const clickedPieceId = getPieceFromClick(x, y, e.target.width, e.target.height);

    if (clickedPieceId !== null) {
        const piece = gameState.board.pieces.find(p => p.id === clickedPieceId);
        if (piece) {
            dragState.isDragging = true;
            dragState.piece = piece;
            dragState.startX = x;
            dragState.startY = y;
            dragState.originalX = piece.x;
            dragState.originalY = piece.y;
            gameState.selectedPiece = clickedPieceId;
            e.target.style.cursor = 'grabbing';
        }
    }
    updateDisplay();
}

function handleGameMouseMove(e) {
    if (!dragState.isDragging || !dragState.piece) return;
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const cellSize = Math.min(e.target.width / gameState.board.width, e.target.height / gameState.board.height);
    const offsetX = (e.target.width - cellSize * gameState.board.width) / 2;
    const offsetY = (e.target.height - cellSize * gameState.board.height) / 2;

    const targetGridX = Math.round((x - offsetX - (dragState.piece.width * cellSize / 2)) / cellSize);
    const targetGridY = Math.round((y - offsetY - (dragState.piece.height * cellSize / 2)) / cellSize);

    if (isValidDragMove(dragState.piece, targetGridX, targetGridY)) {
        dragState.piece.x = targetGridX;
        dragState.piece.y = targetGridY;
        updateDisplay();
    }
}

function handleGameMouseUp(e) {
    if (!dragState.isDragging || !dragState.piece) return;
    const piece = dragState.piece;

    if (piece.x !== dragState.originalX || piece.y !== dragState.originalY) {
        gameState.moveCount++;
        checkWinCondition();
        updateCurrentGameState();
    }

    dragState.isDragging = false;
    dragState.piece = null;
    gameState.selectedPiece = null;
    e.target.style.cursor = 'default';
    updateDisplay();
}

function isValidDragMove(piece, newX, newY) {
    const dx = Math.abs(newX - dragState.originalX);
    const dy = Math.abs(newY - dragState.originalY);
    if ((dx > 0 && dy > 0) || (dx > 2 || dy > 2)) return false;
    return canPlacePiece(piece, newX, newY);
}

function getPieceFromClick(x, y, canvasWidth, canvasHeight) {
    const cellSize = Math.min(canvasWidth / gameState.board.width, canvasHeight / gameState.board.height);
    const offsetX = (canvasWidth - cellSize * gameState.board.width) / 2;
    const offsetY = (canvasHeight - cellSize * gameState.board.height) / 2;
    const gridX = Math.floor((x - offsetX) / cellSize);
    const gridY = Math.floor((y - offsetY) / cellSize);

    for (let piece of gameState.board.pieces) {
        if (gridX >= piece.x && gridX < piece.x + piece.width && gridY >= piece.y && gridY < piece.y + piece.height) {
            return piece.id;
        }
    }
    return null;
}

function canPlacePiece(piece, x, y) {
    if (x < 0 || y < 0 || x + piece.width > gameState.board.width || y + piece.height > gameState.board.height) {
        return false;
    }
    for (let other of gameState.board.pieces) {
        if (other.id === piece.id) continue;
        if (!(x + piece.width <= other.x || x >= other.x + other.width || y + piece.height <= other.y || y >= other.y + other.height)) {
            return false;
        }
    }
    return true;
}

// --- 3D Viewer Logic and Solution Space ---

function generateSolutionSpace() {
    if (typeof nodes_to_use === 'undefined') {
        console.error("Data object `nodes_to_use` is not defined. Ensure the data file is loaded before this script.");
        return;
    }

    viewer.nodes = [];
    viewer.edges = [];
    const states = nodes_to_use;
    const stateKeys = Object.keys(states);
    const keyToIndex = new Map(stateKeys.map((key, index) => [key, index]));

    stateKeys.forEach((key, index) => {
        const data = states[key];
        viewer.nodes.push({
            id: key,
            x: data.x,
            y: data.y,
            z: data.z,
            representation: data.representation,
            depth: data.dist,
            difficulty: data.dist,
            isOptimal: false, 
            isSolution: data.solution_dist === 0,
            isCurrent: false,
            moveCount: data.solution_dist
        });

        if (data.neighbors && Array.isArray(data.neighbors)) {
            data.neighbors.forEach(neighborKey => {
                if (keyToIndex.has(neighborKey)) {
                    viewer.edges.push({ from: index, to: keyToIndex.get(neighborKey) });
                }
            });
        }
    });
    
    updateCurrentGameState();
}

function updateOptimalPath() {
    // Reset all optimal flags
    viewer.nodes.forEach(node => node.isOptimal = false);
    
    if (!viewer.settings.showPath) return;
    
    const currentStateString = gameStateToString();
    const currentNode = viewer.nodes.find(node => node.representation === currentStateString);
    
    if (!currentNode) return;
    
    // Mark optimal path nodes
    let curr = currentNode;
    while (curr && curr.moveCount > 0) {
        curr.isOptimal = true;
        let next = null;
        for (let neighbor of viewer.edges.filter(e => e.from === viewer.nodes.indexOf(curr))) {
            let neighborNode = viewer.nodes[neighbor.to];
            if (neighborNode && neighborNode.moveCount < curr.moveCount) {
                next = neighborNode;
                break;
            }
        }
        if (!next) break;
        curr = next;
    }
    if (curr) curr.isOptimal = true;
}

function updateCurrentGameState() {
    if (!viewer.nodes || viewer.nodes.length === 0) return;
    
    viewer.nodes.forEach(node => node.isCurrent = false);
    
    const currentStateString = gameStateToString();
    const matchingNode = viewer.nodes.find(node => node.representation === currentStateString);
    
    if (matchingNode) {
        matchingNode.isCurrent = true;
    }
    
    updateOptimalPath();
}

function handleViewerClick(e) {
    const rect = viewer.canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const projected = viewer.nodes.map(node => project3D(node, viewer.canvas));

    const sortedIndices = viewer.nodes.map((_, i) => i)
        .sort((a, b) => (projected[b]?.z || 0) - (projected[a]?.z || 0));
    
    for (const i of sortedIndices.reverse()) { // Iterate from front to back
        const node = viewer.nodes[i];
        const p = projected[i];
        if (!p) continue;

        const radius = node.isSolution ? 10 : (node.isCurrent ? 8 : (node.isOptimal ? 6 : 4));
        const distance = Math.sqrt((clickX - p.x) ** 2 + (clickY - p.y) ** 2);

        if (distance <= radius) {
            // A node was clicked, update the game state
            setGameStateFromString(node.representation);
            gameState.moveCount = node.depth;
            
            viewer.nodes.forEach(n => n.isCurrent = false);
            node.isCurrent = true;
            
            checkWinCondition();
            updateDisplay();
            return;
        }
    }
}

// --- Auto-solve Function ---

function executeAutoSolve() {
    const currentStateString = gameStateToString();
    const currentNode = viewer.nodes.find(node => node.representation === currentStateString);
    
    if (!currentNode) return;
    
    let path = [];
    let curr = currentNode;
    
    // Build path to solution
    while (curr && curr.moveCount > 0) {
        path.push(curr);
        let next = null;
        for (let neighbor of viewer.edges.filter(e => e.from === viewer.nodes.indexOf(curr))) {
            let neighborNode = viewer.nodes[neighbor.to];
            if (neighborNode && neighborNode.moveCount < curr.moveCount) {
                next = neighborNode;
                break;
            }
        }
        if (!next) break;
        curr = next;
    }
    if (curr) path.push(curr); // Add solution node
    
    let i = 0;
    function step() {
        if (i >= path.length) return;
        setGameStateFromString(path[i].representation);
        gameState.moveCount = path[i].depth;
        checkWinCondition();
        updateCurrentGameState();
        updateDisplay();
        i++;
        setTimeout(step, 500);
    }
    step();
}

// --- Main Drawing and Game Loop ---

function updateDisplay() {
    const gameCanvas = document.getElementById('gameCanvas');
    if (gameCanvas) {
        drawGame(gameCanvas.getContext('2d'), gameCanvas);
    }
    if (viewer.ctx) {
        draw3DViewer();
    }
    document.getElementById('nodeCountDisplay').textContent = viewer.nodes.length;
    document.getElementById('movesMadeDisplay').textContent = gameState.moveCount;
}

function drawGame(ctx, canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cellSize = Math.min(canvas.width / gameState.board.width, canvas.height / gameState.board.height);
    const offsetX = (canvas.width - cellSize * gameState.board.width) / 2;
    const offsetY = (canvas.height - cellSize * gameState.board.height) / 2;

    // Board and grid
    ctx.fillStyle = '#222';
    ctx.fillRect(offsetX, offsetY, cellSize * gameState.board.width, cellSize * gameState.board.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= gameState.board.width; i++) {
        ctx.beginPath();
        ctx.moveTo(offsetX + i * cellSize, offsetY);
        ctx.lineTo(offsetX + i * cellSize, offsetY + cellSize * gameState.board.height);
        ctx.stroke();
    }
    for (let i = 0; i <= gameState.board.height; i++) {
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY + i * cellSize);
        ctx.lineTo(offsetX + cellSize * gameState.board.width, offsetY + i * cellSize);
        ctx.stroke();
    }

    // Exit area
    ctx.fillStyle = 'rgba(0,255,0,0.3)';
    ctx.fillRect(offsetX + cellSize, offsetY + cellSize * 3, cellSize * 2, cellSize * 2);
    ctx.fillStyle = '#0f0';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', offsetX + cellSize * 2, offsetY + cellSize * 4 + 5);

    // Pieces
    for (let piece of gameState.board.pieces) {
        const x = offsetX + piece.x * cellSize;
        const y = offsetY + piece.y * cellSize;
        const width = piece.width * cellSize;
        const height = piece.height * cellSize;
        const isDragging = dragState.isDragging && dragState.piece && dragState.piece.id === piece.id;
        
        ctx.fillStyle = piece.color;
        if (gameState.selectedPiece === piece.id || isDragging) {
            ctx.shadowBlur = isDragging ? 15 : 10;
            ctx.shadowColor = isDragging ? '#ffff00' : '#fff';
        }
        ctx.fillRect(x + 2, y + 2, width - 4, height - 4);
        ctx.shadowBlur = 0;
        
        ctx.strokeStyle = (gameState.selectedPiece === piece.id || isDragging) ? '#fff' : 'rgba(255,255,255,0.5)';
        ctx.lineWidth = (gameState.selectedPiece === piece.id || isDragging) ? 3 : 2;
        ctx.strokeRect(x + 2, y + 2, width - 4, height - 4);
    }
}

function draw3DViewer() {
    const ctx = viewer.ctx;
    const canvas = viewer.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Project all nodes to 2D screen coordinates
    const projected = viewer.nodes.map(node => project3D(node, canvas));
    
    // Sort nodes by depth (z-coordinate) for proper rendering order
    const sortedIndices = viewer.nodes.map((_, i) => i)
        .sort((a, b) => (projected[b]?.z || 0) - (projected[a]?.z || 0));

    // Draw edges first (so they appear behind nodes)
    for (const edge of viewer.edges) {
        const from = projected[edge.from];
        const to = projected[edge.to];
        
        if (from && to) {
            // Highlight optimal path edges in yellow if showPath is enabled
            if (viewer.settings.showPath && 
                viewer.nodes[edge.from].isOptimal && 
                viewer.nodes[edge.to].isOptimal) {
                ctx.strokeStyle = 'rgba(255,255,0,0.8)';
                ctx.lineWidth = 3;
            } else {
                ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                ctx.lineWidth = 1;
            }
            
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();
        }
    }

    // Draw nodes (from back to front for proper depth sorting)
    for (const i of sortedIndices) {
        const node = viewer.nodes[i];
        const p = projected[i];
        if (!p) continue; // Skip nodes that couldn't be projected

        // Determine node fill color based on color mode
        let color = '#fff';
        if (viewer.settings.colorMode === 0) {
            // Color by depth/distance from start
            color = `hsl(${(node.depth * 45) % 360}, 70%, 60%)`;
        } else if (viewer.settings.colorMode === 1) {
            // Color by difficulty (distance to solution)
            const intensity = Math.max(0, Math.min(255, Math.floor(node.difficulty * 30)));
            color = `rgb(${255 - intensity}, ${intensity}, 100)`;
        }
        ctx.fillStyle = color;

        // Determine stroke color and width based on node type (priority order)
        if (node.isSolution) {
            ctx.strokeStyle = '#0f0'; // Green for solution nodes
            ctx.lineWidth = 4;
        } else if (node.isCurrent) {
            ctx.strokeStyle = '#ff0'; // Yellow for current position
            ctx.lineWidth = 3;
        } else if (node.isOptimal && viewer.settings.showPath) {
            ctx.strokeStyle = '#ffff00'; // Bright yellow for optimal path
            ctx.lineWidth = 2;
        } else if (viewer.settings.showSolutions && node.isSolution) {
            ctx.strokeStyle = '#0f0'; // Green for solutions when showing solutions
            ctx.lineWidth = 2;
        } else {
            ctx.strokeStyle = 'rgba(255,255,255,0.3)'; // Default white
            ctx.lineWidth = 1;
        }

        // Determine node radius based on importance
        const radius = node.isSolution ? 10 : 
                      (node.isCurrent ? 8 : 
                      (node.isOptimal && viewer.settings.showPath ? 6 : 4));

        // Draw the node
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Optional: Add text labels for important nodes
        if (node.isCurrent || node.isSolution) {
            ctx.fillStyle = '#fff';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            if (node.isCurrent) {
                ctx.fillText('YOU', p.x, p.y - radius - 15);
            } else if (node.isSolution) {
                ctx.fillText('WIN', p.x, p.y - radius - 15);
            }
        }
    }
}

function project3D(point, canvas) {
    let x = point.x - viewer.camera.x;
    let y = point.y - viewer.camera.y;
    let z = point.z;
    const cosY = Math.cos(viewer.camera.rotY), sinY = Math.sin(viewer.camera.rotY);
    let tempX = x * cosY - z * sinY;
    let tempZ = x * sinY + z * cosY;
    x = tempX;
    z = tempZ;
    const cosX = Math.cos(viewer.camera.rotX), sinX = Math.sin(viewer.camera.rotX);
    let tempY = y * cosX - z * sinX;
    z = y * sinX + z * cosX;
    y = tempY;
    z += viewer.camera.z;

    if (z <= 0) return null;
    const scale = 400 / z;
    return { x: canvas.width / 2 + x * scale, y: canvas.height / 2 - y * scale, z: z };
}

function startGameLoop() {
    function gameLoop() {
        updateDisplay();
        requestAnimationFrame(gameLoop);
    }
    requestAnimationFrame(gameLoop);
}

// --- Input Handlers ---

function handleKeyDown(e) { 
    keys[e.code] = true; 
    
    if (e.code === 'KeyS') {
        executeAutoSolve();
    }
}

function handleKeyUp(e) { 
    keys[e.code] = false; 
}

function handleMouseDown(e) {
    const rect = viewer.canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    if (e.button === 0) mouse.down = true;
    if (e.button === 2) mouse.rightDown = true;
}

function handleMouseMove(e) {
    const rect = viewer.canvas.getBoundingClientRect();
    const newX = e.clientX - rect.left;
    const newY = e.clientY - rect.top;
    if (mouse.rightDown) {
        viewer.camera.rotY += (newX - mouse.x) * 0.01;
        viewer.camera.rotX += (newY - mouse.y) * 0.01;
    }
    mouse.x = newX;
    mouse.y = newY;
}

function handleMouseUp(e) {
    if (e.button === 0) mouse.down = false;
    if (e.button === 2) mouse.rightDown = false;
}

function handleWheel(e) {
    e.preventDefault();
    const zoomFactor = Math.pow(1.05, -Math.sign(e.deltaY));

    const oldZ = viewer.camera.z;
    let newZ = oldZ / zoomFactor;

    // Clamp the zoom level to prevent zooming too far in or out
    newZ = Math.max(2, Math.min(15, newZ));

    viewer.camera.z = newZ;
}