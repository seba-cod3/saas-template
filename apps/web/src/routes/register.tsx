import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { authClient } from '../lib/auth-client'

export const Route = createFileRoute('/register')({
  component: RegisterPage,
})

function RegisterPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRegister() {
    setError('')
    setLoading(true)

    const { error } = await authClient.signUp.email({
      name,
      email,
      password,
    })

    setLoading(false)

    if (error) {
      setError(error.message ?? 'Registration failed')
      return
    }

    navigate({ to: '/' })
  }

  return (
    <div>
      <h1>Register</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <input
        type="text"
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button onClick={handleRegister} disabled={loading}>
        {loading ? 'Registering...' : 'Register'}
      </button>
    </div>
  )
}