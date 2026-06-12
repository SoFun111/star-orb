import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

camera.position.z = 90;

const renderer = new THREE.WebGLRenderer({
    antialias: true
});

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

document.getElementById('app').appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);

composer.addPass(
    new RenderPass(scene, camera)
);

composer.addPass(
    new UnrealBloomPass(
        new THREE.Vector2(
            window.innerWidth,
            window.innerHeight
        ),
        2.5,
        0.8,
        0.2
    )
);

const count = 15000;

const positions =
    new Float32Array(count * 3);

const sphereTargets = [];
const photoTargets = [];

for (let i = 0; i < count; i++) {

    const r =
        25 * Math.cbrt(Math.random());

    const theta =
        Math.random() * Math.PI * 2;

    const phi =
        Math.acos(
            2 * Math.random() - 1
        );

    const x =
        r * Math.sin(phi) * Math.cos(theta);

    const y =
        r * Math.sin(phi) * Math.sin(theta);

    const z =
        r * Math.cos(phi);

    sphereTargets.push(
        new THREE.Vector3(x, y, z)
    );

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
}

const geometry =
    new THREE.BufferGeometry();

geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(
        positions,
        3
    )
);

const material =
    new THREE.PointsMaterial({
        size: 0.35,
        color: 0xaaddff,
        transparent: true,
        opacity: 0.9
    });

const stars =
    new THREE.Points(
        geometry,
        material
    );

scene.add(stars);

async function loadPhotoTargets() {

   const img = new Image();

const photos = [
    '/1.jpg',
    '/2.jpg',
    '/3.jpg',
    '/4.png',
    '/5.jpg',
    '/6.jpg',
    '/7.jpg'
];

img.src =
    photos[
        Math.floor(
            Math.random() * photos.length
        )
    ];

console.log(
    'loading photo:',
    img.src
);

   await new Promise((resolve,reject)=>{

    img.onload = resolve;

    img.onerror = ()=>{
        reject(
            new Error(
                'image load failed: ' +
                img.src
            )
        );
    };

});

    const canvas =
        document.createElement('canvas');

    const ctx =
        canvas.getContext('2d');

    const maxSize = 300;

    canvas.width = maxSize;
    canvas.height =
        maxSize *
        img.height /
        img.width;

    ctx.drawImage(
        img,
        0,
        0,
        canvas.width,
        canvas.height
    );

    const imageData =
        ctx.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
        );

    const data = imageData.data;

    for (
        let y = 0;
        y < canvas.height;
        y += 2
    ) {

        for (
            let x = 0;
            x < canvas.width;
            x += 2
        ) {

            const index =
                (y * canvas.width + x) * 4;

            const alpha =
                data[index + 3];

            const brightness =
                (
                    data[index] +
                    data[index + 1] +
                    data[index + 2]
                ) / 3;

            if (
                alpha > 10 &&
                brightness > 30
            ) {

                photoTargets.push(
                    new THREE.Vector3(
                        (x - canvas.width / 2) * 0.25,
                        (canvas.height / 2 - y) * 0.25,
                        0
                    )
                );
            }
        }
    }

    console.log(
        'photo points:',
        photoTargets.length
    );
}

let scatter = 0;
let targetX = 0;
let targetY = 0;
let targetScale = 1;
let morph = 0;

function distance(a, b) {
    return Math.hypot(
        a.x - b.x,
        a.y - b.y
    );
}

(async () => {

    const video =
        document.getElementById('video');

    try {

        const stream =
            await navigator.mediaDevices.getUserMedia({
                video: true
            });

        video.srcObject = stream;

        const vision =
            await FilesetResolver.forVisionTasks(
                'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
            );

        const handLandmarker =
            await HandLandmarker.createFromOptions(
                vision,
                {
                    baseOptions: {
                        modelAssetPath:
                            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
                    },
                    runningMode: 'VIDEO',
                    numHands: 1
                }
            );

        function detect() {

            const result =
                handLandmarker.detectForVideo(
                    video,
                    performance.now()
                );

            if (result.landmarks.length) {

                const lm =
                    result.landmarks[0];

                const thumb = lm[4];
                const index = lm[8];
                const middle = lm[12];
                const ring = lm[16];
                const pinky = lm[20];

                const openness =
                    distance(thumb, index) +
                    distance(index, middle) +
                    distance(middle, ring) +
                    distance(ring, pinky);

                scatter =
                    THREE.MathUtils.clamp(
                        openness * 250,
                        0,
                        300
                    );
                morph =
                    THREE.MathUtils.clamp(
                        openness * 2,
                        0,
                        1
                    );

                targetX =
                    (0.5 - lm[0].x) * 120;

                targetY =
                    (0.5 - lm[0].y) * 80;

                targetScale =
                    THREE.MathUtils.clamp(
                        1 + (0.15 - lm[0].z) * 8,
                        0.5,
                        3
                    );
            }

            requestAnimationFrame(detect);
        }

        detect();

    } catch (e) {

        console.error(e);
    }

})();

function animate() {

    requestAnimationFrame(animate);

    const time =
        performance.now() * 0.001;

    const pos =
        geometry.attributes.position.array;

    for (let i = 0; i < count; i++) {

const sphere =
    sphereTargets[i];

const photo =
    photoTargets.length
        ? photoTargets[
            i % photoTargets.length
          ]
        : sphere;

const targetXPos =
    sphere.x * (1 - morph) +
    photo.x * morph;

const targetYPos =
    sphere.y * (1 - morph) +
    photo.y * morph;

const targetZPos =
    sphere.z * (1 - morph) +
    photo.z * morph;

const tx =
    targetXPos +
    Math.sin(time + i * 0.01)
    * scatter * 0.15;

const ty =
    targetYPos +
    Math.cos(time * 1.2 + i * 0.01)
    * scatter * 0.15;

const tz =
    targetZPos +
    Math.sin(time * 0.8 + i * 0.01)
    * scatter * 0.15;

pos[i * 3] +=
    (tx - pos[i * 3]) * 0.03;

pos[i * 3 + 1] +=
    (ty - pos[i * 3 + 1]) * 0.03;

pos[i * 3 + 2] +=
    (tz - pos[i * 3 + 2]) * 0.03;
    }

    geometry.attributes.position.needsUpdate = true;

    stars.position.x +=
        (targetX - stars.position.x) * 0.08;

    stars.position.y +=
        (targetY - stars.position.y) * 0.08;

    stars.scale.lerp(
        new THREE.Vector3(
            targetScale,
            targetScale,
            targetScale
        ),
        0.05
    );

    stars.position.y +=
        Math.sin(time) * 0.03;

    stars.position.x +=
        Math.cos(time * 0.7) * 0.015;

    stars.rotation.y += 0.003;
    stars.rotation.x += 0.0015;
    stars.rotation.z += 0.0008;

    composer.render();
}

(async () => {
    try{
        await loadPhotoTargets();
    }catch(e){
        console.error(e);
    }

    animate();
})();

window.addEventListener(
    'resize',
    () => {

        camera.aspect =
            window.innerWidth /
            window.innerHeight;

        camera.updateProjectionMatrix();

        renderer.setSize(
            window.innerWidth,
            window.innerHeight
        );
    }
);
