export interface User {
  id: number;
  name: string;
  role: 'attendant' | 'supervisor';
  created_at: Date;
}