/**
 * 通知：列表、全部已读
 */
import { Router } from 'express'
import { store } from '../store.js'
import { ok } from '../utils/http.js'

const router = Router()

router.get('/', (req, res) => {
  ok(res, { list: store.list('notifications').reverse().slice(0, 30) })
})

router.post('/read-all', (req, res) => {
  for (const n of store.list('notifications', (n) => !n.read)) n.read = true
  store.save()
  ok(res, { ok: true })
})

export default router
