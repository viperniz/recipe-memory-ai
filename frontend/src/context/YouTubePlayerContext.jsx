import React, { createContext, useContext, useRef, useState, useCallback } from 'react'

const YouTubePlayerContext = createContext(null)

export function YouTubePlayerProvider({ children }) {
  const playerRef = useRef(null)
  const [isReady, setIsReady] = useState(false)

  const registerPlayer = useCallback((player) => {
    playerRef.current = player
    setIsReady(true)
  }, [])

  const unregisterPlayer = useCallback(() => {
    playerRef.current = null
    setIsReady(false)
  }, [])

  const seekTo = useCallback((seconds) => {
    if (playerRef.current) {
      playerRef.current.seekTo(seconds, true)
      playerRef.current.playVideo()
    }
  }, [])

  return (
    <YouTubePlayerContext.Provider value={{ registerPlayer, unregisterPlayer, seekTo, isReady }}>
      {children}
    </YouTubePlayerContext.Provider>
  )
}

export function useYouTubePlayer() {
  return useContext(YouTubePlayerContext)
}
