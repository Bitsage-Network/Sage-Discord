export interface Condition {
  id?: number
  rule_id?: number
  condition_type: string
  condition_data: any
  negate: boolean
  position: number
  label?: string
}

export interface Role {
  role_id: string
  role_name: string
  auto_assign: boolean
}

export interface RuleGroup {
  id: number
  parent_group_id: number | null
  logic_operator: "AND" | "OR" | "NOT"
  name: string
  description: string
  position: number
  conditions: Condition[]
  roles: Role[]
  children?: RuleGroup[]
}
