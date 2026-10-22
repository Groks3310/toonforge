export function IconButton({ label, onClick, disabled = false, danger = false, children }) {
  return (
    <button
      type="button"
      className={danger ? 'tf-btn tf-icon-btn tf-btn--danger' : 'tf-btn tf-icon-btn'}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}