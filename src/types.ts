export type Category = {
  id: string
  name: string
  monthly_budget: number | null
}

export type Expense = {
  id: string
  category_id: string
  spent_on: string // YYYY-MM-DD
  amount: number
  note: string | null
}
