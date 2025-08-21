import React from 'react'
import { createRoot } from 'react-dom/client'
import PopupProviders from '@/components/popup/PopupProviders'
import PopupView from '@/components/popup/PopupView'

const container = document.getElementById('root')!
createRoot(container).render(
  <PopupProviders>
    <PopupView />
  </PopupProviders>
)


