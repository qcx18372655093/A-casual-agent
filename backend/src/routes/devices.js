/**
 * 设备面板（工作上下文，演示连接器数据）
 */
import { Router } from 'express'
import { store, audit } from '../store.js'
import { ok, notFound, actor } from '../utils/http.js'

const router = Router()

router.get('/', (req, res) => {
  ok(res, { list: store.list('demoDevices'), demo: true })
})

router.post('/:id/toggle', (req, res) => {
  const d = store.get('demoDevices', req.params.id)
  if (!d) return notFound(res, '设备不存在')
  const on = !!(req.body || {}).on
  store.update('demoDevices', d.id, {
    status: on ? 'online' : 'offline',
    config: { ...(d.config || {}), power: on },
  })
  audit(actor(req), 'device.toggle', 'device', d.id, `${on ? '开启' : '关闭'}设备「${d.name}」（演示连接器）`)
  ok(res, { device: store.get('demoDevices', d.id), demo: true })
})

export default router
