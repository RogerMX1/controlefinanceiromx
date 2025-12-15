import { useState } from 'react'
import Dashboard from './Dashboard'

export default function App() {
  // Aqui a gente CRIA um usuário falso na marra, só para o app funcionar
  const sessionFake = {
    user: {
      id: 'usuario-teste-123', // Um ID fixo para salvar seus dados
      email: 'voce@teste.com'
    }
  }

  // Retorna direto o Dashboard, sem pedir login
  return <Dashboard session={sessionFake} />
}