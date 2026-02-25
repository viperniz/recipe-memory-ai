import React, { createContext, useContext, useRef, useState, useCallback } from 'react'

const YouTubePlayerContext = createContext(null)

export const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
}

export function YouTubePlayerProvider({ children }) {
  const playerRef = useRef(null)
  const [isReady, setIsReady] = useState(false)
  const [playerState, setPlayerState] = useState(YT_STATE.UNSTARTED)
  const onSeekRef = useRef(null)

  const registerPlayer = useCallback((player) => {
    playerRef.current = player
    setIsReady(true)
  }, [])

  const unregisterPlayer = useCallback(() => {
    playerRef.current = null
    setIsReady(false)
    setPlayerState(YT_STATE.UNSTARTED)
  }, [])

  const seekTo = useCallback((seconds) => {
    if (onSeekRef.current) onSeekRef.current(seconds)
    if (playerRef.current) {
      playerRef.current.seekTo(seconds, true)
      playerRef.current.playVideo()
    }
  }, [])

  const getCurrentTime = useCallback(() => {
    if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
      return playerRef.current.getCurrentTime()
    }
    return 0
  }, [])

  const playVideo = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.playVideo()
    }
  }, [])

  const pauseVideo = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.pauseVideo()
    }
  }, [])

  const setOnSeek = useCallback((fn) => {
    onSeekRef.current = fn
  }, [])

  return (
    <YouTubePlayerContext.Provider value={{ registerPlayer, unregisterPlayer, seekTo, isReady, playerState, setPlayerState, getCurrentTime, playVideo, pauseVideo, setOnSeek }}>
      {children}
    </YouTubePlayerContext.Provider>
  )
}

export function useYouTubePlayer() {
  return useContext(YouTubePlayerContext)
}
