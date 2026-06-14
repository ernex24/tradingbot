export default function InfoTip({ children }) {
  return (
    <span className="info" tabIndex="0">
      <span className="info-icon" aria-hidden="true">i</span>
      <span className="info-tip" role="tooltip">{children}</span>
    </span>
  )
}
