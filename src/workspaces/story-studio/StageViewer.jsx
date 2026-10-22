import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js'

// A 3D stage with any number of robots at once. Each robot has its own colors, its own face
// and its own talking pulse. The robots stand in rows of up to five, and the camera backs
// away to fit everyone.

const MODEL_URL = `${import.meta.env.BASE_URL}models/RobotExpressive.glb`
const PART_MATERIALS = { outfit: 'Main', accent: 'Grey', eyes: 'Black' }
const EXPRESSIONS = { angry: 'Angry', surprised: 'Surprised', sad: 'Sad' }
const SPACING = 2.4
const PER_ROW = 5
const ROW_GAP = 2.6

const cloneModel = SkeletonUtils.clone || (SkeletonUtils.SkeletonUtils && SkeletonUtils.SkeletonUtils.clone)

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

// Where each robot stands. Rows fill from the front, five across, centered.
function layout(count) {
  const rows = Math.ceil(count / PER_ROW)
  const columns = Math.min(count, PER_ROW)
  const positions = []
  for (let index = 0; index < count; index += 1) {
    const row = Math.floor(index / PER_ROW)
    const inRow = row === rows - 1 ? count - row * PER_ROW : PER_ROW
    const column = index - row * PER_ROW
    positions.push({ x: (column - (inRow - 1) / 2) * SPACING, z: -row * ROW_GAP })
  }
  return { positions, columns, rows }
}

// actors: [{ id, colors: { outfit, accent, eyes }, expression }] where expression is
//   'auto' (the animation drives the face), 'neutral', 'surprised', 'sad' or 'angry'.
// speakerId: the id of the actor who is talking right now (or '').
// talkRef: a React ref whose .current (0 to 1) is how open the speaker's mouth is.
export function StageViewer({ actors, speakerId, talkRef }) {
  const mountRef = useRef(null)
  const apiRef = useRef(null)
  const latest = useRef({ actors, speakerId, talkRef })
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')

  useEffect(function track() {
    latest.current = { actors, speakerId, talkRef }
  })

  useEffect(function setup() {
    const mount = mountRef.current
    let disposed = false
    let frame = 0
    let template = null
    let idleClip = null
    let framedKey = ''
    let lastCounts = { columns: 1, rows: 1 }
    const robots = new Map() // actor id -> robot
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
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200)
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
    controls.maxDistance = 90
    controls.maxPolarAngle = Math.PI * 0.52
    controls.update()

    // Backs the camera away and widens the floor so every robot fits.
    function frameCamera(columns, rows, force) {
      lastCounts = { columns, rows }
      const key = columns + 'x' + rows + 'x' + camera.aspect.toFixed(2)
      if (!force && key === framedKey) return
      framedKey = key
      const halfWidth = ((columns - 1) * SPACING) / 2 + 2
      const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
      const distance = Math.max(9, halfWidth / (tan * camera.aspect) + rows * 1.5)
      camera.position.set(0, 3 + rows * 0.8, distance)
      controls.target.set(0, 2, -((rows - 1) * ROW_GAP) / 2)
      controls.update()
      const radius = Math.max(1, halfWidth / 4.5)
      floor.scale.set(radius, radius, 1)
      floor.position.z = -((rows - 1) * ROW_GAP) / 2
    }

    function resize() {
      const width = mount.clientWidth
      const height = mount.clientHeight
      if (width === 0 || height === 0) return
      renderer.setSize(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      frameCamera(lastCounts.columns, lastCounts.rows, false)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(mount)
    resize()

    function createRobot(actor) {
      const root = cloneModel(template.scene)
      const clones = new Map() // original material -> this robot's own copy
      const materials = {} // material name -> { material, original colour }
      const morphMeshes = []

      root.traverse(function each(object) {
        if (!object.isMesh) return
        if (object.morphTargetDictionary) morphMeshes.push(object)
        const list = Array.isArray(object.material) ? object.material : [object.material]
        const own = list.map(function copy(material) {
          if (!clones.has(material)) {
            const duplicate = material.clone()
            clones.set(material, duplicate)
            if (duplicate.name && duplicate.color) {
              materials[duplicate.name] = { material: duplicate, original: duplicate.color.clone() }
            }
          }
          return clones.get(material)
        })
        object.material = Array.isArray(object.material) ? own : own[0]
      })

      const mixer = new THREE.AnimationMixer(root)
      if (idleClip) {
        mixer.clipAction(idleClip).play()
        mixer.setTime(Math.random() * idleClip.duration) // so the robots do not move in lockstep
      }
      const head = root.getObjectByName('Head') || null

      return {
        root,
        mixer,
        materials,
        morphMeshes,
        head,
        headBase: head ? head.scale.clone() : null,
        exprValues: { Angry: 0, Surprised: 0, Sad: 0 },
        actor,
      }
    }

    function removeRobot(robot) {
      scene.remove(robot.root)
      robot.mixer.stopAllAction()
      robot.mixer.uncacheRoot(robot.root)
      Object.values(robot.materials).forEach((entry) => entry.material.dispose())
    }

    function applyColors(robot) {
      Object.keys(PART_MATERIALS).forEach(function each(part) {
        const entry = robot.materials[PART_MATERIALS[part]]
        if (!entry) return
        const value = robot.actor.colors && robot.actor.colors[part]
        if (value) {
          entry.material.color.set(value)
        } else {
          entry.material.color.copy(entry.original)
        }
      })
    }

    // Adds new robots, removes old ones, updates colors and lines everyone up.
    function sync(list) {
      if (!template) return
      const wanted = new Set(list.map((actor) => actor.id))
      robots.forEach(function prune(robot, id) {
        if (!wanted.has(id)) {
          removeRobot(robot)
          robots.delete(id)
        }
      })
      list.forEach(function place(actor) {
        let robot = robots.get(actor.id)
        if (!robot) {
          robot = createRobot(actor)
          robots.set(actor.id, robot)
          scene.add(robot.root)
        }
        robot.actor = actor
        applyColors(robot)
      })
      const { positions, columns, rows } = layout(list.length)
      list.forEach(function stand(actor, index) {
        robots.get(actor.id).root.position.set(positions[index].x, 0, positions[index].z)
      })
      frameCamera(columns, rows, false)
    }

    // The robot has no mouth that opens, so the head stretches a little with the talk level.
    function applyTalk(robot, level) {
      if (!robot.head) return
      robot.head.scale.set(
        robot.headBase.x * (1 - 0.04 * level),
        robot.headBase.y * (1 + 0.1 * level),
        robot.headBase.z * (1 - 0.04 * level),
      )
    }

    // 'auto' hands the face back to the animation once it has eased to neutral.
    function applyExpression(robot) {
      if (robot.morphMeshes.length === 0) return
      const wanted = robot.actor.expression
      const explicit = Boolean(wanted) && wanted !== 'auto'
      const names = Object.keys(robot.exprValues)
      let busy = false
      names.forEach(function ease(name) {
        const target = explicit && EXPRESSIONS[wanted] === name ? 1 : 0
        robot.exprValues[name] += (target - robot.exprValues[name]) * 0.15
        if (robot.exprValues[name] > 0.01) busy = true
      })
      if (!explicit && !busy) return
      robot.morphMeshes.forEach(function each(mesh) {
        names.forEach(function set(name) {
          const index = mesh.morphTargetDictionary[name]
          if (index !== undefined) mesh.morphTargetInfluences[index] = robot.exprValues[name]
        })
      })
    }

    new GLTFLoader().load(
      MODEL_URL,
      function loaded(gltf) {
        if (disposed) {
          disposeTree(gltf.scene)
          return
        }
        template = gltf
        idleClip = gltf.animations.find((clip) => clip.name === 'Idle') || gltf.animations[0] || null
        apiRef.current = { sync }
        sync(latest.current.actors)
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
      const current = latest.current
      const level = current.talkRef && typeof current.talkRef.current === 'number' ? current.talkRef.current : 0
      robots.forEach(function each(robot, id) {
        robot.mixer.update(delta)
        applyTalk(robot, id === current.speakerId ? level : 0)
        applyExpression(robot)
      })
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
      robots.forEach((robot) => removeRobot(robot))
      robots.clear()
      if (template) {
        disposeTree(template.scene)
      }
      floor.geometry.dispose()
      floor.material.dispose()
      renderer.forceContextLoss()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [])

  // Re-sync when anything about the cast changes. The signature avoids work on every render.
  const signature = JSON.stringify(actors)
  useEffect(
    function syncActors() {
      if (apiRef.current) {
        apiRef.current.sync(actors)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature],
  )

  return (
    <div className="motion-viewer" ref={mountRef}>
      {status === 'loading' ? <div className="motion-viewer-note">Loading characters...</div> : null}
      {status === 'error' ? <div className="motion-viewer-note">{message}</div> : null}
      {status === 'ready' && actors.length === 0 ? (
        <div className="motion-viewer-note">Nobody is on stage. Add a character to this scene.</div>
      ) : null}
    </div>
  )
}