// main.js

const GAME_WIDTH = 160;
const GAME_HEIGHT = 90;

let scene, camera, renderer;
let player;
let pedestrians = [];
let lastTime = 0;
let spawnTimer = 0;
let spawnInterval = 5.0; // Seconds between spawns (starts at 50% frequency)
let baseSpeed = 8; // Units per second (reduced initial speed)

let score = 0;
let lives = 3;
let isGameOver = false;
let isGameStarted = false;
let isPaused = false;
let totalGameTime = 0;
let lastSpawnIncreaseTime = 0;
let lastSpeedIncreaseTime = -15; // Offset by 15s so it hits at 15, 45, 75...
let audioCtx;

// DOM Elements
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreEl = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');
const tutorialScreen = document.getElementById('tutorial-screen');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const pauseScreen = document.getElementById('pause-screen');

function init() {
    // 1. Setup Three.js Scene
    const canvas = document.getElementById('game-canvas');
    scene = new THREE.Scene();
    
    // Setup Orthographic Camera to match 16:9 aspect ratio
    const aspect = 16 / 9;
    camera = new THREE.OrthographicCamera(-GAME_WIDTH/2, GAME_WIDTH/2, GAME_HEIGHT/2, -GAME_HEIGHT/2, 0.1, 100);
    camera.position.z = 10;

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    
    // Handle resizing
    function resize() {
        const container = document.getElementById('game-container');
        renderer.setSize(container.clientWidth, container.clientHeight);
    }
    window.addEventListener('resize', resize);
    resize();

    // 2. Setup Environment Materials
    const roadMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.3 });
    const holeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const playerMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const pedMat = new THREE.MeshBasicMaterial({ color: 0xff00ff });

    // Draw Roads
    const roadGeo = new THREE.PlaneGeometry(GAME_WIDTH, 4);
    const topRoad = new THREE.Mesh(roadGeo, roadMat);
    topRoad.position.set(0, 15 - 2, 0); // Road is just under the path
    scene.add(topRoad);
    
    const bottomRoad = new THREE.Mesh(roadGeo, roadMat);
    bottomRoad.position.set(0, -15 - 2, 0);
    scene.add(bottomRoad);

    // Draw Holes
    const holeGeo = new THREE.PlaneGeometry(14, 6);
    const holePositions = [
        {x: -40, y: 15}, {x: 40, y: 15},
        {x: -40, y: -15}, {x: 40, y: -15}
    ];
    holePositions.forEach(pos => {
        const hole = new THREE.Mesh(holeGeo, holeMat);
        hole.position.set(pos.x, pos.y, 0.1);
        scene.add(hole);
    });

    // 3. Initialize Entities
    player = new Player(scene, playerMat);
    
    // Store materials for spawning
    scene.userData.pedMat = pedMat;

    // 4. Setup Controls
    setupControls();

    // 5. Start Game Loop
    requestAnimationFrame(gameLoop);
}

function setupControls() {
    const btnTL = document.getElementById('btn-tl');
    const btnTR = document.getElementById('btn-tr');
    const btnBL = document.getElementById('btn-bl');
    const btnBR = document.getElementById('btn-br');

    // Mappings
    const controls = [
        { btn: btnTL, pos: 'TL' },
        { btn: btnTR, pos: 'TR' },
        { btn: btnBL, pos: 'BL' },
        { btn: btnBR, pos: 'BR' }
    ];

    controls.forEach(c => {
        // Touch and click events
        const trigger = (e) => {
            e.preventDefault();
            if(isGameOver) return;
            player.setPosition(c.pos);
            // Visual feedback on buttons
            controls.forEach(cx => cx.btn.classList.remove('active'));
            c.btn.classList.add('active');
        };
        c.btn.addEventListener('mousedown', trigger);
        c.btn.addEventListener('touchstart', trigger, {passive: false});
    });

    // Keyboard fallback for testing on PC
    window.addEventListener('keydown', (e) => {
        if(isGameOver) return;
        if(e.key === 'q' || e.key === 'ArrowUp' && e.shiftKey) { player.setPosition('TL'); btnTL.classList.add('active'); }
        if(e.key === 'e' || e.key === 'ArrowUp') { player.setPosition('TR'); btnTR.classList.add('active'); }
        if(e.key === 'a' || e.key === 'ArrowDown' && e.shiftKey) { player.setPosition('BL'); btnBL.classList.add('active'); }
        if(e.key === 'd' || e.key === 'ArrowDown') { player.setPosition('BR'); btnBR.classList.add('active'); }
    });
    window.addEventListener('keyup', () => {
        controls.forEach(cx => cx.btn.classList.remove('active'));
    });
    
    window.addEventListener('keydown', (e) => {
        if(e.key === 'p' || e.key === 'P' || e.key === 'Escape') togglePause();
    });

    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', restartGame);
    pauseBtn.addEventListener('click', togglePause);
    pauseScreen.addEventListener('click', togglePause);
}

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playTick() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
    
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
}

function startGame() {
    isGameStarted = true;
    tutorialScreen.classList.add('hidden');
    initAudio();
    try {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        }
    } catch (e) {
        console.warn("Fullscreen API not supported or denied.");
    }
}

function togglePause() {
    if (!isGameStarted || isGameOver) return;
    isPaused = !isPaused;
    if (isPaused) {
        pauseScreen.classList.remove('hidden');
        pauseBtn.innerText = 'RIPRENDI';
    } else {
        pauseScreen.classList.add('hidden');
        pauseBtn.innerText = 'PAUSA';
        lastTime = performance.now();
    }
}

function spawnPedestrian() {
    const currentSpeed = baseSpeed;
    
    // Safety check to ensure no simultaneous arrivals at ANY hole
    const SAFE_WINDOW = 0.8; // Seconds of safe buffer between any two pedestrians reaching any hole
    const timeToHole1 = 45 / currentSpeed;
    const timeToHole2 = 125 / currentSpeed;
    const newArrival1 = totalGameTime + timeToHole1;
    const newArrival2 = totalGameTime + timeToHole2;

    for (let ped of pedestrians) {
        if (!ped.active || ped.falling) continue;
        const arrival1 = ped.spawnTime + (45 / ped.speed);
        const arrival2 = ped.spawnTime + (125 / ped.speed);

        if (Math.abs(newArrival1 - arrival1) < SAFE_WINDOW || 
            Math.abs(newArrival1 - arrival2) < SAFE_WINDOW ||
            Math.abs(newArrival2 - arrival1) < SAFE_WINDOW ||
            Math.abs(newArrival2 - arrival2) < SAFE_WINDOW) {
            return false; // Too close, delay spawn
        }
    }

    // Random path (top or bottom)
    const isTopPath = Math.random() > 0.5;
    const y = isTopPath ? 15 : -15;
    const startX = isTopPath ? -(GAME_WIDTH/2 + 5) : (GAME_WIDTH/2 + 5);
    
    const ped = new Pedestrian(scene, isTopPath, startX, y, currentSpeed, scene.userData.pedMat);
    ped.spawnTime = totalGameTime;
    pedestrians.push(ped);
    return true;
}

function handleCollisions(dt) {
    pedestrians.forEach(ped => {
        if (!ped.active || ped.falling) return;

        const checkHole = (holeX, holeId, isFirst) => {
            // We check exactly when they try to step OUT of the hole (from holeX to the next bit)
            // This means they arrived at the hole, waited in 'sospensione' for one full bit, and now advance.
            if (ped.justStepped && ped.previousStepX === holeX) {
                
                // Which hole is this in terms of Player position?
                let requiredPlayerPos = '';
                if (ped.isTopPath) {
                    requiredPlayerPos = (holeX === -40) ? 'TL' : 'TR';
                } else {
                    requiredPlayerPos = (holeX === -40) ? 'BL' : 'BR';
                }

                if (player.currentPos === requiredPlayerPos) {
                    // Safe crossing
                    if (isFirst) ped.passedFirstHole = true;
                    else ped.passedSecondHole = true;
                    
                    updateScore(10);
                } else {
                    // Miss
                    ped.fall();
                    ped.logicalX = holeX; // visually fall from the hole
                    ped.mesh.position.x = holeX;
                    loseLife();
                }
            }
        };

        // Check first hole
        if (!ped.passedFirstHole) {
            checkHole(ped.firstHoleX, 1, true);
        }
        // Check second hole
        else if (!ped.passedSecondHole) {
            checkHole(ped.secondHoleX, 2, false);
        }
    });
}

function updateScore(points) {
    score += points;
    scoreEl.innerText = score;
}

function loseLife() {
    lives--;
    let livesStr = '';
    for(let i=0; i<lives; i++) livesStr += '★';
    livesEl.innerText = livesStr || '☠';

    // Screen shake effect
    const container = document.getElementById('game-container');
    container.style.transform = 'translate(10px, 10px)';
    setTimeout(() => container.style.transform = 'translate(-10px, -10px)', 50);
    setTimeout(() => container.style.transform = 'translate(10px, -10px)', 100);
    setTimeout(() => container.style.transform = 'translate(0, 0)', 150);

    if (lives <= 0) {
        gameOver();
    }
}

function gameOver() {
    isGameOver = true;
    document.getElementById('final-score').innerText = score;
    gameOverScreen.classList.remove('hidden');
}

function restartGame() {
    isGameOver = false;
    score = 0;
    lives = 3;
    spawnInterval = 5.0;
    baseSpeed = 8;
    totalGameTime = 0;
    lastSpawnIncreaseTime = 0;
    lastSpeedIncreaseTime = -15;
    scoreEl.innerText = '0';
    livesEl.innerText = '★★★';
    gameOverScreen.classList.add('hidden');
    
    // Clear pedestrians
    pedestrians.forEach(p => p.destroy(scene));
    pedestrians = [];
    
    player.setPosition('TL');
}

function gameLoop(time) {
    requestAnimationFrame(gameLoop);

    let dt = (time - lastTime) / 1000;
    lastTime = time;

    if (isGameOver || !isGameStarted || isPaused || dt > 0.1) {
        renderer.render(scene, camera);
        return; 
    }

    totalGameTime += dt;

    if (totalGameTime - lastSpawnIncreaseTime >= 30) {
        lastSpawnIncreaseTime += 30;
        spawnInterval *= 0.9; // Aumenta quantità pedoni (riduce intervallo del 10%)
    }

    if (totalGameTime - lastSpeedIncreaseTime >= 30) {
        lastSpeedIncreaseTime += 30;
        baseSpeed *= 1.1; // Aumenta velocità del 10%
    }

    // Spawning
    spawnTimer += dt;
    if (spawnTimer >= spawnInterval) {
        if (spawnPedestrian()) {
            spawnTimer = 0;
        }
    }

    // Update pedestrians
    for (let i = pedestrians.length - 1; i >= 0; i--) {
        const ped = pedestrians[i];
        ped.update(dt);
        
        // Remove if way off screen or finished falling
        if (!ped.active || ped.logicalX > GAME_WIDTH || ped.logicalX < -GAME_WIDTH) {
            ped.destroy(scene);
            pedestrians.splice(i, 1);
        }
    }

    // Collisions
    handleCollisions(dt);

    // Render
    renderer.render(scene, camera);
}

// Start
init();
