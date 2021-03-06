import {
    loadManagerStart,
    select,
    Tools
}
    from '../api/actions'
import store from '../api/store';
import {
    Scene,
    Color,
    Fog,
    Object3d,
    Raycaster,
    Vector2,
    Box3,
    WebGLRenderer,
    BasicShadowMap,
    PCFShadowMap,
    PCFSoftShadowMap,
    VSMShadowMap,
    PerspectiveCamera,
    Mesh,
    PlaneGeometry,
    MeshPhongMaterial,
    MeshStandardMaterial,
    AxesHelper,
    GridHelper,
    DoubleSide,
} from "three";
import { WEBGL } from 'three/examples/jsm/WEBGL.js';
import Stats from 'three/examples/jsm/libs/stats.module'
import { localhost } from '../api/Config';

// Controls
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
// import { DragControls } from 'three/examples/jsm/controls/DragControls.js';

/* 3d mouse interaction */
// import { Interaction } from 'three.interaction';// fails to use
// import { InteractionManager } from "three.interactive";// ok but 500kB re-imports all three !
import { InteractionManager } from "./ThreeInteractive";// ok, pasted from ./node_modules\three.interactive\src\index.js

import Draggable from './Draggable'
import Angle from './Angle'
import { setupLights } from './helpers/Lights'
import { create as createSolGrid } from './helpers/Sol';
import { getFileNameFromUrl } from '../api/Utils';

const wallHeight = 2380;

export default {
    meubles: [],
    laque: null,
    laqueId: null,
    selection: null,

    /*  clickOnScene(event) {// do not work
         // console.log("clickOnScene", event)
         var raycaster = new Raycaster();
         var mouse = new Vector2();
         raycaster.setFromCamera(mouse, this.camera);
         const selectedMeuble = this.meubles.find(m => {
             const box = new Box3().setFromObject(m.object);
             if (raycaster.ray.intersectsBox(box) === true) {
             }
         })
         if (selectedMeuble) select(selectedMeuble)
     }, */

    getRendererNodeElement() {
        return this.renderer.domElement
    },
    getStatNodeElement() {
        return this.frame_stats.dom
    },
    setup(config) {
        window.ts = this// f12 helper

        this.tool = Tools.ARROW

        this.config = config
        this.xmax = 4000
        this.zmax = 2000
        this.setupSize(config)

        const scene_params = this.scene_params = config.scene_params;
        let camera, scene, renderer, orbitControls, stats, manager;

        this.clear()
        this.scene = new Scene();
        scene = this.scene
        scene.background = new Color(scene_params.backgroundColor);

        /*         if (scene_params.fogEnabled) {
                    scene.fog = new Fog(scene_params.fog.color, scene_params.fog.near, scene_params.fog.far);
                } */
        // Object3D.DefaultUp.set(0, 0, 1);

        // renderer props hard coded :
        /*         var renderer_args = {
                    "preserveDrawingBuffer": true,// for picture taking
                    "antialias": true,
                    "powerPreference": "low-power",
                    "failIfMajorPerformanceCaveat": false
                } */
        var renderer_args = scene_params.renderer

        this.renderer = renderer = new WebGLRenderer(renderer_args);

        renderer.shadowMap.enabled = scene_params.shadowMap.enabled;

        /*
        Shadow maps possibles =>
        BasicShadowMap
        PCFShadowMap
        PCFSoftShadowMap
        VSMShadowMap
        */
        if (scene_params.shadowMap.type === "BasicShadowMap") {
            renderer.shadowMap.type = BasicShadowMap;
        } else if (scene_params.shadowMap.type === "PCFShadowMap") {
            renderer.shadowMap.type = PCFShadowMap;
        } else if (scene_params.shadowMap.type === "PCFSoftShadowMap") {
            renderer.shadowMap.type = PCFSoftShadowMap;
        } else if (scene_params.shadowMap.type === "VSMShadowMap") {
            renderer.shadowMap.type = VSMShadowMap;
        } else {
            renderer.shadowMap.type = PCFSoftShadowMap;
        }

        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);

        // renderer.toneMapping = THREE.ACESFilmicToneMapping;
        // renderer.toneMappingExposure = 1;
        // renderer.outputEncoding = THREE.sRGBEncoding;
        // renderer.physicallyCorrectLights = true;
        // renderer.shadowMap.enabled = true;
        // renderer.localClippingEnable = false;
        // renderer.setClearColor(0xFFFFFF);



        this.frame_stats = stats = new Stats();

        /* raycaster */

        // renderer.domElement.addEventListener("click", this.clickOnScene.bind(this), true);

        /* camera */

        // +Z is up in Blender, whereas + Y is up in three.js
        this.camera = camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 100, 15000);
        camera.position.set(this.xmax / 2, 1700, this.zmax / 2)

        /* controls */

        this.orbitControls = orbitControls = new OrbitControls(camera, renderer.domElement);
        // orbitControls.addEventListener('start', this.render.bind(this)); // use if there is no animation loop
        orbitControls.addEventListener('change', this.render.bind(this)); // use if there is no animation loop
        orbitControls.minDistance = 200;//20cm
        orbitControls.maxDistance = 10000;//10m
        orbitControls.target.set(2000, 1000, 2000);
        orbitControls.update();

        // https://github.com/markuslerner/THREE.Interactive
        this.interactionManager = new InteractionManager(
            renderer,
            camera,
            renderer.domElement
        );

        const mesh = new Mesh(new PlaneGeometry(2000, 2000), new MeshPhongMaterial({ color: 0x999999, depthWrite: false }));
        mesh.rotation.x = - Math.PI / 2;
        mesh.receiveShadow = true;
        scene.add(mesh);


        this.setupLights()

        /* ground */

        /*         const groundMaterial = new MeshStandardMaterial({
                    color: scene_params.groundColor,
                    emissive: 0x2C2C2C,
                });
        
                const geometryGround = new PlaneGeometry(55000, 55000, 12);
                this.ground = new Mesh(geometryGround, groundMaterial);
                this.ground.rotateX(Math.PI / -2);
                //this.ground.castShadow = true;
                //this.ground.receiveShadow = true;
                //if(this.ground.material.map) this.ground.material.map.anisotropy = 5;		
                scene.add(this.ground); */

        /* walls */
        this.setupWalls(config)
        this.resize()
        console.log("MainScene setup", this)

        /* material */
        this.materialId = null

    },
    setupSize(config) {
        if (config) {
            this.xmax = config.xmax > 0 ? config.xmax :
                (config.defaultdressing && config.defaultdressing.xmax ? config.defaultdressing.xmax : this.xmax)
            this.zmax = config.zmax > 0 ? config.zmax :
                (config.defaultdressing && config.defaultdressing.zmax ? config.defaultdressing.zmax : this.zmax)
        }
    },
    setupLights() {
        setupLights(this.scene, this.scene_params)
    },
    setupWalls(config, visible = true) {

        if (localhost) {

            /* 0,0,0 dot */

            const axesHelper = new AxesHelper(15000);
            this.scene.add(axesHelper);

            /* floor grid */
            // TODO because cannot be rectangle, make its own !
            const grid = new GridHelper(10000, 100, 0x000000, 0x9A9A9A);
            grid.material.opacity = 0.25;
            grid.material.transparent = true;
            grid.position.x = 10000 / 2
            grid.position.z = 10000 / 2
            // this.scene.add(grid);
            // console.log(grid)
        }

        if (this.wallRight) this.scene.remove(this.wallRight);
        if (this.wallFront) this.scene.remove(this.wallFront);
        if (this.wallLeft) this.scene.remove(this.wallLeft);
        if (this.wallBack) this.scene.remove(this.wallBack);

        const wallMaterial = new MeshStandardMaterial({
            color: 0x7E838D,
            transparent: true,
            opacity: visible ? .20 : 0,
            side: DoubleSide
        });

        if (config.xmax > 0) {
            const geometryRight = new PlaneGeometry(config.xmax, wallHeight, 10, 10);
            this.wallRight = new Mesh(geometryRight, wallMaterial);
            this.wallRight.name = "wall-right";
            this.wallRight.position.x = config.xmax / 2;
            this.wallRight.position.y = wallHeight / 2;
            this.wallRight.castShadow = this.wallRight.receiveShadow = false;
            this.scene.add(this.wallRight);

            this.wallLeft = new Mesh(geometryRight, wallMaterial);
            this.wallLeft.name = "wall-left";
            this.wallLeft.position.x = config.xmax / 2;
            this.wallLeft.position.y = wallHeight / 2;
            this.wallLeft.position.z = config.zmax;
            this.wallLeft.rotateY(Math.PI);
            this.wallLeft.castShadow = this.wallLeft.receiveShadow = false;
            this.scene.add(this.wallLeft);
        }

        if (config.zmax > 0) {
            const geometryBack = new PlaneGeometry(config.zmax, wallHeight, 10, 10);
            this.wallFront = new Mesh(geometryBack, wallMaterial);
            this.wallFront.name = "wall-front";
            this.wallFront.rotateY(Math.PI / 2)
            this.wallFront.position.x = 0;
            this.wallFront.position.y = wallHeight / 2;
            this.wallFront.position.z = config.zmax / 2;
            this.wallFront.castShadow = this.wallFront.receiveShadow = false;
            this.scene.add(this.wallFront);

            this.wallBack = new Mesh(geometryBack, wallMaterial);
            this.wallBack.name = "wall-back";
            this.wallBack.rotateY(Math.PI / 2)
            this.wallBack.position.x = config.xmax;
            this.wallBack.position.y = wallHeight / 2;
            this.wallBack.position.z = config.zmax / 2;
            this.wallBack.castShadow = this.wallBack.receiveShadow = false;
            this.scene.add(this.wallBack);
        }

        if (visible && false) {
            if (this.sol && this.sol.parent == this.scene) this.scene.remove(this.sol);
            this.sol = createSolGrid(config.xmax, config.zmax)
            this.scene.add(this.sol);
        }
    },
    updateCamera(props) {
        let camera = this.camera
        camera.fov = props.fov;
        camera.zoom = props.zoom;
        camera.focus = props.focus;
        camera.updateProjectionMatrix();
    },
    updateLights(light) {
        let scene = this.scene
        let spotLight = this.spotLight
        let spotLight2 = this.spotLight2

        if (light) {
            scene.add(spotLight);
            scene.add(spotLight2);
        }
        else {
            scene.remove(spotLight);
            scene.remove(spotLight2);
        }
    },
    allLoaded() {
        this.frame_stats.begin();
        this.render();
    },
    clear() {
        if (this.scene) this.scene.clear();
        this.meubles = [];

        //TODO clean all...search for threejs clean scene
    },
    update(config, wallVisible = true) {
        this.clear();
        this.setupLights();
        this.setupWalls(config, wallVisible)
        if (config && config.materialId) {
            this.materialId = config.materialId
        }
    },
    resize() {
        const canvasWrapper = document.getElementById("canvas-wrapper")
        if (!canvasWrapper) return
        // console.log(`canvas-wrapper size is ${canvasWrapper.offsetWidth}x${canvasWrapper.offsetHeight}`)
        this.renderer.setPixelRatio(canvasWrapper.offsetWidth / canvasWrapper.offsetHeight);
        this.renderer.setSize(canvasWrapper.offsetWidth, canvasWrapper.offsetHeight);
        this.camera.aspect = canvasWrapper.offsetWidth / canvasWrapper.offsetHeight;
        this.camera.updateProjectionMatrix();
        this.render()
    },
    render() {
        if (this.interactionManager) this.interactionManager.update();
        // this.frame_stats.update();
        this.renderer.render(this.scene, this.camera);
    },
    add(meuble) {
        this.scene.add(meuble.object);
        this.meubles.unshift(meuble);
    },
    remove(meuble) {
        this.scene.remove(meuble.object);
        this.meubles = this.meubles.filter(item => item !== meuble)
    },
    deselect() {
        if (this.selection && this.selection.deselect) this.selection.deselect()
        this.selection = null
    },
    enableMeubleDragging(enabled) {
        this.meubles.forEach(m => enabled ? m.dragControls.activate() : m.dragControls.deactivate())
    },
    enableMeubleClicking(enabled) {
        console.log("enableMeubleClicking", enabled)
        this.meubles.forEach(m => {
            if (enabled) {
                this.interactionManager.add(m.object)
                m.object.addEventListener('click', m.click.bind(m))
            } else {
                this.interactionManager.remove(m.object)
                m.object.removeEventListener('click', m.click.bind(m))
            }
        })
    },
    enableMeublePainting(enabled) {
        this.meubles.forEach(m => {
            m.object.children.filter(c => m.props.laquables.includes(c.name)).forEach(c => {
                if (enabled) {
                    this.interactionManager.add(c)
                    c.addEventListener('click', m.clickLaquable.bind(m))

                    console.log("interactionManager", c.hasEventListener('click'), this.interactionManager)


                } else {
                    this.interactionManager.remove(c)
                    c.removeEventListener('click', m.clickLaquable.bind(m))
                }
            })
        })
    },
    getRaycasterIntersect() {
        var raycaster = new Raycaster();
        var vec = new Vector2();
        raycaster.setFromCamera(vec, this.camera);
        var intersects = raycaster.intersectObjects(this.scene.children, false); //array
        return intersects;
        // if (intersects.length > 0) {
        //     // selectedObject = intersects[0];
        //     // console.log(selectedObject);
        // }
    },
    getMeubleList() {
        let meubleList = []
        this.meubles.forEach(m => meubleList.push(m.props.sku))
        return meubleList
    },
    /*
        props from catalogue (infos)
        object from fbx (3d)
        state from saved dressing (user modifications)
    */
    createMeuble(props, object, state) {

        if (props.angle) {

            return new Angle(props, object, state)
        } else {
            return new Draggable(props, object, state)

        }
    }
}