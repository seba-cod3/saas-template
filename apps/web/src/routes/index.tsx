import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: RouteComponent,
})

const HEALT_API_URL = `${import.meta.env.VITE_API_URL}/health`

function RouteComponent() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['health'],
    queryFn: () =>
      fetch(HEALT_API_URL).then((res) => res.json()),
  })

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div>
      <h1>SaaS Template</h1>
      <p>Server status: {data?.status}</p>
      <p>Server time: {data?.timestamp}</p>
    </div>
  )
}