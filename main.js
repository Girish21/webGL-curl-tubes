import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import SimplexNoise from 'simplex-noise'

import fragmentShader from './shaders/plane/fragment.frag?raw'
import vertexShader from './shaders/plane/vertex.vert?raw'
import tubesFragmentShader from './shaders/tubes/fragment.frag?raw'
import tubesVertexShader from './shaders/tubes/vertex.vert?raw'

const size = {
  width: window.innerWidth,
  height: window.innerHeight,
}

const mouse = {
  x: 0,
  y: 0,
  clientX: 0,
  clientY: 0,
}

const noise = new SimplexNoise()

function computeCurl(x, y, z) {
  var eps = 0.0001

  var curl = new THREE.Vector3()

  //Find rate of change in YZ plane
  var n1 = noise.noise3D(x, y + eps, z)
  var n2 = noise.noise3D(x, y - eps, z)
  //Average to find approximate derivative
  var a = (n1 - n2) / (2 * eps)
  var n1 = noise.noise3D(x, y, z + eps)
  var n2 = noise.noise3D(x, y, z - eps)
  //Average to find approximate derivative
  var b = (n1 - n2) / (2 * eps)
  curl.x = a - b

  //Find rate of change in XZ plane
  n1 = noise.noise3D(x, y, z + eps)
  n2 = noise.noise3D(x, y, z - eps)
  a = (n1 - n2) / (2 * eps)
  n1 = noise.noise3D(x + eps, y, z)
  n2 = noise.noise3D(x - eps, y, z)
  b = (n1 - n2) / (2 * eps)
  curl.y = a - b

  //Find rate of change in XY plane
  n1 = noise.noise3D(x + eps, y, z)
  n2 = noise.noise3D(x - eps, y, z)
  a = (n1 - n2) / (2 * eps)
  n1 = noise.noise3D(x, y + eps, z)
  n2 = noise.noise3D(x, y - eps, z)
  b = (n1 - n2) / (2 * eps)
  curl.z = a - b

  return curl
}

/**
 * @param {THREE.Vector3} start
 */
function getPoints(start) {
  const scale = 1
  const tubePoints = []

  tubePoints.push(start)

  let currentPoint = start.clone()
  for (let i = 0; i < 100; i++) {
    const v = computeCurl(
      currentPoint.x / scale,
      currentPoint.y / scale,
      currentPoint.z / scale
    )
    currentPoint.addScaledVector(v, 0.01)

    tubePoints.push(currentPoint.clone())
  }
  return tubePoints
}

const canvas = document.getElementById('webGL')
const cursor = document.querySelector('.cursor')

const scene = new THREE.Scene()
const raycastScene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera()
const controls = new OrbitControls(camera, canvas)
const raycaster = new THREE.Raycaster()
const renderer = new THREE.WebGLRenderer({ canvas })
const clock = new THREE.Clock()

controls.enableDamping = true

camera.fov = 75
camera.aspect = size.width / size.height
camera.far = 100
camera.near = 0.1
camera.position.set(0, 0, 3)
renderer.autoClear = false

scene.add(camera)

const planeMaterial = new THREE.ShaderMaterial({
  vertexShader: tubesVertexShader,
  fragmentShader: tubesFragmentShader,
  uniforms: {
    uTime: { value: 0 },
    uLight: { value: new THREE.Vector3(0, 0, 0) },
  },
})
for (let i = 0; i < 300; i++) {
  const points = getPoints(
    new THREE.Vector3(
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5
    )
  )
  const tubeGeometry = new THREE.TubeBufferGeometry(
    new THREE.CatmullRomCurve3(points),
    256,
    0.01,
    8
  )
  const tube = new THREE.Mesh(tubeGeometry, planeMaterial)
  scene.add(tube)
}

const raycastMaterial = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms: {
    uTime: { value: 0 },
    uLight: { value: new THREE.Vector3(0, 0, 0) },
  },
})
const raycastPlane = new THREE.Mesh(
  new THREE.PlaneBufferGeometry(10, 10),
  raycastMaterial
)
raycastScene.add(raycastPlane)

const lightSphere = new THREE.Mesh(
  new THREE.SphereBufferGeometry(0.05, 8, 8),
  new THREE.MeshBasicMaterial({ color: 0xa8e6cf })
)
scene.add(lightSphere)

function resizeHandler() {
  size.height = window.innerHeight
  size.width = window.innerWidth

  camera.aspect = size.width / size.height
  camera.updateProjectionMatrix()

  renderer.setSize(size.width, size.height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
}
resizeHandler()

window.addEventListener('resize', resizeHandler)

const coordTemp = new THREE.Vector2()
const elasticMouse = new THREE.Vector2()
const elasticMouseVelocity = new THREE.Vector2()

function tick() {
  const elapsedTime = clock.getElapsedTime()

  raycaster.setFromCamera({ x: mouse.x, y: mouse.y }, camera)
  const intersects = raycaster.intersectObjects([raycastPlane])

  if (intersects.length > 0) {
    const point = intersects[0].point
    if (point) {
      coordTemp
        .copy({ x: point.x, y: point.y })
        .sub(elasticMouse)
        .multiplyScalar(0.15)
    }
  }
  lightSphere.position.x = elasticMouse.x
  lightSphere.position.y = elasticMouse.y
  elasticMouseVelocity.add(coordTemp)
  elasticMouseVelocity.multiplyScalar(0.8)
  elasticMouse.add(elasticMouseVelocity)

  planeMaterial.uniforms.uTime.value = elapsedTime
  planeMaterial.uniforms.uLight.value = lightSphere.position
  raycastMaterial.uniforms.uTime.value = elapsedTime
  raycastMaterial.uniforms.uLight.value = lightSphere.position

  controls.update()

  renderer.clear()
  renderer.render(raycastScene, camera)
  renderer.clearDepth()

  renderer.render(scene, camera)

  window.requestAnimationFrame(tick)
}
tick()

const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches
const event = isTouch ? 'touchmove' : 'mousemove'
let timeoutId
window.addEventListener(event, e => {
  if (isTouch && e.touches?.[0]) {
    const touchEvent = e.touches[0]
    mouse.x = (touchEvent.clientX / size.width) * 2 - 1
    mouse.y = (-touchEvent.clientY / size.height) * 2 + 1
    mouse.clientX = touchEvent.clientX
    mouse.clientY = touchEvent.clientY
  } else {
    mouse.x = (e.clientX / size.width) * 2 - 1
    mouse.y = (-e.clientY / size.height) * 2 + 1
    mouse.clientX = e.clientX
    mouse.clientY = e.clientY
  }

  clearTimeout(timeoutId)
  timeoutId = setTimeout(() => {
    mouse.x = 0
    mouse.y = 0
    mouse.clientX = 0
    mouse.clientY = 0
  }, 5000)
})
