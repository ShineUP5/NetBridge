import { useState } from 'react'
import { Button } from '../Button'
import { FormField } from '../FormField'

export function ConnectCodeForm({ onSubmit, loading, disabled }) {
  const [code, setCode] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    await onSubmit(code.trim().toUpperCase())
  }

  return (
    <section className="panel dependant-panel">
      <div className="panel-head">
        <h2>Enter code</h2>
      </div>
      <p className="lead">Type the invite code from your friend.</p>
      <form className="stack dependant-form" onSubmit={handleSubmit}>
        <FormField
          className="invite-code-field"
          label="Invite code"
          required
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          placeholder="ABC123"
          maxLength={8}
          inputMode="text"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
        />
        <Button
          type="submit"
          className="dependant-submit"
          disabled={disabled || loading || !code.trim()}
        >
          {loading ? 'Sending…' : 'Ask to join'}
        </Button>
      </form>
    </section>
  )
}
