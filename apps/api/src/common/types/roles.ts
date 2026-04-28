export enum HouseholdRole {
  HOST = 'HOST',
  ADMIN = 'ADMIN',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
}

export enum PlanTier {
  FREE = 'FREE',
  PRO = 'PRO',
}

export enum DocumentCategory {
  IDENTIDADE = 'IDENTIDADE',
  SAUDE = 'SAUDE',
  ESCOLA = 'ESCOLA',
  FINANCEIRO = 'FINANCEIRO',
  IMOVEL = 'IMOVEL',
  OUTROS = 'OUTROS',
}

export enum EventCategory {
  CASA = 'CASA',
  SAUDE = 'SAUDE',
  ESCOLA = 'ESCOLA',
  FINANCEIRO = 'FINANCEIRO',
  PESSOAL = 'PESSOAL',
  OUTROS = 'OUTROS',
}

export enum EventRecurrence {
  NONE = 'NONE',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}
