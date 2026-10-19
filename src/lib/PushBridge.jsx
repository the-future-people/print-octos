// src/lib/PushBridge.jsx
//
// Connects the phone to Print Octos notifications.
//
// Once someone is signed in, the app asks permission to notify them (the
// phone's own question, asked once), registers for push, and gives the
// server this phone's address. Tapping a notification opens its order;
// one arriving while the app is open refreshes the bell.
//
// Only on a real phone. The plugin is imported directly, never returned
// from an async function (a Capacitor plugin answers `then` and breaks
// the promise; see lessons).

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { PushNotifications } from '@capacitor/push-notifications'
import { accountDevice } from '../api/client'
import { useAccount } from './AccountContext.jsx'

const onPhone = () => !!window.Capacitor?.isNativePlatform?.()

export default function PushBridge() {
  const { account } = useAccount()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!onPhone() || !account) return undefined
    const subs = []
    let live = true

    ;(async () => {
      subs.push(await PushNotifications.addListener('registration', ({ value }) => {
        const platform = window.Capacitor?.getPlatform?.() || ''
        accountDevice(value, platform).catch(() => { /* tried again next start */ })
      }))
      subs.push(await PushNotifications.addListener('pushNotificationReceived', () => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] })
        queryClient.invalidateQueries({ queryKey: ['my-orders'] })
      }))
      subs.push(await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
        const { order, token } = notification?.data || {}
        queryClient.invalidateQueries({ queryKey: ['notifications'] })
        if (order && token) navigate(`/track/${order}?t=${token}`)
        else navigate('/notifications')
      }))

      let { receive } = await PushNotifications.checkPermissions()
      if (receive === 'prompt' || receive === 'prompt-with-rationale') {
        receive = (await PushNotifications.requestPermissions()).receive
      }
      if (live && receive === 'granted') await PushNotifications.register()
    })().catch(() => { /* no push on this phone: SMS still reaches them */ })

    return () => { live = false; subs.forEach(s => s.remove()) }
  }, [account, navigate, queryClient])

  return null
}