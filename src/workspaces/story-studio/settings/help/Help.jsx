import '../../styles/info-pages.css'

const SECTIONS = [
  {
    id: 'start',
    title: 'Getting started',
    open: true,
    intro: 'A good first run through the app:',
    steps: [
      'Open Character Studio and create a character. Pick its colors and style, and it is saved on this device.',
      'Open Story Studio. Add a scene, add your character in the Cast tab, then write a few lines in the Dialogue tab.',
      'Press Play story. The lines are spoken one after another, and the character\u2019s mouth follows the words.',
      'Switch the preview between the 2D character and the 3D robot with the toggle under the stage.',
      'Download a backup from Settings when you have something you care about.',
    ],
  },
  {
    id: 'studios',
    title: 'What each studio does',
    points: [
      'Cartoon Studio: upload a photo, apply the cartoon filter, adjust it, change the background, and download the result.',
      'Character Studio: build reusable characters from colors and style options.',
      'Motion Studio: preview movements on a 3D robot, or on a simple 2D character, and chain movements into a saved sequence.',
      'Talking Studio: type or record dialogue, hear it spoken, and watch a mouth preview.',
      'Story Studio: build stories from scenes, a cast and dialogue, then play them with speech.',
    ],
  },
  {
    id: 'saving',
    title: 'Saving and backups',
    intro:
      'Everything is saved automatically in this browser on this computer. It is not synced anywhere, so a different browser or device starts empty. Settings has Download backup and Restore backup. Stories and motion sequences can also be exported from their own studios.',
  },
  {
    id: 'limits',
    title: 'What is not built yet',
    points: [
      'Video export, audio editing and a projects page are planned but not available.',
      'The 3D view uses a free sample robot. Your characters recolor it, but they are not 3D versions of your 2D design.',
      'Mouth movement follows the words in a simple way. It is not exact lip sync.',
      'Voices depend on your device, so they differ between browsers and computers.',
    ],
  },
  {
    id: 'trouble',
    title: 'If something looks wrong',
    points: [
      'Nobody speaks: your browser may have no voices installed. Stories still move on after an estimated reading time.',
      'The 3D view stays empty: WebGL or hardware acceleration may be turned off in your browser settings.',
      'Work is missing: it may have been saved in a different browser, or the browser data was cleared. Restore a backup in Settings if you have one.',
    ],
  },
]

export function Help() {
  return (
    <div className="info-page">
      <div className="section-head">
        <div>
          <p className="eyebrow">Workspace</p>
          <h3>Help &amp; Support</h3>
          <p>ToonForge runs in this browser, on your computer.</p>
        </div>
      </div>

      {SECTIONS.map(function renderSection(section) {
        return (
          <details key={section.id} className="info-details" open={section.open}>
            <summary>{section.title}</summary>
            <div className="info-details-body">
              {section.intro ? <p>{section.intro}</p> : null}
              {section.steps ? (
                <ol>
                  {section.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              ) : null}
              {section.points ? (
                <ul>
                  {section.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </details>
        )
      })}
    </div>
  )
}