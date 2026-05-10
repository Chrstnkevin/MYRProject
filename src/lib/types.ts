export interface KanbanTask {
  id: string
  title: string
  description?: string
  status: 'todo' | 'inprogress' | 'done' | 'blocked'
  priority: 'low' | 'medium' | 'high' | 'critical'
  date: string
  tags?: string[]
  due_date?: string
  order_index: number
  created_at: string
  updated_at: string
}

export interface FinanceTransaction {
  id: string
  date: string
  type: 'income' | 'expense'
  category: string
  description: string
  amount: number
  created_at: string
}

export interface Notulensi {
  id: string
  title: string
  date: string
  location?: string
  attendees?: string[]
  agenda?: string
  notes?: string
  action_items?: ActionItem[]
  tags?: string[]
  created_at: string
  updated_at: string
}

export interface ActionItem {
  id: string
  text: string
  pic?: string
  deadline?: string
  done: boolean
}

export interface UserFlow {
  id: string
  title: string
  description?: string
  content?: string
  thumbnail?: string
  tags?: string[]
  created_at: string
  updated_at: string
}

// ── Landing Page Types ────────────────────────────────────────

export interface TutorialStep {
  id: string
  title: string
  desc: string
  imageUrl: string
}

export interface TutorialImprovement {
  id: string
  name: string
  pic: string
  steps: TutorialStep[]
}

export interface LandingTutorial {
  id: string
  app_id: string
  app_name: string
  emoji: string
  improvements: TutorialImprovement[]
  updated_at: string
}

export interface LandingInfographic {
  id: string
  title: string
  tag: string
  description: string
  image_url: string
  order_index: number
  pic: string
  created_at: string
  updated_at: string
}

export interface SharingZoom {
  id: string
  title: string
  tanggal: string
  pic: string
  screenshots: string[]
  created_at: string
  updated_at: string
}