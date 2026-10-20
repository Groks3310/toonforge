@import '../../styles/index.css';

.talking-studio {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.talking-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) 360px;
  gap: 18px;
}

.talking-stage-panel,
.talking-controls-panel {
  min-height: 540px;
}

.talking-stage {
  display: grid;
  place-items: center;
  height: 100%;
  min-height: 420px;
  border-radius: 18px;
  background: radial-gradient(circle at top, rgba(232, 195, 106, 0.12), transparent 30%), var(--bg-card);
}

.talking-character {
  --skin-tone: #f3c79b;
  --hair-color: #2d1f1a;
  --eye-color: #2a6f9d;
  --outfit-color: #5f7cff;
  --accent-color: #f3d36d;
  position: relative;
  width: 180px;
  height: 250px;
}

.talking-shadow {
  position: absolute;
  left: 50%;
  bottom: 10px;
  width: 150px;
  height: 18px;
  transform: translateX(-50%);
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.25);
  filter: blur(8px);
}

.talking-hair {
  position: absolute;
  left: 46px;
  top: 18px;
  width: 88px;
  height: 40px;
  border-radius: 50% 50% 38% 38%;
  background: var(--hair-color);
}

.talking-head {
  position: absolute;
  left: 40px;
  top: 46px;
  width: 96px;
  height: 90px;
  border-radius: 42% 42% 48% 48%;
  background: var(--skin-tone);
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.talking-eye {
  position: absolute;
  top: 34px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--eye-color);
}

.talking-eye.left { left: 22px; }
.talking-eye.right { right: 22px; }

.talking-mouth {
  position: absolute;
  left: 50%;
  bottom: 18px;
  width: 22px;
  height: 10px;
  border-bottom: 4px solid rgba(110, 52, 41, 0.9);
  border-radius: 0 0 18px 18px;
  transform: translateX(-50%);
  transition: all 0.08s ease;
}

.is-speaking .talking-mouth {
  width: 30px;
  height: 18px;
  border-bottom-width: 7px;
  animation: mouthPulse 0.18s ease-in-out infinite alternate;
}

.talking-body {
  position: absolute;
  left: 44px;
  top: 118px;
  width: 92px;
  height: 90px;
  border-radius: 18px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--outfit-color) 72%, white), var(--outfit-color));
}

.talking-arm {
  position: absolute;
  top: 8px;
  width: 18px;
  height: 65px;
  border-radius: 999px;
  background: var(--skin-tone);
}

.talking-arm.left { left: -10px; }
.talking-arm.right { right: -10px; }

.is-speaking .talking-arm.left { animation: armBounceLeft 0.28s ease-in-out infinite alternate; }
.is-speaking .talking-arm.right { animation: armBounceRight 0.28s ease-in-out infinite alternate; }

.talking-controls-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.character-picker-row .field,
.compact-slider-group .field {
  margin-bottom: 0;
}

.field textarea {
  width: 100%;
  resize: vertical;
  border-radius: 10px;
  border: 1px solid var(--border-strong);
  background: var(--bg-card);
  color: var(--text);
  padding: 10px 12px;
}

.field select {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border-strong);
  background: var(--bg-card);
  color: var(--text);
}

.compact-slider-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  color: var(--text-muted);
  font-size: 0.82rem;
}

.control-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.recording-box {
  margin-top: 8px;
  padding: 14px;
  border: 1px solid var(--border-strong);
  border-radius: 14px;
  background: var(--bg-card);
}

.recording-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  font-size: 0.9rem;
}

.recording-header span {
  color: var(--text-muted);
}

.audio-player {
  width: 100%;
  margin-top: 12px;
}

.error-box {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(194, 34, 31, 0.12);
  color: var(--danger);
}

@keyframes mouthPulse {
  0% { transform: translateX(-50%) scaleY(0.85); }
  100% { transform: translateX(-50%) scaleY(1.2); }
}

@keyframes armBounceLeft {
  0% { transform: rotate(12deg); }
  100% { transform: rotate(-18deg); }
}

@keyframes armBounceRight {
  0% { transform: rotate(-12deg); }
  100% { transform: rotate(18deg); }
}

@media (max-width: 900px) {
  .talking-layout {
    grid-template-columns: 1fr;
  }
}
