import { RouterProvider } from 'react-router-dom'
import { router } from './app/router'
import { DevEnvBanner } from './app/DevEnvBanner'

export default function App() {
  return (
    <>
      <DevEnvBanner />
      <RouterProvider router={router} />
    </>
  )
}
