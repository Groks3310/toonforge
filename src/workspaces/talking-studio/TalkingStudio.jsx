import { useEffect, useMemo, useRef, useState } from 'react'
import { Mic, MicOff, Play, Square, Volume2 } from 'lucide-react'
import { loadCharacters } from '../../lib/character-store.js'
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

  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const audioRef = useRef(null)

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

  function speakDialogue() {
    const speech = window.speechSynthesis
    if (!speech) {
      setRecordingError('Speech synthesis is not available in this browser.')
      return
    }

    speech.cancel()
    const utterance = new SpeechSynthesisUtterance(dialogue || DEFAULT_TEXT)
    utterance.voice = voices[voiceIndex] || null
    utterance.rate = Number(rate)
    utterance.pitch = Number(pitch)
    utterance.volume = Number(volume)

    utterance.onstart = function start() {
      setIsSpeaking(true)
      setRecordingError('')
    }

    utterance.onend = function end() {
      setIsSpeaking(false)
    }

    utterance.onerror = function fail() {
      setIsSpeaking(false)
      setRecordingError('Speech playback could not run on this device.')
    }

    speech.speak(utterance)
  }

  function stopDialogue() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
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

          <div className="talking-stage">
            <div className={`talking-character ${isSpeaking ? 'is-speaking' : ''}`} style={getCharacterStyle()}>
              <div className="talking-shadow" />
              <div className="talking-hair" />
              <div className="talking-head">
                <span className="talking-eye left" />
                <span className="talking-eye right" />
                <span className="talking-mouth" />
              </div>
              <div className="talking-body" />
              <div className="talking-arm left" />
              <div className="talking-arm right" />
            </div>
          </div>
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
            <button className="primary-btn" type="button" onClick={speakDialogue}>
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

          {recordingError ? <div className="error-box">{recordingError}</div> : null}
        </aside>
      </div>
    </div>
  )
}
