import { useRef, useState } from 'react'
import { Download, Trash2, Upload } from 'lucide-react'
import '../../styles/ui-kit.css'
import '../../styles/info-pages.css'

const STORES = [
  { key: 'toonforge-characters-v1', field: 'characters', label: 'Characters' },
  { key: 'toonforge-stories-v1', field: 'stories', label: 'Stories' },
  { key: 'toonforge-motion-sequences-v1', field: 'motionSequences', label: 'Motion sequences' },
]
const MAX_BACKUP_BYTES = 25 * 1024 * 1024

function readList(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) {
      return { items: [], bytes: 0 }
    }
    const parsed = JSON.parse(raw)
    return { items: Array.isArray(parsed) ? parsed : [], bytes: raw.length }
  } catch {
    return { items: [], bytes: 0 }
  }
}

function readAll() {
  const result = {}
  STORES.forEach(function each(store) {
    result[store.field] = readList(store.key)
  })
  return result
}

function formatSize(bytes) {
  if (bytes === 0) return '0 KB'
  if (bytes < 1024) return '<1 KB'
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function detail(store, entry) {
  const count = entry.items.length
  if (store.field === 'stories') {
    const scenes = entry.items.reduce((sum, item) => sum + (item && Array.isArray(item.scenes) ? item.scenes.length : 0), 0)
    return count + (count === 1 ? ' story' : ' stories') + ', ' + scenes + (scenes === 1 ? ' scene' : ' scenes') + ' (' + formatSize(entry.bytes) + ')'
  }
  return count + (count === 1 ? ' item' : ' items') + ' (' + formatSize(entry.bytes) + ')'
}

export function Settings() {
  const [data, setData] = useState(readAll)
  const [message, setMessage] = useState(null)
  const fileInputRef = useRef(null)

  const total = STORES.reduce((sum, store) => sum + data[store.field].items.length, 0)

  function say(text, error = false) {
    setMessage({ text, error })
  }

  function downloadBackup() {
    const fresh = readAll()
    const count = STORES.reduce((sum, store) => sum + fresh[store.field].items.length, 0)
    if (count === 0) {
      say('There is nothing saved yet, so there is nothing to back up.')
      return
    }
    const payload = { app: 'toonforge', type: 'backup', version: 1, exportedAt: new Date().toISOString() }
    STORES.forEach(function add(store) {
      payload[store.field] = fresh[store.field].items
    })
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'toonforge-backup-' + new Date().toISOString().slice(0, 10) + '.json'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setData(fresh)
    say('Backup downloaded. Keep the file somewhere safe.')
  }

  function restoreBackup(event) {
    const file = event.target.files && event.target.files[0]
    event.target.value = ''
    if (!file) return
    if (file.size > MAX_BACKUP_BYTES) {
      say('That file is too large to be a ToonForge backup.', true)
      return
    }
    const reader = new FileReader()
    reader.onerror = function failed() {
      say('Could not read that file.', true)
    }
    reader.onload = function loaded() {
      try {
        const parsed = JSON.parse(String(reader.result))
        if (!parsed || parsed.app !== 'toonforge' || parsed.type !== 'backup') {
          throw new Error('This is not a ToonForge backup file.')
        }
        const present = STORES.filter((store) => Array.isArray(parsed[store.field]))
        if (present.length === 0) {
          throw new Error('This backup has no saved data in it.')
        }
        const summary = present.map((store) => parsed[store.field].length + ' ' + store.label.toLowerCase()).join(', ')
        const sure = window.confirm(
          'Restore ' + summary + '?\n\nThis replaces what is saved in this browser for those items. Download a backup first if you want to keep your current work.',
        )
        if (!sure) return

        const previous = present.map((store) => [store.key, localStorage.getItem(store.key)])
        try {
          present.forEach(function write(store) {
            localStorage.setItem(store.key, JSON.stringify(parsed[store.field]))
          })
        } catch {
          previous.forEach(function rollback(entry) {
            if (entry[1] === null) {
              localStorage.removeItem(entry[0])
            } else {
              localStorage.setItem(entry[0], entry[1])
            }
          })
          throw new Error('There is not enough browser storage space for this backup. Nothing was changed.')
        }
        setData(readAll())
        say('Backup restored: ' + summary + '.')
      } catch (error) {
        say(error.message || 'Could not restore that file.', true)
      }
    }
    reader.readAsText(file)
  }

  function deleteAll() {
    const sure = window.confirm(
      'Delete all saved characters, stories and motion sequences from this browser?\n\nThis cannot be undone. Download a backup first if you want to keep them.',
    )
    if (!sure) return
    try {
      STORES.forEach((store) => localStorage.removeItem(store.key))
      setData(readAll())
      say('All saved data was deleted from this browser.')
    } catch {
      say('Could not delete the saved data.', true)
    }
  }

  return (
    <div className="info-page">
      <div className="section-head">
        <div>
          <p className="eyebrow">Workspace</p>
          <h3>Settings</h3>
          <p>Your work lives in this browser. Back it up here.</p>
        </div>
      </div>

      {message ? (
        <div className={message.error ? 'info-message error' : 'info-message'} role="status">
          {message.text}
        </div>
      ) : null}

      <section className="panel info-panel">
        <h4>Appearance</h4>
        <p className="info-muted">
          Switch between Light, Dark and System with the theme control in the top-right corner.
        </p>
      </section>

      <section className="panel info-panel">
        <h4>Your saved data</h4>
        <dl className="info-stats">
          {STORES.map((store) => (
            <div key={store.key}>
              <dt>{store.label}</dt>
              <dd>{detail(store, data[store.field])}</dd>
            </div>
          ))}
        </dl>
        <div className="info-actions">
          <button type="button" className="tf-btn tf-btn--primary" onClick={downloadBackup}>
            <Download size={16} /> Download backup
          </button>
          <button
            type="button"
            className="tf-btn"
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
          >
            <Upload size={16} /> Restore backup
          </button>
          <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={restoreBackup} hidden />
          <button type="button" className="tf-btn tf-btn--danger" disabled={total === 0} onClick={deleteAll}>
            <Trash2 size={16} /> Delete all saved data
          </button>
        </div>
        <p className="info-muted">
          Browsers limit how much a site can store, usually around 5 MB for this kind of storage. Clearing your
          browser data, using a private window or switching browsers also removes your work, so download a backup
          now and then.
        </p>
      </section>

      <section className="panel info-panel">
        <h4>Privacy</h4>
        <ul>
          <li>There is no account, no cloud upload and no paid service. Photos are processed in this browser.</li>
          <li>The background cutout model runs on your computer.</li>
          <li>
            Spoken voices come from your browser or operating system. Some browsers offer online voices, which send
            the spoken text to that provider. If that matters to you, choose an offline voice in your system settings.
          </li>
          <li>Microphone recording only starts when you press record, and only after you give permission.</li>
        </ul>
      </section>
    </div>
  )
}