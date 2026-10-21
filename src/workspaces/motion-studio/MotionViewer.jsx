import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const MODEL_URL = `${import.meta.env.BASE_URL}models/RobotExpressive.glb`

function disposeTree(root) {
  root.traverse(function each(object) {
    if (object.geometry) {
      object.geometry.dispose()
    }
    if (object.material) {
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach(function free(material) {
        Object.values(material).forEach(function texture(value) {
          if (value && value.isTexture) {
            value.dispose()
          }
        })
        material.dispose()
      })
    }
  })
}

export function MotionViewer({ clip, speed = 1, paused = false, loop = true, restart = 0, onReady })  {
  const mountRef = useRef(null)
  const apiRef = useRef(null)
  const latest = useRef({ clip, speed, paused, loop, onReady })
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')

  useEffect(function track() {
    latest.current = { clip, speed, paused, loop, onReady }
  })

  useEffect(function setup() {
    const mount = mountRef.current
    let disposed = false
    let frame = 0
    let mixer = null
    let current = null
    const actions = {}
    const clock = new THREE.Clock()

    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      setStatus('error')
      setMessage('3D graphics (WebGL) is not available in this browser.')
      return undefined
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
    camera.position.set(0, 3, 10)

    scene.add(new THREE.HemisphereLight(0xffffff, 0x666677, 2.2))
    const sun = new THREE.DirectionalLight(0xffffff, 2.4)
    sun.position.set(3, 8, 5)
    scene.add(sun)

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(5, 48),
      new THREE.MeshStandardMaterial({ color: 0x2a2f3d }),
    )
    floor.rotation.x = -Math.PI / 2
    scene.add(floor)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 2, 0)
    controls.enableDamping = true
    controls.minDistance = 4
    controls.maxDistance = 20
    controls.maxPolarAngle = Math.PI * 0.52
    controls.update()

    function resize() {
      const width = mount.clientWidth
      const height = mount.clientHeight
      if (width === 0 || height === 0) return
      renderer.setSize(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(mount)
    resize()

    function play(name, repeat) {
      if (!mixer) return
      const next = actions[name]
      if (!next) return
      next.reset()
      next.setLoop(repeat ? THREE.LoopRepeat : THREE.LoopOnce, repeat ? Infinity : 1)
      next.clampWhenFinished = true
      if (current && current !== next) {
        next.crossFadeFrom(current, 0.3, false)
      }
      next.play()
      current = next
    }

    function setTime(rate, hold) {
      if (mixer) {
        mixer.timeScale = hold ? 0 : rate
      }
    }

    new GLTFLoader().load(
      MODEL_URL,
      function loaded(gltf) {
        if (disposed) {
          disposeTree(gltf.scene)
          return
        }
        scene.add(gltf.scene)
        mixer = new THREE.AnimationMixer(gltf.scene)
        gltf.animations.forEach(function register(item) {
          actions[item.name] = mixer.clipAction(item)
        })
        apiRef.current = { play, setTime }
        const wanted = latest.current
        play(wanted.clip, wanted.loop)
        setTime(wanted.speed, wanted.paused)
        if (wanted.onReady) {
          wanted.onReady(Object.keys(actions))
        }
        setStatus('ready')
      },
      undefined,
      function failed() {
        if (!disposed) {
          setStatus('error')
          setMessage('Could not load the character model (public/models/RobotExpressive.glb).')
        }
      },
    )

    function tick() {
      frame = requestAnimationFrame(tick)
      const delta = clock.getDelta()
      if (mixer) {
        mixer.update(delta)
      }
      controls.update()
      renderer.render(scene, camera)
    }
    tick()

    return function cleanup() {
      disposed = true
      apiRef.current = null
      cancelAnimationFrame(frame)
      observer.disconnect()
      controls.dispose()
      if (mixer) {
        mixer.stopAllAction()
      }
      disposeTree(scene)
       renderer.forceContextLoss()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [])

  useEffect(
    function changeClip() {
      if (apiRef.current) {
        apiRef.current.play(clip, loop)
      }
    },
    [clip, loop],
  )

  useEffect(
    function changeTime() {
      if (apiRef.current) {
        apiRef.current.setTime(speed, paused)
      }
    },
    [speed, paused],
  )

  return (
    <div className="motion-viewer" ref={mountRef}>
      {status === 'loading' ? <div className="motion-viewer-note">Loading character...</div> : null}
      {status === 'error' ? <div className="motion-viewer-note">{message}</div> : null}
    </div>
  )
}