import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Mic, MicOff, Play, Square, Video, Volume2 } from 'lucide-react'
import { loadCharacters } from '../../lib/character-store.js'
import { createTextMouth, getAudioStream, watchAudioMouth } from '../../lib/lip-sync.js'
import {
  BACKGROUNDS,
  VIDEO_PRESETS,
  createCompositor,
  pickVideoFormat,
  startRecording,
} from '../../lib/video-export.js'
import { MotionViewer } from '../motion-studio/MotionViewer.jsx'
import '../motion-studio/motion-studio.css'
import './talking-studio.css'

const DEFAULT_TEXT = 'Hello! I am ready to tell my story with ToonForge.'

export function TalkingStudio() {
  const [characters, setCharacters] = useState(function load() {
    return loadCharacters()
  })
  const [selectedCharacterId, setSelectedCharacterId] = useState('')
  const [dialogue, setDialogue] = useState(DEFAULT_TEXT)
  const [voiceIndex, setVoiceIndex] = useState(0)
  const [voices, setVoices] = useState([])
  const [rate, setRate] = useState(1)
  const [pitch, setPitch] = useState(1)
  const [volume, setVolume] = useState(1)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingError, setRecordingError] = useState('')
  const [recordedUrl, setRecordedUrl] = useState('')
  const [recordingState, setRecordingState] = useState('Ready to record')
  const [view, setView] = useState('2d')
  const [expression, setExpression] = useState('auto')
  const [isExporting, setIsExporting] = useState(false)
  const [exportSeconds, setExportSeconds] = useState(0)
  const [videoUrl, setVideoUrl] = useState('')
  const [videoExt, setVideoExt] = useState('mp4')
  const [videoPreset, setVideoPreset] = useState('landscape')
  const [videoBackground, setVideoBackground] = useState('blue')
  const [videoFraming, setVideoFraming] = useState('whole')

  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const audioRef = useRef(null)
  const mouthRef = useRef(null)
  const textMouthRef = useRef(null)
  const fallbackRef = useRef(0)
  const characterRef = useRef(null)
  const frameRef = useRef(null) // called by the 3D view after each frame while exporting
  const recorderRef = useRef(null)
  const exportTimerRef = useRef(0)
  const finishTimerRef = useRef(0)
  const talkRef = useRef(0) // current mouth level (0 to 1), read by the 3D robot every frame

  // Sends the mouth level to the 2D mouth element and to the 3D robot. Doing this in React
  // state would re-render the whole page 60 times a second. null puts the mouth back to rest.
  function setMouth(level) {
    talkRef.current = level === null ? 0 : level
    const mouth = mouthRef.current
    if (!mouth) return
    mouth.style.height = level === null ? '' : 4 + level * 22 + 'px'
  }

  useEffect(function hydrateCharacters() {
    const list = loadCharacters()
    setCharacters(list)
    if (list.length > 0) {
      setSelectedCharacterId((previous) => previous || list[0].id)
    }
  }, [])

  useEffect(function syncVoices() {
    const speech = window.speechSynthesis
    if (!speech) {
      return undefined
    }

    function updateVoices() {
      setVoices(speech.getVoices())
    }

    updateVoices()
    speech.addEventListener('voiceschanged', updateVoices)
    return function cleanup() {
      speech.removeEventListener('voiceschanged', updateVoices)
    }
  }, [])

  // Blink the 2D character every few seconds. The eyes are squashed with the CSS "scale"
  // property, which does not clash with any transform your styles already use.
  useEffect(
    function blink() {
      if (view !== '2d') {
        return undefined
      }
      let timer = 0

      function setEyes(closed) {
        const root = characterRef.current
        if (!root) return
        root.querySelectorAll('.talking-eye').forEach(function each(eye) {
          eye.style.transition = 'scale 80ms'
          eye.style.scale = closed ? '1 0.1' : ''
        })
      }

      function schedule() {
        timer = setTimeout(function close() {
          setEyes(true)
          timer = setTimeout(function open() {
            setEyes(false)
            schedule()
          }, 130)
        }, 2200 + Math.random() * 3500)
      }

      schedule()
      return function cleanup() {
        clearTimeout(timer)
        setEyes(false)
      }
    },
    [view],
  )

  useEffect(function setupTextMouth() {
    const textMouth = createTextMouth(setMouth)
    textMouthRef.current = textMouth
    return function cleanup() {
      clearTimeout(fallbackRef.current)
      textMouth.stop()
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  // Whenever a recording or imported clip is loaded, make the mouth follow its sound.
  useEffect(
    function followAudio() {
      if (!recordedUrl || !audioRef.current) {
        return undefined
      }
      return watchAudioMouth(audioRef.current, setMouth)
    },
    [recordedUrl],
  )

  // Free the finished video's memory when it is replaced or the page is left.
  useEffect(
    function cleanupVideoUrl() {
      return function revoke() {
        if (videoUrl) {
          URL.revokeObjectURL(videoUrl)
        }
      }
    },
    [videoUrl],
  )

  // If the person leaves mid-recording, stop the recorder and its timers.
  useEffect(function stopExportOnLeave() {
    return function cleanup() {
      clearInterval(exportTimerRef.current)
      clearTimeout(finishTimerRef.current)
      frameRef.current = null
      if (recorderRef.current) {
        recorderRef.current.stop()
        recorderRef.current = null
      }
    }
  }, [])

  useEffect(
    function cleanupUrls() {
      return function revoke() {
        if (recordedUrl) {
          URL.revokeObjectURL(recordedUrl)
        }
      }
    },
    [recordedUrl],
  )

  const selectedCharacter = useMemo(function pickCharacter() {
    return characters.find((item) => item.id === selectedCharacterId) || characters[0] || null
  }, [characters, selectedCharacterId])

  function speakDialogue(onDone) {
    const speech = window.speechSynthesis
    if (!speech) {
      setRecordingError('Speech synthesis is not available in this browser.')
      return
    }

    speech.cancel()
    clearTimeout(fallbackRef.current)
    const text = dialogue || DEFAULT_TEXT
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.voice = voices[voiceIndex] || null
    utterance.rate = Number(rate)
    utterance.pitch = Number(pitch)
    utterance.volume = Number(volume)

    let sawBoundary = false

    utterance.onstart = function start() {
      setIsSpeaking(true)
      setRecordingError('')
      // Some voices never report word timing. If none arrives, animate across the whole text.
      fallbackRef.current = setTimeout(function fallback() {
        if (!sawBoundary && textMouthRef.current) {
          textMouthRef.current.word(text, Number(rate))
        }
      }, 400)
    }

    utterance.onboundary = function boundary(event) {
      if (event.name && event.name !== 'word') {
        return
      }
      sawBoundary = true
      const match = text.slice(event.charIndex).match(/^\S+/)
      if (match && textMouthRef.current) {
        textMouthRef.current.word(match[0], Number(rate))
      }
    }

    utterance.onend = function end() {
      clearTimeout(fallbackRef.current)
      if (textMouthRef.current) {
        textMouthRef.current.stop()
      }
      setIsSpeaking(false)
      if (typeof onDone === 'function') {
        onDone()
      }
    }

    utterance.onerror = function fail() {
      clearTimeout(fallbackRef.current)
      if (textMouthRef.current) {
        textMouthRef.current.stop()
      }
      setIsSpeaking(false)
      setRecordingError('Speech playback could not run on this device.')
      if (typeof onDone === 'function') {
        onDone()
      }
    }

    speech.speak(utterance)
  }

  function stopDialogue() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    clearTimeout(fallbackRef.current)
    if (textMouthRef.current) {
      textMouthRef.current.stop()
    }
    setIsSpeaking(false)
  }

  function finishExport(immediately) {
    clearTimeout(finishTimerRef.current)

    function stopNow() {
      if (recorderRef.current) {
        recorderRef.current.stop()
        recorderRef.current = null
      }
    }

    if (immediately) {
      stopDialogue()
      if (audioRef.current) {
        audioRef.current.pause()
      }
      stopNow()
    } else {
      // A short pause at the end so the last word is not cut off.
      finishTimerRef.current = setTimeout(stopNow, 600)
    }
  }

  function handleVideoDone(blob, extension) {
    frameRef.current = null
    clearInterval(exportTimerRef.current)
    setIsExporting(false)
    if (blob.size === 0) {
      setRecordingError('The video came out empty. Please try again.')
      return
    }
    setVideoExt(extension)
    setVideoUrl(URL.createObjectURL(blob))
  }

  function startVideoExport() {
    setRecordingError('')
    if (view !== '3d') {
      setRecordingError('Switch to the 3D robot to record a video.')
      return
    }
    if (!pickVideoFormat()) {
      setRecordingError('This browser cannot record video. Try a recent Chrome, Edge, Firefox or Safari.')
      return
    }

    const useClip = Boolean(recordedUrl && audioRef.current)
    const audioStream = useClip ? getAudioStream(audioRef.current) : null
    if (useClip && !audioStream) {
      setRecordingError('This browser cannot capture the clip\'s sound for the video.')
      return
    }

    const preset = VIDEO_PRESETS[videoPreset]
    const compositor = createCompositor({
      width: preset.width,
      height: preset.height,
      background: BACKGROUNDS[videoBackground],
      framing: videoFraming,
    })
    frameRef.current = compositor.draw

    try {
      recorderRef.current = startRecording({
        canvas: compositor.canvas,
        audioStream,
        onDone: handleVideoDone,
      })
    } catch (error) {
      frameRef.current = null
      setRecordingError(error.message || 'Could not start recording.')
      return
    }

    setVideoUrl('')
    setExportSeconds(0)
    setIsExporting(true)
    clearInterval(exportTimerRef.current)
    exportTimerRef.current = setInterval(function tick() {
      setExportSeconds((seconds) => seconds + 1)
    }, 1000)

    if (useClip) {
      const audio = audioRef.current
      audio.currentTime = 0
      audio.addEventListener('ended', function done() {
        finishExport(false)
      }, { once: true })
      audio.play().catch(function fail() {
        finishExport(true)
        setRecordingError('The clip could not be played, so nothing was recorded.')
      })
    } else {
      speakDialogue(function done() {
        finishExport(false)
      })
    }
  }

  function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setRecordingError('Microphone recording is not supported in this browser.')
      return
    }

    setRecordingError('')

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(function capture(stream) {
        streamRef.current = stream
        const recorder = new MediaRecorder(stream)
        mediaRecorderRef.current = recorder
        chunksRef.current = []

        recorder.ondataavailable = function collect(event) {
          if (event.data && event.data.size > 0) {
            chunksRef.current.push(event.data)
          }
        }

        recorder.onstop = function stop() {
          const blob = new Blob(chunksRef.current, {
            type: recorder.mimeType || 'audio/webm',
          })

          if (blob.size === 0) {
            setRecordingState('No audio captured')
            setIsRecording(false)
            return
          }

          const nextUrl = URL.createObjectURL(blob)
          if (recordedUrl) {
            URL.revokeObjectURL(recordedUrl)
          }

          setRecordedUrl(nextUrl)
          setRecordingState('Audio ready to preview')
          setIsRecording(false)

          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop())
            streamRef.current = null
          }
        }

        recorder.start()
        setIsRecording(true)
        setRecordingState('Recording...')
      })
      .catch(function fail(error) {
        const message =
          error && error.name === 'NotAllowedError'
            ? 'Microphone access was denied. Please allow access to record audio.'
            : 'Microphone recording is not available on this device.'
        setRecordingError(message)
        setRecordingState('Ready to record')
        setIsRecording(false)
      })
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      setRecordingState('Finalizing recording...')
      return
    }

    setIsRecording(false)
  }

  function handleAudioImport(event) {
    const file = event.target.files && event.target.files[0]
    if (!file) {
      return
    }

    if (!file.type.startsWith('audio/')) {
      setRecordingError('Please choose a valid audio file.')
      return
    }

    const nextUrl = URL.createObjectURL(file)
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl)
    }

    setRecordedUrl(nextUrl)
    setRecordingState(`Loaded ${file.name}`)
    setRecordingError('')
    event.target.value = ''
  }

  function playRecordedAudio() {
    if (!recordedUrl || !audioRef.current) {
      return
    }

    audioRef.current.currentTime = 0
    audioRef.current
      .play()
      .catch(function fail() {
        setRecordingError('Recorded audio could not be played.')
      })
  }

  function getCharacterStyle() {
    if (!selectedCharacter) {
      return {
        '--skin-tone': '#f3c79b',
        '--hair-color': '#2d1f1a',
        '--eye-color': '#2a6f9d',
        '--outfit-color': '#5f7cff',
      }
    }

    return {
      '--skin-tone': selectedCharacter.skinTone || '#f3c79b',
      '--hair-color': selectedCharacter.hairColor || '#2d1f1a',
      '--eye-color': selectedCharacter.eyeColor || '#2a6f9d',
      '--outfit-color': selectedCharacter.outfitColor || '#5f7cff',
    }
  }

  return (
    <div className="talking-studio">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Workspace</p>
          <h2>Talking Studio</h2>
        </div>
      </div>

      <div className="talking-layout">
        <section className="panel talking-stage-panel">
          <div className="panel-head">
            <h3>Preview</h3>
          </div>

          <div className="seg" role="group" aria-label="Preview type">
            <button type="button" className={view === '3d' ? 'active' : ''} onClick={() => setView('3d')}>
              3D robot
            </button>
            <button type="button" className={view === '2d' ? 'active' : ''} onClick={() => setView('2d')}>
              2D character
            </button>
          </div>

          {view === '3d' ? (
            <MotionViewer
              clip="Idle"
              talkRef={talkRef}
              expression={expression}
              frameRef={frameRef}
              colors={
                selectedCharacter
                  ? {
                      outfit: selectedCharacter.outfitColor,
                      accent: selectedCharacter.accentColor,
                      eyes: selectedCharacter.eyeColor,
                    }
                  : undefined
              }
            />
          ) : (
            <div className="talking-stage">
              <div className="talking-character" style={getCharacterStyle()} ref={characterRef}>
                <div className="talking-shadow" />
                <div className="talking-hair" />
                <div className="talking-head">
                  <span className="talking-eye left" />
                  <span className="talking-eye right" />
                  <span className="talking-mouth" ref={mouthRef} />
                </div>
                <div className="talking-body" />
                <div className="talking-arm left" />
                <div className="talking-arm right" />
              </div>
            </div>
          )}

          {view === '3d' ? (
            <div className="seg" role="group" aria-label="Robot expression">
              {[
                ['auto', 'Auto'],
                ['neutral', 'Neutral'],
                ['surprised', 'Surprised'],
                ['sad', 'Sad'],
                ['angry', 'Angry'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={expression === id ? 'active' : ''}
                  onClick={() => setExpression(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <aside className="panel talking-controls-panel">
          <div className="panel-head">
            <h3>Dialogue</h3>
          </div>

          <div className="field character-picker-row">
            <label htmlFor="character-picker">Character</label>
            <select
              id="character-picker"
              value={selectedCharacterId}
              onChange={function change(event) {
                setSelectedCharacterId(event.target.value)
              }}
            >
              {characters.length === 0 ? <option value="">No characters yet</option> : null}
              {characters.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="dialogue-entry">Text</label>
            <textarea
              id="dialogue-entry"
              rows={6}
              value={dialogue}
              onChange={function change(event) {
                setDialogue(event.target.value)
              }}
            />
          </div>

          <div className="field">
            <label htmlFor="voice-select">Voice</label>
            <select
              id="voice-select"
              value={voiceIndex}
              onChange={function choose(event) {
                setVoiceIndex(Number(event.target.value))
              }}
            >
              {voices.length === 0 ? (
                <option value={0}>Browser voices are loading...</option>
              ) : (
                voices.map((voice, index) => (
                  <option key={`${voice.name}-${voice.lang}-${index}`} value={index}>
                    {voice.name} ({voice.lang})
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="compact-slider-group">
            <div className="field">
              <div className="field-top">
                <label htmlFor="speech-rate">Rate</label>
                <span>{rate.toFixed(1)}x</span>
              </div>
              <input
                id="speech-rate"
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={rate}
                onChange={function change(event) {
                  setRate(Number(event.target.value))
                }}
              />
            </div>

            <div className="field">
              <div className="field-top">
                <label htmlFor="speech-pitch">Pitch</label>
                <span>{pitch.toFixed(1)}</span>
              </div>
              <input
                id="speech-pitch"
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={pitch}
                onChange={function change(event) {
                  setPitch(Number(event.target.value))
                }}
              />
            </div>

            <div className="field">
              <div className="field-top">
                <label htmlFor="speech-volume">Volume</label>
                <span>{volume.toFixed(1)}</span>
              </div>
              <input
                id="speech-volume"
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={function change(event) {
                  setVolume(Number(event.target.value))
                }}
              />
            </div>
          </div>

          <div className="control-row">
            <button className="primary-btn" type="button" onClick={() => speakDialogue()}>
              <Volume2 size={16} />
              Speak
            </button>
            <button className="secondary-btn" type="button" onClick={stopDialogue}>
              <Square size={16} />
              Stop
            </button>
          </div>

          <div className="recording-box">
            <div className="recording-header">
              <strong>Voice recording</strong>
              <span>{recordingState}</span>
            </div>

            <div className="control-row">
              {!isRecording ? (
                <button className="primary-btn" type="button" onClick={startRecording}>
                  <Mic size={16} />
                  Record
                </button>
              ) : (
                <button className="secondary-btn" type="button" onClick={stopRecording}>
                  <MicOff size={16} />
                  Stop
                </button>
              )}

              <label className="secondary-btn file-button" htmlFor="audio-import">
                <Play size={16} />
                Import audio
              </label>
              <input id="audio-import" type="file" accept="audio/*" onChange={handleAudioImport} hidden />
            </div>

            {recordedUrl ? (
              <div className="audio-player-row">
                <audio ref={audioRef} className="audio-player" controls src={recordedUrl} />
                <button className="secondary-btn" type="button" onClick={playRecordedAudio}>
                  Preview clip
                </button>
              </div>
            ) : null}
          </div>

          <div className="recording-box">
            <div className="recording-header">
              <strong>Export video</strong>
              <span>
                {isExporting ? `Recording... ${exportSeconds}s` : videoUrl ? 'Video ready' : 'Ready to record'}
              </span>
            </div>

            {view !== '3d' ? <small>Switch to the 3D robot to record a video.</small> : null}

            <div className="field">
              <label htmlFor="video-format">Format</label>
              <select
                id="video-format"
                value={videoPreset}
                disabled={isExporting}
                onChange={(event) => setVideoPreset(event.target.value)}
              >
                {Object.entries(VIDEO_PRESETS).map(([id, preset]) => (
                  <option key={id} value={id}>{preset.label}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="video-background">Background</label>
              <select
                id="video-background"
                value={videoBackground}
                disabled={isExporting}
                onChange={(event) => setVideoBackground(event.target.value)}
              >
                {Object.entries(BACKGROUNDS).map(([id, item]) => (
                  <option key={id} value={id}>{item.label}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="video-framing">Framing</label>
              <select
                id="video-framing"
                value={videoFraming}
                disabled={isExporting}
                onChange={(event) => setVideoFraming(event.target.value)}
              >
                <option value="whole">Whole view</option>
                <option value="close">Close-up (crops the edges)</option>
              </select>
            </div>

            <div className="control-row">
              {!isExporting ? (
                <button className="primary-btn" type="button" disabled={view !== '3d'} onClick={startVideoExport}>
                  <Video size={16} />
                  Record video
                </button>
              ) : (
                <button className="secondary-btn" type="button" onClick={() => finishExport(true)}>
                  <Square size={16} />
                  Stop and save
                </button>
              )}
            </div>

            <small>
              {recordedUrl
                ? 'The video uses your recorded or imported clip as its sound and ends when the clip ends.'
                : 'No clip loaded. A browser voice cannot be recorded, so this video will have no sound. Record or import audio to add a voice.'}
            </small>

            {videoUrl ? (
              <>
                <video className="audio-player" controls src={videoUrl} style={{ width: '100%' }} />
                <a className="primary-btn" href={videoUrl} download={`toonforge-video.${videoExt}`}>
                  <Download size={16} />
                  Download video
                </a>
                {videoExt === 'webm' ? (
                  <small>
                    This browser saved WebM. Many phone apps want MP4, so convert it before posting, or record in
                    Chrome or Safari for MP4.
                  </small>
                ) : null}
              </>
            ) : null}
          </div>

          {recordingError ? <div className="error-box">{recordingError}</div> : null}
        </aside>
      </div>
    </div>
  )
}