import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js'; // Importar VRButton

// --- DOM Elements ---
const uiContainer = document.getElementById('ui-container');
const modeImagesBtn = document.getElementById('mode-images');
const modeVrWorldBtn = document.getElementById('mode-vr-world');
const imageControls = document.getElementById('image-controls');
const prevImageBtn = document.getElementById('prev-image');
const nextImageBtn = document.getElementById('next-image');
const vrButtonContainer = document.getElementById('vr-button-container'); // Contenedor para el VRButton
const vrGazePointer = document.getElementById('vr-gaze-pointer');

// --- Three.js Variables ---
let renderer, camera, scene; // Ahora solo una cámara y una escena principal
let currentMode = 'start'; // 'start', 'images', 'vr-world'

// --- Image Mode Variables ---
const stereoImages = [
    './images/stereo-image-1.jpg',
    './images/stereo-image-2.jpg',
    './images/stereo-image-3.jpg',
];
let currentImageIndex = 0;
let imageMesh; // Plano donde se proyectará la imagen

// --- VR World Mode Variables ---
let cubesAndPyramids = []; // Array para los objetos del mundo VR

// --- Gaze Interaction Variables ---
let gazeTimeoutId = null;
const GAZE_DURATION = 1500; // Milisegundos para mantener la mirada para activar

// --- Initialization ---
init();

function init() {
    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 1);
    document.body.appendChild(renderer.domElement);

    // Habilitar WebXR
    renderer.xr.enabled = true;

    // Crea el botón VR y añádelo a un contenedor en tu HTML
    vrButtonContainer.appendChild(VRButton.createButton(renderer));

    // Cámara (una sola cámara principal para toda la aplicación)
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 0); // Altura de ojos promedio para VR

    // --- Scene Setup ---
    scene = new THREE.Scene(); // Una sola escena principal que contendrá los elementos del modo activo

    // --- Image Mode Setup ---
    const imageGeometry = new THREE.PlaneGeometry(2, 1); // Relación de aspecto 2:1 para SbS
    imageMesh = new THREE.Mesh(imageGeometry);
    // Posicionar el plano de la imagen un poco adelante para que sea visible
    imageMesh.position.set(0, 1.6, -3); // Centrado a la altura de los ojos, 3 metros adelante
    loadImage(stereoImages[currentImageIndex]); // Carga la primera imagen, pero no la agrega a la escena aún

    // --- VR World Mode Setup ---
    // Sky
    const vrWorldSkyColor = new THREE.Color(0x87ceeb); // Light blue sky

    // Ground
    const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x6b8e23 }); // Olive green
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    // Posición del suelo (en 0,0,0)
    ground.position.y = -0.01; // Ligeramente por debajo para evitar z-fighting

    // Lights
    const ambientLight = new THREE.AmbientLight(0x404040);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 1, 0).normalize();


    // --- Event Listeners ---
    window.addEventListener('resize', onWindowResize);
    modeImagesBtn.addEventListener('click', () => setMode('images'));
    modeVrWorldBtn.addEventListener('click', () => setMode('vr-world'));
    prevImageBtn.addEventListener('click', prevImage);
    nextImageBtn.addEventListener('click', nextImage);

    // Eventos para WebXR (cuando se entra o sale de VR)
    renderer.xr.addEventListener('sessionstart', onSessionStart);
    renderer.xr.addEventListener('sessionend', onSessionEnd);

    // Gaze interaction for VR UI
    // En WebXR, la posición del puntero de mirada se obtiene a través del raycaster
    // No necesitamos mousemove/mousedown directamente en el body para la mirada

    // Start in UI mode
    showUI();
    setMode('start'); // Configura el estado inicial sin objetos en escena
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function setMode(mode) {
    currentMode = mode;
    console.log(`Cambiando a modo: ${mode}`);

    // Limpia la escena de todos los elementos anteriores
    while (scene.children.length > 0) {
        scene.remove(scene.children[0]);
    }

    if (mode === 'images') {
        scene.add(imageMesh);
        imageControls.classList.remove('hidden');
        // Asegúrate de que la cámara esté orientada correctamente para ver la imagen
        camera.position.set(0, 1.6, 0);
        camera.lookAt(imageMesh.position);
    } else if (mode === 'vr-world') {
        // Agrega luces y suelo
        scene.add(new THREE.AmbientLight(0x404040));
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(0, 1, 0).normalize();
        scene.add(directionalLight);
        scene.background = new THREE.Color(0x87ceeb); // Light blue sky

        // Agrega el suelo
        const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x6b8e23 });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.01;
        scene.add(ground);

        // Crea y agrega las montañas
        createVrWorldMountains();
        cubesAndPyramids.forEach(obj => scene.add(obj));

        // Posición inicial de la cámara para el mundo VR
        camera.position.set(0, 1.6, 0); // Altura de los ojos
    } else { // 'start' mode
        // No hay elementos específicos en la escena, solo la UI
        camera.position.set(0, 1.6, 5); // Una posición por defecto
        scene.background = new THREE.Color(0x000000); // Fondo negro
    }
    // Asegúrate de que la UI sea visible al cambiar de modo (fuera de VR)
    if (!renderer.xr.isPresenting) {
        showUI();
    }
}

function onSessionStart() {
    console.log("Sesión WebXR iniciada.");
    hideUI();
    vrGazePointer.style.display = 'block';
}

function onSessionEnd() {
    console.log("Sesión WebXR finalizada.");
    showUI();
    vrGazePointer.style.display = 'none';
    clearGazeTimeout(); // Limpia cualquier acción de mirada pendiente
}

function showUI() {
    uiContainer.classList.remove('hidden');
    vrGazePointer.style.display = 'none'; // El puntero de mirada solo es visible en VR
    // Es posible que necesites ajustar la visibilidad del botón VR
    const vrButton = vrButtonContainer.querySelector('.webxr-button');
    if (vrButton) vrButton.style.display = 'block';
}

function hideUI() {
    uiContainer.classList.add('hidden');
    vrGazePointer.style.display = 'block';
    const vrButton = vrButtonContainer.querySelector('.webxr-button');
    if (vrButton) vrButton.style.display = 'none'; // Ocultar el botón VR cuando ya estamos en VR
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
    const numMountains = 50;

    // Limpia las montañas existentes antes de crearlas de nuevo
    cubesAndPyramids.forEach(obj => {
        if (scene.children.includes(obj)) {
            scene.remove(obj);
        }
        obj.geometry.dispose();
        obj.material.dispose();
    });
    cubesAndPyramids = [];

    for (let i = 0; i < numMountains; i++) {
        const type = Math.random() > 0.5 ? 'cube' : 'pyramid';
        const height = Math.random() * (maxHeight - minHeight) + minHeight;
        const width = height * (0.5 + Math.random() * 0.5);
        const depth = height * (0.5 + Math.random() * 0.5);

        let geometry;
        if (type === 'cube') {
            geometry = new THREE.BoxGeometry(width, height, depth);
        } else {
            geometry = new THREE.ConeGeometry(width / 2, height, 4);
        }

        const material = new THREE.MeshLambertMaterial({
            color: new THREE.Color(Math.random() * 0.2 + 0.3, Math.random() * 0.1 + 0.2, Math.random() * 0.1 + 0.2)
        });

        const mountain = new THREE.Mesh(geometry, material);

        let x, z;
        do {
            x = (Math.random() - 0.5) * 800;
            z = (Math.random() - 0.5) * 800;
        } while (Math.abs(x) < 50 && Math.abs(z) < 50);

        mountain.position.set(x, height / 2, z);
        mountain.rotation.y = Math.random() * Math.PI * 2;

        cubesAndPyramids.push(mountain);
    }
}

// --- Gaze Interaction for WebXR UI ---
const raycaster = new THREE.Raycaster();
let intersectedObject = null; // El objeto 3D de la UI que está siendo "mirado"
const interactiveObjects = []; // Contendrá los meshes invisibles que representan los botones de la UI

function createInteractiveUIButtons() {
    // Limpiar objetos interactivos anteriores
    interactiveObjects.forEach(obj => scene.remove(obj));
    interactiveObjects.length = 0; // Vaciar array

    // Solo crea los botones 3D si la UI está visible y no estamos en VR
    if (!renderer.xr.isPresenting && !uiContainer.classList.contains('hidden')) {
        return;
    }

    const buttonElements = uiContainer.querySelectorAll('button');
    const tempScene = new THREE.Scene(); // Una escena temporal para obtener posiciones relativas de los botones

    // Clonar los botones en Three.js como planos invisibles para raycasting
    buttonElements.forEach(button => {
        const rect = button.getBoundingClientRect();

        // Crear un plano que represente el botón en el espacio 3D
        const geometry = new THREE.PlaneGeometry(
            rect.width / window.innerWidth * 10,  // Escalar para que se vea bien en VR
            rect.height / window.innerHeight * 10
        );
        const material = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0, // Invisible
            side: THREE.DoubleSide
        });
        const buttonMesh = new THREE.Mesh(geometry, material);

        // Posicionar el mesh en el espacio 3D para que coincida con la posición percibida del botón en 2D
        // Esto es un poco hacky y dependerá de cómo proyectes tu UI.
        // Una forma simple es colocarlo a una distancia fija frente a la cámara
        // y ajustar su posición XY en función de su posición relativa en pantalla.
        const targetZ = -2; // Distancia de los botones en VR
        const normalizedX = (rect.left + rect.width / 2) / window.innerWidth - 0.5;
        const normalizedY = -(rect.top + rect.height / 2) / window.innerHeight + 0.5;

        buttonMesh.position.set(normalizedX * 4, normalizedY * 3 + 1.6, targetZ); // Ajustar escala y altura

        // Asocia el mesh 3D con el elemento DOM original para el click
        buttonMesh.userData.domElement = button;
        buttonMesh.name = `ui-button-${button.id}`;
        interactiveObjects.push(buttonMesh);
        scene.add(buttonMesh); // Añadir a la escena principal
    });
}

function updateGazeInteraction() {
    if (!renderer.xr.isPresenting || uiContainer.classList.contains('hidden')) {
        // No hay interacción de mirada si no estamos en VR o la UI está oculta
        clearGazeTimeout();
        if (intersectedObject) {
            intersectedObject.userData.domElement.style.border = 'none';
            intersectedObject = null;
        }
        return;
    }

    // Obtener la dirección de la mirada de la cámara XR
    // La cámara de Three.js ya está alineada con la vista del usuario en VR
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera); // Vector (0,0) es el centro de la pantalla

    const intersects = raycaster.intersectObjects(interactiveObjects, true);

    if (intersects.length > 0) {
        if (intersectedObject !== intersects[0].object) {
            // Nuevo objeto "mirado"
            if (intersectedObject) {
                // Dejar de mirar el objeto anterior
                intersectedObject.userData.domElement.style.border = 'none';
                clearGazeTimeout();
            }
            intersectedObject = intersects[0].object;
            intersectedObject.userData.domElement.style.border = '3px solid yellow'; // Resaltar
            startGazeTimeout(intersectedObject.userData.domElement);
        }
    } else {
        // No hay objetos "mirados"
        if (intersectedObject) {
            intersectedObject.userData.domElement.style.border = 'none';
            clearGazeTimeout();
            intersectedObject = null;
        }
    }
}

function startGazeTimeout(element) {
    clearGazeTimeout();
    vrGazePointer.classList.add('active'); // Indicar que el puntero está activo
    gazeTimeoutId = setTimeout(() => {
        if (element && renderer.xr.isPresenting && !uiContainer.classList.contains('hidden')) {
            console.log('Activando por gaze:', element.id);
            element.click(); // Simular un click
            vrGazePointer.classList.remove('active'); // Reset after activation
            element.style.border = 'none'; // Quitar el highlight
            intersectedObject = null; // Reset hovered element
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

// --- Animation Loop ---
function animate() {
    // Cuando WebXR está activo, el bucle de animación se gestiona por renderer.setAnimationLoop
    // Fuera de VR, usamos requestAnimationFrame
    if (!renderer.xr.isPresenting) {
        requestAnimationFrame(animate);
        // Actualiza las interacciones de mirada solo si la UI es visible y estamos fuera de VR
        // (Aunque para "gaze" fuera de VR, el mousemove sería más apropiado como en la versión anterior)
        // Para simplificar, asumimos que el gaze es principal para VR.
    }

    // Lógica de actualización para el mundo VR
    if (currentMode === 'vr-world' && renderer.xr.isPresenting) {
        // En VR, la cámara se mueve con el usuario, no la rotamos automáticamente
        // Si no estamos en VR, podemos hacer una rotación suave para demo
        // vrWorldCamera.rotation.y += 0.001; // Ya no aplica directamente a `camera` en WebXR
    }

    updateGazeInteraction(); // Siempre comprueba la interacción de mirada si estamos en VR

    if (scene && camera) {
        renderer.render(scene, camera);
    }
}

// El bucle de animación principal para WebXR
renderer.setAnimationLoop(animate);