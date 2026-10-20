import { ArrowRight, BookOpen, Clapperboard, Image, Mic, PersonStanding, Plus, UserRound } from 'lucide-react'

const SHORTCUTS = [
  {
    id: 'cartoon',
    title: 'Photo to Cartoon',
    body: 'Turn your photos into stylized cartoon art with our local filter.',
    icon: Image,
    ready: true,
  },
  {
    id: 'character',
    title: 'Build Characters',
    body: 'Create reusable cartoon avatars and save them on this device.',
    icon: UserRound,
    ready: true,
  },
  {
    id: 'motion',
    title: 'Animate Movement',
    body: 'Preview simple character motions and movement loops in real time.',
    icon: PersonStanding,
    ready: true,
  },
  {
    id: 'talking',
    title: 'Make It Talk',
    body: 'Voice and mouth animation come after Character Studio.',
    icon: Mic,
    ready: false,
  },
  {
    id: 'video',
    title: 'Create a Video',
    body: 'Timeline editing will combine scenes, audio, and captions.',
    icon: Clapperboard,
    ready: false,
  },
  {
    id: 'story',
    title: 'Tell a Story',
    body: 'Multi-scene stories will be built from characters you already have.',
    icon: BookOpen,
    ready: false,
  },
]

export function Dashboard({ onNavigate }) {
  return (
    <div>
      <section className="hero">
        <div>
          <p className="eyebrow">Welcome to ToonForge</p>
          <h2>Bring your imagination to life</h2>
          <p>
            Create cartoons, animate characters, make them talk and move, and turn ideas
            into videos. We start with a real photo-to-cartoon tool that runs on your computer.
          </p>
          <button type="button" className="primary-btn" onClick={function go() { onNavigate('cartoon') }}>
            <Plus size={16} />
            New cartoon
          </button>
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
          <h3>Featured templates</h3>
          <p>Story templates will appear here when Story Studio is built. Nothing is faked.</p>
        </div>
      </div>
      <div className="empty-row">
        <div className="empty-state panel">
          <p className="empty-copy">
            No templates yet. The first working studio is Cartoon Studio: upload a photo,
            apply our cartoon filter, and download the result.
          </p>
        </div>
        <div className="promo-card">
          <p className="eyebrow">Local first</p>
          <h3>Your photos stay here</h3>
          <p className="empty-copy">
            Processing happens in this browser. There is no account, no cloud upload, and no paid API.
          </p>
        </div>
      </div>

      <div className="section-head">
        <div>
          <h3>Recent projects</h3>
          <p>Saved projects will show here after we add local storage.</p>
        </div>
      </div>
      <div className="empty-state panel">
        <p className="empty-copy">You have not saved a project yet.</p>
      </div>
    </div>
  )
}
