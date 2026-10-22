import { useState } from 'react'
import { ArrowRight, BookOpen, CircleHelp, Image, Mic, PersonStanding, Plus, Settings as SettingsIcon, UserRound } from 'lucide-react'
import { hasSavedStories, loadStories } from '../../lib/story-store.js'
import '../../styles/ui-kit.css'
import './dashboard-extras.css'

// Only studios that work are listed. Add a card here when a new studio is finished.
const SHORTCUTS = [
  {
    id: 'cartoon',
    title: 'Photo to Cartoon',
    body: 'Turn a photo into stylized cartoon art, with background cutout. It runs on your computer.',
    icon: Image,
  },
  {
    id: 'character',
    title: 'Build Characters',
    body: 'Create reusable characters and save them on this device.',
    icon: UserRound,
  },
  {
    id: 'motion',
    title: 'Animate Movement',
    body: 'Preview movements on a 3D robot, then chain them into sequences.',
    icon: PersonStanding,
  },
  {
    id: 'talking',
    title: 'Make It Talk',
    body: 'Type or record dialogue, hear it spoken, and watch the mouth move.',
    icon: Mic,
  },
  {
    id: 'story',
    title: 'Tell a Story',
    body: 'Build multi-scene stories with a cast, dialogue and spoken playback.',
    icon: BookOpen,
  },
]

const VISIBLE_STORIES = 4

function plural(count, word) {
  return count + ' ' + word + (count === 1 ? '' : 's')
}

export function Dashboard({ onNavigate, onOpenStory }) {
  // Shows nothing until Story Studio has saved something, so new users see an empty state.
  const [stories] = useState(function read() {
    return hasSavedStories() ? loadStories() : []
  })

  function openStory(id) {
    if (onOpenStory) {
      onOpenStory(id)
    } else {
      onNavigate('story')
    }
  }

  return (
    <div>
      <section className="hero">
        <div>
          <p className="eyebrow">Welcome to ToonForge</p>
          <h2>Bring your imagination to life</h2>
          <p>
            Turn photos into cartoons, build characters, animate them, make them talk, and put
            them together in stories. Everything runs in this browser, on your computer.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              className="primary-btn"
              onClick={function go() {
                onNavigate('story')
              }}
            >
              <Plus size={16} />
              Start a story
            </button>
            <button
              type="button"
              className="tf-btn"
              onClick={function go() {
                onNavigate('cartoon')
              }}
            >
              New cartoon
            </button>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-portrait" />
          <div className="hero-note">
            Your story
            <br />
            your way
          </div>
        </div>
      </section>

      <div className="shortcut-grid">
        {SHORTCUTS.map(function renderCard(item) {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              className="shortcut-card"
              onClick={function go() {
                onNavigate(item.id)
              }}
            >
              <div className="shortcut-icon">
                <Icon size={18} />
              </div>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <span className="arrow">
                <ArrowRight size={14} />
              </span>
            </button>
          )
        })}
      </div>

      <div className="section-head">
        <div>
          <h3>Your stories</h3>
          <p>Stories are saved in this browser. Use Export in Story Studio to back them up.</p>
        </div>
      </div>
      <div className="empty-row">
        {stories.length === 0 ? (
          <div className="empty-state panel">
            <p className="empty-copy">You have not started a story yet.</p>
            <button
              type="button"
              className="tf-btn tf-btn--primary"
              onClick={function go() {
                onNavigate('story')
              }}
            >
              <Plus size={16} />
              Start a story
            </button>
          </div>
        ) : (
          <div className="panel dash-stories">
            <ul className="dash-story-list">
              {stories.slice(0, VISIBLE_STORIES).map(function renderStory(story) {
                const lineCount = story.scenes.reduce((sum, scene) => sum + scene.lines.length, 0)
                return (
                  <li key={story.id}>
                    <button
                      type="button"
                      className="dash-story"
                      onClick={function open() {
                        openStory(story.id)
                      }}
                    >
                      <span className="dash-story-icon">
                        <BookOpen size={16} />
                      </span>
                      <span className="dash-story-copy">
                        <strong>{story.title}</strong>
                        <small>
                          {plural(story.scenes.length, 'scene')} &middot; {plural(lineCount, 'line')}
                        </small>
                      </span>
                      <ArrowRight size={14} />
                    </button>
                  </li>
                )
              })}
            </ul>
            {stories.length > VISIBLE_STORIES ? (
              <p className="dash-more">
                and {stories.length - VISIBLE_STORIES} more in Story Studio
              </p>
            ) : null}
          </div>
        )}
        <div className="promo-card">
          <p className="eyebrow">Local first</p>
          <h3>Your photos stay here</h3>
          <p className="empty-copy">
            Processing happens in this browser. There is no account, no cloud upload, and no paid API.
          </p>
        </div>
      </div>

            <div className="dash-footer-links">
        <button
          type="button"
          className="tf-btn"
          onClick={function go() {
            onNavigate('settings')
          }}
        >
          <SettingsIcon size={16} /> Settings and backup
        </button>
        <button
          type="button"
          className="tf-btn"
          onClick={function go() {
            onNavigate('help')
          }}
        >
          <CircleHelp size={16} /> Help
        </button>
      </div>
    </div>
  )
}