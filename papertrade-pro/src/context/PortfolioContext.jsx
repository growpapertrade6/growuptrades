import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from './AuthContext'

const PortfolioContext = createContext(null)

export function PortfolioProvider({ children }) {
  const { user, profile, refreshProfile } = useAuth()
  const [positions, setPositions] = useState([])
  const [optionPositions, setOptionPositions] = useState([])
  const [orders, setOrders] = useState([])
  const [watchlist, setWatchlist] = useState([])
  const [loaded, setLoaded] = useState(false)

  const loadAll = useCallback(async () => {
    if (!user) return
    const [p, op, o, w] = await Promise.all([
      supabase.from('positions').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('option_positions').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('watchlist').select('*').eq('user_id', user.id).order('created_at'),
    ])
    setPositions(p.data ?? [])
    setOptionPositions(op.data ?? [])
    setOrders(o.data ?? [])
    setWatchlist((w.data ?? []).map(r => r.symbol))
    setLoaded(true)
  }, [user])

  useEffect(() => {
    if (user) loadAll()
    else {
      setPositions([]); setOptionPositions([]); setOrders([]); setWatchlist([]); setLoaded(false)
    }
  }, [user, loadAll])

  async function updateCash(delta) {
    if (!profile) return
    const newCash = profile.cash + delta
    await supabase.from('profiles').update({ cash: newCash }).eq('id', user.id)
    await refreshProfile()
  }

  async function recordOrder(order) {
    const { data, error } = await supabase.from('orders').insert([{ ...order, user_id: user.id }]).select().single()
    if (!error) setOrders(prev => [data, ...prev])
    return data
  }

  async function upsertPosition(pos) {
    const existing = pos.id && positions.find(p => p.id === pos.id)
    if (existing) {
      await supabase.from('positions').update(pos).eq('id', pos.id)
      setPositions(prev => prev.map(p => (p.id === pos.id ? { ...p, ...pos } : p)))
      return { ...existing, ...pos }
    }
    const { data } = await supabase.from('positions').insert([{ ...pos, user_id: user.id }]).select().single()
    setPositions(prev => [...prev, data])
    return data
  }

  async function removePosition(id) {
    await supabase.from('positions').delete().eq('id', id)
    setPositions(prev => prev.filter(p => p.id !== id))
  }

  async function upsertOptionPosition(pos) {
    const existing = pos.id && optionPositions.find(p => p.id === pos.id)
    if (existing) {
      await supabase.from('option_positions').update(pos).eq('id', pos.id)
      setOptionPositions(prev => prev.map(p => (p.id === pos.id ? { ...p, ...pos } : p)))
      return { ...existing, ...pos }
    }
    const { data } = await supabase.from('option_positions').insert([{ ...pos, user_id: user.id }]).select().single()
    setOptionPositions(prev => [...prev, data])
    return data
  }

  async function removeOptionPosition(id) {
    await supabase.from('option_positions').delete().eq('id', id)
    setOptionPositions(prev => prev.filter(p => p.id !== id))
  }

  async function addToWatchlist(symbol) {
    if (watchlist.includes(symbol)) return
    await supabase.from('watchlist').insert([{ user_id: user.id, symbol }])
    setWatchlist(prev => [...prev, symbol])
  }

  async function removeFromWatchlist(symbol) {
    await supabase.from('watchlist').delete().eq('user_id', user.id).eq('symbol', symbol)
    setWatchlist(prev => prev.filter(s => s !== symbol))
  }

  async function resetAccount() {
    await Promise.all([
      supabase.from('positions').delete().eq('user_id', user.id),
      supabase.from('option_positions').delete().eq('user_id', user.id),
      supabase.from('orders').delete().eq('user_id', user.id),
    ])
    await supabase.from('profiles').update({ cash: profile.starting_cash }).eq('id', user.id)
    setPositions([]); setOptionPositions([]); setOrders([])
    await refreshProfile()
  }

  return (
    <PortfolioContext.Provider value={{
      positions, optionPositions, orders, watchlist, loaded,
      updateCash, recordOrder, upsertPosition, removePosition,
      upsertOptionPosition, removeOptionPosition,
      addToWatchlist, removeFromWatchlist, resetAccount, reload: loadAll,
    }}>
      {children}
    </PortfolioContext.Provider>
  )
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext)
  if (!ctx) throw new Error('usePortfolio must be used within PortfolioProvider')
  return ctx
}
