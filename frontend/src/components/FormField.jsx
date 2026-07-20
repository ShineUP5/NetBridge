export function FormField({
  label,
  type = 'text',
  value,
  onChange,
  required = false,
  minLength,
  placeholder,
  className = '',
  inputMode,
  autoCapitalize,
  autoCorrect,
  spellCheck,
  maxLength,
  pattern,
}) {
  return (
    <label className={className ? `field ${className}` : 'field'}>
      {label}
      <input
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        placeholder={placeholder}
        inputMode={inputMode}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        spellCheck={spellCheck}
        pattern={pattern}
      />
    </label>
  )
}
