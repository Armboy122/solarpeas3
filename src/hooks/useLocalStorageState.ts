import { useEffect, useState } from 'react'

export function useLocalStorageState<T>(
  storageKey: string,
  createInitialState: () => T,
) {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return createInitialState()
    }

    const storedValue = window.localStorage.getItem(storageKey)

    if (!storedValue) {
      return createInitialState()
    }

    try {
      return JSON.parse(storedValue) as T
    } catch {
      return createInitialState()
    }
  })

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(state))
  }, [state, storageKey])

  const resetState = (nextState?: T) => {
    const value = nextState ?? createInitialState()
    setState(value)
    window.localStorage.setItem(storageKey, JSON.stringify(value))
  }

  return [state, setState, resetState] as const
}
