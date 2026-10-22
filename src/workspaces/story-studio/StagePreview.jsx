import { CharacterFigure } from './CharacterFigure.jsx'
import { StageViewer } from './StageViewer.jsx'

export function StagePreview({ view, look, cast, actors, speakerMemberId, speaking, talkRef, caption, hasCharacters }) {
  return (
    <div
      className="ss-stage"
      style={{ background: 'linear-gradient(180deg,' + look.sky1 + ',' + look.sky2 + ')' }}
    >
      {view === '3d' ? (
        <StageViewer actors={actors} speakerId={speakerMemberId} talkRef={talkRef} />
      ) : (
        <>
          <div className="ss-ground" />
          {cast.map((entry, index) => (
            <CharacterFigure
              key={entry.member.id}
              character={entry.character}
              large
              index={index}
              total={cast.length}
              speaking={speaking && entry.member.id === speakerMemberId}
            />
          ))}
          {cast.length === 0 ? (
            <div className="ss-stage-note">
              {hasCharacters
                ? 'Nobody is on stage. Add a character in the Cast tab.'
                : 'Create a character in Character Studio, then cast it here.'}
            </div>
          ) : null}
        </>
      )}
      <div className="ss-caption">
        {caption ? (
          <>
            <strong>{caption.speaker}</strong>
            <span>{caption.text}</span>
          </>
        ) : (
          <span className="ss-caption-empty">No dialogue yet.</span>
        )}
      </div>
    </div>
  )
}