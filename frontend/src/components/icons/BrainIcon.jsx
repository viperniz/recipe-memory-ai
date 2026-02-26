import React from 'react'

function BrainIcon({ className = '', animated = false, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`brain-icon ${animated ? 'brain-icon-animated' : ''} ${className}`}
      {...props}
    >
      {/* Left hemisphere */}
      <path d="M12 2C9.5 2 7.5 3.5 7 5.5C5.5 5.8 4 7.2 4 9c0 1.5.8 2.8 2 3.5-.2.5-.3 1-.3 1.5 0 1.8 1.2 3.3 3 3.8.3 1.8 1.8 3.2 3.3 3.2" />
      {/* Right hemisphere */}
      <path d="M12 2c2.5 0 4.5 1.5 5 3.5 1.5.3 3 1.7 3 3.5 0 1.5-.8 2.8-2 3.5.2.5.3 1 .3 1.5 0 1.8-1.2 3.3-3 3.8-.3 1.8-1.8 3.2-3.3 3.2" />
      {/* Central fissure */}
      <path d="M12 2v19" />
      {/* Neural folds */}
      <path d="M8 8c1.3 0 2.5.5 3.2 1.2" />
      <path d="M16 8c-1.3 0-2.5.5-3.2 1.2" />
      <path d="M7.5 13c1.5-.2 3 .3 4 1" />
      <path d="M16.5 13c-1.5-.2-3 .3-4 1" />
    </svg>
  )
}

export default BrainIcon
