import { createFileRoute } from '@tanstack/react-router'
import { RefinePage } from '@/features/refine/refine-page'

export const Route = createFileRoute('/refine')({
  component: RefinePage,
})
