import * as THREE from 'three';
import { StereoEffect } from 'three/addons/effects/StereoEffect.js';

// --- DOM Elements ---
const uiContainer = document.getElementById('ui-container');
const modeImagesBtn = document.getElementById('mode-images');
const modeVrWorldBtn = document.getElementById('mode-vr-world');
const imageControls = document.getElementById('image-controls');
const prevImageBtn = document.getElementById('prev-image');
const nextImageBtn = document.getElementById('next-image');
const toggleVrModeBtn = document.getElementById('toggle-vr-mode');
const vrGazePointer = document.getElementById('vr-gaze-pointer');

// --- Three.js Variables ---
let renderer, camera, scene, stereoEffect;
let currentMode = 'start'; // 'start', 'images', 'vr-world'
let isVrMode = false;

// --- Image Mode Variables ---
const stereoImages = [
    './images/stereo-image-1.jpeg',
    './images/stereo-image-2.jpeg',
    './images/stereo-image-3.jpeg',
    './images/stereo-image-4.jpeg',
    './images/stereo-image-5.jpeg',
    './images/stereo-image-6.jpeg',
    './images/stereo-image-7.jpeg',
    './images/stereo-image-8.jpg',
    './images/stereo-image-9.JPG',
    './images/stereo-image-10.jpg',

];
let currentImageIndex = 0;
let imageMesh; // Plano donde se proyectará la imagen
let imageScene, imageCamera; // Escena y cámara separadas para las imágenes

// --- VR World Mode Variables ---
let vrWorldScene, vrWorldCamera; // Escena y cámara separadas para el mundo VR
let cubesAndPyramids = []; // Array para los objetos del mundo VR

// --- Gaze Interaction Variables ---
let gazeTimeoutId = null;
const GAZE_DURATION = 1500; // Milisegundos para mantener la mirada para activar

// --- Initialization ---
init();
animate();

function init() {
    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 1);
    document.body.appendChild(renderer.domElement);

    // Stereo Effect (will wrap the renderer)
    stereoEffect = new StereoEffect(renderer);
    stereoEffect.setSize(window.innerWidth, window.innerHeight);

    // --- Image Mode Setup ---
    imageScene = new THREE.Scene();
    imageCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    imageCamera.position.z = 0.01; // Muy cerca para ver el plano de la imagen

    const imageGeometry = new THREE.PlaneGeometry(2, 1); // Relación de aspecto 2:1 para SbS
    imageMesh = new THREE.Mesh(imageGeometry);
    imageScene.add(imageMesh);
    loadImage(stereoImages[currentImageIndex]);

    // --- VR World Mode Setup ---
    vrWorldScene = new THREE.Scene();
    vrWorldCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    vrWorldCamera.position.set(0, 10, 0); // Posición inicial
    vrWorldCamera.lookAt(0, 0, -50); // Mirando hacia adelante

    // Sky
    vrWorldScene.background = new THREE.Color(0x87ceeb); // Light blue sky

    // Ground
    const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x6b8e23 }); // Olive green
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    vrWorldScene.add(ground);

    // Lights
    const ambientLight = new THREE.AmbientLight(0x404040);
    vrWorldScene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 1, 0).normalize();
    vrWorldScene.add(directionalLight);

    // Create mountains (cubes and pyramids)
    createVrWorldMountains();

    // --- Event Listeners ---
    window.addEventListener('resize', onWindowResize);
    modeImagesBtn.addEventListener('click', () => setMode('images'));
    modeVrWorldBtn.addEventListener('click', () => setMode('vr-world'));
    prevImageBtn.addEventListener('click', prevImage);
    nextImageBtn.addEventListener('click', nextImage);
    toggleVrModeBtn.addEventListener('click', toggleVrMode);

    // Gaze interaction for VR UI
    document.body.addEventListener('mousemove', onGazeMove);
    document.body.addEventListener('mousedown', onGazeClick); // Simulate click for desktop
    document.body.addEventListener('mouseup', onGazeRelease);
    document.body.addEventListener('touchstart', onGazeClick); // Simulate click for mobile
    document.body.addEventListener('touchend', onGazeRelease);

    // Start in UI mode
    showUI();
    setMode('start');
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    imageCamera.aspect = window.innerWidth / window.innerHeight;
    imageCamera.updateProjectionMatrix();

    vrWorldCamera.aspect = window.innerWidth / window.innerHeight;
    vrWorldCamera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
    stereoEffect.setSize(window.innerWidth, window.innerHeight);
}

function setMode(mode) {
    currentMode = mode;
    console.log(`Cambiando a modo: ${mode}`);

    // Update the active camera and scene based on the mode
    if (mode === 'images') {
        camera = imageCamera;
        scene = imageScene;
        imageControls.classList.remove('hidden');
        uiContainer.classList.remove('hidden'); // Ensure UI is visible initially
    } else if (mode === 'vr-world') {
        camera = vrWorldCamera;
        scene = vrWorldScene;
        imageControls.classList.add('hidden');
        uiContainer.classList.remove('hidden'); // Ensure UI is visible initially
    } else { // 'start' mode
        uiContainer.classList.remove('hidden');
        imageControls.classList.add('hidden');
        // No active scene/camera until a mode is selected
        camera = undefined;
        scene = undefined;
    }
    // Update effect size immediately
    stereoEffect.setSize(window.innerWidth, window.innerHeight);
}

function toggleVrMode() {
    isVrMode = !isVrMode;
    if (isVrMode) {
        uiContainer.classList.add('hidden');
        vrGazePointer.style.display = 'block';
        toggleVrModeBtn.textContent = 'Salir de VR (Side-by-Side)';
        console.log("Modo VR activado.");
    } else {
        uiContainer.classList.remove('hidden');
        vrGazePointer.style.display = 'none';
        toggleVrModeBtn.textContent = 'Activar VR (Side-by-Side)';
        clearGazeTimeout(); // Clear any pending gaze actions
        console.log("Modo VR desactivado.");
    }
}

function showUI() {
    uiContainer.classList.remove('hidden');
    vrGazePointer.style.display = 'none';
}

function hideUI() {
    uiContainer.classList.add('hidden');
    if (isVrMode) {
        vrGazePointer.style.display = 'block';
    } else {
        vrGazePointer.style.display = 'none';
    }
}

// --- Image Mode Functions ---
function loadImage(path) {
    const loader = new THREE.TextureLoader();
    loader.load(path, (texture) => {
        if (imageMesh.material) {
            imageMesh.material.dispose(); // Limpiar material anterior
        }
        imageMesh.material = new THREE.MeshBasicMaterial({ map: texture });
        imageMesh.material.needsUpdate = true;
    }, undefined, (err) => {
        console.error('Error al cargar la imagen estereoscópica:', err);
    });
}

function prevImage() {
    currentImageIndex = (currentImageIndex - 1 + stereoImages.length) % stereoImages.length;
    loadImage(stereoImages[currentImageIndex]);
    console.log(`Cargando imagen anterior: ${stereoImages[currentImageIndex]}`);
}

function nextImage() {
    currentImageIndex = (currentImageIndex + 1) % stereoImages.length;
    loadImage(stereoImages[currentImageIndex]);
    console.log(`Cargando imagen siguiente: ${stereoImages[currentImageIndex]}`);
}

// --- VR World Functions ---
function createVrWorldMountains() {
    const minHeight = 5;
    const maxHeight = 50;
    const numMountains = 50; // Más montañas para un mundo más denso

    for (let i = 0; i < numMountains; i++) {
        const type = Math.random() > 0.5 ? 'cube' : 'pyramid';
        const height = Math.random() * (maxHeight - minHeight) + minHeight;
        const width = height * (0.5 + Math.random() * 0.5); // Proporción variable
        const depth = height * (0.5 + Math.random() * 0.5);

        let geometry;
        if (type === 'cube') {
            geometry = new THREE.BoxGeometry(width, height, depth);
        } else { // Pyramid (Tetrahedron or Cone)
            geometry = new THREE.ConeGeometry(width / 2, height, 4); // 4-sided pyramid
        }

        const material = new THREE.MeshLambertMaterial({
            color: new THREE.Color(Math.random() * 0.2 + 0.3, Math.random() * 0.1 + 0.2, Math.random() * 0.1 + 0.2) // Tonos de gris-marrón
        });

        const mountain = new THREE.Mesh(geometry, material);

        // Random position, avoid spawning exactly at (0,0,0)
        let x, z;
        do {
            x = (Math.random() - 0.5) * 800;
            z = (Math.random() - 0.5) * 800;
        } while (Math.abs(x) < 50 && Math.abs(z) < 50); // Keep some distance from origin

        mountain.position.set(x, height / 2, z); // Base en el suelo
        mountain.rotation.y = Math.random() * Math.PI * 2; // Rotación aleatoria

        vrWorldScene.add(mountain);
        cubesAndPyramids.push(mountain);
    }
}

// --- Gaze Interaction (Simulated) ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredElement = null;

function onGazeMove(event) {
    if (!isVrMode) return;

    // Actualiza la posición del puntero central (simulado)
    const clientX = window.innerWidth / 2;
    const clientY = window.innerHeight / 2;

    mouse.x = (clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(clientY / window.innerHeight) * 2 + 1;

    // Verifica si la UI está visible y si el puntero está sobre algún botón
    if (!uiContainer.classList.contains('hidden')) {
        // Intersección con los botones de la UI
        const buttons = uiContainer.querySelectorAll('button');
        let newHovered = null;

        buttons.forEach(button => {
            const rect = button.getBoundingClientRect();
            // Simular un rayo desde el centro de la pantalla
            // Si el puntero central está dentro del botón
            if (clientX >= rect.left && clientX <= rect.right &&
                clientY >= rect.top && clientY <= rect.bottom) {
                newHovered = button;
            }
        });

        if (newHovered !== hoveredElement) {
            if (hoveredElement) {
                hoveredElement.style.border = 'none';
                clearGazeTimeout();
            }
            if (newHovered) {
                hoveredElement = newHovered;
                hoveredElement.style.border = '3px solid yellow'; // Highlight
                startGazeTimeout(hoveredElement);
            } else {
                hoveredElement = null;
                clearGazeTimeout();
            }
        }
    } else {
        // If UI is hidden, no interaction
        if (hoveredElement) {
            hoveredElement.style.border = 'none';
            clearGazeTimeout();
            hoveredElement = null;
        }
    }
}


function startGazeTimeout(element) {
    clearGazeTimeout();
    vrGazePointer.classList.add('active'); // Indicar que el puntero está activo
    gazeTimeoutId = setTimeout(() => {
        if (element && isVrMode && !uiContainer.classList.contains('hidden')) {
            // console.log('Activando por gaze:', element.id);
            element.click(); // Simular un click
            vrGazePointer.classList.remove('active'); // Reset after activation
            element.style.border = 'none'; // Quitar el highlight
            hoveredElement = null; // Reset hovered element
        }
    }, GAZE_DURATION);
}

function clearGazeTimeout() {
    if (gazeTimeoutId) {
        clearTimeout(gazeTimeoutId);
        gazeTimeoutId = null;
        vrGazePointer.classList.remove('active');
    }
}

// Simulación de clic para probar en escritorio
function onGazeClick(event) {
    if (!isVrMode) return;
    // Prevenir el comportamiento por defecto de la selección de texto en móviles
    event.preventDefault();

    // Resetear el timeout y el puntero si se hace click/touch de verdad
    clearGazeTimeout();
    vrGazePointer.classList.add('active'); // Indicar que está presionado

    // Si el UI está visible, simula un click en el elemento hovered
    if (hoveredElement && !uiContainer.classList.contains('hidden')) {
        // console.log('Click manual en:', hoveredElement.id);
        hoveredElement.click();
        hoveredElement.style.border = 'none'; // Quitar el highlight
        hoveredElement = null;
    }
}

function onGazeRelease() {
    if (!isVrMode) return;
    vrGazePointer.classList.remove('active');
    clearGazeTimeout(); // Limpiar el timeout si se suelta el clic/touch antes de tiempo
    if (hoveredElement) {
         hoveredElement.style.border = '3px solid yellow'; // Re-highlight if still hovered
         startGazeTimeout(hoveredElement); // Reiniciar el contador si se suelta después de un click corto
    }
}


// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);

    if (currentMode === 'vr-world') {
        // Simple movement for VR World (can be controlled by device orientation later)
        vrWorldCamera.rotation.y += 0.001; // Gentle rotation
    }

    // Render using StereoEffect if VR mode is on, else use standard renderer
    if (isVrMode) {
        if (camera && scene) {
            stereoEffect.render(scene, camera);
        }
    } else {
        if (camera && scene) {
            renderer.render(scene, camera);
        }
    }
}