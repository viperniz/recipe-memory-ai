import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function ProfilePage() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate('/app', { replace: true })
  }, [navigate])

  return null
}

export default ProfilePage
